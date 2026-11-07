import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { baselineModules, baselineSchema, billingEstimate } from "./baseline";
import { importTemplates, parseSampleCsv, validateImport } from "./imports";
import {
  readWorkspace,
  workspaceRepository,
} from "../../../apps/web/src/data/workspace";

describe("structured source-informed drafts", () => {
  const business = {
    title: "Sample business",
    detail: "A synthetic business profile for workflow review.",
    fields: {
      category: "Food",
      hours: "Demo hours",
      owner: "Demo owner",
      contact: "sample@example.invalid",
      website: "",
    },
  };
  it("keeps module identifiers unique", () =>
    expect(new Set(baselineModules.map((item) => item.id)).size).toBe(
      baselineModules.length,
    ));
  it("requires evidence and explicit server gaps for every module", () =>
    expect(
      baselineModules.every(
        (item) =>
          item.evidence.length && item.server.length && item.steps.length === 3,
      ),
    ).toBe(true));
  it("rejects real contact domains", () =>
    expect(
      baselineSchema("businesses").safeParse({
        ...business,
        fields: { ...business.fields, contact: "sample@example.com" },
      }).success,
    ).toBe(false));
  it("rejects executable or real external links", () => {
    for (const website of [
      "javascript:alert(1)",
      "https://example.com",
      "https://secret@example.invalid",
    ]) {
      expect(
        baselineSchema("businesses").safeParse({
          ...business,
          fields: { ...business.fields, website },
        }).success,
      ).toBe(false);
    }
  });
  it("rejects hidden or unsupported fields", () =>
    expect(
      baselineSchema("businesses").safeParse({
        ...business,
        fields: { ...business.fields, approved: "true" },
      }).success,
    ).toBe(false));
  it("rejects reversed event windows", () =>
    expect(
      baselineSchema("booth-events").safeParse({
        title: "Sample event",
        detail: "A synthetic booth event for testing.",
        fields: {
          venue: "Demo venue",
          date: "2026-11-20",
          setup: "09:00",
          start: "11:00",
          end: "10:00",
          capacity: "4",
        },
      }).success,
    ).toBe(false));
  it("rejects setup after opening", () =>
    expect(
      baselineSchema("booth-events").safeParse({
        title: "Sample event",
        detail: "A synthetic booth event for testing.",
        fields: {
          venue: "Demo venue",
          date: "2026-11-20",
          setup: "12:00",
          start: "10:00",
          end: "11:00",
          capacity: "4",
        },
      }).success,
    ).toBe(false));
  it("calculates flat and area assessments in centavos", () => {
    expect(billingEstimate(1850, 120, "Flat amount")).toBe(185000);
    expect(billingEstimate(12.35, 120.5, "Per square metre")).toBe(148818);
  });
  it("rejects invalid or unsafe calculator inputs", () => {
    for (const amount of [-1, Infinity, NaN, 1000001])
      expect(() => billingEstimate(amount, 120, "Per square metre")).toThrow();
  });
});

describe("CSV staging validation", () => {
  it("rejects duplicate units within a batch", () => {
    const csv = parseSampleCsv(
      "unit,owner,area,occupancy\nDemo A-09,Demo Owner,120,Unknown\nDemo A-09,Demo Owner,100,Vacant",
    );
    expect(
      validateImport(
        "units",
        csv,
        Object.fromEntries(csv.headers.map((header) => [header, header])),
      )[1].errors,
    ).toContain(
      "Duplicate unit or evidence reference within this sample batch.",
    );
  });
  it("handles BOM, CRLF, embedded quotes, commas and newlines", () =>
    expect(
      parseSampleCsv('\uFEFFunit,note\r\nDemo A-09,"A, B\n""sample"""\r\n'),
    ).toEqual({
      headers: ["unit", "note"],
      rows: [["Demo A-09", 'A, B\n"sample"']],
    }));
  it.each(["a,a\n1,2", "a,b\n1", 'a,b\n"open,2', 'a,b\n"closed"oops,2'])(
    "rejects malformed CSV %s",
    (text) => expect(() => parseSampleCsv(text)).toThrow(),
  );
  it("refuses oversized batches", () =>
    expect(() =>
      parseSampleCsv(
        "unit\n" + Array.from({ length: 101 }, () => "Demo A-09").join("\n"),
      ),
    ).toThrow());
  it("requires different mapped source columns", () =>
    expect(() =>
      validateImport(
        "units",
        parseSampleCsv("a,b,c,d\nDemo A-09,Demo Owner,120,Unknown"),
        { unit: "a", owner: "a", area: "c", occupancy: "d" },
      ),
    ).toThrow());
  it("validates all three synthetic templates", () => {
    for (const [key, value] of Object.entries(importTemplates)) {
      const csv = parseSampleCsv(
        [value.columns.join(","), value.example.join(",")].join("\n"),
      );
      expect(
        validateImport(
          key as keyof typeof importTemplates,
          csv,
          Object.fromEntries(value.columns.map((column) => [column, column])),
        )[0].errors,
      ).toEqual([]);
    }
  });
  it("rejects unlabelled units and references", () => {
    const csv = parseSampleCsv(
      "unit,date,amount,reference,method,allocation\nReal unit,2026-11-04,500,REF01,Cash,Demo invoice",
    );
    expect(
      validateImport(
        "payments",
        csv,
        Object.fromEntries(csv.headers.map((header) => [header, header])),
      )[0].errors,
    ).toHaveLength(2);
  });
});

