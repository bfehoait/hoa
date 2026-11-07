import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sampleStorageKey } from "./preview-scope";
import { useAuth } from "./auth";
import {
  assertPreviewTransition,
  workInputSchema,
  workspaceStateSchema,
  workTransitionSchema,
  type WorkInput,
  type WorkItem,
  type WorkStatus,
} from "../../../../packages/shared/src/workspace";
import {
  baselineModule,
  baselineModules,
  sampleBaselineFields,
  baselineSchema,
  relatedField,
  relatedModule,
  tripSteps,
} from "../../../../packages/shared/src/baseline";
import { z } from "zod";
import {
  assertContentPublication,
  garageItems,
  garageReviewSchema,
  conversationModules,
  localActorSchema,
  messageInputSchema,
  publishableModules,
  type LocalActor,
} from "../../../../packages/shared/src/integration";
import {
  importTemplates,
  parseSampleCsv,
  validateImport,
  type ImportKind,
} from "../../../../packages/shared/src/imports";

const KEY = sampleStorageKey("bellefort-workspace-v1");
const seed = (
  id: string,
  kind: WorkItem["kind"],
  title: string,
  detail: string,
  status: WorkStatus,
  extra: Partial<WorkItem> = {},
): WorkItem => ({
  id,
  kind,
  title,
  detail,
  status,
  metadata: {},
  attachments: [],
  garageReviews: [],
  createdAt: "2026-11-04T02:00:00Z",
  events: [
    {
      at: "2026-11-04T02:00:00Z",
      label: "Synthetic fixture created; not a real HOA record",
    },
  ],
  ...extra,
});
const fixtures: WorkItem[] = [
  seed(
    "REG-DEMO-01",
    "registration",
    "Jamie · sample applicant",
    "Sample household application for Demo A-07. Identity and occupancy have not been verified.",
    "Submitted locally",
    {
      metadata: {
        email: "jamie@example.invalid",
        unit: "Demo A-07",
        role: "Homeowner",
        proof: "Not supplied",
      },
    },
  ),
  seed(
    "REG-DEMO-02",
    "registration",
    "Morgan · sample applicant",
    "Sample renter application for Demo A-08. Owner consent and evidence are not supplied.",
    "In review",
    {
      metadata: {
        email: "morgan@example.invalid",
        unit: "Demo A-08",
        role: "Renter",
        proof: "Not supplied",
      },
    },
  ),
  seed(
    "EXP-DEMO-01",
    "expense",
    "Sample lighting repair",
    "Demonstration expense awaiting a verified source document and the authorized finance workflow.",
    "In review",
    {
      amount: 125000,
      metadata: { category: "Maintenance", reference: "Not supplied" },
    },
  ),
  seed(
    "ANN-DEMO-01",
    "announcement",
    "Sample community reminder",
    "Keep shared paths clear. This is demonstration content for the local publishing workflow, not an official HOA notice.",
    "Draft",
  ),
  seed(
    "PER-DEMO-01",
    "permit",
    "Sample home improvement enquiry",
    "A demonstration enquiry. Permit type, required evidence, fees and approval authority are not confirmed.",
    "Submitted locally",
    { metadata: { unit: "Block 08 · Lot 12", requirements: "Not confirmed" } },
  ),
  seed(
    "INC-DEMO-01",
    "incident",
    "Sample gate equipment concern",
    "A non-emergency demonstration incident about a gate device. No emergency response or real security notification is initiated.",
    "In review",
    { metadata: { location: "Sample gate", severity: "Unclassified" } },
  ),
  seed(
    "TRN-DEMO-01",
    "enrollment",
    "First-aid basics · sample interest",
    "Sample interest in a community workshop. There is no confirmed session or actual enrollment.",
    "Submitted locally",
  ),
];
function fresh() {
  return workspaceStateSchema.parse({
    version: 1,
    items: structuredClone(fixtures),
    preferences: { inApp: true, email: false },
  });
}
export function readWorkspace() {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(KEY);
  } catch {
    throw new Error(
      "Workspace storage is unavailable. Allow browser session storage and retry.",
    );
  }
  if (!raw) return fresh();
  try {
    return workspaceStateSchema.parse(JSON.parse(raw));
  } catch {
    throw new Error(
      "Workspace preview data is damaged. Use Developer tools to reset only this sample workspace.",
    );
  }
}
function save(state: ReturnType<typeof fresh>) {
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify(workspaceStateSchema.parse(state)),
    );
  } catch {
    throw new Error(
      "Workspace was not saved. Browser storage may be blocked or full. Retry after checking storage.",
    );
  }
}
export const workspaceRepository = {
  async load() {
    return readWorkspace();
  },
  async create(input: WorkInput) {
    const value = workInputSchema.parse(input);
    const state = readWorkspace();
    const now = new Date().toISOString();
    const row: WorkItem = {
      ...value,
      id: `${value.kind.toUpperCase()}-${crypto.randomUUID().slice(0, 8)}`,
      status:
        value.kind === "announcement" ||
        value.kind === "listing" ||
        value.kind === "baseline" ||
        value.kind === "document"
          ? "Draft"
          : "Submitted locally",
      createdAt: now,
      attachments: [],
      garageReviews: [],
      events: [
        {
          at: now,
          label: "Saved in this browser tab; no real submission or delivery",
        },
      ],
    };
    state.items.unshift(row);
    save(state);
    return row;
  },
  async transition(input: { id: string; next: WorkStatus; reason: string }) {
    const validation = workTransitionSchema.safeParse(input);
    if (!validation.success)
      throw new Error(
        validation.error.issues[0]?.message ??
          "Check the sample status change and retry.",
      );
    input = validation.data;
    const state = readWorkspace();
    const item = state.items.find((row) => row.id === input.id);
    if (!item)
      throw new Error(
        "This sample record no longer exists. Reload and try again.",
      );
    if (input.reason.trim().length < 5)
      throw new Error("Add a short reason for this local change.");
    assertPreviewTransition(item, input.next);
    item.status = input.next;
    item.events.push({
      at: new Date().toISOString(),
      label: `${input.next} (local only): ${input.reason.trim()}`,
    });
    save(state);
    return item;
  },
  async preferences(value: { inApp: boolean; email: boolean }) {
    if (value.email)
      throw new Error(
        "Email delivery is not connected. No subscription was created.",
      );
    const state = readWorkspace();
    state.preferences = value;
    save(state);
  },
  async baseline(input: {
    module: string;
    title: string;
    detail: string;
    fields: Record<string, string>;
    id?: string;
  }) {
    const definition = baselineModule(input.module);
    const value = baselineSchema(input.module).parse(input);
    const state = readWorkspace();
    const parentModule = relatedModule[input.module];
    if (parentModule) {
      const parentId = String(value.fields[relatedField[input.module]]);
      const parent = state.items.find(
        (item) =>
          item.id === parentId &&
          item.kind === "baseline" &&
          item.metadata.module === parentModule &&
          !["Archived", "Cancelled"].includes(item.status),
      );
      if (!parent)
        throw new Error(
          "Choose an active local parent record. No real booking or enrollment is created.",
        );
    }
    const metadata = { ...value.fields, module: definition.id } as Record<
      string,
      string
    >;
    if (!input.id)
      return workspaceRepository.create({
        kind: "baseline",
        title: value.title,
        detail: value.detail,
        metadata,
      });
    const row = state.items.find(
      (item) =>
        item.id === input.id &&
        item.kind === "baseline" &&
        item.metadata.module === definition.id,
    );
    if (!row || !["Draft", "Changes requested"].includes(row.status))
      throw new Error(
        "Only a current local draft or changes-requested record can be edited.",
      );
    row.title = value.title;
    row.detail = value.detail;
    if (
      value.fields.items !== undefined &&
      row.metadata.items !== metadata.items
    )
      row.garageReviews = [];
    row.metadata = { ...row.metadata, ...metadata };
    row.events.push({
      at: new Date().toISOString(),
      label: "Sample details edited locally; no external update",
    });
    save(state);
    return row;
  },
  async importDrafts(input: {
    kind: ImportKind;
    text: string;
    mapping: Record<string, string>;
  }) {
    const template = importTemplates[input.kind];
    if (!template) throw new Error("Unknown sample import type.");
    const rows = validateImport(
      input.kind,
      parseSampleCsv(input.text),
      input.mapping,
    );
    if (rows.some((row) => row.errors.length))
      throw new Error(
        "Correct every invalid row before staging the sample batch.",
      );
    const state = readWorkspace();
    const now = new Date().toISOString();
    const batch = `DEMO-BATCH-${crypto.randomUUID().slice(0, 8)}`;
    const identityKey = input.kind === "units" ? "unit" : "reference";
    if (
      rows.some((row) =>
        state.items.some(
          (item) =>
            item.kind === "baseline" &&
            item.metadata.module === template.module &&
            !["Archived", "Cancelled"].includes(item.status) &&
            item.metadata[identityKey] === row.input.fields[identityKey],
        ),
      )
    )
      throw new Error(
        "An active local draft already uses a unit or evidence reference in this batch. Review it before importing again.",
      );
    state.items.unshift(
      ...rows.map((row): WorkItem => ({
        id: `BASELINE-${crypto.randomUUID().slice(0, 8)}`,
        kind: "baseline",
        title: row.input.title,
        detail: row.input.detail,
        metadata: { ...row.input.fields, module: template.module, batch },
        status: "Draft",
        createdAt: now,
        attachments: [],
        garageReviews: [],
        events: [
          {
            at: now,
            label: `Staged synthetic CSV row ${row.row} in ${batch}; not posted to an official registry or ledger`,
          },
        ],
      })),
    );
    save(state);
    return { count: rows.length, batch };
  },
  async note(input: { id: string; text: string }) {
    const value = z
      .object({
        id: z.string().min(1),
        text: z.string().trim().min(5, "Add at least 5 characters.").max(300),
      })
      .parse(input);
    const state = readWorkspace();
    const row = state.items.find(
      (item) => item.id === value.id && item.kind === "baseline",
    );
    if (!row || ["Archived", "Cancelled"].includes(row.status))
      throw new Error("This local conversation is closed or unavailable.");
    row.events.push({
      at: new Date().toISOString(),
      label: `Local note (not sent): ${value.text}`,
    });
    save(state);
    return row;
  },
  async simulate(input: {
    id: string;
    action: "trip" | "booth";
    value?: string;
  }) {
    const state = readWorkspace();
    const row = state.items.find(
      (item) => item.id === input.id && item.kind === "baseline",
    );
    if (!row || ["Cancelled", "Archived"].includes(row.status))
      throw new Error("This sample record is no longer active.");
    if (input.action === "trip") {
      if (row.metadata.module !== "ride-requests")
        throw new Error("Only ride drafts have a trip simulation.");
      const current = row.metadata.tripStep ?? tripSteps[0];
      const index = tripSteps.findIndex((step) => step === current);
      if (index < 0 || index >= tripSteps.length - 1)
        throw new Error("This sample trip has no further steps.");
      row.metadata.tripStep = tripSteps[index + 1];
      row.events.push({
        at: new Date().toISOString(),
        label: `${row.metadata.tripStep}; simulation only, no driver notified`,
      });
    } else {
      if (row.metadata.module !== "booth-applications")
        throw new Error("Only vendor drafts have booth proposals.");
      const parent = state.items.find(
        (item) =>
          item.id === row.metadata.eventId &&
          item.kind === "baseline" &&
          item.metadata.module === "booth-events" &&
          !["Cancelled", "Archived"].includes(item.status),
      );
      const booth = Number(input.value);
      if (
        !parent ||
        !Number.isInteger(booth) ||
        booth < 1 ||
        booth > Number(parent.metadata.capacity)
      )
        throw new Error(
          "Use a whole booth number within the active sample event capacity.",
        );
      if (
        state.items.some(
          (item) =>
            item.id !== row.id &&
            item.metadata.module === "booth-applications" &&
            item.metadata.eventId === parent.id &&
            item.metadata.booth === String(booth) &&
            !["Cancelled", "Archived"].includes(item.status),
        )
      )
        throw new Error(
          "Another active local proposal uses this booth number. Choose another.",
        );
      row.metadata.booth = String(booth);
      row.events.push({
        at: new Date().toISOString(),
        label: `Sample booth ${booth} proposed locally; no allocation or vendor approval`,
      });
    }
    save(state);
    return row;
  },
  async reset() {
    sessionStorage.removeItem(KEY);
    return fresh();
  },
  async publishContent(input: { id: string; reason: string }) {
    const value = z
      .object({
        id: z.string().min(1),
        reason: z
          .string()
          .trim()
          .min(5, "Add a short publication reason.")
          .max(300),
      })
      .parse(input);
    const state = readWorkspace();
    const item = state.items.find((row) => row.id === value.id);
    if (!item) throw new Error("This sample content no longer exists.");
    assertContentPublication(item);
    item.status = "Preview published";
    item.metadata.previewPublishedAt = new Date().toISOString();
    item.events.push({
      at: item.metadata.previewPublishedAt,
      label: `Published into local sample views only: ${value.reason}`,
    });
    save(state);
    return item;
  },
  async message(input: z.infer<typeof messageInputSchema>) {
    const value = messageInputSchema.parse(input);
    const state = readWorkspace();
    const thread = state.items.find(
      (row) =>
        row.id === value.threadId &&
        row.kind === "baseline" &&
        conversationModules.includes(row.metadata.module),
    );
    if (!thread || ["Archived", "Cancelled"].includes(thread.status))
      throw new Error(
        "Choose an active sample conversation. Closed threads cannot receive replies.",
      );
    if (
      state.messages.length >= 1000 ||
      state.messages.filter((message) => message.threadId === thread.id)
        .length >= 200
    )
      throw new Error(
        "This local message preview has reached its sample limit. Export or reset sample data before continuing.",
      );
    const message = {
      ...value,
      id: `MSG-${crypto.randomUUID().slice(0, 8)}`,
      at: new Date().toISOString(),
    };
    state.messages.push(message);
    thread.events.push({
      at: message.at,
      label: `${value.actor} sample message saved locally; not sent to a real recipient`,
    });
    save(state);
    return message;
  },
  async markRead(input: { threadId: string; actor: LocalActor }) {
    const value = z
      .object({ threadId: z.string().min(1), actor: localActorSchema })
      .parse(input);
    const state = readWorkspace();
    if (
      !state.items.some(
        (item) =>
          item.id === value.threadId &&
          item.kind === "baseline" &&
          conversationModules.includes(item.metadata.module),
      )
    )
      throw new Error("Sample conversation not found.");
    const last = state.messages
      .filter((message) => message.threadId === value.threadId)
      .at(-1);
    if (last) state.readMarks[`${value.actor}:${value.threadId}`] = last.id;
    save(state);
  },
  async sampleAttachment(input: {
    id: string;
    kind: "Document reference" | "Image reference" | "QR content reference";
  }) {
    const value = z
      .object({
        id: z.string().min(1),
        kind: z.enum([
          "Document reference",
          "Image reference",
          "QR content reference",
        ]),
      })
      .parse(input);
    const state = readWorkspace();
    const item = state.items.find(
      (row) => row.id === value.id && row.kind === "baseline",
    );
    if (!item || !["Draft", "Changes requested"].includes(item.status))
      throw new Error(
        "Only editable local drafts can change sample references.",
      );
    if (item.attachments.length >= 8)
      throw new Error("Use at most eight sample references per draft.");
    const id = crypto.randomUUID().slice(0, 8);
    item.attachments.push({
      id,
      name: `DEMO-${id}.${value.kind === "Document reference" ? "pdf" : "png"}`,
      kind: value.kind,
      caption:
        "Synthetic reference only; no file uploaded, QR generated or protected document stored",
    });
    item.events.push({
      at: new Date().toISOString(),
      label: `${value.kind} added as synthetic metadata; no upload`,
    });
    save(state);
  },
  async gateSimulation(input: { id: string }) {
    const state = readWorkspace();
    const item = state.items.find(
      (row) =>
        row.id === input.id &&
        row.kind === "baseline" &&
        ["walk-ins", "gate-passes"].includes(row.metadata.module),
    );
    if (!item || ["Archived", "Cancelled"].includes(item.status))
      throw new Error("Choose an active sample visitor or gate-pass enquiry.");
    if (item.metadata.gateSimulation === "Sample departure")
      throw new Error("This sample gate-event sequence is complete.");
    item.metadata.gateSimulation = item.metadata.gateSimulation
      ? "Sample departure"
      : "Sample arrival";
    item.events.push({
      at: new Date().toISOString(),
      label: `${item.metadata.gateSimulation}; simulation only, no gate authorization or real entry/exit event`,
    });
    save(state);
    return item;
  },
  async loadIntegrationScenario() {
    const state = readWorkspace();
    if (
      state.items.some(
        (item) => item.metadata.scenario === "INTEGRATION-DEMO-V1",
      )
    )
      throw new Error(
        "The synthetic integration scenario is already present. Existing sample edits were preserved.",
      );
    const now = new Date().toISOString();
    const records = baselineModules.map((definition): WorkItem => {
      const parent = relatedModule[definition.id];
      const fields = sampleBaselineFields(
        definition.id,
        parent ? `DEMO-INTEGRATION-${parent}` : "",
      );
      const value = baselineSchema(definition.id).parse({
        title: `Sample ${definition.title.toLowerCase()}`,
        detail:
          "Invented integration scenario for local demonstrations. No real person, official decision, payment, nomination or reservation is represented.",
        fields,
      });
      const published = (publishableModules as readonly string[]).includes(
        definition.id,
      );
      return {
        id: `DEMO-INTEGRATION-${definition.id}`,
        kind: "baseline",
        title: value.title,
        detail: value.detail,
        metadata: {
          ...fields,
          module: definition.id,
          scenario: "INTEGRATION-DEMO-V1",
        },
        status: published ? "Preview published" : "Submitted locally",
        createdAt: now,
        events: [
          {
            at: now,
            label:
              "Synthetic integration fixture loaded. Publication and workflow states are illustrative; no actual review or authority.",
          },
        ],
        attachments: [],
        garageReviews:
          definition.id === "garage-sales"
            ? (fields.items ?? "")
                .split(/\r?\n/)
                .map((item) => item.trim())
                .filter(Boolean)
                .map((item, index) => ({
                  index,
                  item,
                  decision: "Preview reviewed" as const,
                  reason:
                    "Synthetic fixture review; not an actual item decision",
                }))
            : [],
      };
    });
    if (records.some((row) => state.items.some((item) => item.id === row.id)))
      throw new Error(
        "A scenario reference conflicts with an existing local record. No records were overwritten.",
      );
    state.items.unshift(...records);
    state.messages.push({
      id: `MSG-${crypto.randomUUID().slice(0, 8)}`,
      threadId: "DEMO-INTEGRATION-messages",
      actor: "Office",
      text: "Synthetic office reply for the local conversation walkthrough. No message was delivered outside this browser tab.",
      at: now,
    });
    save(state);
    return { count: records.length };
  },
  async reviewGarageItem(input: {
    id: string;
    index: number;
    decision: "Preview reviewed" | "Changes requested";
    reason: string;
  }) {
    const value = z
      .object({
        id: z.string().min(1),
        index: z.number().int().min(0).max(19),
        decision: z.enum(["Preview reviewed", "Changes requested"]),
        reason: z
          .string()
          .trim()
          .min(5, "Add a short reason for the local item review.")
          .max(300),
      })
      .parse(input);
    const state = readWorkspace();
    const item = state.items.find(
      (row) =>
        row.id === value.id &&
        row.kind === "baseline" &&
        row.metadata.module === "garage-sales" &&
        row.status === "In review",
    );
    if (!item)
      throw new Error(
        "Start local review of an active garage-sale draft first.",
      );
    const name = garageItems(item.metadata.items ?? "")[value.index];
    if (!name)
      throw new Error("That sample item no longer exists. Reload the listing.");
    const review = garageReviewSchema.parse({
      index: value.index,
      item: name,
      decision: value.decision,
      reason: value.reason,
    });
    item.garageReviews = item.garageReviews.filter(
      (row) => row.index !== value.index,
    );
    item.garageReviews.push(review);
    item.events.push({
      at: new Date().toISOString(),
      label: `Sample item ${name}: ${value.decision}. ${value.reason}. No real item approval.`,
    });
    save(state);
    return item;
  },
  async assignSampleTrip(input: {
    id: string;
    driver: string;
    vehicle: string;
  }) {
    const value = z
      .object({
        id: z.string().min(1),
        driver: z.enum(["Demo driver A", "Demo driver B"]),
        vehicle: z.enum(["Demo vehicle 1", "Demo vehicle 2"]),
      })
      .parse(input);
    const state = readWorkspace();
    const item = state.items.find(
      (row) =>
        row.id === value.id &&
        row.kind === "baseline" &&
        row.metadata.module === "ride-requests",
    );
    if (
      !item ||
      ["Archived", "Cancelled"].includes(item.status) ||
      item.metadata.tripStep === tripSteps.at(-1)
    )
      throw new Error(
        "Choose an active sample ride. Completed simulations cannot be reassigned.",
      );
    item.metadata.sampleDriver = value.driver;
    item.metadata.sampleVehicle = value.vehicle;
    item.events.push({
      at: new Date().toISOString(),
      label: `Sample pairing: ${value.driver}, ${value.vehicle}. No real assignment or driver verification.`,
    });
    save(state);
    return item;
  },
};
export function useWorkspace() {
  const auth = useAuth();
  return useQuery({
    queryKey: ["workspace-preview"],
    queryFn: () => {
      if (!auth.preview && !auth.rolePreview)
        throw new Error(
          "Local demonstration data is unavailable in your account.",
        );
      return workspaceRepository.load();
    },
    retry: false,
    staleTime: Infinity,
    enabled: auth.preview || !!auth.rolePreview,
  });
}
export function useWorkspaceAction<T>(
  operation: (input: T) => Promise<unknown>,
) {
  const auth = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: T) => {
      if (!auth.preview && !auth.rolePreview)
        throw new Error("This local demonstration cannot change your account.");
      return operation(input);
    },
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["workspace-preview"] }),
  });
}
