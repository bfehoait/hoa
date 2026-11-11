import { useId, useState } from "react";
import { Link } from "../../components/AccessLink";
import { Button, Feedback, Field } from "../../components/UI";
import { makeClient } from "../../data/auth";
import { registrationSchema } from "../../../../../packages/shared/src/registration";
import { formatLotAddress } from "../../../../../packages/shared/src/lot-address";
import {
  LotAddressFields,
  type LotParts,
} from "../../components/LotAddressFields";
import { AuthFrame } from "./AuthFrame";
import styles from "../office/CreateAccount.module.css";
const answers = [
  ["not_provided", "Not provided"],
  ["yes", "Yes"],
  ["no", "No"],
];
type Person = {
  name: string;
  relationship: string;
  phone: string;
  senior: string;
  pwd: string;
};
export default function Registration() {
  const id = useId(),
    [clientId] = useState(() => crypto.randomUUID());
  const [role, setRole] = useState("homeowner"),
    [household, setHousehold] = useState<Person[]>([]);
  const [lotParts, setLotParts] = useState<LotParts>({
    phase: "",
    block: "",
    lot: "",
  });
  const [pending, setPending] = useState(false),
    [sent, setSent] = useState(false),
    [error, setError] = useState<Error | null>(null);
  const field = (
    name: string,
    label: string,
    type = "text",
    maxLength = 120,
    required = true,
  ) => (
    <Field key={name} label={label} htmlFor={id + name}>
      <input
        id={id + name}
        name={name}
        type={type}
        maxLength={type === "number" ? undefined : maxLength}
        min={type === "number" ? 1 : undefined}
        required={required}
        autoComplete={
          name === "name"
            ? "name"
            : name === "email"
              ? "email"
              : name === "phone"
                ? "tel"
                : undefined
        }
      />
    </Field>
  );
  function person(index: number, key: keyof Person, value: string) {
    setHousehold((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    );
  }
  return (
    <AuthFrame>
      <Link className="text-link" to="/sign-in">
        Back to sign in
      </Link>
      <h1>Join your community</h1>
      {sent ? (
        <>
          <p>
            Your details have been received for office review. This does not
            create a sign-in account or verify ownership.
          </p>
          <p>
            The office will provide sign-in instructions after verifying your
            membership. No email has been sent.
          </p>
          <Link className="text-link" to="/sign-in">
            Return to sign in
          </Link>
        </>
      ) : (
        <form
          className={styles.form}
          onSubmit={async (event) => {
            event.preventDefault();
            if (pending) return;
            setError(null);
            const data = Object.fromEntries(new FormData(event.currentTarget));
            const parsed = registrationSchema.safeParse({
              ...data,
              clientId,
              role,
              household,
              consent: data.consent === "on",
            });
            if (!parsed.success) {
              setError(
                new Error(
                  parsed.error.issues[0]?.message ?? "Check the application.",
                ),
              );
              return;
            }
            const client = makeClient();
            if (!client) {
              setError(
                new Error(
                  "Registration is not connected yet. Contact the office.",
                ),
              );
              return;
            }
            setPending(true);
            try {
              const result = await client.rpc("bfe_apply_for_membership", {
                p_fields: parsed.data,
              });
              if (result.error || result.data?.received !== true)
                throw new Error(
                  "We could not confirm your application. Please try again or contact the office.",
                );
              setSent(true);
            } catch (e) {
              setError(
                e instanceof Error
                  ? e
                  : new Error("Application could not be confirmed."),
              );
            } finally {
              setPending(false);
            }
          }}
        >
          <p className={styles.note}>
            Apply as a homeowner or renter. The office verifies your details
            before creating an account.
          </p>
          <Feedback error={error} />
          <fieldset className={styles.fields} disabled={pending}>
            {field("name", "Full name")}
            {field("email", "Email address", "email", 200)}
            {field("phone", "Mobile number", "tel", 40)}
            <Field label="I am the" htmlFor={id + "role"}>
              <select
                id={id + "role"}
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="homeowner">Homeowner</option>
                <option value="renter">Renter</option>
              </select>
            </Field>
            <LotAddressFields value={lotParts} onChange={setLotParts} />
            {formatLotAddress(lotParts) && (
              <p className={styles.note}>
                Lot address: {formatLotAddress(lotParts)}
              </p>
            )}
            {field("street", "Street (optional)", "text", 120, false)}
            {field("ownerName", "Registered homeowner name")}
            {["senior", "pwd"].map((key) => (
              <Field
                key={key}
                label={
                  key === "senior"
                    ? "Senior citizen (optional)"
                    : "Person with disability (optional)"
                }
                htmlFor={id + key}
              >
                <select name={key} id={id + key}>
                  {answers.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </fieldset>
          <Field
            label="Health conditions / comorbidities (optional)"
            htmlFor={id + "health"}
          >
            <textarea
              id={id + "health"}
              name="healthNote"
              maxLength={1000}
              disabled={pending}
              aria-describedby={id + "health-help"}
            />
            <small id={id + "health-help"}>
              Private note for authorized Office review. Do not include medical
              documents or ID numbers.
            </small>
          </Field>
          <details>
            <summary>Other household members ({household.length})</summary>
            <p className={styles.note}>
              Optional. Do not include medical details or ID images.
            </p>
            {household.map((row, index) => (
              <fieldset
                key={index}
                className={styles.fields}
                disabled={pending}
              >
                <legend>Household member {index + 1}</legend>
                {(["name", "relationship", "phone"] as const).map((key) => (
                  <Field
                    key={key}
                    label={
                      key === "name"
                        ? "Full name"
                        : key === "phone"
                          ? "Mobile (optional)"
                          : "Relationship"
                    }
                    htmlFor={id + index + key}
                  >
                    <input
                      id={id + index + key}
                      value={row[key]}
                      maxLength={
                        key === "name" ? 120 : key === "phone" ? 40 : 60
                      }
                      required={key !== "phone"}
                      type={key === "phone" ? "tel" : "text"}
                      onChange={(e) => person(index, key, e.target.value)}
                    />
                  </Field>
                ))}
                {(["senior", "pwd"] as const).map((key) => (
                  <Field
                    key={key}
                    label={
                      key === "senior"
                        ? "Senior citizen"
                        : "Person with disability"
                    }
                    htmlFor={id + index + key}
                  >
                    <select
                      id={id + index + key}
                      value={row[key]}
                      onChange={(e) => person(index, key, e.target.value)}
                    >
                      {answers.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>
                ))}
                <div className={styles.memberActions}>
                  <Button
                    secondary
                    size="sm"
                    disabled={pending}
                    type="button"
                    onClick={() =>
                      setHousehold((rows) => rows.filter((_, i) => i !== index))
                    }
                  >
                    Remove member {index + 1}
                  </Button>
                </div>
              </fieldset>
            ))}
            <Button
              tone="quiet"
              size="sm"
              type="button"
              disabled={pending || household.length >= 20}
              onClick={() =>
                setHousehold((rows) => [
                  ...rows,
                  {
                    name: "",
                    relationship: "",
                    phone: "",
                    senior: "not_provided",
                    pwd: "not_provided",
                  },
                ])
              }
            >
              Add household member
            </Button>
          </details>
          <Field
            label="Anything else the office should know (optional)"
            htmlFor={id + "note"}
          >
            <textarea
              name="note"
              id={id + "note"}
              maxLength={1000}
              disabled={pending}
            />
          </Field>
          <div style={{ display: "none" }} aria-hidden="true">
            <label>
              Website
              <input
                name="website"
                defaultValue=""
                tabIndex={-1}
                autoComplete="off"
              />
            </label>
          </div>
          <label
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              minHeight: 48,
            }}
          >
            <input type="checkbox" name="consent" required disabled={pending} />
            I confirm these details are accurate and may be reviewed for
            membership.
          </label>
          <Button type="submit" pending={pending}>
            Send application
          </Button>
        </form>
      )}
    </AuthFrame>
  );
}
