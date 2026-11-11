// Public operational contact data from the legacy directory, confirmed by
// the project owner on 10 November 2026. No staff names or personal emails.
export type HotlineContact = {
  name: string;
  lines: { number: string; label?: string }[];
};

export const emergencyContacts: HotlineContact[] = [
  {
    name: "Barangay Molino IV",
    lines: [
      { number: "0969 161 1999", label: "Smart · Duplex Delta Base" },
      { number: "0917 724 0303", label: "Globe / Viber · Duplex Delta Base" },
      { number: "(046) 884 6599", label: "PLDT landline" },
    ],
  },
  {
    name: "Bacoor emergency / Rescue 161",
    lines: [
      { number: "161", label: "Local hotline" },
      { number: "(046) 417 0207", label: "Landline" },
    ],
  },
  { name: "PNP Cavite", lines: [{ number: "0998 598 6953" }] },
  {
    name: "Bureau of Fire Cavite",
    lines: [
      { number: "0965 865 7240", label: "Central station" },
      { number: "0966 695 9711", label: "Central station" },
      { number: "0966 938 2591", label: "Molino substation" },
    ],
  },
  {
    name: "Metro South Medical Center",
    lines: [
      { number: "(046) 894 1630" },
      { number: "(046) 885 6113" },
      { number: "0918 904 8736" },
    ],
  },
  {
    name: "Cavite Command Center",
    lines: [{ number: "0905 844 1334" }, { number: "0908 815 0650" }],
  },
];
export const communityContacts: HotlineContact[] = [
  {
    name: "BEHOAI security guards",
    lines: [{ number: "0962 650 9132" }, { number: "0964 842 9013" }],
  },
  { name: "Breighton Land admin office", lines: [{ number: "0928 770 1922" }] },
];
export const utilityContacts: HotlineContact[] = [
  {
    name: "Aqualink water",
    lines: [{ number: "0967 457 6140" }, { number: "0949 625 3489" }],
  },
];

export function hotlineTelephone(number: string) {
  const digits = number.replace(/\D/g, "");
  // Preserve the local short code; convert full Philippine numbers to +63.
  return "tel:" + (digits.startsWith("0") ? "+63" + digits.slice(1) : digits);
}
