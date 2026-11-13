import { z } from "zod";
import { useSearchParams, useParams } from "react-router-dom";
import { useAuth } from "../../data/auth";
import { useReceipts } from "../../data/registry";
import { useLinkedPropertyAddress } from "../../data/linked-properties";
import { Link } from "../../components/AccessLink";
import { Button, Feedback, PageIntro, Skeleton } from "../../components/UI";
import {
  ChevronRight,
  House,
  Wallet,
  Droplet,
  CircleDollarSign,
  Check,
  ReceiptText,
} from "lucide-react";
import { money } from "../../../../../packages/shared/src";
import LotRegister, { LotLinkButton } from "../registry/LotRegister";
import PayDues from "./PayDues";
import MonthlyHoaCharges from "./MonthlyHoaCharges";
import { useAccountBalance } from "../../data/hoa-balance";
import AmenityCharges from "./AmenityCharges";
import { balanceMoney } from "../../../../../packages/shared/src/hoa-balance";
import styles from "./HouseholdAccount.module.css";
import { memberRoles } from "../../../../../packages/shared/src/auth";

export default function HouseholdAccount() {
  const path = useParams()["*"] ?? "";
  if (path === "bills" || path === "amenity-charges")
    return (
      <div className={styles.page}>
        <PageIntro title={path === "bills" ? "HOA bills" : "Amenity charges"} />
        <section
          className={styles.chargeContent}
          aria-label={
            path === "bills"
              ? "HOA bills and payments applied"
              : "Amenity charge details"
          }
        >
          {path === "bills" ? <MonthlyHoaCharges /> : <AmenityCharges />}
        </section>
      </div>
    );
  return <HouseholdOverview />;
}

