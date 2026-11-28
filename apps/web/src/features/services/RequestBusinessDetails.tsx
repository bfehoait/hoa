import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  requestBusinessFields,
  requestHandlingSchema,
  type LiveRequest,
} from "../../../../../packages/shared/src/requests";
import { Button, Feedback, Skeleton } from "../../components/UI";
import RecordFacts from "../../components/RecordFacts";
import { useAuth } from "../../data/auth";
import { featureRpc } from "../../data/feature-records";
import styles from "./RequestDesk.module.css";

export default function RequestBusinessDetails({
  request,
  office,
  onBusy,
  onEditing,
}: {
  request: LiveRequest;
  office: boolean;
  onBusy: (busy: boolean) => void;
  onEditing: (editing: boolean) => void;
}) {
  const auth = useAuth(),
    cache = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  const sample = auth.preview || !!auth.rolePreview;
  const query = useQuery({
    queryKey: [
      "bfe",
      auth.userId,
      "business-context",
      request.id,
      request.version,
    ],
    enabled: !sample && !auth.memberPreview,
    retry: false,
    gcTime: 0,
    queryFn: async () =>
      requestHandlingSchema.parse(
        await featureRpc("bfe_request_business_context", {
          p_request: request.id,
        }),
      ),
  });
  const save = useMutation({
    mutationFn: async (f: FormData) => {
      if (!query.data) throw new Error("Refresh the request before saving.");
      return requestHandlingSchema.parse(
        await featureRpc("bfe_save_request_handling", {
          p_request: request.id,
          p_request_version: request.version,
          p_context_version: query.data.version,
          p_priority: f.get("priority"),
          p_assignee: query.data.can_assign
            ? f.get("assignee") || null
            : query.data.assignee_id,
          p_resolution: f.get("resolution"),
          p_reference: f.get("reference"),
        }),
      );
    },
    onSuccess: async () => {
      setEditing(false);
      setNotice("Assignment and details saved.");
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["bfe", auth.userId] }),
        cache.invalidateQueries({ queryKey: ["office-review-inbox"] }),
        cache.invalidateQueries({ queryKey: ["account", auth.userId] }),
      ]);
    },
  });
  useEffect(() => {
    onBusy(save.isPending);
    return () => onBusy(false);
  }, [save.isPending, onBusy]);
  useEffect(() => {
    onEditing(editing);
    return () => onEditing(false);
  }, [editing, onEditing]);
  if (sample)
    return (
      <>
        {request.business_details && (
          <RecordFacts
            label="Request information"
            items={requestBusinessFields
              .filter((f) => request.business_details?.[f.key])
              .map((f) => ({
                key: f.key,
                label: f.label,
                value: request.business_details?.[f.key],
              }))}
          />
        )}
      </>
    );
  if (auth.memberPreview)
    return (
      <p className="note">
        Sign in to this account to see assignment details. This preview is
        read-only.
      </p>
    );
  return (
    <section
      className={styles.businessDetails}
      aria-label="Request details and Office handling"
    >
      <Feedback error={query.error} message={notice} />
      {query.isPending && <Skeleton />}
      {query.isError && (
        <Button secondary onClick={() => void query.refetch()}>
          Try again
        </Button>
      )}
      {query.data && (
        <>
          <RecordFacts
            label="Request information"
            items={requestBusinessFields
              .filter((f) => query.data?.details[f.key])
              .map((f) => ({
                key: f.key,
                label: f.label,
                value: query.data?.details[f.key],
              }))}
          />
          {!editing ? (
            <>
              <dl className={styles.handlingSummary}>
                <div>
                  <dt>Priority</dt>
                  <dd>
                    {query.data.priority === "Untriaged"
                      ? "Not set"
                      : query.data.priority}
                  </dd>
                </div>
                <div>
                  <dt>Assigned to</dt>
                  <dd>{query.data.assignee_name || "Not assigned yet"}</dd>
                </div>
              </dl>
              {query.data.resolution && (
                <>
                  <h3>How this was resolved</h3>
                  <p className={styles.description}>{query.data.resolution}</p>
                </>
              )}
              {office &&
                query.data.can_handle &&
                request.status !== "Resolved" && (
                  <Button
                    secondary
                    onClick={() => {
                      setEditing(true);
                      save.reset();
                    }}
                  >
                    Edit assignment & priority
                  </Button>
                )}
            </>
          ) : (
            <form
              className={styles.form}
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate(new FormData(e.currentTarget));
              }}
            >
              <fieldset disabled={save.isPending}>
                <label>
                  Priority
                  <select name="priority" defaultValue={query.data.priority}>
                    {["Untriaged", "Low", "Normal", "High", "Urgent"].map(
                      (p) => (
                        <option key={p} value={p}>
                          {p === "Untriaged" ? "Not set" : p}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                {query.data.can_assign && (
                  <label>
                    Assigned staff member
                    <select
                      name="assignee"
                      defaultValue={query.data.assignee_id ?? ""}
                    >
                      <option value="">Not assigned yet</option>
                      {query.data.assignee_id &&
                        !query.data.handlers.some(
                          (h) => h.id === query.data?.assignee_id,
                        ) && (
                          <option value={query.data.assignee_id}>
                            Existing handler (review access)
                          </option>
                        )}
                      {query.data.handlers.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  Resolution
                  <textarea
                    name="resolution"
                    maxLength={5000}
                    defaultValue={query.data.resolution}
                  />
                </label>
                <p className="note">
                  Explain how the request was resolved before closing it. Saving
                  these details does not close the request.
                </p>
                <label>
                  Handling reference or reason
                  <input
                    name="reference"
                    required
                    minLength={3}
                    maxLength={200}
                  />
                </label>
                <Feedback error={save.error} />
                <div className="form-actions">
                  <Button
                    type="button"
                    secondary
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" pending={save.isPending}>
                    Save assignment & details
                  </Button>
                </div>
              </fieldset>
            </form>
          )}
        </>
      )}
    </section>
  );
}
