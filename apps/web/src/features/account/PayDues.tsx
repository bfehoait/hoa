import { useState } from "react";
import { ArrowUpRight, Copy } from "lucide-react";
import { buyaniAccount } from "../../../../../packages/shared/src/payment";
import { Button, Feedback } from "../../components/UI";
import styles from "./PayDues.module.css";

export default function PayDues({
  phase,
  block,
  lot,
}: {
  phase?: number;
  block?: number;
  lot?: number;
}) {
  const account =
    phase && block && lot ? buyaniAccount(phase, block, lot) : null;
  const [message, setMessage] = useState("");
  return (
    <section className={styles.panel}>
      <h2>Pay your dues</h2>
      <p>
        Continue to Buyani to view your provider account and pay your HOA dues.
      </p>
      <div className={styles.account}>
        <span>
          {account ? "Account number for this lot" : "Example account number"}
        </span>
        <strong>{account || "BF1-019-026"}</strong>
        <span>
          {account
            ? "Check this matches your registered Buyani account."
            : "Phase 1 · Block 19 · Lot 26 — replace with your own lot details."}
        </span>
      </div>
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
