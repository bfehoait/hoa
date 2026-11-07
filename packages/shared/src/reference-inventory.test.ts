import { describe, it, expect } from "vitest";
import inventory from "./reference-inventory.json";
describe("sanitized reference metadata", () => {
  it("does not embed source markup, JWT-like tokens, email addresses or source backend URLs", () => {
    const text = JSON.stringify(inventory);
    expect(text).not.toMatch(/<script\b|<!doctype\b/i);
    expect(text).not.toMatch(/eyJ[A-Za-z0-9_-]{30,}/);
    expect(text).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    expect(text).not.toMatch(/https?:\/\/[^\s"<>]*supabase\./);
  });
  it("limits the function index to identifiers and source lines", () => {
    for (const entry of inventory.functions) {
      expect(Object.keys(entry).sort()).toEqual(["line", "name"]);
      expect(entry.line).toBeGreaterThan(0);
    }
  });
  it("keeps source structures as schema metadata, not records", () => {
    for (const entry of inventory.datasets) {
      expect(Object.keys(entry).sort()).toEqual([
        "fields",
        "line",
        "name",
        "shape",
        "sourceEntryCount",
      ]);
      expect(entry.fields.every((field) => typeof field === "string")).toBe(
        true,
      );
    }
    expect(inventory).not.toHaveProperty("accounts");
    expect(inventory).not.toHaveProperty("ballots");
  });
  it("keeps snapshot identifiers and counts internally consistent", () => {
    expect(inventory.commit).toMatch(/^[a-f0-9]{40}$/);
    expect(inventory.functions.length).toBe(inventory.functionCount);
    expect(
      inventory.sourceFiles.every((file) => /^[a-f0-9]{64}$/.test(file.sha256)),
    ).toBe(true);
    expect(inventory.identicalAppCopies).toBe(true);
  });
});
