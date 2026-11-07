import { useAuth } from "../../data/auth";
import LotRegister from "../registry/LotRegister";
import PayDues from "./PayDues";
import { NavigationGroup } from "../../components/Navigation";
import { useState } from "react";
import {
  Download,
  FileText,
  Info,
  ShieldCheck,
  ArrowUpRight,
  ChevronRight,
  CreditCard,
  Printer,
} from "lucide-react";
import { NavLink, useParams } from "react-router-dom";
import { Link } from "../../components/AccessLink";
import {
  balance,
  invoiceStatus,
  money,
} from "../../../../../packages/shared/src";
import { AS_OF, invoices } from "../../data/fixtures";
import { downloadCsv } from "../../data/download";
import { Badge, Button, Feedback, Modal, PageIntro } from "../../components/UI";
import { InvoiceVisual } from "../../components/RecordVisuals";
import styles from "./Account.module.css";

export default function Account() {
  const auth = useAuth();
  const path = useParams()["*"] ?? "";
  if (!auth.preview && !auth.rolePreview)
    return (
      <>
        <LotRegister account />
        {!path.startsWith("lots/") && <PayDues />}
      </>
    );
  return <SampleAccount />;
}

function SampleAccount() {
  const paymentsOnly = useParams()["*"] === "payments";
  const [filter, setFilter] = useState("All");
  const [paymentOptions, setPaymentOptions] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const rows = invoices.filter((i) =>
    paymentsOnly
      ? i.received > 0
      : filter === "All" || invoiceStatus(i, AS_OF) === filter,
  );
  const total = invoices.reduce((sum, i) => sum + balance(i), 0);
  const invoice = invoices.find((i) => i.id === selected);
  function exportStatement() {
    downloadCsv("SAMPLE-bellefort-statement.csv", [
      ["SYNTHETIC PREVIEW — NOT AN OFFICIAL STATEMENT"],
      ["As of", AS_OF],
      [
        "Reference",
        "Period",
        "Billed PHP",
        "Recorded PHP",
        "Balance PHP",
        "Due",
      ],
      ...invoices.map((i) => [
        i.id,
        i.period,
        i.amount / 100,
        i.received / 100,
        balance(i) / 100,
        i.due,
      ]),
    ]);
    setMessage(
      "Sample statement prepared for download. Check your browser’s downloads.",
    );
  }
  return (
    <div className={styles.accountPage}>
      <PageIntro
        eyebrow="YOUR ACCOUNT"
        title={paymentsOnly ? "Your payment history" : "Bills & payments"}
        description="Your bills and recorded payments, in one clear place."
        action={
          <Button
            secondary
            onClick={exportStatement}
            aria-label="Download statement"
          >
            <Download size={20} />
            <span className={styles.downloadLabel}>Download statement</span>
          </Button>
        }
      />
      <NavigationGroup aria-label="Account navigation">
        <NavLink
          end
          to="/account"
          className={({ isActive }) => (isActive ? styles.selectedTab : "")}
        >
          Bills & statement
        </NavLink>
        <NavLink
          to="/account/payments"
          className={({ isActive }) => (isActive ? styles.selectedTab : "")}
        >
          Payment history
        </NavLink>
      </NavigationGroup>
      <div className={styles.rail}>
        <div className={styles.summary}>
          <div>
            <p className="eyebrow">
              {paymentsOnly ? "RECORDED PAYMENTS" : "OUTSTANDING BALANCE"}
            </p>
            <p className={styles.amount}>
              {money(
                paymentsOnly
                  ? invoices.reduce((sum, i) => sum + i.received, 0)
                  : total,
              )}
            </p>
            <p className="muted">
              {paymentsOnly ? "2 settled sample bills" : "Due 30 November 2026"}
            </p>
            {!paymentsOnly && (
              <button
                className={styles.paymentOptions}
                onClick={() => setPaymentOptions(true)}
              >
                <CreditCard size={20} />
                Pay your dues
                <ChevronRight size={20} />
              </button>
            )}
          </div>
          <div className={styles.summaryDetails}>
            <div>
              <span>Recorded payments</span>
              <strong>
                {money(invoices.reduce((sum, i) => sum + i.received, 0))}
              </strong>
            </div>
            <div>
              <span>Statement date</span>
              <strong>4 November 2026</strong>
            </div>
            <div>
              <span>Account</span>
              <strong>Block 08 · Lot 12</strong>
            </div>
          </div>
        </div>
        <Link className={styles.statementLink} to="/account/statement">
          <span className={styles.statementIcon}>
            <Printer size={24} />
          </span>
          <span>
            <strong>Account statement</strong>
            <span>View, print or save as PDF</span>
          </span>
          <ChevronRight size={20} />
        </Link>
        <div className="notice-note">
          <ShieldCheck size={20} />
          <p>Sample bills only. Online payments aren’t connected.</p>
        </div>
      </div>
      <div className={styles.ledger}>
        <InvoiceVisual records={invoices} />
        <Feedback message={message} />
        <div className="section-title">
          <h2>{paymentsOnly ? "Recorded activity" : "Invoices"}</h2>
          <Badge>
            {paymentsOnly ? "2 recorded payments" : "3 sample bills"}
          </Badge>
        </div>
        {!paymentsOnly && (
          <div className="filters" aria-label="Filter bills">
            {["All", "Due", "Paid", "Overdue"].map((f) => (
              <button
                className="filter"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                key={f}
              >
                {f}
              </button>
            ))}
          </div>
        )}
        <div className={styles.invoiceList}>
          {rows.length ? (
            rows.map((i) => (
              <button
                className={styles.invoice}
                key={i.id}
                onClick={() => setSelected(i.id)}
              >
                <span className={styles.fileIcon}>
                  <FileText size={24} />
                </span>
                <span className={styles.invoiceTitle}>
                  <strong>{i.period}</strong>
                  <span>
                    {i.id} · due {i.due}
                  </span>
                </span>
                <span className={styles.invoiceAmount}>
                  <strong>{money(i.amount)}</strong>
                  <Badge
                    tone={
                      invoiceStatus(i, AS_OF) === "Paid" ? "green" : "amber"
                    }
                  >
                    {invoiceStatus(i, AS_OF)}
                  </Badge>
                </span>
                <ArrowUpRight size={20} />
              </button>
            ))
          ) : (
            <div className="panel">
              <h2>No overdue bills in this sample.</h2>
              <p className="muted">Your other bills are available under All.</p>
            </div>
          )}
        </div>
        <div className={styles.question}>
          <Info size={20} />
          <div>
            <h2>Something doesn’t look right?</h2>
            <p className="muted">
              Send the office a concern with your bill reference.
            </p>
          </div>
          <Link to="/services/requests?new=concern" className="text-link">
            Raise a concern
            <ArrowUpRight size={20} />
          </Link>
        </div>
      </div>
      {invoice && (
        <Modal
          title={invoice.period}
          description="Sample bill details · not an official statement"
          onClose={() => setSelected(null)}
          footer={
            <Button secondary onClick={() => setSelected(null)}>
              Close details
            </Button>
          }
        >
          <dl className="detail-list">
            <div>
              <dt>Bill reference</dt>
              <dd>{invoice.id}</dd>
            </div>
            <div>
              <dt>Due date</dt>
              <dd>{invoice.due}</dd>
            </div>
            <div>
              <dt>Billed amount</dt>
              <dd>{money(invoice.amount)}</dd>
            </div>
            <div>
              <dt>Recorded payments</dt>
              <dd>{money(invoice.received)}</dd>
            </div>
            <div>
              <dt>Outstanding</dt>
              <dd>{money(balance(invoice))}</dd>
            </div>
          </dl>
          <p className="note">
            The sample amount does not establish the HOA’s dues policy. A real
            bill needs an approved breakdown and source records.
          </p>
        </Modal>
      )}
      {paymentOptions && (
        <Modal
          title="Payment options"
          description="Buyani opens separately. Sample balances are not actual charges."
          onClose={() => setPaymentOptions(false)}
          footer={
            <Button secondary onClick={() => setPaymentOptions(false)}>
              Back to my account
            </Button>
          }
        >
          <PayDues />
        </Modal>
      )}
    </div>
  );
}
