import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { makeClient, useAuth } from "../../data/auth";
import { featureRpc } from "../../data/feature-records";
import { downloadFile } from "../../data/download";
import { Button, Feedback, Skeleton } from "../../components/UI";
import { priceSchema } from "./BookingPrice";
import styles from "./BookingFeeApproval.module.css";

export const checkoutSchema = z.object({
  checkout: z
    .object({
      reference: z.string(),
      hold_until: z.string(),
      status: z.string(),
      expired: z.boolean(),
      proof_path: z.string().nullable(),
      offered_centavos: z.number().nullable(),
      receipt_number: z.string().nullable(),
      verified_centavos: z.number().nullable(),
      verified_at: z.string().nullable(),
      download_name: z.string().optional(),
    })
    .nullable(),
  payment_settings: z
    .object({
      instructions: z.string(),
      reservation_basis: z.enum(["rental", "rental_and_bond"]).nullable(),
    })
    .nullable(),
});
export const cents = (value: string) =>
  /^\d{1,9}(\.\d{1,2})?$/.test(value)
    ? Number(value.split(".")[0]) * 100 +
      Number((value.split(".")[1] ?? "").padEnd(2, "0"))
    : null;
const money = (n: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    n / 100,
  );

export default function BookingCheckout({
  id,
  version,
  office = false,
  onSaved,
  onBusyChange,
  rejectAction,
}: {
  id: string;
  version: number;
  office?: boolean;
  onSaved?: () => void;
  onBusyChange?: (busy: boolean) => void;
  rejectAction?: ReactNode;
}) {
  const auth = useAuth(),
    cache = useQueryClient();
  const query = useQuery({
    queryKey: ["booking-checkout", auth.userId, id, version],
    enabled:
      !!auth.userId &&
      !auth.preview &&
      !auth.rolePreview &&
      !auth.memberPreview,
    retry: false,
    refetchInterval: 30000,
    queryFn: async () =>
      checkoutSchema.parse(
        await featureRpc("bfe_booking_checkout_read", { p_id: id }),
      ),
  });
  const quote = useQuery({
    queryKey: ["booking-checkout-quote", auth.userId, id, version, office],
    enabled: query.isSuccess && !!query.data.checkout,
    retry: false,
    queryFn: async () =>
      z
        .object({ quote: priceSchema.nullable() })
        .parse(
          await featureRpc(
            office ? "bfe_booking_fee_review" : "bfe_booking_price",
            { p_id: id },
          ),
        ),
  });
  const [notice, setNotice] = useState("");
  const refresh = async () => {
    await Promise.all(
      [
        "booking-checkout",
        "booking-fee-review",
        "booking-checkout-quote",
        "operations",
        "operations-slots",
        "office-review-inbox",
        "booking-charge",
        "account",
        "home-bookings",
        "registry",
      ].map((key) => cache.invalidateQueries({ queryKey: [key] })),
    );
  };
  const approve = useMutation({
    mutationFn: async (form: FormData) => {
      const rental = cents(String(form.get("rental") ?? "")),
        bond = cents(String(form.get("bond") ?? "")),
        paid = cents(String(form.get("paid") ?? ""));
      if (rental === null || bond === null || paid === null)
        throw new Error("Enter valid amounts with up to two decimal places.");
      onBusyChange?.(true);
      try {
        return await featureRpc("bfe_approve_excel_booking", {
          p_id: id,
          p_version: version,
          p_rental: rental,
          p_bond: bond,
          p_paid: paid,
          p_receipt: form.get("receipt"),
          p_note: form.get("note"),
        });
      } finally {
        onBusyChange?.(false);
      }
    },
    onSuccess: async () => {
      await refresh();
      onSaved?.();
    },
  });
  const upload = useMutation({
    mutationFn: async (form: FormData) => {
      const file = form.get("proof"),
        amount = cents(String(form.get("paid") ?? ""));
      if (
        !(file instanceof File) ||
        !file.size ||
        file.size > 8 * 1024 * 1024 ||
        !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
          file.type,
        )
      )
        throw new Error("Choose a JPEG, PNG, WebP or PDF up to 8 MB.");
      if (amount === null || amount <= 0)
        throw new Error("Enter the payment amount.");
      const total = quote.data?.quote?.total_centavos;
      if (total == null)
        throw new Error(
          "Office must confirm the booking fee before online payment.",
        );
      if (amount < Math.ceil(total * 0.2) || amount > total)
        throw new Error(
          "Enter at least 20% of the Total Booking Fee, up to the full total.",
        );
      const client = makeClient();
      if (!client) throw new Error("Sign in to upload payment proof.");
      const ext = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "application/pdf": "pdf",
      }[file.type];
      const path = `${auth.userId}/${id}/${crypto.randomUUID()}.${ext}`;
      const result = await client.storage
        .from("bfe-booking-proofs")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (result.error)
        throw new Error("The proof could not be uploaded. Please retry.");
      await featureRpc("bfe_submit_booking_proof", {
        p_id: id,
        p_path: path,
        p_amount: amount,
      });
    },
    onSuccess: async () => {
      setNotice(
        "Proof submitted. Office will verify the payment before confirming your booking.",
      );
      await refresh();
    },
  });
  const proof = useMutation({
    mutationFn: async () => {
      const client = makeClient(),
        path = query.data?.checkout?.proof_path;
      if (!client || !path) throw new Error("Proof is unavailable.");
      const result = await client.storage
        .from("bfe-booking-proofs")
        .download(path);
      if (result.error)
        throw new Error("Proof is unavailable for this account.");
      const url = URL.createObjectURL(result.data);
      downloadFile(
        url,
        `${query.data?.checkout?.download_name ?? query.data?.checkout?.reference}.${path.split(".").pop()}`,
      );
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  });
  if (auth.preview || auth.rolePreview || auth.memberPreview) return null;
  if (query.isPending)
    return (
      <Skeleton variant="section" label="Loading booking payment details" />
    );
  if (query.isError) return <Feedback error={query.error} />;
  const c = query.data.checkout;
  if (!c) return null;
  const settings = query.data.payment_settings;
  return (
    <section className={styles.panel} aria-label="Booking payment">
      <dl className="detail-list">
        <div>
          <dt>Booking Reference</dt>
          <dd>
            <strong>{c.reference}</strong>
          </dd>
        </div>
        {c.receipt_number && (
          <div>
            <dt>Official Receipt Number</dt>
            <dd>{c.receipt_number}</dd>
          </div>
        )}
        {c.verified_centavos !== null && (
          <div>
            <dt>Verified Payment</dt>
            <dd>{money(c.verified_centavos)}</dd>
          </div>
        )}
      </dl>
      {!c.verified_at && c.status === "Pending" && (
        <p>
          {c.expired
            ? "The three-day pencil booking has ended. Submit a new booking to check availability."
            : `Pencil booked until ${new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(c.hold_until))}. This is not guaranteed. Whoever pays first will have the confirmed booking after Office verifies payment.`}
        </p>
      )}
      {c.proof_path && (
        <Button
          secondary
          pending={proof.isPending}
          onClick={() => proof.mutate()}
        >
          Save Payment Proof
        </Button>
      )}
      <Feedback error={proof.error} />
      {!office && c.status === "Pending" && !c.expired && !c.verified_at && (
        <>
          <h3>Pay Now</h3>
          {settings?.instructions ? (
            <>
              <p style={{ whiteSpace: "pre-wrap" }}>{settings.instructions}</p>
              <p>
                Reservation payment must be at least 20% of the Total Booking
                Fee. It is credited toward your total.
              </p>
              <form
                className={styles.form}
                onSubmit={(e) => {
                  e.preventDefault();
                  upload.mutate(new FormData(e.currentTarget));
                }}
              >
                <label>
                  Reservation Payment (PHP)
                  <input
                    name="paid"
                    inputMode="decimal"
                    required
                    aria-describedby="booking-payment-minimum"
                  />
                </label>
                <label>
                  Upload Proof of Payment
                  <input
                    name="proof"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    required
                  />
                </label>
                <p id="booking-payment-minimum">
                  {quote.data?.quote?.total_centavos != null && (
                    <>
                      Minimum payment:{" "}
                      {money(Math.ceil(quote.data.quote.total_centavos * 0.2))}
                      .{" "}
                    </>
                  )}
                  JPEG, PNG, WebP or PDF, up to 8 MB. Uploading proof does not
                  confirm payment.
                </p>
                <Button
                  type="submit"
                  pending={upload.isPending}
                  disabled={
                    quote.isPending ||
                    quote.isError ||
                    quote.data?.quote?.total_centavos == null
                  }
                >
                  Submit Payment Proof
                </Button>
                <Feedback error={upload.error} />
              </form>
            </>
          ) : (
            <p>
              Online payment details are not available yet. Visit the HOA office
              and present your booking reference.{" "}
            </p>
          )}
        </>
      )}
      {office && c.status === "Pending" && !c.expired && !c.verified_at && (
        <>
          <h3>Verify Payment and Confirm Booking</h3>
          <p>
            Match the payment proof or receive payment at the office, issue an
            official receipt, then enter its number below. The reservation
            payment is credited, not added as a second fee.
          </p>
          {quote.isPending ? (
            <Skeleton />
          ) : (
            <form
              className={styles.form}
              onSubmit={(e) => {
                e.preventDefault();
                approve.mutate(new FormData(e.currentTarget));
              }}
            >
              <div className={styles.amounts}>
                <label>
                  Rental / Admission (PHP)
                  <input
                    name="rental"
                    key={`rental-${quote.data?.quote?.rental_centavos}`}
                    defaultValue={
                      quote.data?.quote?.rental_centavos == null
                        ? ""
                        : (quote.data.quote.rental_centavos / 100).toFixed(2)
                    }
                    inputMode="decimal"
                    required
                  />
                </label>
                <label>
                  Refundable Bond (PHP)
                  <input
                    name="bond"
                    defaultValue={(
                      (quote.data?.quote?.bond_centavos ?? 0) / 100
                    ).toFixed(2)}
                    inputMode="decimal"
                    required
                  />
                </label>
                <label>
                  Payment Received (PHP)
                  <input
                    name="paid"
                    defaultValue={
                      c.offered_centavos == null
                        ? ""
                        : (c.offered_centavos / 100).toFixed(2)
                    }
                    inputMode="decimal"
                    required
                  />
                </label>
              </div>
              <label>
                Official Receipt Number
                <input name="receipt" maxLength={100} required />
              </label>
              <label>
                Payment Verification Note
                <textarea name="note" minLength={5} maxLength={500} required />
              </label>
              <label>
                <input type="checkbox" required /> I matched or received this
                payment and issued the receipt.
              </label>
              <Feedback error={quote.error ?? approve.error} />
              <div className={styles.footer}>
                {rejectAction}
                <Button
                  type="submit"
                  pending={approve.isPending}
                  disabled={quote.isError}
                >
                  Approve and Record Payment
                </Button>
              </div>
            </form>
          )}
        </>
      )}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
