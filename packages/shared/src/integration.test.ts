import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { baselineModules, sampleBaselineFields } from "./baseline";
import {
  assertContentPublication,
  isPublishedContent,
  matchesAudience,
  unreadMessages,
} from "./integration";
import { workspaceStateSchema } from "./workspace";
import {
  readWorkspace,
  workspaceRepository,
} from "../../../apps/web/src/data/workspace";

describe("connected synthetic workflows", () => {
  it("requires each current garage item to be reviewed locally before publication", async () => {
    const row = await create("garage-sales");
    await workspaceRepository.transition({
      id: row.id,
      next: "Submitted locally",
      reason: "Submit sample garage list",
    });
    await workspaceRepository.transition({
      id: row.id,
      next: "In review",
      reason: "Review sample garage list",
    });
    await expect(
      workspaceRepository.publishContent({
        id: row.id,
        reason: "Try incomplete item review",
      }),
    ).rejects.toThrow("every current sample garage item");
    await workspaceRepository.reviewGarageItem({
      id: row.id,
      index: 0,
      decision: "Preview reviewed",
      reason: "Inspect sample table locally",
    });
    await workspaceRepository.reviewGarageItem({
      id: row.id,
      index: 1,
      decision: "Changes requested",
      reason: "Clarify sample chair details",
    });
    await expect(
      workspaceRepository.publishContent({
        id: row.id,
        reason: "Try pending item changes",
      }),
    ).rejects.toThrow("every current sample garage item");
    await workspaceRepository.reviewGarageItem({
      id: row.id,
      index: 1,
      decision: "Preview reviewed",
      reason: "Sample changes reviewed locally",
    });
    expect(
      (
        await workspaceRepository.publishContent({
          id: row.id,
          reason: "Publish sample sale after item review",
        })
      ).status,
    ).toBe("Preview published");
  });
  it("invalidates garage item reviews when the list is edited", async () => {
    const row = await create("garage-sales");
    await workspaceRepository.transition({
      id: row.id,
      next: "Submitted locally",
      reason: "Submit sample garage list",
    });
    await workspaceRepository.transition({
      id: row.id,
      next: "In review",
      reason: "Review sample garage list",
    });
    await workspaceRepository.reviewGarageItem({
      id: row.id,
      index: 0,
      decision: "Preview reviewed",
      reason: "Inspect sample table locally",
    });
    await workspaceRepository.transition({
      id: row.id,
      next: "Changes requested",
      reason: "Revise the sample item list",
    });
    const result = await workspaceRepository.baseline({
      module: "garage-sales",
      id: row.id,
      title: row.title,
      detail: row.detail,
      fields: {
        ...sampleBaselineFields("garage-sales"),
        items: "Sample replacement item",
      },
    });
    expect(result.garageReviews).toEqual([]);
  });
  it("refuses item review outside a garage review and rejects actual approval states", async () => {
    const row = await create("garage-sales");
    await expect(
      workspaceRepository.reviewGarageItem({
        id: row.id,
        index: 0,
        decision: "Preview reviewed",
        reason: "This is only a draft",
      }),
    ).rejects.toThrow("Start local review");
    await expect(
      workspaceRepository.reviewGarageItem({
        id: row.id,
        index: 0,
        decision: "Approved" as never,
        reason: "Try actual approval value",
      }),
    ).rejects.toThrow();
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
  async function create(module = "businesses") {
    return workspaceRepository.baseline({
      module,
      title: "Sample connected record",
      detail: "Invented details for a local integration test.",
      fields: sampleBaselineFields(module),
    });
  }
  it("loads old workspace data with empty message and read-marker defaults", () => {
    const data = workspaceStateSchema.parse({
      version: 1,
      items: [],
      preferences: { inApp: true, email: false },
    });
    expect(data.messages).toEqual([]);
    expect(data.readMarks).toEqual({});
  });
  it("loads every current module as a labelled synthetic scenario without touching resident storage", async () => {
    storage.set("bellefort-preview-v1", "resident sentinel");
    expect((await workspaceRepository.loadIntegrationScenario()).count).toBe(
      baselineModules.length,
    );
    const state = readWorkspace();
    expect(state.items.filter((item) => item.metadata.scenario)).toHaveLength(
      baselineModules.length,
    );
    expect(state.messages).toHaveLength(1);
    expect(storage.get("bellefort-preview-v1")).toBe("resident sentinel");
    expect(state.items.every((item) => item.attachments.length === 0)).toBe(
      true,
    );
  });
  it("refuses duplicate scenario loads and preserves edits", async () => {
    await workspaceRepository.loadIntegrationScenario();
    const before = JSON.stringify(readWorkspace());
    await expect(workspaceRepository.loadIntegrationScenario()).rejects.toThrow(
      "already present",
    );
    expect(JSON.stringify(readWorkspace())).toBe(before);
  });
  it("requires local review before directory publication", async () => {
    const row = await create();
    expect(() => assertContentPublication(row)).toThrow("start its review");
    await expect(
      workspaceRepository.publishContent({
        id: row.id,
        reason: "Synthetic local publication",
      }),
    ).rejects.toThrow();
    await workspaceRepository.transition({
      id: row.id,
      next: "Submitted locally",
      reason: "Submit synthetic draft",
    });
    await workspaceRepository.transition({
      id: row.id,
      next: "In review",
      reason: "Inspect synthetic draft",
    });
    const published = await workspaceRepository.publishContent({
      id: row.id,
      reason: "Reviewed synthetic metadata",
    });
    expect(isPublishedContent(published)).toBe(true);
    await workspaceRepository.transition({
      id: row.id,
      next: "Archived",
      reason: "Withdraw local content",
    });
    expect(
      isPublishedContent(
        readWorkspace().items.find((item) => item.id === row.id)!,
      ),
    ).toBe(false);
  });
  it("refuses publishing financial evidence or role proposals", async () => {
    for (const module of [
      "payment-evidence",
      "access-proposals",
      "unit-register",
    ]) {
      const row = await create(module);
      await workspaceRepository.transition({
        id: row.id,
        next: "Submitted locally",
        reason: "Submit synthetic proposal",
      });
      await workspaceRepository.transition({
        id: row.id,
        next: "In review",
        reason: "Inspect synthetic proposal",
      });
      await expect(
        workspaceRepository.publishContent({
          id: row.id,
          reason: "Try unsupported publication",
        }),
      ).rejects.toThrow("cannot be published");
    }
  });
  it("keeps the generic transition from publishing a baseline record", async () => {
    const row = await create();
    await expect(
      workspaceRepository.transition({
        id: row.id,
        next: "Preview published",
        reason: "Try generic publication",
      }),
    ).rejects.toThrow("Only sample content");
  });
  it("filters simulated audiences without claiming permissions", async () => {
    const row = await create();
    row.metadata.audience = "Board";
    expect(matchesAudience(row, "Homeowners")).toBe(false);
    expect(matchesAudience(row, "Board")).toBe(true);
    row.metadata.audience = "All members";
    expect(matchesAudience(row, "Renters")).toBe(true);
  });
  it("shares replies between local actor views and persists separate read markers", async () => {
    const thread = await create("messages");
    await workspaceRepository.message({
      threadId: thread.id,
      actor: "Resident",
      text: "Synthetic resident follow-up",
    });
    let state = readWorkspace();
    expect(
      unreadMessages(state.messages, state.readMarks, thread.id, "Office"),
    ).toBe(1);
    expect(
      unreadMessages(state.messages, state.readMarks, thread.id, "Resident"),
    ).toBe(0);
    await workspaceRepository.markRead({
      threadId: thread.id,
      actor: "Office",
    });
    await workspaceRepository.message({
      threadId: thread.id,
      actor: "Office",
      text: "Synthetic office response",
    });
    state = readWorkspace();
    expect(
      unreadMessages(state.messages, state.readMarks, thread.id, "Office"),
    ).toBe(0);
    expect(
      unreadMessages(state.messages, state.readMarks, thread.id, "Resident"),
    ).toBe(1);
    await workspaceRepository.markRead({
      threadId: thread.id,
      actor: "Resident",
    });
    state = readWorkspace();
    expect(
      unreadMessages(state.messages, state.readMarks, thread.id, "Resident"),
    ).toBe(0);
  });
  it("refuses replies on closed or unrelated records", async () => {
    const thread = await create("messages");
    await workspaceRepository.transition({
      id: thread.id,
      next: "Archived",
      reason: "Close sample thread",
    });
    await expect(
      workspaceRepository.message({
        threadId: thread.id,
        actor: "Office",
        text: "This must fail safely",
      }),
    ).rejects.toThrow("Closed threads");
    const other = await create();
    await expect(
      workspaceRepository.message({
        threadId: other.id,
        actor: "Resident",
        text: "Unrelated record reply",
      }),
    ).rejects.toThrow("active sample conversation");
  });
  it("rejects oversized replies without writing", async () => {
    const thread = await create("messages");
    await expect(
      workspaceRepository.message({
        threadId: thread.id,
        actor: "Office",
        text: "x".repeat(1001),
      }),
    ).rejects.toThrow();
    expect(readWorkspace().messages).toHaveLength(0);
  });
  it("adds only synthetic metadata references and caps their count", async () => {
    const row = await create();
    for (let index = 0; index < 8; index++)
      await workspaceRepository.sampleAttachment({
        id: row.id,
        kind: "Image reference",
      });
    await expect(
      workspaceRepository.sampleAttachment({
        id: row.id,
        kind: "Document reference",
      }),
    ).rejects.toThrow("eight");
    const attachments = readWorkspace().items.find(
      (item) => item.id === row.id,
    )!.attachments;
    expect(
      attachments.every(
        (item) =>
          item.name.startsWith("DEMO-") && !Object.keys(item).includes("data"),
      ),
    ).toBe(true);
  });
  it("prevents changing synthetic media after submission", async () => {
    const row = await create();
    await workspaceRepository.transition({
      id: row.id,
      next: "Submitted locally",
      reason: "Submit sample content",
    });
    await expect(
      workspaceRepository.sampleAttachment({
        id: row.id,
        kind: "QR content reference",
      }),
    ).rejects.toThrow("editable local drafts");
  });
  it("simulates arrival/departure in order without changing request authority", async () => {
    const row = await create("walk-ins");
    await workspaceRepository.gateSimulation({ id: row.id });
    const last = await workspaceRepository.gateSimulation({ id: row.id });
    expect(last.metadata.gateSimulation).toBe("Sample departure");
    expect(last.status).toBe("Draft");
    await expect(
      workspaceRepository.gateSimulation({ id: row.id }),
    ).rejects.toThrow("complete");
  });
  it("records only predefined synthetic trip pairings", async () => {
    const row = await create("ride-requests");
    const result = await workspaceRepository.assignSampleTrip({
      id: row.id,
      driver: "Demo driver B",
      vehicle: "Demo vehicle 2",
    });
    expect(result.metadata.sampleDriver).toBe("Demo driver B");
    expect(result.status).toBe("Draft");
    await expect(
      workspaceRepository.assignSampleTrip({
        id: row.id,
        driver: "Unverified real driver",
        vehicle: "Demo vehicle 2",
      }),
    ).rejects.toThrow();
  });
  it("reports blocked persistence without claiming scenario completion", async () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("full");
      },
    });
    await expect(workspaceRepository.loadIntegrationScenario()).rejects.toThrow(
      "not saved",
    );
  });
});
