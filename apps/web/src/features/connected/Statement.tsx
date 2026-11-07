import { Link } from "../../components/AccessLink";
import { ArrowLeft, Printer, FileText } from "lucide-react";
import { AS_OF, invoices } from "../../data/fixtures";
import { balance, money } from "../../../../../packages/shared/src";
import { Button, PageIntro } from "../../components/UI";
import { InvoiceVisual } from "../../components/RecordVisuals";
import styles from "./Connected.module.css";

export default function Statement() {
  return (
    <>
      <Link className="text-link back-link" to="/account">
        <ArrowLeft size={20} />
        Bills & payments
      </Link>
      <PageIntro
        eyebrow="BILLS & PAYMENTS"
        title="Account statement"
        description="Review your bills. Print or save a PDF."
      />
      <section className={styles.statement} data-sample-statement>
        <div className={styles.statementBrand}>
          <FileText size={28} />
          <p className="eyebrow">BELLEFORT ESTATES</p>
        </div>
        <h2>SAMPLE STATEMENT — NOT OFFICIAL</h2>
        <p>Sample household · Block 08, Lot 12 · As of {AS_OF}</p>
        <p className="note">Sample data only. Not a bill or receipt.</p>
        <div className={styles.statementTotals}>
          <div>
            <span>Outstanding</span>
            <strong>
              {money(invoices.reduce((sum, row) => sum + balance(row), 0))}
            </strong>
          </div>
          <div>
            <span>Billed</span>
            <strong>
              {money(invoices.reduce((sum, row) => sum + row.amount, 0))}
            </strong>
          </div>
          <div>
            <span>Recorded payments</span>
            <strong>
              {money(invoices.reduce((sum, row) => sum + row.received, 0))}
            </strong>
          </div>
        </div>
        <InvoiceVisual records={invoices} />
        <div
          className={`${styles.tableWrap} ${styles.statementTable}`}
          tabIndex={0}
          role="region"
          aria-label="Scrollable synthetic statement table"
        >
          <table className={styles.table}>
            <caption className="sr-only">
              Synthetic invoice statement in Philippine pesos
            </caption>
            <thead>
              <tr>
                <th scope="col">Reference / period</th>
                <th scope="col">Due date</th>
                <th scope="col">Billed</th>
                <th scope="col">Recorded</th>
                <th scope="col">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <th scope="row">
                    {invoice.id}
                    <br />
                    {invoice.period}
                  </th>
                  <td data-label="Due date">{invoice.due}</td>
                  <td data-label="Billed">{money(invoice.amount)}</td>
                  <td data-label="Recorded">{money(invoice.received)}</td>
                  <td data-label="Outstanding">{money(balance(invoice))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={2}>
                  Sample totals
                </th>
                <td>
                  {money(invoices.reduce((sum, row) => sum + row.amount, 0))}
                </td>
                <td>
                  {money(invoices.reduce((sum, row) => sum + row.received, 0))}
                </td>
                <td>
                  {money(invoices.reduce((sum, row) => sum + balance(row), 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p>Generated from synthetic records. No payment is requested.</p>
        <div className="form-actions">
          <Button onClick={() => window.print()}>
            <Printer size={20} />
            Print sample / save as PDF
          </Button>
        </div>
      </section>
    </>
  );
}
