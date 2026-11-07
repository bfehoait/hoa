"""Offline workbook validation. No database/network access; no formula execution.

Default: print aggregate results only. --output-sql requires the ignored,
dev-server-denied .private-imports directory. Generated SQL contains private data.
"""
import argparse
import collections
import datetime
import decimal
import hashlib
import json
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET
import zipfile

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
LOT_HEADERS = [
    "Physical Lot ID", "Phase", "Block", "Lot", "Admin Masterlist?",
    "Agency Receipts?", "Admin Unit ID(s)", "Admin Homeowner Name(s)",
    "Admin Status(es)", " Admin Remarks", "Admin HOA Start", "Linear Park",
    "Admin Proposed Rate PHP", "Agency Account Series (all)",
    "Agency Homeowner / Payer (all)", "Agency Account Variant",
    "Owner Name Comparison", "Admin Duplicate Rows", "Agency Receipt Transactions",
    "Jan Receipts", "Feb Receipts", "Mar Receipts", "Apr Receipts", "May Receipts",
    "Jun Receipts", "Jul Receipts", "Aug Receipts", "Sep Receipts", "YTD Collections",
    "Paid Months", "HOA Eligibility (provisional)", "Eligibility Admin Decision",
    "Verified Monthly Rate", "Billing Start Verified", "Difference / Review Notes",
    "Masterlist Update Needed?", "Review Priority", "Gov Role",
    "Indicative Jan-Sep Dues", "Indicative Difference", "Collections Comment", "BOD/Officer",
]
PAY_HEADERS = ["Receipt Month", "Agency Account Series", "Agency Payer", "OR Date",
               "OR No.", "Amount PHP", "Normalized Physical Lot", "Source File"]


class InvalidWorkbook(ValueError):
    pass


def money(value):
    try:
        amount = decimal.Decimal(str(value)) * 100
        # Excel's binary numeric cache can contain sub-millionth-cent noise.
        # Reject actual fractional cents; round only this representation noise.
        if not amount.is_finite() or abs(amount - amount.to_integral_value()) > decimal.Decimal('0.000001'):
            raise ValueError()
        return int(amount.to_integral_value())
    except (ValueError, decimal.InvalidOperation):
        raise InvalidWorkbook("Invalid amount or fractional centavo.") from None


def text(value):
    return "" if value is None else str(value).strip()


def read_workbook(path):
    """Read all sheet cells, including cached formulas, without loading app code."""
    if Path(path).suffix.lower() != ".xlsx":
        raise InvalidWorkbook("Use an XLSX workbook.")
    with zipfile.ZipFile(path) as archive:
        if sum(x.file_size for x in archive.infolist()) > 100_000_000:
            raise InvalidWorkbook("Workbook expands beyond the supported size.")
        strings = []
        if "xl/sharedStrings.xml" in archive.namelist():
            strings = ["".join(x.itertext()) for x in ET.fromstring(archive.read("xl/sharedStrings.xml")).findall("m:si", NS)]
        rels = {x.attrib["Id"]: x.attrib["Target"] for x in ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))}
        result = {}
        for sheet in ET.fromstring(archive.read("xl/workbook.xml")).findall("m:sheets/m:sheet", NS):
            name = sheet.attrib["name"]
            target = rels[sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]]
            target = target.lstrip("/") if target.startswith("/") else "xl/" + target
            data = []
            for row in ET.fromstring(archive.read(target)).findall("m:sheetData/m:row", NS):
                cells = {}
                for cell in row.findall("m:c", NS):
                    column = 0
                    for char in re.match(r"[A-Z]+", cell.attrib["r"])[0]:
                        column = column * 26 + ord(char) - 64
                    value = cell.find("m:v", NS)
                    kind = cell.attrib.get("t")
                    if kind == "e":
                        raise InvalidWorkbook("Workbook contains an Excel error cell.")
                    raw = value.text if value is not None else None
                    if kind == "s":
                        raw = strings[int(raw)]
                    elif kind == "inlineStr":
                        raw = "".join(cell.find("m:is", NS).itertext())
                    elif raw is not None and kind not in ("str", "d"):
                        number = decimal.Decimal(raw)
                        raw = int(number) if number == number.to_integral_value() else str(number)
                    cells[column - 1] = raw
                data.append((int(row.attrib["r"]), cells))
            result[name] = data
        if set(result) != {"LOT Register", "Payments"}:
            raise InvalidWorkbook("Unexpected worksheets; review the workbook version.")
        records = {}
        for name, headers in [("LOT Register", LOT_HEADERS), ("Payments", PAY_HEADERS)]:
            rows = result[name]
            if not rows or [rows[0][1].get(i) for i in range(len(headers))] != headers:
                raise InvalidWorkbook("Worksheet headers do not match the assessed version.")
            if any(any(i >= len(headers) and text(v) for i, v in cells.items()) for _, cells in rows):
                raise InvalidWorkbook("Unexpected populated columns.")
            records[name] = [(index, {key: cells.get(i) for i, key in enumerate(headers)})
                             for index, cells in rows[1:] if any(text(v) for v in cells.values())]
        return records


