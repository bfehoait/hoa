import { Link } from "../../components/AccessLink";
import { ChevronRight } from "lucide-react";
import { useAccountBalance } from "../../data/hoa-balance";
import { balanceMoney } from "../../../../../packages/shared/src/hoa-balance";
import styles from "./ResidentHome.module.css";

export default function HomeownerSummary() {
  const balance = useAccountBalance();
  const data = balance.data;
  const empty =
    data &&
    !data.hoa.needs_review &&
    !data.hoa.invoice_count &&
    !data.amenity_charge_count;
  return (
    <Link
      to="/account"
      className={styles.balanceShortcut}
      aria-label="View My account balance"
    >
      <span>
        <span>Total balance</span>
        <strong>
          {data?.hoa.needs_review
            ? "Under review"
            : data
              ? balanceMoney(data.total_balance_centavos)
              : balance.isPending && balance.allowed
                ? "Loading..."
                : "Unavailable"}
        </strong>
      </span>
      <span>
        {empty ? "No posted charges" : "View account"}
        <ChevronRight size={20} aria-hidden="true" />
      </span>
    </Link>
  );
}
