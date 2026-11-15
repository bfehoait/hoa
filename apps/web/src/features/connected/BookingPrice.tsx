import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { featureRpc } from "../../data/feature-records";
import { useAuth } from "../../data/auth";
import { Feedback, Skeleton } from "../../components/UI";
import styles from "./BookingSchedule.module.css";

export const priceSchema = z.object({
  policy_date: z.iso.date(),
  use_type: z.string(),
  period: z.string(),
  minutes: z.number(),
  adults: z.number().int(),
  children: z.number().int(),
  rental_centavos: z.number().int().nullable(),
  bond_centavos: z.number().int().nullable(),
  reservation_centavos: z.number().int().nullable(),
  total_centavos: z.number().int().nullable(),
  hourly_day_centavos: z.number().int().nullable(),
  hourly_night_centavos: z.number().int().nullable(),
  notes: z.array(z.string()),
});
const money = (value: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    value / 100,
  );
export function PriceBreakdown({
  price,
}: {
  price: z.infer<typeof priceSchema>;
}) {
  return (
    <section className={styles.price} aria-label="Booking price estimate">
      <h3>Booking price estimate</h3>
      <p>
        Based on the amenities guidelines dated{" "}
        {new Intl.DateTimeFormat("en-PH", {
          day: "numeric",
          month: "long",
          year: "numeric",
          timeZone: "Asia/Manila",
        }).format(new Date(`${price.policy_date}T12:00:00+08:00`))}
        .
      </p>
      <dl className="detail-list">
        <div>
          <dt>Selected duration</dt>
          <dd>{price.minutes / 60} hours</dd>
        </div>
        <div>
          <dt>Use</dt>
          <dd>
            {(
              {
                hall: "Function Hall",
                "court-sports": "Court — sports",
                "court-function": "Court — special function",
                "pool-exclusive": "Pool — exclusive use",
                "pool-individual": "Pool — individual admission",
              } as Record<string, string>
            )[price.use_type] ?? price.use_type}
          </dd>
        </div>
        <div>
          <dt>Rental / admission</dt>
          <dd>
            {price.rental_centavos === null
              ? "Office confirmation needed"
              : money(price.rental_centavos)}
          </dd>
        </div>
        {price.bond_centavos !== null && (
          <div>
            <dt>Refundable bond</dt>
            <dd>{money(price.bond_centavos)}</dd>
          </div>
        )}
        {price.reservation_centavos !== null && (
          <div>
            <dt>Listed reservation fee</dt>
            <dd>
              {money(price.reservation_centavos)} — Office confirms how it
              applies
            </dd>
          </div>
        )}
        {price.rental_centavos !== null && price.bond_centavos !== null && (
          <div>
            <dt>Rental + refundable bond</dt>
            <dd>{money(price.rental_centavos + price.bond_centavos)}</dd>
          </div>
        )}
        {price.hourly_day_centavos !== null &&
          price.hourly_night_centavos !== null && (
            <div>
              <dt>Published hourly rates</dt>
              <dd>
                {money(price.hourly_day_centavos)} daytime /{" "}
                {money(price.hourly_night_centavos)} nighttime
              </dd>
            </div>
          )}
        {price.use_type === "pool-individual" && (
          <div>
            <dt>Guests</dt>
            <dd>
              {price.adults} adults · {price.children} children
            </dd>
          </div>
        )}
        <div>
          <dt>Total estimate</dt>
          <dd>
            {price.total_centavos === null
              ? "Office confirmation needed"
              : money(price.total_centavos)}
          </dd>
        </div>
      </dl>
      <details>
        <summary>How this price is worked out</summary>
        <ul>
          {price.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </details>
      <p>No payment or account charge is recorded by this estimate.</p>
    </section>
  );
}
export default function BookingPrice({ id }: { id: string }) {
  const auth = useAuth();
  const preview = auth.preview || !!auth.rolePreview || !!auth.memberPreview;
  const query = useQuery({
    queryKey: ["booking-price", auth.userId, id],
    enabled: !!auth.userId && !preview,
    retry: false,
    staleTime: 300000,
    queryFn: async () =>
      z
        .object({ quote: priceSchema.nullable() })
        .parse(await featureRpc("bfe_booking_price", { p_id: id })),
  });
  if (preview)
    return <p>Booking price estimates are not shown in account preview.</p>;
  if (query.isPending)
    return <Skeleton variant="section" label="Loading price estimate" />;
  if (query.isError)
    return (
      <>
        <p>Price estimate unavailable. Office can confirm the fee.</p>
        <Feedback error={query.error} />
      </>
    );
  return query.data?.quote ? (
    <PriceBreakdown price={query.data.quote} />
  ) : (
    <p>
      No price estimate was saved with this earlier booking. Office confirms its
      fee.
    </p>
  );
}
