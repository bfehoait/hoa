// Owner-supplied BFE Amenities Guidelines, as of 21 October 2025, pp. 1–3.
// Displayed prices are policy information, not a payment or booking quote.
export const amenityGuidelineDate = "21 October 2025";
export type AmenityKey = "hall" | "court" | "pool";
export function amenityKey(name: string): AmenityKey | null {
  switch (name.trim().toLowerCase()) {
    case "clubhouse":
    case "function hall":
      return "hall";
    case "basketball court":
    case "open court":
      return "court";
    case "swimming pool":
      return "pool";
    default:
      return null;
  }
}
export const amenityGuidelines = {
  hall: {
    name: "Function Hall",
    hours: "8 AM–10 PM; Sundays noon–5 PM reserved for Mass.",
    capacity:
      "Hall capacity is not specified in the guideline; confirm with the Office.",
    rates: [
      "Daytime (8 AM–5 PM): ₱3,500 for 9 hours or ₱1,000 for 2 hours.",
      "Nighttime (covering 5:01–10 PM): ₱3,000 for 5 hours or ₱1,500 for 2 hours.",
      "Extension: ₱500/hour, within operating hours. Reservation fee: ₱2,500. Refundable surety bond: ₱2,500.",
    ],
    restrictions: [
      "Pool and pool area use are excluded. Submit a venue layout for sound, lighting and electrical equipment; the requesting party pays setup and logistics costs.",
      "Arrange and settle extensions with the Village Admin during office hours and before the extension; no same-day extension after office hours or use beyond 10 PM.",
    ],
  },
  court: {
    name: "Basketball court",
    hours: "Monday–Saturday 7 AM–10 PM; Sunday 7 AM–noon.",
    capacity:
      "Court capacity is not specified in the guideline; confirm with the Office.",
    rates: [
      "Exclusive sports use: ₱250/hour daytime or ₱300/hour nighttime; no surety bond listed for sports.",
      "Special functions: ₱350/hour daytime or ₱400/hour nighttime; ₱2,500 refundable surety bond.",
      "Unit owners have 2 free daytime hours for sports without electricity use. Request on the same day before use; 7–9 AM may be reserved the day before. Office verifies eligibility.",
    ],
    restrictions: [
      "Obtain an Office request and present the latest water bill. Bring your sports equipment and wear sports attire.",
      "No hanging on rims, nets or supports; no bicycles, rollerblades or skateboards. Arrange extensions with the Village Admin during office hours and settle before use; no same-day extension after office hours.",
      "The court table does not define the daytime/nighttime cutoff; confirm the applicable rate with the Office.",
    ],
  },
  pool: {
    name: "Swimming pool",
    hours:
      "Tuesday–Saturday 9 AM–9 PM; Sunday 7–11 AM. Closed Monday for maintenance.",
    capacity:
      "Maximum 40 people in the pool. Office must verify total admission.",
    rates: [
      "Exclusive: ₱5,000 for 8 daytime hours (9 AM–5 PM) or ₱4,000 for 5 nighttime hours (covering 5:01–9 PM).",
      "Exclusive extension: ₱1,000/hour within operating hours. Reservation fee: ₱2,500. Refundable surety bond: ₱2,500.",
      "Individual daytime admission: children ₱80, adults ₱100. Nighttime: children ₱100, adults ₱120. The guideline does not define the child-price age band or Sunday package pricing; confirm with the Office.",
    ],
    restrictions: [
      "No lifeguard on duty. Children aged 7 and below need floaters and continuous adult supervision. Diapered infants and toddlers may not enter the pool.",
      "Wear proper stretch swimsuits, swimming trunks or board shorts; no T-shirts or denim shorts. Remove body accessories and shower before swimming.",
      "No running, diving, rough play, indecent behavior or glass containers. Durable plastic or metal containers are allowed. Dry off and change before entering common areas.",
      "Submit a venue layout to the Village Administrator for events around the pool. No extension beyond 9 PM; Sunday closing remains 11 AM.",
    ],
  },
} as const;

export const generalAmenityRestrictions = [
  "For Bellefort homeowners/residents and their guests; only homeowners/residents may reserve. Availability is first come, first served. Present the latest water bill, complete the Office agreement and pay required deposits.",
  "Rental/reservation fees are non-refundable and paid dates cannot be transferred. Setup through cleanup must fit the reserved time. The guideline lists reservation fees separately from rental and bond; Office confirms the amount due.",
  "Exclusive-use surety bond: ₱2,500, refundable subject to damage and cleanup review. Submit the original official receipt and a valid ID copy to the Office for a refund within 15 calendar days.",
  "Supervise children, behave responsibly and leave the venue clean; take all trash home. Residents are liable for damage; damage or leftover waste may forfeit the bond. Security may remove unsafe or inappropriate guests.",
  "No pets, gambling, alcohol, damaging carpentry/drilling, fireworks, explosives, open flames, flash devices, cooking or charcoal/gas/electric grills.",
  "Sunday Mass occupies the hall noon–5 PM; court and pool are also closed during Mass. Their earlier Sunday closing times still apply. Management may amend these guidelines.",
] as const;

// Manila calendar date; return permitted minutes since midnight.
export function amenityWindows(name: string, date: string): [number, number][] {
  const key = amenityKey(name);
  // Use the supplied Manila calendar date without a host-timezone conversion.
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (!Number.isFinite(weekday)) return [];
  if (key === "hall")
    return weekday === 0
      ? [
          [480, 720],
          [1020, 1320],
        ]
      : [[480, 1320]];
  if (key === "court") return weekday === 0 ? [[420, 720]] : [[420, 1320]];
  if (key === "pool")
    return weekday === 1 ? [] : weekday === 0 ? [[420, 660]] : [[540, 1260]];
  return [[420, 1320]];
}

export function amenityAttendeeLimit(name: string, configured: number) {
  return amenityKey(name) === "pool" ? Math.min(40, configured) : configured;
}