def validate(records, expected=None):
    lots, receipts, seen, references = [], [], set(), set()
    amounts, months, counts = collections.Counter(), collections.Counter(), collections.Counter()
    phases = collections.Counter()
    for row, fields in records["LOT Register"]:
        try:
            identity = text(fields["Physical Lot ID"])
            phase, block, lot = (int(fields[key]) for key in ["Phase", "Block", "Lot"])
            if not re.fullmatch(r'[1-9][0-9]*-[0-9]{2}-[0-9]{3}', identity) or identity != f"{phase}-{block:02d}-{lot:03d}" or min(phase, block, lot) <= 0 or identity in seen:
                raise ValueError()
            if fields["Review Priority"] not in ("LOW", "MEDIUM", "HIGH") or not text(fields["Admin Unit ID(s)"]):
                raise ValueError()
            seen.add(identity)
            phases[phase] += 1
            lots.append({"physical_id": identity, "phase": phase, "block": block, "lot": lot,
                         "admin_unit": text(fields["Admin Unit ID(s)"]),
                         "recorded_homeowner": text(fields["Admin Homeowner Name(s)"]),
                         "registry_status": text(fields["Admin Status(es)"]),
                         "review_priority": fields["Review Priority"], "source_row": row, "fields": fields})
        except (ValueError, TypeError):
            raise InvalidWorkbook(f"Invalid or duplicate lot at worksheet row {row}.") from None
    for row, fields in records["Payments"]:
        try:
            date = datetime.date.fromisoformat(text(fields["OR Date"]))
            identity, ref = text(fields["Normalized Physical Lot"]), text(fields["OR No."])
            amount = money(fields["Amount PHP"])
            if identity not in seen or not ref or ref in references or amount <= 0 or amount > 9007199254740991:
                raise ValueError()
            if text(fields["Receipt Month"]).lower()[:3] != date.strftime("%b").lower():
                raise ValueError()
            if any(not text(fields[k]) for k in PAY_HEADERS):
                raise ValueError()
            references.add(ref)
            amounts[identity] += amount
            months[(identity, date.strftime("%Y-%m"))] += amount
            counts[identity] += 1
            receipts.append({"physical_id": identity, "or_number": ref, "receipt_date": date.isoformat(),
                             "amount_centavos": amount, "account_series": text(fields["Agency Account Series"]),
                             "payer": text(fields["Agency Payer"]), "source_file": text(fields["Source File"]), "source_row": row})
        except (ValueError, TypeError):
            raise InvalidWorkbook(f"Invalid or duplicate receipt at worksheet row {row}.") from None
    for lot in lots:
        fields, identity = lot["fields"], lot["physical_id"]
        if money(fields["YTD Collections"]) != amounts[identity] or fields["Agency Receipt Transactions"] != counts[identity]:
            raise InvalidWorkbook("Lot totals or receipt counts do not reconcile.")
        for month, key in enumerate(LOT_HEADERS[19:28], 1):
            if money(fields[key]) != months[(identity, f"2026-{month:02d}")]:
                raise InvalidWorkbook("Monthly totals do not reconcile.")
        if fields["Paid Months"] != sum(money(fields[k]) > 0 for k in LOT_HEADERS[19:28]):
            raise InvalidWorkbook("Receipt-month count does not reconcile.")
    total = sum(r["amount_centavos"] for r in receipts)
    summary = {"lots": len(lots), "receipts": len(receipts), "total_centavos": total,
               "phases": dict(sorted(phases.items())), "lots_with_receipts": len(amounts),
               "accounts_created": 0, "ownership_links_created": 0}
    if expected and (len(lots), len(receipts), total) != expected:
        raise InvalidWorkbook("Counts or amount differ from the assessed master workbook; review the new version first.")
    if expected and (dict(phases) != {1: 669, 2: 198, 3: 54} or len(amounts) != 637
                     or min(r['receipt_date'] for r in receipts) != '2026-01-01'
                     or max(r['receipt_date'] for r in receipts) != '2026-09-30'):
        raise InvalidWorkbook("Phase, linked-lot or date coverage differs from the assessed workbook.")
    return lots, receipts, summary