function HouseholdOverview() {
  const { member } = useAuth();
  const householdRole = member
    ? memberRoles(member).find(
        (role) => role === "homeowner" || role === "renter",
      )
    : undefined;
  const links = useLinkedPropertyAddress();
  const balance = useAccountBalance();
  const hoa = balance.data?.hoa;
  const billed = !!hoa?.invoice_count && !hoa.needs_review;
  const hasCharges =
    !!(hoa?.invoice_count || balance.data?.amenity_charge_count) &&
    !hoa?.needs_review;
  const path = useParams()["*"] ?? "";
  const section = path === "payments" ? "payments" : "properties";
  if (path.startsWith("lots/")) return <LotRegister account />;
  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Account</h1>
      <header className={styles.accountHeader}>
        <div className={styles.heroTop}>
          <p className={styles.accountLabel}>My account</p>
          <Link to="/more/profile">
            Profile details <ChevronRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <div className={styles.memberIdentity}>
          <span className={styles.avatar} aria-hidden="true">
            {(member?.name?.trim() || "A").slice(0, 1).toUpperCase()}
          </span>
          <div>
            <h2 className={styles.holder}>
              {member?.name?.trim() || "Account holder"}
            </h2>
            <p className={styles.memberRole}>
              {householdRole === "renter"
                ? "Renter"
                : householdRole === "homeowner"
                  ? "Homeowner"
                  : "Member"}
            </p>
          </div>
        </div>
        <div className={styles.address}>
          <House size={24} aria-hidden="true" />
          <div>
            <span>
              {links.properties.length
                ? "Linked household address"
                : "Household address"}
            </span>
            <strong>{links.address}</strong>
          </div>
        </div>
        {links.isError && section === "payments" && (
          <Button
            secondary
            pending={links.isFetching}
            onClick={() => void links.refetch()}
          >
            Retry property links
          </Button>
        )}
      </header>
      <section className={styles.balance} aria-labelledby="account-balance">
        <div className={styles.balanceHeading}>
          <h2 id="account-balance">Total balance</h2>
          {balance.data && !hoa?.needs_review && !hasCharges && (
            <span className={styles.balanceStatus}>
              <Check size={16} aria-hidden="true" />
              No posted charges
            </span>
          )}
        </div>
        <strong>
          {hoa?.needs_review
            ? "Under review"
            : balance.data
              ? balanceMoney(balance.data.total_balance_centavos)
              : balance.isPending && balance.allowed
                ? "Loading…"
                : "Unavailable"}
        </strong>
        <p>
          {balance.isError
            ? "Your balance could not be loaded."
            : hoa?.needs_review
              ? "Your charges need Office review before a balance can be confirmed."
              : balance.data
                ? hasCharges
                  ? "HOA dues for linked properties and confirmed charges for your amenity bookings. Water dues are unavailable."
                  : "No charges have been posted yet. Unbilled months are not counted as debt."
                : balance.isPending && balance.allowed
                  ? "Loading your confirmed charges."
                  : "Your balance is currently unavailable."}
        </p>
        {billed && hoa && (
          <p>
            {hoa.unpaid_months} month
            {hoa.unpaid_months === 1 ? "" : "s"} with unpaid HOA charges ·{" "}
            {hoa.overdue_charges} overdue charge
            {hoa.overdue_charges === 1 ? "" : "s"}
            {hoa.billed_lots < hoa.linked_lots
              ? `. Billing is recorded for ${hoa.billed_lots} of ${hoa.linked_lots} linked properties.`
              : ""}
          </p>
        )}
        <nav className={styles.accountActions} aria-label="Account actions">
          <button
            type="button"
            onClick={() =>
              document
                .getElementById("account-payment-options")
                ?.scrollIntoView({ behavior: "instant", block: "start" })
            }
          >
            <Wallet size={20} aria-hidden="true" />
            Pay dues
          </button>
          <Link to="/account/payments">
            <ReceiptText size={20} aria-hidden="true" />
            History
          </Link>
          <Link to="/account/bills">
            <ReceiptText size={20} aria-hidden="true" />
            HOA bills
          </Link>
        </nav>
      </section>
      <section className={styles.duesPanel} aria-label="Breakdown of dues">
        <p className={styles.breakdownLabel}>Breakdown of dues</p>
        <dl className={styles.balanceBreakdown} aria-label="Balance breakdown">
          <div>
            <dt>
              <Wallet size={20} aria-hidden="true" />
              HOA dues
            </dt>
            <dd>
              {hoa && !hoa.needs_review
                ? balanceMoney(hoa.hoa_balance_centavos)
                : hoa?.needs_review
                  ? "Under review"
                  : "No data"}
            </dd>
          </div>
          <div>
            <dt>
              <Droplet size={20} aria-hidden="true" />
              Water dues
            </dt>
            <dd>Unavailable</dd>
          </div>
          <div>
            <dt>
              <CircleDollarSign size={20} aria-hidden="true" />
              Other
            </dt>
            <dd>
              {balance.data
                ? balanceMoney(balance.data.other_balance_centavos)
                : "No data"}
            </dd>
          </div>
        </dl>
      </section>
      {balance.isError && (
        <>
          <Feedback error={balance.error} />
          <Button secondary onClick={() => void balance.refetch()}>
            Retry balance
          </Button>
        </>
      )}
      {!!(hoa?.invoice_count || balance.data?.amenity_charge_count) && (
        <nav className={styles.chargeLinks} aria-label="Charge details">
          {!!hoa?.invoice_count && (
            <Link to="/account/bills">
              <span>View HOA bills</span>
              <ChevronRight size={20} aria-hidden="true" />
            </Link>
          )}
          {!!balance.data?.amenity_charge_count && (
            <Link to="/account/amenity-charges">
              <span>View amenity charges</span>
              <ChevronRight size={20} aria-hidden="true" />
            </Link>
          )}
        </nav>
      )}
      <div
        id="account-payment-options"
        aria-label="HOA dues and payment method"
      >
        <h2 className={styles.mobileSectionTitle}>Your property</h2>
        {links.properties.map((property) => (
          <PayDues
            key={property.lot_id}
            lotId={property.lot_id}
            phase={property.phase}
            block={property.block}
            lot={property.lot}
            monthlyDuesCentavos={property.monthly_dues_centavos}
            linearPark={property.linear_park}
          />
        ))}
        {!links.properties.length && !links.isPending && <PayDues />}
      </div>
      <section className={styles.mobileRecords} aria-label="Account records">
        <h2>Records</h2>
        <nav>
          {!!hoa?.invoice_count && (
            <Link to="/account/bills">
              <ReceiptText size={20} aria-hidden="true" />
              <span>
                HOA bills<small>Posted monthly invoices</small>
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </Link>
          )}
          {!!balance.data?.amenity_charge_count && (
            <Link to="/account/amenity-charges">
              <ReceiptText size={20} aria-hidden="true" />
              <span>
                Amenity charges<small>Confirmed booking fees</small>
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </Link>
          )}
          <Link to="/account/payments">
            <ReceiptText size={20} aria-hidden="true" />
            <span>
              Payment history<small>Receipts available to your account</small>
            </span>
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
        </nav>
        {links.isSuccess && links.properties.length > 0 && (
          <LotLinkButton another />
        )}
      </section>
      <nav className={styles.tabs} aria-label="Account sections">
        <Link
          to="/account/lots"
          preventScrollReset
          aria-current={section === "properties" ? "page" : undefined}
        >
          Properties
        </Link>
        <Link
          to="/account/payments"
          preventScrollReset
          aria-current={section === "payments" ? "page" : undefined}
        >
          Payments
        </Link>
      </nav>
      <div className={styles.tabContent}>
        {section === "properties" ? (
          <div
            className={`${styles.properties} ${links.isSuccess && links.properties.length > 0 ? styles.linkedPropertiesOverview : ""}`}
          >
            <LotRegister account embedded />
          </div>
        ) : (
          <AccountPayments />
        )}
      </div>
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
                <ul className={styles.receipts} aria-label="Recorded receipts">
                  {query.data.rows.map((receipt) => (
                    <li key={receipt.id}>
                      <span className={styles.receiptIcon} aria-hidden="true">
                        <ReceiptText size={20} />
                      </span>
                      <div className={styles.receiptDetails}>
                        <h3>Receipt {receipt.or_number}</h3>
                        <p>
                          Lot {receipt.physical_id} ·{" "}
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
                        </p>
                      </div>
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
