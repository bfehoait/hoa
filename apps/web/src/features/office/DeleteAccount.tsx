import { useEffect, useId, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button, Feedback, Field, Modal } from "../../components/UI";
import { makeClient, useAuth } from "../../data/auth";
import type { AccessMember } from "../../data/access-control";
import styles from "./CreateAccount.module.css";

export default function DeleteAccount({
  member,
  disabled,
  onDeleted,
  onBusyChange,
}: {
  member: AccessMember;
  disabled: boolean;
  onDeleted: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const auth = useAuth();
  const cache = useQueryClient();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    onBusyChange(busy);
  }, [busy, onBusyChange]);
  const options = useQuery({
    queryKey: ["account-delete-options", auth.userId, member.user_id],
    enabled:
      !!auth.userId &&
      !auth.preview &&
      !auth.rolePreview &&
      !auth.memberPreview,
    retry: false,
    gcTime: 0,
    queryFn: async () => {
      const result = await makeClient()!.rpc("bfe_account_delete_options", {
        p_target: member.user_id,
      });
      if (result.error)
        throw new Error("Account deletion needs database update 026.");
      return z.object({ enabled: z.boolean() }).parse(result.data);
    },
  });
  if (auth.preview || auth.rolePreview || auth.memberPreview) return null;
  const protectedReason =
    member.user_id === auth.userId
      ? "You cannot delete your own account."
      : [member.role, ...(member.extra_roles ?? [])].includes("developer")
        ? "Developer accounts cannot be deleted here."
        : null;
  const unavailableReason =
    protectedReason ??
    (options.isPending
      ? "Checking deletion permissions..."
      : options.isError
        ? "Deletion permissions could not be checked. Database update 026 or your connection may need attention."
        : !options.data?.enabled
          ? "Your current permissions do not allow deleting this account."
          : null);
  const close = () => {
    if (!busy) {
      setOpen(false);
      setConfirmation("");
      setReason("");
      setError(null);
      setRequestId(crypto.randomUUID());
    }
  };
  async function remove() {
    if (busy || confirmation !== member.name || reason.trim().length < 3)
      return;
    setBusy(true);
    setError(null);
    try {
      const client = makeClient();
      if (!client) throw new Error("Sign in again before deleting an account.");
      const { user_id, ...expected } = member;
      const result = await client.functions.invoke("bfe-create-account", {
        body: {
          operation: "delete",
          requestId,
          userId: user_id,
          expected,
          confirmation,
          reason,
        },
      });
      if (result.error) {
        let message =
          "Deletion could not be confirmed. Refresh the directory before retrying.";
        if (result.error.context instanceof Response) {
          try {
            const body = await result.error.context.json();
            if (typeof body.message === "string") message = body.message;
          } catch {
            /* Safe generic message. */
          }
        }
        throw new Error(message);
      }
      if (result.data?.deleted !== true)
        throw new Error(
          "Deletion was not confirmed. Check the directory before retrying.",
        );
      for (const queryKey of [
        ["office-people"],
        ["developer-monitor"],
        ["access-control"],
        ["tab-access"],
        ["account-delete-options"],
      ])
        void cache.invalidateQueries({ queryKey });
      onDeleted();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure
          : new Error("Deletion could not be confirmed."),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={styles.deleteSection}>
      <Button
        tone="danger"
        disabled={disabled || !!unavailableReason || !options.data?.enabled}
        onClick={() => setOpen(true)}
      >
        Delete account
      </Button>
      <p className={styles.note}>
        {unavailableReason ??
          (disabled
            ? "Save or reset other changes before deleting this account."
            : "For accounts that no longer need to be kept. Use Suspended to retain their records.")}
      </p>
      {options.isError && !protectedReason && (
        <Button secondary onClick={() => void options.refetch()}>
          Check again
        </Button>
      )}
      {open && (
        <Modal
          title="Delete this account?"
          busy={busy}
          onClose={close}
          footer={
            <>
              <Button
                tone="danger"
                type="submit"
                form={id}
                pending={busy}
                disabled={
                  confirmation !== member.name || reason.trim().length < 3
                }
              >
                Delete account permanently
              </Button>
              <Button secondary disabled={busy} onClick={close}>
                Keep account
              </Button>
            </>
          }
        >
          <form
            id={id}
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              void remove();
            }}
          >
            <p>
              This permanently removes <strong>{member.name}</strong>'s sign-in
              account, member entry and personal preferences. It cannot be
              undone. Linked operational records or uploaded files will block
              deletion.
            </p>
            <Feedback error={error} />
            <fieldset className={styles.fields} disabled={busy}>
              <Field
                label="Type their full name to confirm"
                htmlFor={id + "-confirmation"}
              >
                <input
                  id={id + "-confirmation"}
                  value={confirmation}
                  disabled={busy}
                  required
                  autoComplete="off"
                  maxLength={120}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              </Field>
              <Field label="Reason for deletion" htmlFor={id + "-reason"}>
                <input
                  id={id + "-reason"}
                  value={reason}
                  disabled={busy}
                  required
                  minLength={3}
                  maxLength={200}
                  onChange={(event) => setReason(event.target.value)}
                />
              </Field>
            </fieldset>
          </form>
        </Modal>
      )}
    </section>
  );
}
