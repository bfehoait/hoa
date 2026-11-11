import { z } from "zod";
import { useSearchParams, useParams } from "react-router-dom";
import { useAuth } from "../../data/auth";
import { useReceipts } from "../../data/registry";
import { useLinkedPropertyAddress } from "../../data/linked-properties";
import { Link } from "../../components/AccessLink";
import { Button, Feedback, Skeleton } from "../../components/UI";
import { money } from "../../../../../packages/shared/src";
import LotRegister from "../registry/LotRegister";
import PayDues from "./PayDues";
import MonthlyHoaCharges from "./MonthlyHoaCharges";
import { useHoaBalance } from "../../data/hoa-balance";
import { balanceMoney } from "../../../../../packages/shared/src/hoa-balance";
import styles from "./HouseholdAccount.module.css";

export default function HouseholdAccount() {
  const { member } = useAuth();
  const links = useLinkedPropertyAddress();
  const balance = useHoaBalance();
  const billed = !!balance.data?.invoice_count && !balance.data.needs_review;
  const path = useParams()["*"] ?? "";
  const section = path === "payments" ? "payments" : "properties";
  if (path.startsWith("lots/")) return <LotRegister account />;
  return (
    <div className={styles.page}>
      <header className={styles.accountHeader}>
        <div className={styles.heroTop}>
          <h1>My account</h1>
          <Link to="/more/profile">Profile details</Link>
        </div>
        <p className={styles.holder}>
          {member?.name?.trim() || "Account holder"}
        </p>
        <p className={styles.address}>
          <span>
            {links.properties.length
              ? "Linked household address: "
              : "Household address: "}
          </span>
          {links.address}
        </p>
        {links.isError && (
          <Button secondary onClick={() => void links.refetch()}>
            Refresh linked properties
          </Button>
        )}
      </header>
      <section className={styles.balance} aria-labelledby="account-balance">
        <h2 id="account-balance">Total recorded balance</h2>
        <strong>
          {billed && balance.data
            ? balanceMoney(balance.data.total_recorded_balance_centavos)
            : balance.data?.needs_review
              ? "Under review"
              : balance.isPending && balance.allowed
                ? "Loading…"
                : balance.data
                  ? "No bills yet"
                  : "Unavailable"}
        </strong>
        <p>
          {billed
            ? "HOA only. Water and other charges are not connected. Historical coverage needs Office verification."
            : balance.isError
              ? "Your recorded balance could not be loaded."
              : "Office must verify and post the monthly HOA bills. Missing receipts are not automatically treated as debt."}
        </p>
        <dl className={styles.balanceBreakdown} aria-label="Balance breakdown">
          <div>
            <dt>HOA dues</dt>
            <dd>
              {billed && balance.data
                ? balanceMoney(balance.data.hoa_balance_centavos)
                : balance.data?.needs_review
                  ? "Under review"
                  : balance.data
                    ? "No bills yet"
                    : "No data"}
            </dd>
          </div>
          <div>
            <dt>Water dues</dt>
            <dd>No data</dd>
          </div>
          <div>
            <dt>Other</dt>
            <dd>No data</dd>
          </div>
        </dl>
        {billed && balance.data && (
          <p>
            {balance.data.unpaid_months} month
            {balance.data.unpaid_months === 1 ? "" : "s"} with unpaid HOA
            charges · {balance.data.overdue_charges} overdue charge
            {balance.data.overdue_charges === 1 ? "" : "s"}
            {balance.data.billed_lots < balance.data.linked_lots
              ? `. Billing is recorded for ${balance.data.billed_lots} of ${balance.data.linked_lots} linked properties.`
              : ""}
          </p>
        )}
      </section>
      {balance.isError && (
        <>
          <Feedback error={balance.error} />
          <Button secondary onClick={() => void balance.refetch()}>
            Retry balance
          </Button>
        </>
      )}
      <details className={styles.billingDetails}>
        <summary>Monthly HOA charges & payments applied</summary>
        <MonthlyHoaCharges />
      </details>
      <div aria-label="HOA dues and payment method">
        {links.properties.map((property) => (
          <PayDues
            key={property.lot_id}
            phase={property.phase}
            block={property.block}
            lot={property.lot}
            monthlyDuesCentavos={property.monthly_dues_centavos}
            linearPark={property.linear_park}
          />
        ))}
        {!links.properties.length && !links.isPending && <PayDues />}
      </div>
      <nav className={styles.tabs} aria-label="Account sections">
        <Link
          to="/account/lots"
          aria-current={section === "properties" ? "page" : undefined}
        >
          Properties
        </Link>
        <Link
          to="/account/payments"
          aria-current={section === "payments" ? "page" : undefined}
        >
          Payments
        </Link>
      </nav>
      {section === "properties" ? (
        <div className={styles.properties}>
          <LotRegister account embedded />
        </div>
      ) : (
        <AccountPayments />
      )}
    </div>
  );
}

