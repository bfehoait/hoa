import { describe, expect, it } from "vitest";
import {
  effectiveAccessSchema,
  hasCapability,
  officeRequirement,
} from "./permissions";

describe("module permission contracts", () => {
  it("requires the exact action and scope without treating summary as private view", () => {
    const access = effectiveAccessSchema.parse({
      version: 1,
      committees: ["finance"],
      capabilities: [
        { module: "finance", action: "summary", scope: "association" },
      ],
    });
    expect(
      hasCapability(access, {
        module: "finance",
        action: "summary",
        scope: "association",
      }),
    ).toBe(true);
    expect(
      hasCapability(access, {
        module: "finance",
        action: "view",
        scope: "association",
      }),
    ).toBe(false);
    expect(
      hasCapability(access, {
        module: "finance",
        action: "summary",
        scope: "own",
      }),
    ).toBe(false);
    expect(
      hasCapability(undefined, {
        module: "finance",
        action: "view",
        scope: "association",
      }),
    ).toBe(false);
  });
  it("maps office aliases and denies unknown office modules", () => {
    expect(officeRequirement("/office/inbox?new=1")).toEqual({
      module: "requests",
      action: "view",
      scope: "association",
    });
    expect(officeRequirement("/office/finance/collections")).toEqual({
      module: "finance",
      action: "view",
      scope: "association",
    });
    expect(officeRequirement("/admin/unknown")).toBeUndefined();
    expect(officeRequirement("/developer/modules/finance")).toBeNull();
    expect(officeRequirement("/officer")).toBeNull();
  });
  it("rejects unrecognized permissions and missing protocol version", () => {
    expect(
      effectiveAccessSchema.safeParse({ capabilities: [], committees: [] })
        .success,
    ).toBe(false);
    expect(
      effectiveAccessSchema.safeParse({
        version: 1,
        capabilities: [
          { module: "all", action: "everything", scope: "global" },
        ],
        committees: [],
      }).success,
    ).toBe(false);
  });
});
