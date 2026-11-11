import { NavLink, useSearchParams } from "react-router-dom";
import { NavigationGroup } from "../../components/Navigation";
import { PageIntro } from "../../components/UI";
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
        description="Recorded collections are connected. Accounting statements require verified accounting records."
      />
      <NavigationGroup aria-label="Finance workspace">
        <NavLink to="/office/finance">Imported receipts</NavLink>
        <NavLink to="/office/finance/accounting">Accounting records</NavLink>
      </NavigationGroup>
      {legacyExpenses ? (
        <section className={styles.panel}>
          <h2>Expense records</h2>
          <p>
            Record expenses in Accounting records, then submit them for
            independent finance review. Imported collection receipts remain
            separate.
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
              Imported receipts are historical evidence. New billing runs,
              payment allocations and expense postings are managed in Accounting
              records.
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
                    Prepare drafts and review submissions separately from
                    imported collections.
                  </p>
                </div>
                <nav aria-label="Accounting tasks">
                  <NavLink to="/office/finance/accounting?kind=receipt-allocation">
                    Allocate imported receipts
                  </NavLink>
                  <NavLink to="/office/finance/accounting?kind=payment&status=Draft">
                    Draft payments
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
                No figures are estimated from receipt gaps or legacy test dues.
                Financial reports will need the approved accounting source
                before they can be calculated.
              </p>
              <NavLink className="text-link" to="/office/finance">
                View recorded collections
              </NavLink>
            </section>
          )}
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
        </>
      )}
    </>
  );
}
