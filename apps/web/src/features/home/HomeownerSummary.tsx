import { Link } from "../../components/AccessLink";
import { ChevronRight } from "lucide-react";
import { useLinkedPropertyAddress } from "../../data/linked-properties";
import styles from "./ResidentHome.module.css";
import { useAccountBalance } from "../../data/hoa-balance";
import { balanceMoney } from "../../../../../packages/shared/src/hoa-balance";

export default function HomeownerSummary() {
  const { address, properties } = useLinkedPropertyAddress();
  const balance = useAccountBalance();
  const billed =
    !!(balance.data?.hoa.invoice_count || balance.data?.amenity_charge_count) &&
    !balance.data?.hoa.needs_review;
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
          <dt>Total balance</dt>
          <dd>
            {billed && balance.data
              ? balanceMoney(balance.data.total_balance_centavos)
              : balance.data?.hoa.needs_review
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
          ? "HOA dues and your confirmed amenity charges. Water dues are unavailable."
          : balance.isError
            ? "Open My account to retry the balance connection."
            : "Bills and amenity charges appear after Office confirmation. Water dues are unavailable."}
      </p>
    </section>
  );
}
