import { fieldVisible, type BaselineField } from "./baseline";
import { liveFieldLabel } from "./feature-records";

/** Readable display only; never used for validation or permission decisions. */
export function recordFacts(
  fields: BaselineField[],
  values: Record<string, string>,
) {
  return fields
    .filter((field) => fieldVisible(field, values))
    .filter(
      (field) => field.required || (values[field.key] ?? "").trim() !== "",
    )
    .map((field) => ({
      key: field.key,
      label: (() => {
        const label = liveFieldLabel(field.label);
        return label.charAt(0).toUpperCase() + label.slice(1);
      })(),
      value: factValue(field, values[field.key] ?? ""),
    }));
}

function factValue(field: BaselineField, value: string) {
  if (!value.trim()) return "Not provided";
  // A date-only answer is a calendar date, not an instant to shift by timezone.
  if (field.type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(value + "T00:00:00Z");
    if (
      !Number.isNaN(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    )
      return new Intl.DateTimeFormat("en-PH", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(date);
  }
  if (field.type === "time" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    const [hours, minutes] = value.split(":");
    const hour = Number(hours);
    return `${hour % 12 || 12}:${minutes} ${hour < 12 ? "AM" : "PM"}`;
  }
  return value;
}
