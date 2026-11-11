import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { amenityChargeSchema } from "../../../../../packages/shared/src/account-balance";
import { balanceMoney } from "../../../../../packages/shared/src/hoa-balance";
import { featureRpc } from "../../data/feature-records";
import { useAuth } from "../../data/auth";
import { Link } from "../../components/AccessLink";
import { Feedback } from "../../components/UI";

export default function BookingCharge({
  id,
  office,
}: {
  id: string;
  office: boolean;
}) {
  const auth = useAuth();
  const query = useQuery({
    queryKey: ["booking-charge", auth.userId, id],
    enabled: !!auth.userId && !auth.preview && !auth.rolePreview,
    retry: false,
    gcTime: 0,
    queryFn: async () =>
      z
        .object({
          charge: amenityChargeSchema.nullable(),
          can_create: z.boolean(),
        })
        .parse(await featureRpc("bfe_booking_charge", { p_id: id })),
  });
  if (query.isPending) return <p role="status">Checking booking fee…</p>;
  if (query.isError)
    return (
      <>
        <p>Booking fee unavailable. No amount has been assumed.</p>
        <Feedback error={query.error} />
      </>
    );
  const charge = query.data?.charge;
  return (
    <section aria-label="Booking fee">
      {charge ? (
        <>
          <p>
            <strong>
              Confirmed booking fee: {balanceMoney(charge.amount_centavos)}
            </strong>
          </p>
          <p>
            Rental {balanceMoney(charge.rental_centavos)} · Additional
            reservation fee {balanceMoney(charge.reservation_centavos)} ·
            Refundable bond {balanceMoney(charge.bond_centavos)}
          </p>
          <p>
            Paid {balanceMoney(charge.paid_centavos)} · Balance{" "}
            {balanceMoney(charge.balance_centavos)}
          </p>
          {office && <p>Charge reference: {charge.id}</p>}
          {office && (
            <Link
              className="text-link"
              to={`/office/finance/accounting?kind=amenity-payment&charge=${charge.id}`}
            >
              Record verified payment
            </Link>
          )}
        </>
      ) : (
        <p>
          Fee awaiting Office confirmation. No charge has been added to your
          account yet.
        </p>
      )}
      {office && query.data?.can_create && (
        <Link
          className="text-link"
          to={`/office/finance/accounting?kind=amenity-charge&booking=${id}`}
        >
          Prepare booking charge
        </Link>
      )}
    </section>
  );
}
