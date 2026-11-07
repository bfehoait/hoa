import { useState } from "react";
import { BarChart3, Download, FileSpreadsheet } from "lucide-react";
import {
  reportPeriods,
  buildFinanceReport,
  financeReportCsv,
} from "../../../../../packages/shared/src/finance-report";
import { money } from "../../../../../packages/shared/src";
import { hasCapability } from "../../../../../packages/shared/src/permissions";
import { AS_OF, householdLedger } from "../../data/fixtures";
import { downloadCsv } from "../../data/download";
import { useAuth } from "../../data/auth";
import { usePermissions } from "../../data/permissions";
import { Badge, Button, Feedback, PageIntro } from "../../components/UI";
import styles from "./FinanceReports.module.css";
import { financeReports } from "../../../../../packages/shared/src/finance-catalog";
import registryStyles from "../registry/LotRegister.module.css";

export default function FinanceReports() {
  const [reportId, setReportId] = useState("collections");
  const [period, setPeriod] =
    useState<(typeof reportPeriods)[number]>("This month");
  const [notice, setNotice] = useState("");
  const auth = useAuth();
  const permissions = usePermissions();
  const canExport =
    auth.preview ||
    !!auth.rolePreview ||
    hasCapability(permissions.data, {
      module: "finance",
      action: "export",
      scope: "association",
    });
  const report = buildFinanceReport(householdLedger, AS_OF, period);
  const maximum = Math.max(
    1,
    ...report.months.map((month) => month.billed ?? 0),
  );
  const amount = (value: number | null) =>
    value === null ? "Unavailable" : money(value);
  function exportReport() {
    downloadCsv(
      `SAMPLE-Bellefort-finance-${report.start}-to-${report.end}.csv`,
      financeReportCsv(report),
    );
    setNotice(
      "Sample report downloaded with report details, summary, monthly breakdown and invoice detail. No live HOA export was requested.",
    );
  }
  return (
    <div className={styles.reports}>
      <PageIntro
        eyebrow="FINANCE · SAMPLE REPORT"
        title="Financial reports"
        icon={<BarChart3 size={28} />}
        action={
          reportId === "collections" ? (
            <Button disabled={!canExport} onClick={exportReport}>
              <Download size={20} />
              Download sample CSV
            </Button>
          ) : undefined
        }
      />
      <label className={registryStyles.toolbar}>
        Report
        <select
          aria-label="Report"
          value={reportId}
          onChange={(event) => setReportId(event.target.value)}
        >
          {financeReports.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </select>
      </label>
      {reportId !== "collections" ? (
        <section className={registryStyles.panel}>
          <h2>{financeReports.find((r) => r.id === reportId)?.title}</h2>
          <p>
            Unavailable — verified accounting records have not been supplied.
          </p>
          <p>{financeReports.find((r) => r.id === reportId)?.needs}</p>
        </section>
      ) : (
        <>
          <div
            className={styles.filters}
            role="group"
            aria-label="Report period"
          >
            {reportPeriods.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={period === value}
                onClick={() => {
                  setPeriod(value);
                  setNotice("");
                }}
              >
                {value}
              </button>
            ))}
          </div>
          <div className={styles.source}>
            <Badge>Sample data</Badge>
            <p>
              {report.start} to {report.end} · Snapshot {AS_OF}
            </p>
          </div>
          <Feedback message={notice} />
          {!canExport && (
            <p className="note">
              A separate finance export permission is required to download this
              report.
            </p>
          )}
          <div className={styles.metrics}>
            {[
              ["Billed", report.billed],
              ["Recorded against bills", report.received],
              ["Outstanding", report.outstanding],
            ].map(([label, value]) => (
              <section key={String(label)}>
                <h2>{label}</h2>
                <strong>{amount(value as number | null)}</strong>
                <p>Selected supplied invoices</p>
              </section>
            ))}
          </div>
          <section
            className={styles.chart}
            aria-label="Monthly sample billing chart"
          >
            <div className="section-title">
              <h2>Monthly billing picture</h2>
              <FileSpreadsheet size={24} />
            </div>
            <p className="note">
              Track = billed · filled = recorded against those bills. Missing
              months are unavailable.
            </p>
            {report.months.map((month) => (
              <div className={styles.month} key={month.key}>
                <strong>{month.label}</strong>
                <div
                  className={styles.track}
                  role="img"
                  aria-label={`${month.label}: billed ${amount(month.billed)}, recorded ${amount(month.received)}, outstanding ${amount(month.outstanding)}`}
                >
                  {month.billed === null ? (
                    <span className={styles.unknown}>No supplied invoices</span>
                  ) : (
                    <>
                      <i
                        style={{ width: `${(month.billed / maximum) * 100}%` }}
                      />
                      <b
                        style={{
                          width: `${(month.received! / maximum) * 100}%`,
                        }}
                      />
                    </>
                  )}
                </div>
                <span>
                  {amount(month.outstanding)}
                  <small>outstanding</small>
                </span>
              </div>
            ))}
          </section>
          <details className={styles.chart}>
            <summary>Monthly table & exact amounts</summary>
            <div
              className={styles.table}
              tabIndex={0}
              role="region"
              aria-label="Scrollable monthly financial report"
            >
              <table>
                <caption>PHP · synthetic invoice snapshot</caption>
                <thead>
                  <tr>
                    <th scope="col">Due month</th>
                    <th scope="col">Billed</th>
                    <th scope="col">Recorded</th>
                    <th scope="col">Outstanding</th>
                    <th scope="col">Invoices</th>
                  </tr>
                </thead>
                <tbody>
                  {report.months.map((month) => (
                    <tr key={month.key}>
                      <th scope="row">{month.label}</th>
                      <td>{amount(month.billed)}</td>
                      <td>{amount(month.received)}</td>
                      <td>{amount(month.outstanding)}</td>
                      <td>{month.count ? month.count : "Not supplied"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">Selected total</th>
                    <td>{amount(report.billed)}</td>
                    <td>{amount(report.received)}</td>
                    <td>{amount(report.outstanding)}</td>
                    <td>{report.rows.length}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </details>
          <p className="note">
            This is a limited sample, not an official monthly income statement.
            Expenses, bank reconciliation, receipt-date collections and unbilled
            households remain unavailable.
          </p>
        </>
      )}
    </div>
  );
}
