import { useEffect, useId, useState, type ReactNode } from "react";
import { Check, ReceiptText } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useAuth } from "../../data/auth";
import { featureRpc } from "../../data/feature-records";
import { Button, Feedback, Skeleton } from "../../components/UI";
import { priceSchema } from "./BookingPrice";
import styles from "./BookingFeeApproval.module.css";

const reviewSchema = z.object({
  quote: priceSchema.nullable(),
  has_charge: z.boolean(),
  version: z.number().int(),
  status: z.string(),
});
const asAmount = (cents: number | null | undefined) =>
  cents == null ? "" : (cents / 100).toFixed(2);
const asCents = (amount: string) =>
  /^\d{1,11}(\.\d{1,2})?$/.test(amount)
    ? Number(amount.split(".")[0]) * 100 +
      Number((amount.split(".")[1] ?? "").padEnd(2, "0"))
    : null;
const money = (cents: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    cents / 100,
  );

export default function BookingFeeApproval({
  id,
  version,
  onSaved,
  onBusyChange,
  rejectAction,
  disabled = false,
}: {
  id: string;
  version: number;
  onSaved: () => void;
  onBusyChange: (busy: boolean) => void;
  rejectAction?: ReactNode;
  disabled?: boolean;
}) {
  const auth = useAuth();
  const fallbackAction = rejectAction ? (
    <div className={styles.footer}>{rejectAction}</div>
  ) : null;
  const query = useQuery({
    queryKey: ["booking-fee-review", auth.userId, id, version],
    enabled:
      !!auth.userId &&
      !auth.preview &&
      !auth.rolePreview &&
      !auth.memberPreview,
    retry: false,
    gcTime: 0,
    queryFn: async () =>
      reviewSchema.parse(
        await featureRpc("bfe_booking_fee_review", { p_id: id }),
      ),
  });
  if (auth.preview || auth.rolePreview || auth.memberPreview)
    return <p>Fee confirmation is unavailable in preview.</p>;
  if (query.isPending)
    return (
      <>
        <Skeleton variant="section" label="Loading booking fee confirmation" />
        {fallbackAction}
      </>
    );
  if (query.isError)
    return (
      <>
        <Feedback error={query.error} />
        <Button type="button" secondary onClick={() => void query.refetch()}>
          Try again
        </Button>
        {fallbackAction}
      </>
    );
  if (query.data.has_charge)
    return (
      <>
        <p>The fee has already been added to this account.</p>
        {fallbackAction}
      </>
    );
  if (
    query.data.version !== version ||
    !["Pending", "Approved"].includes(query.data.status)
  )
    return (
      <>
        <p>This booking changed. Reopen it before confirming the fee.</p>
        {fallbackAction}
      </>
    );
  return (
    <FeeForm
      key={`${id}:${version}`}
      id={id}
      version={version}
      data={query.data}
      onSaved={onSaved}
      onBusyChange={onBusyChange}
      rejectAction={rejectAction}
      disabled={disabled}
    />
  );
}