describe("local workflow persistence", () => {
  it("rejects reimporting an active evidence reference", async () => {
    const input = {
      kind: "expenses" as const,
      text: "date,category,amount,reference\n2026-11-04,Demo maintenance,500,DEMO-REF",
      mapping: {
        date: "date",
        category: "category",
        amount: "amount",
        reference: "reference",
      },
    };
    await workspaceRepository.importDrafts(input);
    await expect(workspaceRepository.importDrafts(input)).rejects.toThrow(
      "already uses",
    );
    expect(
      readWorkspace().items.filter((item) => item.kind === "baseline"),
    ).toHaveLength(1);
  });
  let storage: Map<string, string>;
  beforeEach(() => {
    storage = new Map();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  const booth = {
    module: "booth-events",
    title: "Sample booth event",
    detail: "Synthetic event for local review only.",
    fields: {
      venue: "Demo venue",
      date: "2026-11-20",
      setup: "09:00",
      start: "10:00",
      end: "11:00",
      capacity: "2",
    },
  };
  it("saves editable drafts, then prevents edits after submission", async () => {
    const record = await workspaceRepository.baseline(booth);
    expect(record.status).toBe("Draft");
    await workspaceRepository.baseline({
      ...booth,
      id: record.id,
      title: "Sample revised event",
    });
    await workspaceRepository.transition({
      id: record.id,
      next: "Submitted locally",
      reason: "Review this synthetic draft",
    });
    await expect(
      workspaceRepository.baseline({ ...booth, id: record.id }),
    ).rejects.toThrow("Only a current local draft");
  });
  it("rejects linked requests without an active local parent", async () => {
    await expect(
      workspaceRepository.baseline({
        module: "booth-applications",
        title: "Sample vendor",
        detail: "Synthetic vendor for event review.",
        fields: {
          eventId: "missing",
          business: "Demo business",
          products: "Demo products",
          contact: "sample@example.invalid",
        },
      }),
    ).rejects.toThrow("active local parent");
    expect(
      readWorkspace().items.filter((item) => item.kind === "baseline"),
    ).toHaveLength(0);
  });
  it("enforces unique booth proposals and capacity within the local simulation", async () => {
    const event = await workspaceRepository.baseline(booth);
    const input = {
      module: "booth-applications",
      title: "Sample vendor",
      detail: "Synthetic vendor for event review.",
      fields: {
        eventId: event.id,
        business: "Demo business",
        products: "Demo products",
        contact: "sample@example.invalid",
      },
    };
    const first = await workspaceRepository.baseline(input),
      second = await workspaceRepository.baseline(input);
    await workspaceRepository.simulate({
      id: first.id,
      action: "booth",
      value: "1",
    });
    await expect(
      workspaceRepository.simulate({
        id: second.id,
        action: "booth",
        value: "1",
      }),
    ).rejects.toThrow("Another active local proposal");
    await expect(
      workspaceRepository.simulate({
        id: second.id,
        action: "booth",
        value: "3",
      }),
    ).rejects.toThrow("capacity");
  });
  it("walks simulated trips in order and refuses steps after completion", async () => {
    const ride = await workspaceRepository.baseline({
      module: "ride-requests",
      title: "Sample ride",
      detail: "Synthetic ride for dispatch review.",
      fields: {
        pickup: "Demo pickup",
        destination: "Demo destination",
        date: "2026-11-20",
        time: "10:00",
        passengers: "2",
      },
    });
    for (let index = 0; index < 4; index++)
      await workspaceRepository.simulate({ id: ride.id, action: "trip" });
    await expect(
      workspaceRepository.simulate({ id: ride.id, action: "trip" }),
    ).rejects.toThrow("no further steps");
    expect(
      readWorkspace().items.find((item) => item.id === ride.id)?.status,
    ).toBe("Draft");
  });
  it("keeps notes local and refuses closed conversations", async () => {
    const record = await workspaceRepository.baseline(booth);
    await workspaceRepository.note({
      id: record.id,
      text: "Synthetic follow-up message",
    });
    expect(readWorkspace().items[0].events.at(-1)?.label).toContain("not sent");
    await workspaceRepository.transition({
      id: record.id,
      next: "Archived",
      reason: "Close synthetic demonstration",
    });
    await expect(
      workspaceRepository.note({ id: record.id, text: "Another note" }),
    ).rejects.toThrow("closed");
  });
  it("rejects an invalid import batch without saving any rows", async () => {
    await expect(
      workspaceRepository.importDrafts({
        kind: "units",
        text: "unit,owner,area,occupancy\nDemo A-09,Demo Owner,120,Unknown\nReal unit,Real Owner,120,Unknown",
        mapping: {
          unit: "unit",
          owner: "owner",
          area: "area",
          occupancy: "occupancy",
        },
      }),
    ).rejects.toThrow("every invalid row");
    expect(storage.size).toBe(0);
  });
  it("stages valid evidence only as drafts without touching resident data", async () => {
    storage.set("bellefort-preview-v1", "resident sentinel");
    const result = await workspaceRepository.importDrafts({
      kind: "payments",
      text: "unit,date,amount,reference,method,allocation\nDemo A-09,2026-11-04,500,DEMO-REF,Cash,Demo invoice",
      mapping: {
        unit: "unit",
        date: "date",
        amount: "amount",
        reference: "reference",
        method: "method",
        allocation: "allocation",
      },
    });
    expect(result.count).toBe(1);
    expect(readWorkspace().items[0].status).toBe("Draft");
    expect(storage.get("bellefort-preview-v1")).toBe("resident sentinel");
  });
  it("reports storage failure without claiming a saved draft", async () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("full");
      },
    });
    await expect(workspaceRepository.baseline(booth)).rejects.toThrow(
      "not saved",
    );
  });
});
