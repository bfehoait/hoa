import { useState } from "react";
import { useHoaBalance } from "../../data/hoa-balance";
import {
  balanceMoney,
  billingMonth,
} from "../../../../../packages/shared/src/hoa-balance";
import { Badge, Button, Feedback, Skeleton } from "../../components/UI";
import styles from "./HouseholdAccount.module.css";

export default function MonthlyHoaCharges() {
  const [page, setPage] = useState(0);
  const query = useHoaBalance(page, page > 0);
  if (query.data && page > 0 && page * 20 >= query.data.invoice_count)
    setPage(0);
  if (!query.allowed)
    return (
      <p className={styles.note}>
        Own finance access is required to view monthly bills.
      </p>
    );
  if (query.isPending) return <Skeleton />;
  if (query.isError)
    return (
      <>
        <Feedback error={query.error} />
        <Button secondary onClick={() => void query.refetch()}>
          Retry monthly bills
        </Button>
      </>
    );
  if (!query.data) return null;
  const data = query.data;
  return (
    <>
      <p className={styles.note}>
        Posted HOA invoices through {billingMonth(data.as_of.slice(0, 7))}.
        Months without posted bills are not counted as unpaid. Historical
        receipt coverage needs Office verification.
      </p>
      {data.needs_review && (
        <p role="alert">
          These allocations need Office reconciliation before a balance can be
          confirmed.
        </p>
      )}
      {BigInt(data.unallocated_centavos) > 0n && (
        <p className={styles.note}>
          {balanceMoney(data.unallocated_centavos)} in posted payments awaits
          allocation. It has not been subtracted from an arbitrary month.
        </p>
      )}
      {data.rows.length ? (
        <ul className={styles.invoiceList}>
          {data.rows.map((row) => (
            <li key={row.id}>
              <div className={styles.invoiceHeading}>
                <div>
                  <strong>{billingMonth(row.period)}</strong>
                  <p>Lot {row.physical_id}</p>
                  <p>
                    Due{" "}
                    {new Date(
                      `${row.due_date}T00:00:00+08:00`,
                    ).toLocaleDateString("en-PH", {
                      dateStyle: "medium",
                      timeZone: "Asia/Manila",
                    })}
                  </p>
                </div>
                <Badge tone={row.status === "Paid" ? "green" : "neutral"}>
                  {row.status}
                </Badge>
              </div>
              <dl>
                <div>
                  <dt>Billed</dt>
                  <dd>{balanceMoney(row.billed_centavos)}</dd>
                </div>
                <div>
                  <dt>Applied</dt>
                  <dd>{balanceMoney(row.allocated_centavos)}</dd>
                </div>
                <div>
                  <dt>Remaining</dt>
                  <dd>
                    <strong>{balanceMoney(row.balance_centavos)}</strong>
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      ) : (
        <p>
          No posted HOA bills are available for your current linked properties.
        </p>
      )}
      {data.invoice_count > 20 && (
        <nav className={styles.pagination} aria-label="Monthly HOA bill pages">
          <Button
            secondary
            disabled={page === 0 || query.isFetching}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span>
            Page {page + 1} of {Math.ceil(data.invoice_count / 20)}
          </span>
          <Button
            secondary
            disabled={(page + 1) * 20 >= data.invoice_count || query.isFetching}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </nav>
      )}
    </>
  );
}
