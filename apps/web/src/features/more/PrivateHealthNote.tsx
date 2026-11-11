import { useId, useState } from "react";
import { z } from "zod";
import { useAuth } from "../../data/auth";
import { useRegistryAction, useRegistryRpc } from "../../data/registry";
import { Button, Feedback, Skeleton } from "../../components/UI";
import styles from "./Settings.module.css";

const healthSchema = z.object({
  note: z.string(),
  version: z.number().int(),
  can_edit: z.boolean(),
});
export default function PrivateHealthNote({ target }: { target?: string }) {
  const auth = useAuth();
  const preview = auth.preview || !!auth.rolePreview || !!auth.memberPreview;
  const query = useRegistryRpc(
    "bfe_private_health_note",
    { p_target: target ?? null },
    healthSchema,
    !preview,
  );
  const action = useRegistryAction();
  const id = useId();
  const [draft, setDraft] = useState<{ note: string; version: number } | null>(
    null,
  );
  const [saved, setSaved] = useState(false);
  return (
    <section className={styles.panel} aria-labelledby={id}>
      <h2 id={id}>Health conditions (optional)</h2>
      <p className={styles.help}>
        Private comorbidity or health-condition note for you and authorized
        Office managers. It is not shown in the member directory or community
        feed. Include only what you want the office to know.
      </p>
      {preview ? (
        <p className={styles.help}>
          Private health notes are available when signed in directly.
        </p>
      ) : query.isPending ? (
        <Skeleton />
      ) : query.isError ? (
        <>
          <Feedback error={query.error} />
          <Button secondary onClick={() => void query.refetch()}>
            Retry health note
          </Button>
        </>
      ) : (
        query.data && (
          <>
            {draft ? (
              <form
                className={styles.form}
                onSubmit={(event) => {
                  event.preventDefault();
                  setSaved(false);
                  action.mutate(
                    {
                      name: "bfe_save_private_health_note",
                      args: { p_version: draft.version, p_note: draft.note },
                    },
                    {
                      onSuccess: () => {
                        setDraft(null);
                        setSaved(true);
                      },
                      onError: () => {
                        void query.refetch();
                      },
                    },
                  );
                }}
              >
                <label htmlFor={`${id}-note`}>
                  Comorbidities / health conditions
                </label>
                <textarea
                  id={`${id}-note`}
                  value={draft.note}
                  maxLength={1000}
                  disabled={action.isPending}
                  onChange={(event) =>
                    setDraft({ ...draft, note: event.target.value })
                  }
                />
                <p className={styles.help}>
                  Up to 1,000 characters. Leave blank and save to clear your
                  profile note.
                </p>
                <Feedback error={action.error} />
                <div className="form-actions">
                  <Button
                    secondary
                    disabled={action.isPending}
                    onClick={() => setDraft(null)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" pending={action.isPending}>
                    Save health note
                  </Button>
                </div>
              </form>
            ) : (
              <>
                <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                  {query.data.note || "No health conditions provided."}
                </p>
                {query.data.can_edit && !target && (
                  <Button
                    secondary
                    onClick={() => {
                      setDraft({
                        note: query.data.note,
                        version: query.data.version,
                      });
                      action.reset();
                      setSaved(false);
                    }}
                  >
                    Edit health note
                  </Button>
                )}
              </>
            )}
          </>
        )
      )}
      {saved && <Feedback message="Health note saved." />}
    </section>
  );
}
