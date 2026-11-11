import { it, expect } from "vitest";
import {
  baselineModules,
  fieldVisible,
  sampleBaselineFields,
  visibleFields,
} from "./baseline";
import {
  featureInputSchema,
  publicationLinksSchema,
  featureFieldHint,
  liveFieldLabel,
} from "./feature-records";
it("validates all structured feature inputs without restricting real contacts to sample domains", () => {
  for (const definition of baselineModules)
    expect(
      featureInputSchema(definition.id).safeParse({
        title: "Synthetic feature title",
        detail: "Synthetic feature details for field validation.",
        fields: sampleBaselineFields(
          definition.id,
          "81000000-0000-4000-8000-000000000001",
        ),
      }).success,
      definition.id,
    ).toBe(true);
});
it("all feature fields reject missing required values and accept empty optional values", () => {
  for (const definition of baselineModules)
    for (const field of definition.fields) {
      const sample = sampleBaselineFields(
        definition.id,
        "81000000-0000-4000-8000-000000000001",
      );
      const result = featureInputSchema(definition.id).safeParse({
        title: "Synthetic title",
        detail: "Synthetic form field validation.",
        fields: { ...sample, [field.key]: "" },
      });
      // A field hidden by its showWhen condition is never required, so blanking
      // it must stay valid even though the definition marks it required.
      expect(result.success, definition.id + ":" + field.key).toBe(
        !field.required || !fieldVisible(field, sample),
      );
    }
});
it("publication links enforce the private media service limits and HTTPS safety", () => {
  const link = { label: "Website", url: "https://example.invalid/profile" };
  expect(publicationLinksSchema.parse([link])).toEqual([link]);
  for (const url of [
    "http://example.invalid",
    "https://name:password@example.invalid",
    "javascript:alert(1)",
    "https://example.invalid/" + String.fromCharCode(0),
  ])
    expect(publicationLinksSchema.safeParse([{ ...link, url }]).success).toBe(
      false,
    );
  expect(
    publicationLinksSchema.safeParse(Array.from({ length: 6 }, () => link))
      .success,
  ).toBe(false);
  expect(
    publicationLinksSchema.safeParse([{ ...link, label: "x" }]).success,
  ).toBe(false);
});
it("attachment descriptions stay explicit and unsupported contacts never promise link controls", () => {
  expect(liveFieldLabel("Evidence description (no upload)")).toContain(
    "text only",
  );
  expect(featureFieldHint("publishing", "attachments")).toContain(
    "File upload is not connected",
  );
  expect(featureFieldHint("carpools", "contact")).not.toContain(
    "publication links",
  );
  expect(featureFieldHint("businesses", "contact")).toContain(
    "publication links",
  );
});
it("rejects malformed dates, credential links, fractional capacities and unknown fields", () => {
  const input = (module: string, fields: Record<string, string>) =>
    featureInputSchema(module).safeParse({
      title: "Synthetic title",
      detail: "Synthetic details for field validation.",
      fields: { ...sampleBaselineFields(module), ...fields },
    }).success;
  expect(input("events", { date: "2026-02-30" })).toBe(false);
  expect(
    input("businesses", { website: "https://user:secret@example.invalid/" }),
  ).toBe(false);
  expect(input("workshops", { capacity: "1.5" })).toBe(false);
  expect(input("businesses", { role: "developer" })).toBe(false);
});

it("category-conditional fields appear, are required, and stay empty when hidden", () => {
  const schema = featureInputSchema("businesses");
  const base = {
    title: "Synthetic title",
    detail: "Synthetic conditional field validation.",
  };
  const common = {
    hours: "Demo hours",
    owner: "Demo owner",
    contact: "sample@example.invalid",
    website: "",
    fulfilment: "",
    serviceArea: "",
    storefront: "",
    businessKind: "",
    listedBy: "",
    facebook: "",
  };
  // Food shows fulfilment only.
  expect(
    visibleFields("businesses", { category: "Food" }).map((f) => f.key),
  ).toEqual([
    "category",
    "fulfilment",
    "hours",
    "owner",
    "contact",
    "website",
    "listedBy",
    "facebook",
  ]);
  expect(
    visibleFields("businesses", { category: "Home services" }).map(
      (f) => f.key,
    ),
  ).toEqual([
    "category",
    "serviceArea",
    "hours",
    "owner",
    "contact",
    "website",
    "listedBy",
    "facebook",
  ]);
  // Required while shown.
  expect(
    schema.safeParse({ ...base, fields: { ...common, category: "Food" } })
      .success,
  ).toBe(false);
  expect(
    schema.safeParse({
      ...base,
      fields: { ...common, category: "Food", fulfilment: "Delivery" },
    }).success,
  ).toBe(true);
  // Rejected while hidden, so the stored record matches what was asked.
  expect(
    schema.safeParse({
      ...base,
      fields: {
        ...common,
        category: "Home services",
        serviceArea: "Demo area",
        fulfilment: "Delivery",
      },
    }).success,
  ).toBe(false);
  expect(fieldVisible({ key: "x", label: "X" }, {})).toBe(true);
});
it("gate pass questions follow the pass purpose", () => {
  expect(
    visibleFields("gate-passes", { purpose: "Service work" }).map((f) => f.key),
  ).toContain("crew");
  expect(
    visibleFields("gate-passes", { purpose: "Delivery" }).map((f) => f.key),
  ).not.toContain("crew");
  for (const purpose of ["Move-in", "Move-out"])
    expect(
      visibleFields("gate-passes", { purpose }).map((f) => f.key),
    ).toContain("movingUnit");
});