def sql_literal(value):
    return "'" + value.replace("'", "''") + "'"


def split_sql(lots, receipts, checksum, source):
    """Three owner-only editor uploads; finalization reuses the atomic importer."""
    schema = 'bfe_upload_' + checksum[:16]
    chunks = [{"lots": [], "receipts": []} for _ in range(3)]
    sizes = [0, 0, 0]
    for key, rows in [("lots", lots), ("receipts", receipts)]:
        for row in rows:
            index = min(range(3), key=lambda i: sizes[i])
            chunks[index][key].append(row)
            sizes[index] += len(json.dumps(row, ensure_ascii=True, separators=(',', ':')))
    payloads = [json.dumps(c, ensure_ascii=True, separators=(',', ':')) for c in chunks]
    hashes = [hashlib.md5(p.encode('utf-8')).hexdigest() for p in payloads]
    guard = """DO $$ BEGIN
 IF current_user <> 'postgres' OR auth.uid() IS NOT NULL THEN
 RAISE EXCEPTION 'Run in SQL Editor as postgres.'; END IF;
END $$;
"""
    setup = f"""CREATE SCHEMA IF NOT EXISTS {schema};
REVOKE ALL ON SCHEMA {schema} FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE IF NOT EXISTS {schema}.chunks(part integer PRIMARY KEY CHECK(part BETWEEN 1 AND 3),payload text NOT NULL);
ALTER TABLE {schema}.chunks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON {schema}.chunks FROM PUBLIC,anon,authenticated,service_role;
"""
    expected_hashes = ','.join(f"({i+1},{sql_literal(h)})" for i, h in enumerate(hashes))
    finish = f"""DO $$
DECLARE lots jsonb; receipts jsonb; bid uuid;
BEGIN
 IF (SELECT count(*) FROM {schema}.chunks) <> 3 OR EXISTS(
 SELECT 1 FROM (VALUES {expected_hashes}) AS e(part,digest)
 LEFT JOIN {schema}.chunks c USING(part) WHERE c.payload IS NULL OR md5(c.payload) <> e.digest
 ) THEN RAISE EXCEPTION 'Upload incomplete or changed. Run all three original parts in order.'; END IF;
 SELECT coalesce(jsonb_agg(x ORDER BY (x->>'source_row')::integer),'[]'::jsonb) INTO lots
 FROM {schema}.chunks c CROSS JOIN LATERAL jsonb_array_elements(c.payload::jsonb->'lots') x;
 SELECT coalesce(jsonb_agg(x ORDER BY (x->>'source_row')::integer),'[]'::jsonb) INTO receipts
 FROM {schema}.chunks c CROSS JOIN LATERAL jsonb_array_elements(c.payload::jsonb->'receipts') x;
 IF jsonb_array_length(lots) <> {len(lots)} OR jsonb_array_length(receipts) <> {len(receipts)}
 OR (SELECT coalesce(sum((x->>'amount_centavos')::bigint),0) FROM jsonb_array_elements(receipts) x) <> {sum(r['amount_centavos'] for r in receipts)}
 THEN RAISE EXCEPTION 'Upload totals do not reconcile.'; END IF;
 bid := public.bfe_import_registry({sql_literal(checksum)},{sql_literal(source)},lots,receipts);
 RAISE NOTICE 'Import completed. Batch: %',bid;
END $$;
DROP TABLE {schema}.chunks;
DROP SCHEMA {schema};
"""
    result = []
    for index, payload in enumerate(payloads):
        sql = ('-- PRIVATE DATA: authorized owner execution only. Never commit or publish.\n'
               f'-- Part {index+1} of 3. Run complete files in order as postgres.\n'
               "BEGIN;\nSET LOCAL standard_conforming_strings=on;\nSET LOCAL statement_timeout='120s';\n" + guard)
        if index == 0:
            sql += setup
        sql += (f"INSERT INTO {schema}.chunks(part,payload) VALUES({index+1},{sql_literal(payload)}) "
                "ON CONFLICT(part) DO UPDATE SET payload=excluded.payload;\n")
        if index == 2:
            sql += finish
        sql += 'COMMIT;\n'
        if index == 2:
            sql += ("SELECT lot_count,receipt_count,total_centavos,status FROM public.bfe_import_batches WHERE checksum="
                    + sql_literal(checksum) + ';\n')
        if len(sql.encode('utf-8')) >= 950_000:
            raise InvalidWorkbook('A split part is still too large; review upload sizing.')
        result.append(sql)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workbook", type=Path)
    parser.add_argument("--output-sql", type=Path)
    parser.add_argument("--output-sql-parts", type=Path)
    args = parser.parse_args()
    try:
        lots, receipts, summary = validate(read_workbook(args.workbook), (921, 4314, 566005850))
        checksum = hashlib.sha256(args.workbook.read_bytes()).hexdigest()
        summary["checksum"] = checksum
        if args.output_sql_parts:
            root = (Path(__file__).resolve().parents[1] / '.private-imports').resolve()
            output = args.output_sql_parts.resolve()
            if root not in output.parents or output.exists():
                raise InvalidWorkbook('Split output must be a new directory inside .private-imports.')
            parts = split_sql(lots, receipts, checksum, args.workbook.name)
            output.mkdir(parents=True)
            for index, part in enumerate(parts, 1):
                (output / f'lot-register-part-{index}.sql').write_text(part, encoding='utf-8')
            summary['private_sql_parts_bytes'] = [len(p.encode('utf-8')) for p in parts]
        if args.output_sql:
            root = Path(__file__).resolve().parents[1] / ".private-imports"
            output = args.output_sql.resolve()
            if root.resolve() not in output.parents or output.suffix != ".sql":
                raise InvalidWorkbook("SQL output must be inside .private-imports with a .sql extension.")
            output.parent.mkdir(parents=True, exist_ok=True)
            statement = "-- PRIVATE DATA: owner execution in isolated staging only. Never commit or publish.\nBEGIN;\nSET LOCAL standard_conforming_strings=on;\nSET LOCAL statement_timeout='120s';\nSELECT public.bfe_import_registry(" + ",".join([
                sql_literal(checksum), sql_literal(args.workbook.name),
                sql_literal(json.dumps(lots, ensure_ascii=True)) + "::jsonb",
                sql_literal(json.dumps(receipts, ensure_ascii=True)) + "::jsonb",
            ]) + ");\nCOMMIT;\n"
            with output.open("x", encoding="utf-8") as handle:
                handle.write(statement)
            summary["private_sql_created"] = True
        print(json.dumps(summary, indent=2))
    except InvalidWorkbook as error:
        print(str(error) + " No database was contacted.", file=sys.stderr)
        return 1
    except (OSError, KeyError, zipfile.BadZipFile, ET.ParseError):
        # Avoid echoing paths, resident values or full SQL in command logs.
        print("Validation failed or output already exists. No database was contacted. Review workbook structure and aggregate reconciliation.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
