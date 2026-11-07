import { NavLink, useSearchParams } from "react-router-dom";
import { PageIntro } from "../../components/UI";
import { ReceiptPanel } from "../registry/LotRegister";
import { financeReports } from "../../../../../packages/shared/src/finance-catalog";
import styles from "../registry/LotRegister.module.css";
import financeStyles from "./FinanceReports.module.css";

export default function RecordedFinance({ section }: { section: string }) {
  const [params, setParams] = useSearchParams();
  const reports =
    section === "finance/reports" || section === "finance/reconciliation";
  const legacyExpenses = section === "finance/expenses";
  const selected =
    params.get("report") ??
    (section === "finance/reconciliation" ? "bank" : "collections");
  const allowed = reports
    ? financeReports
    : financeReports.filter((r) =>
        ["collections", "aging", "delinquency"].includes(r.id),
      );
  const report = allowed.find((r) => r.id === selected) ?? allowed[0];
  return (
    <>
      <nav
        className={financeStyles.tabs}
        aria-label="Finance workspace navigation"
      >
        <NavLink end to="/office/finance">
          Collections & AR
        </NavLink>
        <NavLink to="/office/finance/reports">Reports</NavLink>
      </nav>
      <PageIntro
        eyebrow="FINANCE RECORDS"
        title={reports ? "Financial reports" : "Collections & AR"}
        description="Recorded collections are connected. Accounting statements require verified accounting records."
      />
      {legacyExpenses ? (
        <section className={styles.panel}>
          <h2>Expense totals unavailable</h2>
          <p>
            No expense transactions were imported. A budget or collection
            receipt is not an expense entry.
          </p>
          <NavLink
            className="text-link"
            to="/office/finance/reports?report=income-expense"
          >
            View Income and Expense requirements
          </NavLink>
        </section>
      ) : (
        <>
          <label className={styles.toolbar}>
            {" "}
            {reports ? "Report" : "Collection view"}
            <select
              aria-label={reports ? "Report" : "Collection view"}
              value={report.id}
              onChange={(event) => setParams({ report: event.target.value })}
            >
              {allowed.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.id === "collections" && !reports ? "Collected" : r.title}
                </option>
              ))}
            </select>
          </label>
          <p>
            Total billed, outstanding balances, paid status and overdue amounts
            are unavailable until approved invoices and payment allocations are
            supplied.
          </p>
          {report.available ? (
            <ReceiptPanel />
          ) : (
            <section className={styles.panel}>
              <h2>
                {report.id === "bank"
                  ? "Reconciled balance unavailable"
                  : report.title}
              </h2>
              <p>
                <strong>
                  Unavailable — required records have not been supplied.
                </strong>
              </p>
              <p>{report.needs}</p>
              <p>
                No figures are estimated from receipt gaps or legacy test dues.
                Financial reports will need the approved accounting source
                before they can be calculated.
              </p>
              <NavLink className="text-link" to="/office/finance">
                View recorded collections
              </NavLink>
            </section>
          )}
          {reports && (
            <details className={styles.panel}>
              <summary>Report readiness and required records</summary>
              <dl>
                {financeReports.map((r) => (
                  <div key={r.id}>
                    <dt>{r.title}</dt>
                    <dd>
                      {r.available
                        ? "Connected: imported receipt evidence"
                        : "Unavailable"}
                      <p>{r.needs}</p>
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
        </>
      )}
    </>
  );
}
