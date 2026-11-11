import { z } from "zod";
import { hoaBalanceSchema } from "./hoa-balance";

const cents = z.string().regex(/^\d+$/);
export const amenityChargeSchema = z
  .object({
    id: z.uuid(),
    booking_id: z.uuid(),
    facility_name: z.string(),
    starts_at: z.string(),
    rental_centavos: cents,
    reservation_centavos: cents,
    bond_centavos: cents,
    amount_centavos: cents,
    paid_centavos: cents,
    balance_centavos: cents,
  })
  .refine(
    (value) =>
      BigInt(value.rental_centavos) +
        BigInt(value.reservation_centavos) +
        BigInt(value.bond_centavos) ===
        BigInt(value.amount_centavos) &&
      BigInt(value.amount_centavos) - BigInt(value.paid_centavos) ===
        BigInt(value.balance_centavos),
    { message: "Amenity charge amounts could not be reconciled." },
  );

export const accountBalanceSchema = z
  .object({
    hoa: hoaBalanceSchema,
    scope: z.literal("posted_hoa_and_amenities"),
    other_balance_centavos: cents,
    total_balance_centavos: cents,
    amenity_charge_count: z.number().int().nonnegative(),
    rows: z.array(amenityChargeSchema),
  })
  .refine(
    (value) =>
      BigInt(value.hoa.hoa_balance_centavos) +
        BigInt(value.other_balance_centavos) ===
      BigInt(value.total_balance_centavos),
    { message: "Total balance must equal HOA plus Other." },
  );
