import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { memberRoles } from "../../../../packages/shared/src/auth";
import {
  liveMessageFields,
  liveMessageSchema,
  liveRequestFields,
  liveRequestInput,
  liveRequestSchema,
  type LiveRequest,
  type LiveRequestInput,
} from "../../../../packages/shared/src/requests";
import { makeClient, useAuth } from "./auth";
import { usePermissions } from "./permissions";
import { accountPreview } from "./account-preview-client";
import {
  createRequestSample,
  readRequestSamples,
  replyRequestSample,
  statusRequestSample,
} from "./request-samples";

const pageSize = 20;
export function useRequestSummary() {
  const auth = useAuth();
  const permissions = usePermissions();
  const sample = auth.preview || !!auth.rolePreview;
  const assigned = auth.member ? memberRoles(auth.member) : [];
  return useQuery({
    queryKey: ["bfe", auth.userId, auth.rolePreview, "summary"],
    enabled:
      sample ||
      (!!auth.userId &&
        !auth.checking &&
        !auth.memberError &&
        assigned.some((role) => role === "admin" || role === "developer") &&
        permissions.allowsPath("/office/requests")),
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
    queryFn: async ({ signal }) => {
      const statuses = ["Open", "In progress", "Resolved"] as const;
      if (sample) {
        const rows = readRequestSamples().requests;
        return statuses.map((status) => ({
          status,
          count: rows.filter((row) => row.status === status).length,
        }));
      }
      const client = makeClient();
      if (!client) throw new Error("Sign-in is not connected.");
      if (accountPreview) {
        return Promise.all(
          statuses.map(async (status) => {
            const { data, error } = await client.rpc("bfe_preview_requests", {
              p_office: true,
              p_status: status,
            });
            requestError(error);
            return {
              status,
              count: z.object({ total: z.number() }).parse(data).total,
            };
          }),
        );
      }
      return Promise.all(
        statuses.map(async (status) => {
          const { count, error } = await client
            .from("bfe_requests")
            .select("id", { count: "exact", head: true })
            .eq("status", status)
            .abortSignal(signal);
          requestError(error);
          return { status, count };
        }),
      );
    },
  });
}
function requestError(error: { code?: string } | null) {
  if (!error) return;
  if (["42P01", "42883", "PGRST202", "PGRST205"].includes(error.code ?? ""))
    throw new Error(
      "Request services are not available yet. Please contact the office; no record has been saved locally.",
    );
  if (error.code === "40001")
    throw new Error(
      "This request changed. Refresh it before updating the status.",
    );
  if (error.code === "42501")
    throw new Error(
      "Your account is not allowed to perform this action. Refresh your membership or contact the office.",
    );
  throw new Error(
    "The operation could not be confirmed. Refresh to check the saved record before retrying. Your text has been kept on this screen.",
  );
}
export function useRequests(
  office: boolean,
  page: number,
  status: string,
  category: string,
) {
  const auth = useAuth();
  const permissions = usePermissions();
  const sample = auth.preview || !!auth.rolePreview;
  const assigned = auth.member ? memberRoles(auth.member) : [];
  const enabled =
    !auth.preview &&
    !auth.rolePreview &&
    !auth.checking &&
    !auth.memberError &&
    !!auth.userId &&
    (office
      ? assigned.some((role) => role === "admin" || role === "developer") &&
        permissions.allowsPath("/office/requests")
      : assigned.some((role) => ["homeowner", "renter"].includes(role)));
  return useQuery({
    queryKey: [
      "bfe",
      auth.userId,
      auth.rolePreview,
      "requests",
      office,
      page,
      status,
      category,
    ],
    enabled: sample || enabled,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
    queryFn: async ({ signal }) => {
      if (sample) {
        const rows = readRequestSamples()
          .requests.filter(
            (row) =>
              (!status || row.status === status) &&
              (!category || row.category === category),
          )
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
        return {
          records: rows.slice(page * pageSize, (page + 1) * pageSize),
          total: rows.length,
          sample: true,
        };
      }
      if (!enabled) throw new Error("An active membership is required.");
      const client = makeClient();
      if (!client) throw new Error("Sign-in is not connected.");
      if (accountPreview) {
        const { data, error } = await client
          .rpc("bfe_preview_requests", {
            p_office: office,
            p_page: page,
            p_status: status,
            p_category: category,
          })
          .abortSignal(signal);
        requestError(error);
        return z
          .object({
            records: z.array(liveRequestSchema),
            total: z.number(),
            sample: z.literal(false),
          })
          .parse(data);
      }
      let query = client
        .from("bfe_requests")
        .select(liveRequestFields, { count: "exact" })
        .order("updated_at", { ascending: false })
        .order("id", { ascending: false });
      if (!office) query = query.eq("owner_id", auth.userId!);
      if (status) query = query.eq("status", status);
      if (category) query = query.eq("category", category);
      const { data, error, count } = await query
        .range(page * pageSize, page * pageSize + pageSize - 1)
        .abortSignal(signal);
      requestError(error);
      const parsed = z.array(liveRequestSchema).safeParse(data);
      if (!parsed.success)
        throw new Error(
          "Request records could not be verified. Contact the office.",
        );
      return { records: parsed.data, total: count, sample: false };
    },
  });
}
export function useRequestThread(id: string | null, page: number) {
  const auth = useAuth();
  const sample = auth.preview || !!auth.rolePreview;
  return useQuery({
    queryKey: ["bfe", auth.userId, auth.rolePreview, "messages", id, page],
    enabled:
      !!id &&
      (sample ||
        (!!auth.userId &&
          !!auth.member &&
          !auth.checking &&
          !auth.memberError)),
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
    queryFn: async ({ signal }) => {
      if (sample) {
        const rows = readRequestSamples()
          .messages.filter((row) => row.request_id === id)
          .sort((a, b) => b.created_at.localeCompare(a.created_at));
        return {
          records: rows.slice(page * pageSize, (page + 1) * pageSize).reverse(),
          total: rows.length,
        };
      }
      const client = makeClient();
      if (!client || !id) throw new Error("Select a request first.");
      if (accountPreview) {
        const { data, error } = await client
          .rpc("bfe_preview_request_thread", { p_id: id, p_page: page })
          .abortSignal(signal);
        requestError(error);
        const parsed = z
          .object({ records: z.array(liveMessageSchema), total: z.number() })
          .parse(data);
        return { ...parsed, records: parsed.records.reverse() };
      }
      const { data, count, error } = await client
        .from("bfe_request_messages")
        .select(liveMessageFields, { count: "exact" })
        .eq("request_id", id)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1)
        .abortSignal(signal);
      requestError(error);
      const parsed = z.array(liveMessageSchema).safeParse(data);
      if (!parsed.success)
        throw new Error(
          "Replies could not be verified. Refresh or contact the office.",
        );
      return { records: parsed.data.reverse(), total: count };
    },
  });
}
export function useRequestActions(office = false) {
  const auth = useAuth();
  const sample = auth.preview || !!auth.rolePreview;
  const cache = useQueryClient();
  async function call(name: string, args: Record<string, unknown>) {
    if (
      auth.preview ||
      auth.rolePreview ||
      !auth.userId ||
      auth.checking ||
      auth.memberError ||
      !auth.member
    )
      throw new Error("Your verified session is required.");
    const client = makeClient();
    if (!client) throw new Error("Sign-in is not connected.");
    const { data, error } = await client.rpc(name, args);
    requestError(error);
    return data;
  }
  const invalidate = () => {
    void cache.invalidateQueries({ queryKey: ["bfe", auth.userId] });
    void cache.invalidateQueries({ queryKey: ["account", auth.userId] });
  };
  const create = useMutation({
    mutationFn: async ({
      clientId,
      input,
    }: {
      clientId: string;
      input: LiveRequestInput;
    }) => {
      const parsed = liveRequestInput.parse(input);
      if (sample) return createRequestSample(parsed, clientId);
      return liveRequestSchema.parse(
        await call("bfe_create_request", {
          p_client_id: clientId,
          p_title: parsed.title,
          p_description: parsed.description,
          p_category: parsed.category,
        }),
      );
    },
    onSuccess: invalidate,
  });
  const reply = useMutation({
    mutationFn: async ({
      requestId,
      clientId,
      body,
    }: {
      requestId: string;
      clientId: string;
      body: string;
    }) => {
      const text = z.string().trim().min(1).max(5000).parse(body);
      if (sample) return replyRequestSample(requestId, clientId, text, office);
      return liveMessageSchema.parse(
        await call("bfe_reply_request", {
          p_request_id: requestId,
          p_client_id: clientId,
          p_body: text,
        }),
      );
    },
    onSuccess: invalidate,
  });
  const status = useMutation({
    mutationFn: async ({
      request,
      value,
    }: {
      request: LiveRequest;
      value: LiveRequest["status"];
    }) => {
      if (sample) return statusRequestSample(request, value);
      return liveRequestSchema.parse(
        await call("bfe_set_request_status", {
          p_request_id: request.id,
          p_expected_version: request.version,
          p_status: value,
        }),
      );
    },
    onSuccess: invalidate,
  });
  return { create, reply, status };
}