function AccountPayments() {
  const [params, setParams] = useSearchParams();
  const from = z.iso.date().safeParse(params.get("from")).data ?? "";
  const to = z.iso.date().safeParse(params.get("to")).data ?? "";
  const requestedPage = Number(params.get("page") ?? 0);
  const page =
    Number.isInteger(requestedPage) &&
    requestedPage >= 0 &&
    requestedPage <= 10000
      ? requestedPage
      : 0;
  function update(values: Record<string, string | number>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) {
      if (!value) next.delete(key);
      else next.set(key, String(value));
    }
    setParams(next, { preventScrollReset: true });
  }
  const setPage = (value: number) => update({ page: value });
  const valid = !from || !to || from <= to;
  const query = useReceipts(
    {
      p_lot: null,
      p_from: from || null,
      p_to: to || null,
      p_page: page,
      p_export: false,
    },
    valid,
  );
  return (
    <section className={styles.payments} aria-labelledby="recorded-payments">
      <div className={styles.sectionHeading}>
        <h2 id="recorded-payments">Recorded payments</h2>
      </div>
      <p className={styles.note}>
        Receipts available to this account. These records do not establish your
        current balance or bank-cleared payment status.
      </p>
      <div className={styles.filters}>
        <label>
          From
          <input
            type="date"
            value={from}
            onChange={(event) => {
              update({ from: event.target.value, page: 0 });
            }}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={to}
            onChange={(event) => {
              update({ to: event.target.value, page: 0 });
            }}
          />
        </label>
      </div>
      {!valid ? (
        <p role="alert">Choose an end date on or after the start date.</p>
      ) : query.isPending ? (
        <Skeleton />
      ) : query.isError ? (
        <>
          <Feedback error={query.error} />
          <Button secondary onClick={() => void query.refetch()}>
            Try again
          </Button>
        </>
      ) : (
        query.data && (
          <>
            <p className={styles.note}>
              {query.data.total}{" "}
              {query.data.total === 1 ? "receipt" : "receipts"}
              {from || to ? " in this date range" : " available"}
            </p>
            {query.data.rows.length ? (
              <>
                <div className={styles.receiptHead} aria-hidden="true">
                  <span>Receipt</span>
                  <span>Property</span>
                  <span>Date recorded</span>
                  <span>Amount</span>
                </div>
                <ul className={styles.receipts} aria-label="Recorded receipts">
                  {query.data.rows.map((receipt) => (
                    <li key={receipt.id}>
                      <h3>Receipt {receipt.or_number}</h3>
                      <p>Lot {receipt.physical_id}</p>
                      <time dateTime={receipt.receipt_date}>
                        {new Date(
                          receipt.receipt_date + "T00:00:00+08:00",
                        ).toLocaleDateString("en-PH", {
                          timeZone: "Asia/Manila",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </time>
                      <strong>{money(receipt.amount_centavos)}</strong>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className={styles.empty}>
                <h3>No payment records to show</h3>
                <p>
                  {from || to
                    ? "Try a different date range."
                    : "No receipts are available to this account yet. Contact the office if a payment record is missing."}
                </p>
              </div>
            )}
            {query.data.total > 20 && (
              <div className={styles.pagination}>
                <Button
                  secondary
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <span>Page {page + 1}</span>
                <Button
                  secondary
                  disabled={(page + 1) * 20 >= query.data.total}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )
      )}
    </section>
  );
}
