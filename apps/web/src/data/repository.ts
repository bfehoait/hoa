import { z } from "zod";
import { requestStatuses } from "../../../../packages/shared/src/requests";
import { sampleStorageKey } from "./preview-scope";
import { DEMO_HOME, initialRecords, type LocalRecord } from "./fixtures";

const recordSchema = z.object({
  id: z.string(),
  kind: z.enum(["request", "booking", "visitor", "interest"]),
  title: z.string(),
  detail: z.string(),
  status: z.string(),
  assignedTo: z.string().optional(),
  createdAt: z.string(),
  date: z.string().optional(),
  category: z.string().optional(),
});
const stateSchema = z.object({
  version: z.literal(1),
  records: z.array(recordSchema),
  profile: z.object({ name: z.string(), phone: z.string() }),
  saved: z.array(z.string()),
  audit: z
    .array(z.object({ id: z.string(), title: z.string(), at: z.string() }))
    .default([]),
});
type DemoState = z.infer<typeof stateSchema>;
const KEY = sampleStorageKey("bellefort-preview-v1");
function fresh(): DemoState {
  return {
    version: 1,
    records: structuredClone(initialRecords),
    profile: { name: DEMO_HOME.name, phone: DEMO_HOME.phone },
    saved: [],
    audit: [],
  };
}
export function readState(): DemoState {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return fresh();
  try {
    const state = stateSchema.parse(JSON.parse(raw));
    for (const record of state.records) {
      if (record.kind === "booking" && record.title === "Clubhouse")
        record.title = "Swimming pool";
      if (record.kind === "request") {
        if (record.status === "In review") record.status = "In progress";
        if (record.status === "Saved locally") record.status = "Open";
        z.enum(requestStatuses).parse(record.status);
      }
    }
    return state;
  } catch {
    throw new Error(
      "Preview data could not be read. Reset the preview in Settings to recover.",
    );
  }
}
function write(state: DemoState) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(stateSchema.parse(state)));
  } catch {
    throw new Error(
      "This browser could not save the preview. Allow session storage, then try again.",
    );
  }
}
function audit(state: DemoState, title: string) {
  state.audit.unshift({
    id: crypto.randomUUID(),
    title,
    at: new Date().toISOString(),
  });
}
export const repository = {
  async load() {
    return readState();
  },
  async add(record: Omit<LocalRecord, "id" | "createdAt">) {
    const state = readState();
    if (record.kind === "request") z.enum(requestStatuses).parse(record.status);
    const row = {
      ...record,
      id: `${record.kind.toUpperCase()}-${crypto.randomUUID().slice(0, 8)}`,
      createdAt: new Date().toISOString(),
    };
    state.records.unshift(row);
    audit(state, `Created local ${row.kind}: ${row.title}`);
    write(state);
    return row;
  },
  async cancel(id: string) {
    const state = readState();
    const row = state.records.find((r) => r.id === id);
    if (!row)
      throw new Error(
        "This preview record no longer exists. Refresh and try again.",
      );
    if (row.kind !== "booking" && row.kind !== "visitor")
      throw new Error("This record cannot be cancelled here.");
    row.status = "Cancelled";
    audit(state, `Cancelled local ${row.kind}: ${row.title}`);
    write(state);
    return row;
  },
  async profile(profile: DemoState["profile"]) {
    const state = readState();
    state.profile = profile;
    audit(state, "Updated sample profile");
    write(state);
    return profile;
  },
  async review(input: { id: string; status: "In progress" | "Resolved" }) {
    const state = readState();
    const row = state.records.find((r) => r.id === input.id);
    if (!row || row.kind !== "request")
      throw new Error(
        "Only an existing sample service request can be reviewed.",
      );
    if (!["In progress", "Resolved"].includes(input.status))
      throw new Error("Invalid preview status.");
    row.status = input.status;
    audit(state, `${input.status}: local request ${row.id}`);
    write(state);
    return row;
  },
  async bookmark(id: string) {
    const state = readState();
    state.saved = state.saved.includes(id)
      ? state.saved.filter((x) => x !== id)
      : [...state.saved, id];
    write(state);
  },
  async assign(input: { id: string; assignee: string }) {
    const value = z
      .object({
        id: z.string(),
        assignee: z.enum(["Demo staff A", "Demo staff B", "Unassigned"]),
      })
      .parse(input);
    const state = readState();
    const record = state.records.find(
      (row) => row.id === value.id && row.kind === "request",
    );
    if (!record)
      throw new Error("Only an existing sample request can be assigned.");
    record.assignedTo = value.assignee;
    audit(state, `Assigned local request ${record.id} to ${value.assignee}`);
    write(state);
    return record;
  },
  async reset() {
    sessionStorage.removeItem(KEY);
    return fresh();
  },
};
