import { Link } from "../../components/AccessLink";
import { ChevronRight } from "lucide-react";
import { useLinkedPropertyAddress } from "../../data/linked-properties";
import styles from "./ResidentHome.module.css";
import { useHoaBalance } from "../../data/hoa-balance";
import { balanceMoney } from "../../../../../packages/shared/src/hoa-balance";

export default function HomeownerSummary() {
  const { address, properties } = useLinkedPropertyAddress();
  const balance = useHoaBalance();
  const billed = !!balance.data?.invoice_count && !balance.data.needs_review;
  return (
    <section
      className={styles.accountCard}
      aria-labelledby="household-account-title"
    >
      <div className={styles.heading}>
        <h2 id="household-account-title">My account</h2>
        <Link className={styles.accountLink} to="/account">
          View account <ChevronRight size={18} aria-hidden="true" />
        </Link>
      </div>
      <dl className={styles.accountDetails}>
        <div>
          <dt>
            {properties.length
              ? "Linked household address"
              : "Household address"}
          </dt>
          <dd>{address}</dd>
        </div>
        <div>
          <dt>Recorded HOA balance</dt>
          <dd>
            {billed && balance.data
              ? balanceMoney(balance.data.total_recorded_balance_centavos)
              : balance.data?.needs_review
                ? "Under review"
                : balance.isError
                  ? "Unavailable"
                  : balance.isPending && balance.allowed
                    ? "Checking…"
                    : balance.data
                      ? "No bills yet"
                      : "Unavailable"}
          </dd>
        </div>
      </dl>
      <p className={styles.accountNote}>
        {billed
          ? "HOA invoices only. Water, other charges and unverified historical coverage are not included."
          : balance.isError
            ? "Open My account to retry the balance connection."
            : "Monthly bills appear after Office verification and posting."}
      </p>
    </section>
  );
}
