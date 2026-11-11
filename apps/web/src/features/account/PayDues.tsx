import { useState } from "react";
import { ArrowUpRight, Copy } from "lucide-react";
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
}: {
  phase?: number;
  block?: number;
  lot?: number;
  monthlyDuesCentavos?: number | null;
  linearPark?: "yes" | "no" | null;
}) {
  const account =
    phase && block && lot ? buyaniAccount(phase, block, lot) : null;
  const [message, setMessage] = useState("");
  return (
    <section className={styles.panel}>
      <h2>HOA dues & payment</h2>
      {account && (
        <p>
          Phase {phase} · Block {block} · Lot {lot}
        </p>
      )}
      {monthlyDuesCentavos !== undefined && (
        <p>
          <strong>
            {monthlyDuesCentavos === null
              ? "Monthly HOA rate unavailable"
              : `${money(monthlyDuesCentavos)} / month`}
          </strong>
          <br />
          {linearPark === "yes"
            ? "Linear Park lot"
            : linearPark === "no"
              ? "Non-linear-park lot"
              : "Linear Park classification needs Office review"}
          . Recurring rate only; this is not your outstanding balance.
        </p>
      )}
      <p>
        Payment method: <strong>Buyani</strong>. Continue to your provider
        account to pay.
      </p>
      {account && (
        <div className={styles.account}>
          <span>Account reference for this lot</span>
          <strong>{account}</strong>
          <span>Check this matches your registered Buyani account.</span>
        </div>
      )}
      <p className={styles.note}>
        Use your registered Buyani account; some references include an
        additional suffix. Payment confirmation appears here only after it is
        recorded.
      </p>
      <div className={styles.actions}>
        {account && (
          <Button
            secondary
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(account);
                setMessage("Account number copied.");
              } catch {
                setMessage(
                  "Copy unavailable. Select and copy the account number above.",
                );
              }
            }}
          >
            <Copy size={20} />
            Copy account number
          </Button>
        )}
        <a
          className={styles.pay}
          href="https://pay.buyani.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Continue to Buyani <ArrowUpRight size={20} />
        </a>
        <span className={styles.note}>Opens a new tab</span>
      </div>
      <Feedback message={message} />
    </section>
  );
}
