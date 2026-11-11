import { useId, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Plus, Eye, EyeOff } from "lucide-react";
import { Button, Feedback, Field, Modal } from "../../components/UI";
import { makeClient, useAuth } from "../../data/auth";
import {
  manualAccountRoles,
  manualAccountRoleLabels,
  manualAccountSchema,
} from "../../../../../packages/shared/src/manual-accounts";
import styles from "./CreateAccount.module.css";
import { LotAddressFields } from "../../components/LotAddressFields";
import {
  formatLotAddress,
  splitLotAddress,
} from "../../../../../packages/shared/src/lot-address";

// Shared by the existing developer monitor and office member directory.
export type RegistrationAccount = {
  id: string;
  name: string;
  email: string;
  unit: string;
  role: "homeowner" | "renter";
};
export default function CreateAccount({
  application,
  onCreated,
}: { application?: RegistrationAccount; onCreated?: () => void } = {}) {
  const auth = useAuth();
  const cache = useQueryClient();
  const [open, setOpen] = useState(false);
  const enabled =
    !!auth.userId &&
    !auth.preview &&
    !auth.memberPreview &&
    !auth.rolePreview &&
    !auth.checking;
  const options = useQuery({
    queryKey: ["manual-account-options", auth.userId],
    enabled,
    retry: false,
    gcTime: 0,
    staleTime: 0,
    queryFn: async () => {
      const result = await makeClient()!.rpc("bfe_manual_account_options");
      if (result.error)
        throw new Error("Manual account creation needs its server setup.");
      return z.object({ enabled: z.boolean() }).parse(result.data);
    },
  });
  if (!enabled || (!options.isError && !options.data?.enabled)) return null;
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus size={18} aria-hidden="true" />{" "}
        {application ? "Approve & create account" : "Create account"}
      </Button>
      {open &&
        (options.isError ? (
          <Modal
            title="Account creation is not available yet"
            onClose={() => setOpen(false)}
            footer={
              <Button secondary onClick={() => setOpen(false)}>
                Done
              </Button>
            }
          >
            <p>
              The system owner needs to finish the manual account setup before
              accounts can be created here.
            </p>
          </Modal>
        ) : (
          <AccountForm
            application={application}
            onClose={() => setOpen(false)}
            onCreated={() => {
              for (const queryKey of [
                ["office-people"],
                ["developer-monitor"],
                ["access-control"],
              ])
                void cache.invalidateQueries({ queryKey });
              void cache.invalidateQueries({
                queryKey: ["registration-detail"],
              });
              onCreated?.();
            }}
          />
        ))}
    </>
  );
}

