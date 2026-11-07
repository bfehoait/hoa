import { z } from "zod";
import {
  liveMessageSchema,
  liveRequestSchema,
  type LiveRequestInput,
  type LiveRequest,
} from "../../../../packages/shared/src/requests";
import { sampleStorageKey } from "./preview-scope";

const key = sampleStorageKey("bellefort-request-samples-v1");
const owner = "00000000-0000-4000-8000-000000000001";
const schema = z.object({
  requests: z.array(liveRequestSchema),
  messages: z.array(liveMessageSchema),
});
type Samples = z.infer<typeof schema>;
function seed(): Samples {
  const now = new Date().toISOString();
  return {
    requests: [
      {
        title: "Sample streetlight repair",
        category: "Maintenance",
        status: "In progress",
        description:
          "Invented scenario: a streetlight beside Sample Park is not working.",
      },
      {
        title: "Sample community suggestion",
        category: "Concern",
        status: "Open",
        description:
          "Invented scenario: add a shaded waiting area near the sample gate.",
      },
      {
        title: "Sample noise complaint",
        category: "Complaint",
        status: "Open",
        description:
          "Invented scenario for reviewing a confidential resident complaint.",
      },
      {
        title: "Sample document enquiry",
        category: "Document",
        status: "Resolved",
        description:
          "Invented scenario: ask the office which document requirements apply.",
      },
      {
        title: "Sample account question",
        category: "Support",
        status: "Open",
        description:
          "Invented scenario: ask for help correcting recorded contact details.",
      },
    ].map((item, i) => ({
      ...item,
      id: `30000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
      owner_id: owner,
      unit_snapshot: "Sample A-01",
      version: 1,
      created_at: now,
      updated_at: now,
    })) as Samples["requests"],
    messages: [
      {
        id: "40000000-0000-4000-8000-000000000001",
        request_id: "30000000-0000-4000-8000-000000000001",
        author_id: owner,
        author_kind: "Office",
        body: "Sample reply: the maintenance team is checking this issue. Nothing has been sent to a real team.",
        created_at: now,
      },
    ],
  };
}
export function readRequestSamples(): Samples {
  const value = sessionStorage.getItem(key);
  if (value) return schema.parse(JSON.parse(value));
  const initial = seed();
  save(initial);
  return initial;
}
function save(value: Samples) {
  sessionStorage.setItem(key, JSON.stringify(schema.parse(value)));
}
export function createRequestSample(input: LiveRequestInput, clientId: string) {
  const value = readRequestSamples();
  const existing = value.requests.find((row) => row.id === clientId);
  if (existing) return existing;
  const now = new Date().toISOString();
  const record: LiveRequest = {
    ...input,
    id: clientId,
    owner_id: owner,
    unit_snapshot: "Sample A-01",
    status: "Open",
    version: 1,
    created_at: now,
    updated_at: now,
  };
  value.requests.unshift(record);
  save(value);
  return record;
}
export function replyRequestSample(
  requestId: string,
  clientId: string,
  body: string,
  office: boolean,
) {
  const value = readRequestSamples();
  const existing = value.messages.find((row) => row.id === clientId);
  if (existing) return existing;
  const request = value.requests.find((row) => row.id === requestId);
  if (!request || request.status === "Resolved")
    throw new Error("Reopen the sample before adding a reply.");
  const record = liveMessageSchema.parse({
    id: clientId,
    request_id: requestId,
    author_id: owner,
    author_kind: office ? "Office" : "Resident",
    body,
    created_at: new Date().toISOString(),
  });
  value.messages.push(record);
  request.version++;
  request.updated_at = record.created_at;
  save(value);
  return record;
}
export function statusRequestSample(
  request: LiveRequest,
  status: LiveRequest["status"],
) {
  const value = readRequestSamples();
  const record = value.requests.find((row) => row.id === request.id);
  if (!record) throw new Error("Sample not found.");
  record.status = status;
  record.version++;
  record.updated_at = new Date().toISOString();
  save(value);
  return record;
}