function FeeForm({
  id,
  version,
  data,
  onSaved,
  onBusyChange,
  rejectAction,
  disabled,
}: {
  id: string;
  version: number;
  data: z.infer<typeof reviewSchema>;
  onSaved: () => void;
  onBusyChange: (busy: boolean) => void;
  rejectAction?: ReactNode;
  disabled: boolean;
}) {
  const cache = useQueryClient();
  const hintId = useId();
  const [rental, setRental] = useState(asAmount(data.quote?.rental_centavos));
  // A listed reservation fee may be credited. Do not add it twice by default.
  const [reservation, setReservation] = useState(
    !data.quote || data.quote.reservation_centavos != null ? "" : "0.00",
  );
  const [bond, setBond] = useState(
    data.quote ? asAmount(data.quote.bond_centavos ?? 0) : "",
  );
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const amounts = [rental, reservation, bond].map(asCents);
  const valid = amounts.every(
    (value) => value !== null && value <= 1000000000000,
  );
  const feeLabels = [
    "rental / admission",
    "additional reservation fee",
    "refundable bond",
  ];
  const incompleteFees = feeLabels.filter(
    (_, index) => amounts[index] === null || amounts[index]! > 1000000000000,
  );
  const remaining = [
    ...incompleteFees.map((label) => `confirm ${label}`),
    ...(note.trim().length < 5 ? ["add a fee explanation"] : []),
    ...(!confirmed ? ["tick the confirmation box"] : []),
  ];
  const total = valid
    ? amounts.reduce<number>((sum, value) => sum + (value ?? 0), 0)
    : null;
  const save = useMutation({
    mutationFn: async () => {
      if (!valid || !confirmed)
        throw new Error("Check and confirm the fee first.");
      return featureRpc("bfe_approve_booking_with_fee", {
        p_id: id,
        p_version: version,
        p_rental: amounts[0],
        p_reservation: amounts[1],
        p_bond: amounts[2],
        p_note: note.trim(),
      });
    },
    onSuccess: async () => {
      await Promise.all(
        [
          "operations",
          "registry",
          "booking-charge",
          "booking-fee-review",
          "accounting",
          "office-review-inbox",
          "calendar-bookings",
          "office-facility-calendar",
          "home-bookings",
          "notifications",
          "account",
          "navigation-badges",
        ].map((key) => cache.invalidateQueries({ queryKey: [key] })),
      );
      onSaved();
    },
  });
  useEffect(() => {
    onBusyChange(save.isPending);
    return () => onBusyChange(false);
  }, [save.isPending, onBusyChange]);
  function change(set: (value: string) => void, value: string) {
    set(value);
    setConfirmed(false);
  }
  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <header className={styles.heading}>
        <span className={styles.icon}>
          <ReceiptText size={22} aria-hidden="true" />
        </span>
        <div>
          <h3>
            {data.status === "Pending"
              ? "Approve booking & confirm fee"
              : "Confirm booking fee"}
          </h3>
          <p>
            Check the amounts below. Confirmed fees will be added to Other and
            Total balance. Enter 0 only when no fee applies.
          </p>
        </div>
      </header>
      <fieldset disabled={save.isPending || disabled}>
        <legend className="sr-only">Booking fee amounts</legend>
        <div className={styles.amounts}>
          <label>
            Rental / admission (PHP)
            <input
              type="number"
              inputMode="decimal"
              min="0"
              max="10000000000"
              step="0.01"
              required
              placeholder="Enter amount"
              value={rental}
              onChange={(e) => change(setRental, e.target.value)}
            />
          </label>
          <label>
            Additional reservation fee (PHP)
            <input
              type="number"
              inputMode="decimal"
              min="0"
              max="10000000000"
              step="0.01"
              required
              placeholder="Enter amount"
              aria-describedby={
                data.quote?.reservation_centavos != null ? hintId : undefined
              }
              value={reservation}
              onChange={(e) => change(setReservation, e.target.value)}
            />
          </label>
          <label>
            Refundable bond (PHP)
            <input
              type="number"
              inputMode="decimal"
              min="0"
              max="10000000000"
              step="0.01"
              required
              placeholder="Enter amount"
              value={bond}
              onChange={(e) => change(setBond, e.target.value)}
            />
          </label>
        </div>
        {data.quote?.reservation_centavos != null && (
          <p id={hintId} className={styles.guidance}>
            Listed reservation fee: {money(data.quote.reservation_centavos)}.
            Enter only the extra amount due after any credit. Enter 0 if it is
            already included.
          </p>
        )}
        <label>
          Fee explanation
          <textarea
            rows={2}
            required
            minLength={5}
            maxLength={500}
            value={note}
            onChange={(e) => change(setNote, e.target.value)}
            placeholder="Explain the rate, any credit or free use"
          />
        </label>
        <div className={styles.total} role="status" aria-live="polite">
          <div>
            <span>Total to add</span>
            <small>Includes any refundable bond. No payment is recorded.</small>
          </div>
          <strong>
            {total === null ? "Fee confirmation needed" : money(total)}
          </strong>
        </div>
        {incompleteFees.length > 0 && (
          <p className={styles.guidance}>
            Confirm {incompleteFees.join(", ")}. A blank field is not a zero
            fee.
          </p>
        )}
        <label className={styles.confirm}>
          <input
            type="checkbox"
            required
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span>
            I have checked these amounts and confirm they should be added to the
            account.
          </span>
        </label>
      </fieldset>
      <Feedback error={save.error} />
      {remaining.length > 0 && (
        <p className={styles.guidance}>To approve: {remaining.join("; ")}.</p>
      )}
      <div className={styles.footer}>
        {rejectAction}
        <Button
          type="submit"
          pending={save.isPending}
          disabled={disabled || !valid || !confirmed || note.trim().length < 5}
        >
          <Check size={18} aria-hidden="true" />
          {data.status === "Pending"
            ? "Approve & add fee"
            : "Confirm & add fee"}
        </Button>
      </div>
    </form>
  );
}
