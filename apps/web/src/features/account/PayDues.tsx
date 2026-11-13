import { useState } from "react";
import { ArrowUpRight, Copy, Info, House, ChevronRight } from "lucide-react";
import { Link } from "../../components/AccessLink";
import { buyaniAccount } from "../../../../../packages/shared/src/payment";
import { money } from "../../../../../packages/shared/src";
import { Button, Feedback } from "../../components/UI";
import styles from "./PayDues.module.css";

export default function PayDues({
  phase,
  block,
  lot,
  monthlyDuesCentavos,
  linearPark,
  lotId,
}: {
  phase?: number;
  block?: number;
  lot?: number;
  monthlyDuesCentavos?: number | null;
  linearPark?: "yes" | "no" | null;
  lotId?: string;
}) {
  const account =
    phase && block && lot ? buyaniAccount(phase, block, lot) : null;
  const [message, setMessage] = useState("");
  return (
    <section className={`${styles.panel} ${lotId ? styles.linkedPanel : ""}`}>
      {lotId && (
        <Link className={styles.propertyRow} to={`/account/lots/${lotId}`}>
          <House size={22} aria-hidden="true" />
          <span>
            <strong>
              Lot {phase}-{String(block).padStart(2, "0")}-
              {String(lot).padStart(3, "0")}
            </strong>
            <small>
              Phase {phase} · Block {block} · Lot {lot}
            </small>
          </span>
          <ChevronRight size={20} aria-hidden="true" />
        </Link>
      )}
      <div className={styles.heading}>
        <h2>HOA dues & payment</h2>
        {monthlyDuesCentavos != null && (
          <span className={styles.rateBadge}>Monthly rate</span>
        )}
      </div>
      {account && (
        <p className={styles.note}>
          Phase {phase} · Block {block} · Lot {lot}
        </p>
      )}
      {monthlyDuesCentavos !== undefined && (
        <>
          <p className={styles.rate}>
            {monthlyDuesCentavos === null ? (
              "Monthly HOA rate unavailable"
            ) : (
              <>
                <strong>{money(monthlyDuesCentavos)}</strong>
                <span> / month</span>
              </>
            )}
          </p>
          <div className={styles.rateNotice}>
            <Info size={20} aria-hidden="true" />
            <p>
              {linearPark === "yes"
                ? "Linear Park lot"
                : linearPark === "no"
                  ? "Non-linear-park lot"
                  : "Linear Park classification needs Office review"}
              . Recurring rate only; this is not your outstanding balance.
            </p>
          </div>
        </>
      )}
      {account && (
        <div className={styles.account}>
          <span>Account reference for this lot</span>
          <div className={styles.reference}>
            <strong>{account}</strong>
            <Button
              secondary
              aria-label="Copy account reference"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(account);
                  setMessage("Account reference copied.");
                } catch {
                  setMessage(
                    "Copy unavailable. Select and copy the reference above.",
                  );
                }
              }}
            >
              <Copy size={20} aria-hidden="true" />
            </Button>
          </div>
          <span>
            Check this matches your registered Buyani account, including any
            suffix.
          </span>
        </div>
      )}
      <p className={styles.note}>
        Payment method: <strong>Buyani</strong>. Continue to your provider
        account to pay. Payment confirmation appears here after it is recorded.
      </p>
      <div className={styles.actions}>
        <a
          className={styles.pay}
          href="https://pay.buyani.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Continue to Buyani <ArrowUpRight size={20} aria-hidden="true" />
        </a>
        <span className={styles.note}>Opens a new tab</span>
      </div>
      <Feedback message={message} />
    </section>
  );
}
