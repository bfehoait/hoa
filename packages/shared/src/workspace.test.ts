import { describe, it, expect } from "vitest";
import {
  assertPreviewTransition,
  registrationPreviewSchema,
  workInputSchema,
  workStatusSchema,
} from "./workspace";

describe("preview workspace contracts", () => {
  it("refuses institutional approval states", () =>
    expect(workStatusSchema.safeParse("Approved").success).toBe(false));
  it("refuses paid status", () =>
    expect(workStatusSchema.safeParse("Paid").success).toBe(false));
  it("refuses ballots as generic work items", () =>
    expect(
      workInputSchema.safeParse({
        kind: "vote",
        title: "Sample vote",
        detail: "This must not be a shared browser ballot.",
        metadata: {},
      }).success,
    ).toBe(false));
  it("refuses negative money", () =>
    expect(
      workInputSchema.safeParse({
        kind: "expense",
        title: "Demo expense",
        detail: "Sample record only.",
        amount: -1,
        metadata: {},
      }).success,
    ).toBe(false));
  it("refuses fractional centavos", () =>
    expect(
      workInputSchema.safeParse({
        kind: "expense",
        title: "Demo expense",
        detail: "Sample record only.",
        amount: 1.5,
        metadata: {},
      }).success,
    ).toBe(false));
  it("does not turn an unspecified amount into zero", () =>
    expect(
      workInputSchema.parse({
        kind: "expense",
        title: "Demo expense",
        detail: "Sample record only.",
        metadata: {},
      }).amount,
    ).toBeUndefined());
  it("rejects a real email domain in sample registration", () =>
    expect(
      registrationPreviewSchema.safeParse({
        name: "Sample Member",
        email: "member@example.com",
        unit: "Demo A-01",
        role: "Homeowner",
      }).success,
    ).toBe(false));
  it("accepts synthetic email and claimed membership without granting a role", () =>
    expect(
      registrationPreviewSchema.parse({
        name: "Sample Member",
        email: "member@example.invalid",
        unit: "Demo A-01",
        role: "Homeowner",
      }).role,
    ).toBe("Homeowner"));
  it("allows a valid local review step", () =>
    expect(() =>
      assertPreviewTransition(
        { kind: "registration", status: "Submitted locally" },
        "In review",
      ),
    ).not.toThrow());
  it("refuses skipping from application submission to publication", () =>
    expect(() =>
      assertPreviewTransition(
        { kind: "registration", status: "Submitted locally" },
        "Preview published",
      ),
    ).toThrow());
  it("never publishes a financial record", () =>
    expect(() =>
      assertPreviewTransition(
        { kind: "expense", status: "Draft" },
        "Preview published",
      ),
    ).toThrow());
  it("refuses changing a closed sample record", () =>
    expect(() =>
      assertPreviewTransition(
        { kind: "permit", status: "Archived" },
        "In review",
      ),
    ).toThrow());
  it("allows explicitly labelled local announcement publication", () =>
    expect(() =>
      assertPreviewTransition(
        { kind: "announcement", status: "Draft" },
        "Preview published",
      ),
    ).not.toThrow());
});
