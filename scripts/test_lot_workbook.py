"""Synthetic tests only. Run: python -m unittest discover -s scripts -p test_lot_workbook.py"""
import copy
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("lot_import", Path(__file__).with_name("assess-lot-workbook.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def fixture():
    row = dict.fromkeys(module.LOT_HEADERS)
    row.update({"Physical Lot ID": "1-01-001", "Phase": 1, "Block": 1, "Lot": 1,
                "Admin Unit ID(s)": "SYNTHETIC-001", "Admin Homeowner Name(s)": "Sample owner",
                "Admin Status(es)": "Synthetic", "Review Priority": "MEDIUM",
                "YTD Collections": "900.00", "Agency Receipt Transactions": 1, "Paid Months": 1})
    for key in module.LOT_HEADERS[19:28]:
        row[key] = "900.00" if key == "Jan Receipts" else 0
    payment = dict(zip(module.PAY_HEADERS, ["Jan", "SYNTHETIC-ACCOUNT", "Sample payer",
                       "2026-01-02", "00001", "900.00", "1-01-001", "synthetic.xlsx"]))
    return {"LOT Register": [(2, row)], "Payments": [(2, payment)]}


class ImportTests(unittest.TestCase):
    def test_preserves_references_and_all_source_fields(self):
        lots, receipts, summary = module.validate(fixture())
        self.assertEqual(receipts[0]["or_number"], "00001")
        self.assertEqual(len(lots[0]["fields"]), 42)
        self.assertEqual(summary["total_centavos"], 90000)
        self.assertEqual(summary["accounts_created"], 0)

    def test_rejects_unmatched_payment(self):
        data = fixture()
        data["Payments"][0][1]["Normalized Physical Lot"] = "2-01-001"
        with self.assertRaises(module.InvalidWorkbook):
            module.validate(data)

    def test_rejects_duplicates(self):
        for sheet in ["Payments", "LOT Register"]:
            data = fixture()
            data[sheet].append(copy.deepcopy(data[sheet][0]))
            with self.assertRaises(module.InvalidWorkbook):
                module.validate(data)

    def test_rejects_changed_totals(self):
        data = fixture()
        data["LOT Register"][0][1]["YTD Collections"] = 800
        with self.assertRaises(module.InvalidWorkbook):
            module.validate(data)

    def test_rejects_wrong_month_invalid_date_and_fractional_cents(self):
        for key, value in [("Receipt Month", "Feb"), ("OR Date", "2026-02-30"), ("Amount PHP", "900.001")]:
            data = fixture()
            data["Payments"][0][1][key] = value
            with self.assertRaises(module.InvalidWorkbook):
                module.validate(data)

    def test_rounds_excel_representation_noise_only(self):
        self.assertEqual(module.money("900.0000000001"), 90000)
        for value in ["NaN", "Infinity", "900.001"]:
            with self.assertRaises(module.InvalidWorkbook):
                module.money(value)

    def test_quotes_private_sql_values(self):
        self.assertEqual(module.sql_literal("Sample O'Name"), "'Sample O''Name'")

    def test_baseline_must_match(self):
        with self.assertRaises(module.InvalidWorkbook):
            module.validate(fixture(), (921, 4314, 566005850))


if __name__ == "__main__":
    unittest.main()
