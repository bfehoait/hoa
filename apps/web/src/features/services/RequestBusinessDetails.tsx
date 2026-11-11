import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  requestBusinessFields,
  requestHandlingSchema,
  type LiveRequest,
} from "../../../../../packages/shared/src/requests";
import { Button, Feedback } from "../../components/UI";
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
      setNotice("Office handling saved.");
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
          <dl>
            {requestBusinessFields
              .filter((f) => request.business_details?.[f.key])
              .map((f) => (
                <div key={f.key}>
                  <dt>{f.label}</dt>
                  <dd>{request.business_details?.[f.key]}</dd>
                </div>
              ))}
          </dl>
        )}
      </>
    );
  if (auth.memberPreview)
    return (
      <p className="note">
        Structured handling details are available when signed in directly; this
        account preview retains its existing read-only request view.
      </p>
    );
  return (
    <section aria-label="Request details and Office handling">
      <Feedback error={query.error} message={notice} />
      {query.data && (
        <>
          <dl>
            {requestBusinessFields
              .filter((f) => query.data?.details[f.key])
              .map((f) => (
                <div key={f.key}>
                  <dt>{f.label}</dt>
                  <dd>{query.data?.details[f.key]}</dd>
                </div>
              ))}
          </dl>
          {!editing ? (
            <>
              <p>
                Priority: {query.data.priority} · Handler:{" "}
                {query.data.assignee_name || "Unassigned"}
              </p>
              {query.data.resolution && (
                <>
                  <h3>Recorded resolution</h3>
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
                    Edit Office handling
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
                        <option key={p}>{p}</option>
                      ),
                    )}
                  </select>
                </label>
                {query.data.can_assign && (
                  <label>
                    Assigned handler
                    <select
                      name="assignee"
                      defaultValue={query.data.assignee_id ?? ""}
                    >
                      <option value="">Unassigned</option>
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
                  Record at least five characters before using Resolve. Saving
                  handling does not close the request.
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
                    Save handling
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
