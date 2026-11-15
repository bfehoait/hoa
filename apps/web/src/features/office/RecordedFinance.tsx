import PageIntro from "../office/OfficePage";
import { NavLink, useSearchParams } from "react-router-dom";
import { NavigationGroup } from "../../components/Navigation";
import { ReceiptPanel } from "../registry/LotRegister";
import { financeReports } from "../../../../../packages/shared/src/finance-catalog";
import styles from "../registry/LotRegister.module.css";
import layout from "./RecordedFinance.module.css";

export default function RecordedFinance({ section }: { section: string }) {
  const [params, setParams] = useSearchParams();
  const legacyExpenses = section === "finance/expenses";
  const selected =
    params.get("report") ??
    (section === "finance/reconciliation" ? "bank" : "collections");
  const allowed = financeReports;
  const report = allowed.find((r) => r.id === selected) ?? allowed[0];
  return (
    <>
      <PageIntro
        eyebrow="FINANCE RECORDS"
        title="Finance"
        description="View past receipts and manage approved financial records."
      />
      <NavigationGroup aria-label="Finance workspace">
        <NavLink to="/office/finance">Past receipts</NavLink>
        <NavLink to="/office/finance/accounting">Accounting records</NavLink>
      </NavigationGroup>
      {legacyExpenses ? (
        <section className={styles.panel}>
          <h2>Expense records</h2>
          <p>
            Enter expenses in Accounting records and send them for a separate
            review. Past collection receipts are kept separately.
          </p>
          <NavLink
            className="text-link"
            to="/office/finance/accounting?kind=expense"
          >
            Open expense recording
          </NavLink>
        </section>
      ) : (
        <>
          <div className={layout.context}>
            <label className={layout.view}>
              Finance view
              <select
                aria-label="Finance view"
                value={report.id}
                onChange={(event) => setParams({ report: event.target.value })}
              >
                {allowed.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </label>
            <p className={layout.availability}>
              Past receipts show earlier collections. Use Accounting records to
              create bills, apply payments to bills and record expenses.
            </p>
          </div>
          {report.available ? (
            <>
              <ReceiptPanel dashboard />
              <section
                className={layout.accountingTools}
                aria-labelledby="finance-accounting-title"
              >
                <div>
                  <h2 id="finance-accounting-title">Accounting workspace</h2>
                  <p>
                    Create and review financial records. Past receipts stay in
                    their own list.
                  </p>
                </div>
                <nav aria-label="Accounting tasks">
                  <NavLink to="/office/finance/accounting?kind=receipt-allocation">
                    Apply past receipts to bills
                  </NavLink>
                  <NavLink to="/office/finance/accounting?kind=payment&status=Draft">
                    Payment drafts
                  </NavLink>
                  <NavLink to="/office/finance/accounting?kind=payment&status=Submitted">
                    Review payments
                  </NavLink>
                  <NavLink to="/office/finance/accounting?kind=expense&status=Submitted">
                    Review expenses
                  </NavLink>
                </nav>
              </section>
            </>
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
                Missing receipts are not treated as unpaid bills. These reports
                need approved financial records before totals can be shown.
              </p>
              <NavLink className="text-link" to="/office/finance">
                View recorded collections
              </NavLink>
            </section>
          )}
          <details className={styles.panel}>
            <summary>What each report needs</summary>
            <dl>
              {financeReports.map((r) => (
                <div key={r.id}>
                  <dt>{r.title}</dt>
                  <dd>
                    {r.available
                      ? "Available: past receipt records"
                      : "Unavailable"}
                    <p>{r.needs}</p>
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        </>
      )}
    </>
  );
}
