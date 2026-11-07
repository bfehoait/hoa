import { useState } from "react";
import { Link } from "../../components/AccessLink";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  FileSpreadsheet,
  Wallet,
} from "lucide-react";
import { billingEstimate } from "../../../../../packages/shared/src/baseline";
import {
  importTemplates,
  parseSampleCsv,
  validateImport,
  type ImportKind,
} from "../../../../../packages/shared/src/imports";
import { money } from "../../../../../packages/shared/src";
import { useWorkspaceAction, workspaceRepository } from "../../data/workspace";
import { downloadCsv } from "../../data/download";
import { Button, Feedback, Field, PageIntro } from "../../components/UI";
import { ProgressTimeline, WorkspaceNote } from "../../components/WorkspaceUI";
import styles from "./FeatureBaseline.module.css";

export function BaselineImports() {
  const [kind, setKind] = useState<ImportKind>("units");
  const [text, setText] = useState("");
  const [csv, setCsv] = useState<ReturnType<typeof parseSampleCsv> | null>(
    null,
  );
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<Error | null>(null);
  const [checked, setChecked] = useState<ReturnType<
    typeof validateImport
  > | null>(null);
  const [result, setResult] = useState<{ count: number; batch: string } | null>(
    null,
  );
  const mutation = useWorkspaceAction(workspaceRepository.importDrafts);
  const template = importTemplates[kind];
  function clearReview() {
    setCsv(null);
    setChecked(null);
    setResult(null);
    setFailure(null);
    mutation.reset();
  }
  function parse() {
    try {
      setFailure(null);
      setChecked(null);
      setResult(null);
      const value = parseSampleCsv(text);
      setCsv(value);
      setMapping(
        Object.fromEntries(
          template.columns.map((column) => [
            column,
            value.headers.includes(column) ? column : "",
          ]),
        ),
      );
    } catch (error) {
      setCsv(null);
      setFailure(
        error instanceof Error
          ? error
          : new Error("Could not read the sample CSV."),
      );
    }
  }
  function validate() {
    try {
      setFailure(null);
      setChecked(validateImport(kind, csv!, mapping));
    } catch (error) {
      setChecked(null);
      setFailure(
        error instanceof Error
          ? error
          : new Error("Could not validate the sample rows."),
      );
    }
  }
  const valid = checked && checked.every((row) => !row.errors.length);
  return (
    <>
      <Link className="text-link back-link" to="/explore">
        <ArrowLeft size={20} /> Feature baseline
      </Link>
      <PageIntro
        eyebrow="SYNTHETIC CSV · REVIEW BEFORE STAGING"
        title="Bring structure to sample data."
        description="Use invented units and evidence only. Map columns, correct errors and stage a batch of local drafts."
      />
      <div className={styles.steps}>
        {[
          "1. Read sample CSV",
          "2. Map and validate",
          "3. Stage local drafts",
        ].map((label) => (
          <div className={styles.step} key={label}>
            <FileSpreadsheet size={24} />
            <p>{label}</p>
          </div>
        ))}
      </div>
      <div className="two-column">
        <section className="panel">
          <Field label="Sample import type">
            <select
              id="import-type"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as ImportKind);
                setText("");
                clearReview();
              }}
            >
              {Object.entries(importTemplates).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.title}
                </option>
              ))}
            </select>
          </Field>
          <div className="form-actions">
            <Button
              secondary
              onClick={() => {
                setText(
                  [template.columns.join(","), template.example.join(",")].join(
                    "\n",
                  ),
                );
                clearReview();
              }}
            >
              Use synthetic example CSV
            </Button>
            <Button
              secondary
              onClick={() =>
                downloadCsv(`SAMPLE-${kind}-template.csv`, [
                  [...template.columns],
                  [...template.example],
                ])
              }
            >
              <Download size={20} /> Download template
            </Button>
          </div>
          <Field label="Sample CSV text (maximum 100 KB, 100 rows)">
            <textarea
              id="sample-csv"
              value={text}
              maxLength={100000}
              rows={7}
              onChange={(e) => {
                setText(e.target.value);
                clearReview();
              }}
            />
          </Field>
          <Field label="Or choose a synthetic CSV file">
            <input
              id="sample-csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                clearReview();
                if (!file) return;
                if (file.size > 100000) {
                  setFailure(
                    new Error("Use a sample CSV smaller than 100 KB."),
                  );
                  return;
                }
                try {
                  setText(await file.text());
                } catch {
                  setFailure(
                    new Error(
                      "File reading failed. Paste the sample CSV instead.",
                    ),
                  );
                }
                e.target.value = "";
              }}
            />
          </Field>
          <Button onClick={parse}>Read sample CSV</Button>
          {csv && (
            <div style={{ marginTop: 24 }}>
              <h2>Column mapping</h2>
              {template.columns.map((key) => (
                <Field key={key} label={`Map ${key}`}>
                  <select
                    id={`map-${key}`}
                    value={mapping[key]}
                    onChange={(e) => {
                      setMapping({ ...mapping, [key]: e.target.value });
                      setChecked(null);
                      setResult(null);
                    }}
                  >
                    <option value="">Choose source column</option>
                    {csv.headers.map((header) => (
                      <option key={header}>{header}</option>
                    ))}
                  </select>
                </Field>
              ))}
              <Button onClick={validate}>Validate mapped rows</Button>
            </div>
          )}
        </section>
        <aside className="panel">
          <h2>Staging protects the source of truth.</h2>
          <ProgressTimeline
            items={[
              {
                label: "Synthetic data only",
                detail:
                  "Demo A-09 units, Demo owner labels and DEMO- evidence references.",
              },
              {
                label: "Validate every row",
                detail:
                  "The entire batch must pass. Duplicate mappings and malformed CSV are rejected.",
              },
              {
                label: "Drafts only",
                detail:
                  "No real payments, receipts, balances, residents or approval states change.",
              },
            ]}
          />
          <WorkspaceNote>
            Never paste resident exports here. CSV text is parsed locally; it is
            not uploaded. The source snapshot and its records are not imported.
          </WorkspaceNote>
        </aside>
      </div>
      <Feedback error={failure ?? mutation.error} />
      {checked && (
        <section className="panel" style={{ marginTop: 24 }}>
          <h2>
            {checked.length} sample rows ·{" "}
            {checked.filter((row) => row.errors.length).length} need correction
          </h2>
          <div className={styles.results}>
            <table>
              <caption className="sr-only">
                Synthetic import validation results
              </caption>
              <thead>
                <tr>
                  <th scope="col">Row</th>
                  <th scope="col">Sample values</th>
                  <th scope="col">Validation</th>
                </tr>
              </thead>
              <tbody>
                {checked.map((row) => (
                  <tr key={row.row}>
                    <th scope="row">{row.row}</th>
                    <td>{Object.values(row.input.fields).join(" · ")}</td>
                    <td>{row.errors.join("; ") || "Valid synthetic draft"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button
            disabled={!valid || !!result}
            pending={mutation.isPending}
            onClick={async () => {
              try {
                setResult(
                  (await mutation.mutateAsync({ kind, text, mapping })) as {
                    count: number;
                    batch: string;
                  },
                );
              } catch {
                /* shown inline */
              }
            }}
          >
            Stage local draft batch
          </Button>
          <Feedback
            message={
              result
                ? `${result.count} synthetic drafts staged in ${result.batch}. No official records were created.`
                : undefined
            }
          />
          {result && (
            <Link className="text-link" to={`/explore/${template.module}`}>
              Review staged drafts <ArrowRight size={20} />
            </Link>
          )}
        </section>
      )}
    </>
  );
}
export function BillingCalculator() {
  const [mode, setMode] = useState<"Flat amount" | "Per square metre">(
    "Flat amount",
  );
  const [rate, setRate] = useState(""),
    [area, setArea] = useState("");
  let estimate: number | undefined;
  let error: Error | null = null;
  if (rate.trim() && (mode === "Flat amount" || area.trim())) {
    try {
      estimate = billingEstimate(
        Number(rate),
        mode === "Flat amount" ? 1 : Number(area),
        mode,
      );
    } catch (caught) {
      error =
        caught instanceof Error
          ? caught
          : new Error("Check the sample values.");
    }
  }
  return (
    <>
      <Link className="text-link back-link" to="/explore">
        <ArrowLeft size={20} /> Feature baseline
      </Link>
      <PageIntro
        eyebrow="FINANCE · SAMPLE CALCULATOR"
        title="See how an assessment adds up."
        description="Enter your own synthetic figures. No official rate, penalty or invoice is assumed."
      />
      <div className="two-column">
        <section className="panel">
          <Field label="Sample assessment mode">
            <select
              id="assessment-mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as typeof mode)}
            >
              <option>Flat amount</option>
              <option>Per square metre</option>
            </select>
          </Field>
          <Field label="Sample rate in PHP">
            <input
              id="assessment-rate"
              type="number"
              min={0}
              max={1000000}
              step=".01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </Field>
          {mode === "Per square metre" && (
            <Field label="Sample area in square metres">
              <input
                id="assessment-area"
                type="number"
                min={0}
                max={1000000}
                step=".01"
                value={area}
                onChange={(e) => setArea(e.target.value)}
              />
            </Field>
          )}
          <Feedback error={error} />
        </section>
        <section className="panel">
          <span className={styles.icon}>
            <Wallet size={26} />
          </span>
          <h2 style={{ marginTop: 16 }}>Illustrative assessment</h2>
          <p className={styles.amount} aria-live="polite">
            {estimate === undefined ? "Not calculated" : money(estimate)}
          </p>
          <p className="note">
            {mode === "Flat amount"
              ? "Flat sample rate"
              : "Sample rate × sample area"}{" "}
            · rounded to centavos. Excludes penalties, credits and prior
            balances.
          </p>
          <Link className="text-link" to="/explore/billing-proposals">
            Prepare a billing proposal <ArrowRight size={20} />
          </Link>
        </section>
      </div>
      <WorkspaceNote>
        This calculator never creates invoices, marks payments or changes your
        household balance. Official billing definitions remain unconfirmed.
      </WorkspaceNote>
    </>
  );
}
