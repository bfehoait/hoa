import { useState } from "react";
import {
  ArrowRight,
  ChevronRight,
  CalendarDays,
  CarFront,
  ClipboardCheck,
  CreditCard,
  Eye,
  EyeOff,
  FolderClosed,
  KeyRound,
  MessageSquare,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";
import { money } from "../../../../../packages/shared/src";
import { canOpenPath } from "../../../../../packages/shared/src/auth";
import { Link } from "../../components/AccessLink";
import { useAuth } from "../../data/auth";
import { usePermissions } from "../../data/permissions";
import styles from "./Home.module.css";

const shortcuts = [
  { title: "Bills", to: "/account", icon: ReceiptText },
  { title: "Payments", to: "/account/payments", icon: CreditCard },
  { title: "Concerns", to: "/services/requests", icon: MessageSquare },
  { title: "Gate pass", to: "/services/visitors", icon: KeyRound },
  { title: "Amenities", to: "/services/bookings", icon: CalendarDays },
  { title: "Documents", to: "/more/documents", icon: FolderClosed },
  { title: "Vehicles", to: "/more/vehicles", icon: CarFront },
  { title: "Permits", to: "/more/permits", icon: ClipboardCheck },
];

/**
 * The signed-in household summary.
 *
 * Billing has no connected server source yet, so the amount shown is a real
 * zero — the account holds no recorded charge — and the card says exactly that
 * rather than implying a bill was issued and settled. No figure here is
 * invented, and none of these links grants an approval.
 */
export default function HomeownerSummary() {
  const auth = useAuth();
  const permissions = usePermissions();
  const [hidden, setHidden] = useState(false);
  const allowed = (to: string) =>
    !!auth.member && canOpenPath(auth.member, to) && permissions.allowsPath(to);
  const links = shortcuts.filter((item) => allowed(item.to));
  return (
    <>
      <section className={styles.accountGrid} aria-label="Household account">
        <article className={styles.balanceCard}>
          <div className={styles.balanceHeader}>
            <h2>Household balance</h2>
            <button
              type="button"
              onClick={() => setHidden(!hidden)}
              className={styles.visibility}
              aria-label={hidden ? "Show balance" : "Hide balance"}
              aria-pressed={hidden}
            >
              {hidden ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <p className={styles.amount}>
            {hidden ? (
              <span aria-label="Balance hidden">••••••</span>
            ) : (
              money(0)
            )}
          </p>
          <p className={styles.due}>
            No charges are recorded in your account yet.
          </p>
          {allowed("/account") && (
            <Link className={styles.statementButton} to="/account">
              <ReceiptText size={20} aria-hidden="true" />
              View account
              <ArrowRight size={20} aria-hidden="true" />
            </Link>
          )}
          <p className={styles.balanceFootnote}>
            <ShieldCheck size={14} aria-hidden="true" />
            Billing is not connected yet · this is not a bill
          </p>
        </article>
      </section>
      {links.length > 0 && (
        <section className={styles.services} aria-labelledby="shortcuts-title">
          <div className="section-title">
            <h2 id="shortcuts-title">Your home, made simple</h2>
            <Link className="text-link" to="/services">
              All services
              <ChevronRight size={18} aria-hidden="true" />
            </Link>
          </div>
          <div className={styles.shortcutGrid}>
            {links.map(({ title, to, icon: Icon }) => (
              <Link key={title} to={to}>
                <span className={styles.shortcutIcon}>
                  <Icon size={28} aria-hidden="true" />
                </span>
                {title}
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
