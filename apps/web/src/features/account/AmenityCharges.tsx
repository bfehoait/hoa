import { useState } from "react";
import { useAccountBalance } from "../../data/hoa-balance";
import { balanceMoney } from "../../../../../packages/shared/src/hoa-balance";
import { Button, Feedback, Skeleton } from "../../components/UI";
import styles from "./HouseholdAccount.module.css";

export default function AmenityCharges() {
  const [page, setPage] = useState(0);
  const query = useAccountBalance(page);
  if (!query.allowed) return <p>Own Finance access is required.</p>;
  if (query.isPending) return <Skeleton />;
  if (query.isError)
    return (
      <>
        <Feedback error={query.error} />
        <Button secondary onClick={() => void query.refetch()}>
          Retry charges
        </Button>
      </>
    );
  if (!query.data) return null;
  return (
    <>
      <p className={styles.note}>
        Office-confirmed fees for your bookings. Refundable bonds are listed
        separately within the amount due. Cancellation does not automatically
        waive fees or confirm a refund.
      </p>
      {!query.data.rows.length && <p>No confirmed amenity charges.</p>}
      <ul className={styles.invoiceList}>
        {query.data.rows.map((row) => (
          <li key={row.id}>
            <div>
              <strong>{row.facility_name}</strong>
              <p>
                {new Date(row.starts_at).toLocaleString("en-PH", {
                  timeZone: "Asia/Manila",
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
              <p>
                Rental {balanceMoney(row.rental_centavos)} · Additional
                reservation fee {balanceMoney(row.reservation_centavos)} ·
                Refundable bond {balanceMoney(row.bond_centavos)}
              </p>
              <small>Charge reference: {row.id}</small>
            </div>
            <dl>
              <div>
                <dt>Charge</dt>
                <dd>{balanceMoney(row.amount_centavos)}</dd>
              </div>
              <div>
                <dt>Paid</dt>
                <dd>{balanceMoney(row.paid_centavos)}</dd>
              </div>
              <div>
                <dt>Balance</dt>
                <dd>{balanceMoney(row.balance_centavos)}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
      {query.data.amenity_charge_count > 20 && (
        <div className="form-actions">
          <Button secondary disabled={!page} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span>Page {page + 1}</span>
          <Button
            secondary
            disabled={(page + 1) * 20 >= query.data.amenity_charge_count}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </>
  );
}
