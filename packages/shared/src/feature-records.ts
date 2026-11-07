import { z } from "zod";
import {
  baselineModule,
  fieldVisible,
  type BaselineField,
} from "./baseline";
export const featureRecordSchema = z.object({
  id: z.uuid(),
  module: z.string(),
  title: z.string(),
  detail: z.string(),
  status: z.enum([
    "Submitted",
    "In review",
    "Reviewed",
    "Rejected",
    "Withdrawn",
    "Published",
  ]),
  fields: z.record(z.string(), z.string()).optional(),
  version: z.number().int().optional(),
  publication_consent: z.boolean().optional(),
  created_at: z.string(),
  expires_at: z.string().nullable().optional(),
});
export type FeatureRecord = z.infer<typeof featureRecordSchema>;
export const featureDashboardSchema = z.object({
  rows: z.array(featureRecordSchema),
  total: z.number().int(),
  can_create: z.boolean(),
  can_review: z.boolean(),
  can_publish: z.boolean(),
  publishable: z.boolean(),
});
export function liveFieldLabel(value: string) {
  return value
    .replace(/\b(Sample|Synthetic|Local)\s+/gi, "")
    .replace(/\(no upload\)/g, "(text only)");
}
export const publicationLinksSchema = z
  .array(
    z.object({
      label: z
        .string()
        .trim()
        .min(2, "Give each link a label of at least two characters.")
        .max(40),
      url: z
        .string()
        .trim()
        .min(10)
        .max(2000)
        .regex(
          /^https:\/\/[A-Za-z0-9.-]+\.[A-Za-z]{2,}([/:?#][^\s<>]*)?$/,
          "Use a full HTTPS address without embedded credentials.",
        )
        .refine(
          (value) =>
            Array.from(value).every(
              (c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127,
            ),
          "Remove control characters from the address.",
        ),
    }),
  )
  .max(5, "Add at most five publication links.");
export function featureFieldHint(
  module: string,
  key: string,
): string | undefined {
  if (key === "photoNote")
    return "Text caption only. Choose a cover photo in Photo & publication links below.";
  if (["attachments", "evidence", "source", "reference"].includes(key))
    return "Enter a description or reference. File upload is not connected for this field; no file is attached by entering text.";
  if (key === "assignedTo")
    return "The office assigns staff during review. This form does not assign a handler.";
  if (["eventId", "sessionId", "carpoolId"].includes(key))
    return "This is a reference for a proposal. Use the activity application service to request an actual place.";
  if (module === "garage-sales" && key === "location")
    return "Use a general location. Do not include a private home address unless you intend staff to review it for publication.";
  if (key === "contact")
    return [
      "businesses",
      "buy-sell",
      "jobs",
      "garage-sales",
      "workshops",
      "booth-events",
    ].includes(module)
      ? "Submitted contact details stay restricted. Use optional publication links if you want members to contact you after review."
      : "Submitted contact details stay restricted and are not automatically published.";
  if (key === "website" || key === "applyLink")
    return "Optional. Enter a full HTTPS address, for example https://example.com.";
  return undefined;
}
export function featureInputSchema(module: string) {
  const fields: Record<string, z.ZodType<string>> = {};
  const conditional: [BaselineField, z.ZodType<string>][] = [];
  for (const field of baselineModule(module).fields) {
    let schema: z.ZodType<string> = z.string().trim().max(2000);
    if (field.required)
      schema = z.string().trim().min(1, "This field is required.").max(2000);
    if (field.options) schema = z.enum(field.options);
    else if (field.type === "date") schema = z.iso.date();
    else if (field.type === "time")
      schema = z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a valid time.");
    else if (field.type === "email") schema = z.email();
    else if (field.type === "url")
      schema = z.url().refine((value) => {
        const url = new URL(value);
        return (
          url.protocol === "https:" &&
          !url.username &&
          !url.password &&
          url.hostname.includes(".")
        );
      }, "Use a full HTTPS link without embedded credentials.");
    else if (field.type === "number")
      schema = z
        .string()
        .regex(
          /^\d+(\.\d{1,2})?$/,
          "Use a non-negative number with at most two decimal places.",
        )
        .refine(
          (v) =>
            v.length <= 15 &&
            Number(v) >= (field.min ?? 0) &&
            Number(v) <= (field.max ?? 1000000),
          "Number is outside the allowed range.",
        )
        .refine(
          (v) =>
            !["capacity", "seats", "places", "passengers"].includes(
              field.key,
            ) || Number.isInteger(Number(v)),
          "Use a whole number.",
        );
    // A conditional field is only required while its condition holds, so the
    // base shape accepts empty and superRefine below enforces the real rule.
    fields[field.key] =
      field.required && !field.showWhen
        ? schema
        : z.union([z.literal(""), schema]);
    if (field.showWhen) conditional.push([field, schema]);
  }
  return z
    .object({
      title: z.string().trim().min(3).max(120),
      detail: z.string().trim().min(10).max(5000),
      fields: z.object(fields).strict(),
    })
    .superRefine((value, ctx) => {
      for (const [field, schema] of conditional) {
        const given = (value.fields[field.key] ?? "").trim();
        if (!fieldVisible(field, value.fields)) {
          if (given)
            ctx.addIssue({
              code: "custom",
              path: ["fields", field.key],
              message:
                "This answer does not apply to the option you chose. Clear it or change that choice.",
            });
          continue;
        }
        if (field.required !== false && !given) {
          ctx.addIssue({
            code: "custom",
            path: ["fields", field.key],
            message: "This answer is needed for the option you chose.",
          });
          continue;
        }
        if (!given) continue;
        const check = schema.safeParse(given);
        if (!check.success)
          ctx.addIssue({
            code: "custom",
            path: ["fields", field.key],
            message: check.error.issues[0].message,
          });
      }
      if (
        value.fields.start &&
        value.fields.end &&
        value.fields.end <= value.fields.start
      )
        ctx.addIssue({
          code: "custom",
          path: ["fields", "end"],
          message: "End time must be after start time.",
        });
      if (
        value.fields.setup &&
        value.fields.start &&
        value.fields.setup > value.fields.start
      )
        ctx.addIssue({
          code: "custom",
          path: ["fields", "setup"],
          message: "Setup must be before the start.",
        });
    });
}