function AccountForm({
  onClose,
  onCreated,
  application,
}: {
  onClose: () => void;
  onCreated: () => void;
  application?: RegistrationAccount;
}) {
  const id = useId();
  const [requestId] = useState(() => crypto.randomUUID());
  const [name, setName] = useState(application?.name ?? "");
  const [email, setEmail] = useState(application?.email ?? "");
  const [role, setRole] = useState<(typeof manualAccountRoles)[number]>(
    application?.role ?? "homeowner",
  );
  const [lotParts, setLotParts] = useState(() =>
    splitLotAddress(application?.unit ?? ""),
  );
  const unit = formatLotAddress(lotParts);
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [discard, setDiscard] = useState(false);
  const dirty = !!(
    name ||
    email ||
    Object.values(lotParts).some(Boolean) ||
    password ||
    reason
  );
  const close = () => {
    if (busy) return;
    if (dirty && !created) setDiscard(true);
    else onClose();
  };
  const description: Record<string, string> = {
    homeowner:
      "Uses household services and views their own statements where available.",
    renter: "Uses resident services and submits requests for their household.",
    admin:
      "Handles office work within the permissions assigned. Access management needs separate authorization.",
    board:
      "Reviews approved summaries and documents. Private records need separate permission.",
    security: "Handles gate and visitor duties within assigned permissions.",
    driver: "Handles assigned shuttle duties within transport permissions.",
  };
  async function submit() {
    if (busy || created) return;
    if (Object.values(lotParts).some(Boolean) && !unit) {
      setError(
        new Error(
          "Choose phase, block and lot, or clear all three for a staff account.",
        ),
      );
      return;
    }
    const parsed = manualAccountSchema.safeParse({
      ...(application ? { registrationId: application.id } : {}),
      requestId,
      name,
      email,
      role,
      unit,
      password,
      reason,
    });
    if (!parsed.success) {
      setError(
        new Error(
          parsed.error.issues[0]?.message ?? "Check the account details.",
        ),
      );
      return;
    }
    const client = makeClient();
    if (!client) {
      setError(new Error("Sign in again before creating an account."));
      return;
    }
    setBusy(true);
    setSubmitted(true);
    setError(null);
    try {
      const result = await client.functions.invoke("bfe-create-account", {
        body: parsed.data,
      });
      if (result.error) {
        let message =
          "Account creation could not be confirmed. Check the directory before retrying. If the service has not been installed, ask the system owner to finish setup.";
        // Read only the function's safe message; never display an Auth error payload.
        const response = result.error.context;
        if (response instanceof Response) {
          try {
            const body = await response.json();
            if (typeof body.message === "string") message = body.message;
          } catch {
            /* Generic safe message above. */
          }
        }
        throw new Error(message);
      }
      if (result.data?.created !== true)
        throw new Error(
          "Account creation was not confirmed. Check the directory before retrying.",
        );
      setPassword("");
      setCreated(true);
      onCreated();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure
          : new Error("Account creation was not confirmed."),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Modal
        title={created ? "Account created" : "Create account"}
        busy={busy}
        onClose={close}
        footer={
          created ? (
            <Button onClick={onClose}>Done</Button>
          ) : (
            <>
              <Button type="submit" form={id} pending={busy}>
                {submitted ? "Retry same account" : "Create account"}
              </Button>
              <Button secondary disabled={busy} onClick={close}>
                Cancel
              </Button>
            </>
          )
        }
      >
        {created ? (
          <p>
            The sign-in account and member record are linked. No email was sent.
            Share the sign-in details privately and ask the member to change
            their password in Profile.
          </p>
        ) : (
          <form
            id={id}
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <p className={styles.note}>
              No email will be sent. Share the sign-in details privately.
            </p>
            <Feedback error={error} />
            <fieldset disabled={busy || submitted} className={styles.fields}>
              <Field label="Full name" htmlFor={id + "-name"}>
                <input
                  id={id + "-name"}
                  autoComplete="off"
                  value={name}
                  maxLength={120}
                  required
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>
              <Field label="Email address" htmlFor={id + "-email"}>
                <input
                  id={id + "-email"}
                  type="email"
                  readOnly={!!application}
                  autoComplete="off"
                  value={email}
                  maxLength={200}
                  required
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>
              <Field label="Role" htmlFor={id + "-role-select"}>
                <select
                  id={id + "-role-select"}
                  value={role}
                  aria-describedby={id + "-role"}
                  onChange={(event) =>
                    setRole(event.target.value as typeof role)
                  }
                >
                  {manualAccountRoles
                    .filter(
                      (value) => !application || value === application.role,
                    )
                    .map((value) => (
                      <option key={value} value={value}>
                        {manualAccountRoleLabels[value]}
                      </option>
                    ))}
                </select>
                <span id={id + "-role"} className={styles.note}>
                  {description[role]}
                </span>
              </Field>
              <LotAddressFields
                value={lotParts}
                onChange={setLotParts}
                required={["homeowner", "renter"].includes(role)}
              />
              <p className={styles.note}>
                {unit && <>Lot address: {unit}. </>}Lot access is approved
                separately.
                {application &&
                  !formatLotAddress(splitLotAddress(application.unit)) && (
                    <>
                      {" "}
                      The submitted address needs review; choose the correct lot
                      before creating the account.
                    </>
                  )}
              </p>
              <Field label="Initial password" htmlFor={id + "-password"}>
                <span className={styles.password}>
                  <input
                    id={id + "-password"}
                    aria-describedby={id + "-password-hint"}
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    minLength={12}
                    maxLength={128}
                    required
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <Button
                    type="button"
                    tone="quiet"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </Button>
                </span>
                <span id={id + "-password-hint"} className={styles.note}>
                  At least 12 characters. Share privately.
                </span>
              </Field>
              <Field label="Reason for creation" htmlFor={id + "-reason"}>
                <input
                  id={id + "-reason"}
                  value={reason}
                  minLength={3}
                  maxLength={200}
                  required
                  onChange={(event) => setReason(event.target.value)}
                />
              </Field>
            </fieldset>
            {submitted && (
              <p className={styles.note}>
                Details are locked after submission so retrying cannot create a
                different account. Check the directory if the result is
                uncertain.
              </p>
            )}
          </form>
        )}
      </Modal>
      {discard && (
        <Modal
          title="Discard account details?"
          onClose={() => setDiscard(false)}
          footer={
            <>
              <Button secondary onClick={() => setDiscard(false)}>
                Keep editing
              </Button>
              <Button tone="danger" onClick={onClose}>
                Discard details
              </Button>
            </>
          }
        >
          <p>
            {submitted
              ? "A submission was made. Closing this form does not undo it; check the directory before starting again."
              : "These details have not been submitted."}
          </p>
        </Modal>
      )}
    </>
  );
}
