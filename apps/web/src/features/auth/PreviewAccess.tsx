import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Link } from "../../components/AccessLink";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CarFront,
  House,
  LockKeyhole,
  ShieldCheck,
  Users,
} from "lucide-react";
import { registrationPreviewSchema } from "../../../../../packages/shared/src/workspace";
import { useWorkspaceAction, workspaceRepository } from "../../data/workspace";
import { Button, Feedback, Field, formValues } from "../../components/UI";
import { ProgressTimeline, WorkspaceNote } from "../../components/WorkspaceUI";
import styles from "./Access.module.css";

export default function Access() {
  const location = useLocation();
  const navigate = useNavigate();
  const client = useQueryClient();
  const registration = location.pathname === "/register";
  const recovery = location.pathname === "/recover";
  const mutation = useWorkspaceAction(workspaceRepository.create);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  function enter(path: string) {
    try {
      sessionStorage.setItem("bellefort-preview-entry", "open");
    } catch {
      /* Navigation still works without this optional preference. */
    }
    client.removeQueries({ queryKey: ["preview"] });
    navigate(path);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    const value = registrationPreviewSchema.safeParse(formValues(event));
    if (!value.success) {
      const next: Record<string, string> = {};
      value.error.issues.forEach(
        (issue) => (next[String(issue.path[0])] = issue.message),
      );
      setErrors(next);
      return;
    }
    setErrors({});
    try {
      await mutation.mutateAsync({
        kind: "registration",
        title: `${value.data.name} · sample applicant`,
        detail: `Synthetic ${value.data.role.toLowerCase()} application for ${value.data.unit}. Evidence and identity are not verified.`,
        metadata: {
          email: value.data.email,
          unit: value.data.unit,
          role: value.data.role,
          proof: "Not supplied",
        },
      });
      setSaved(true);
    } catch {
      /* Inline mutation feedback. */
    }
  }
  const attr = (id: string) => ({
    id,
    name: id,
    "aria-invalid": !!errors[id],
    "aria-describedby": errors[id] ? `${id}-error` : undefined,
  });
  return (
    <main className={styles.access}>
      <section className={styles.identity}>
        <Link to="/" className={styles.brand}>
          <img src="/icon.svg" alt="" width="48" height="48" />
          <span>
            Bellefort<small>ESTATES · LOCAL PREVIEW</small>
          </span>
        </Link>
        <div>
          <p className="eyebrow">YOUR HOME. YOUR COMMUNITY.</p>
          <p className={styles.identityTitle}>
            {registration
              ? "A place for your household."
              : recovery
                ? "A clear way back."
                : "Welcome to Bellefort."}
          </p>
          <p>
            This workspace demonstrates the complete resident and office
            experience using synthetic records.
          </p>
          <ProgressTimeline
            items={[
              {
                label: "Explore the design",
                detail: "Mobile and desktop previews",
                done: true,
              },
              {
                label: "Review the workflows",
                detail: "Local changes, no live approvals",
                done: true,
              },
              {
                label: "Connect a secure backend",
                detail: "Separate project and approved rules required",
              },
            ]}
          />
        </div>
        <p className="small">Bacoor, Cavite · Proposed community portal</p>
      </section>
      <section className={styles.panel}>
        <div className={styles.card}>
          <Link to="/" className="text-link">
            <ArrowLeft size={18} />
            Back to preview
          </Link>
          <h1>
            {registration
              ? "Sample registration"
              : recovery
                ? "Account recovery"
                : "Preview access"}
          </h1>
          <p className="muted">
            {registration
              ? "Use invented details and an @example.invalid address."
              : "Real sign-in, password recovery and account sessions are not connected."}
          </p>
          {registration ? (
            saved ? (
              <>
                <Feedback message="Sample registration saved locally. No account was created and no invitation was sent." />
                <Link className="text-link" to="/office/registrations">
                  Open the local review queue
                  <ArrowRight size={20} />
                </Link>
              </>
            ) : (
              <form onSubmit={submit} noValidate>
                <Field label="Sample full name" error={errors.name}>
                  <input {...attr("name")} autoComplete="off" maxLength={100} />
                </Field>
                <Field label="Sample email" error={errors.email}>
                  <input
                    {...attr("email")}
                    type="email"
                    placeholder="sample@example.invalid"
                    autoComplete="off"
                  />
                </Field>
                <Field label="Sample unit" error={errors.unit}>
                  <input
                    {...attr("unit")}
                    placeholder="Demo A-07"
                    maxLength={60}
                  />
                </Field>
                <Field label="Claimed membership" error={errors.role}>
                  <select {...attr("role")}>
                    <option>Homeowner</option>
                    <option>Renter</option>
                  </select>
                </Field>
                <Feedback error={mutation.error} />
                <Button pending={mutation.isPending} type="submit">
                  Save sample application
                </Button>
              </form>
            )
          ) : recovery ? (
            <>
              <div className={styles.lock}>
                <LockKeyhole size={32} />
                <h2>Password recovery is not available yet.</h2>
                <p>
                  No email is sent from this preview. Recovery will use the
                  authorized identity provider after setup.
                </p>
              </div>
              <Link className="text-link" to="/sign-in">
                Back to preview access
                <ArrowRight size={20} />
              </Link>
            </>
          ) : (
            <>
              <div className={styles.workspaces}>
                {[
                  { title: "Resident preview", path: "/", icon: House },
                  { title: "Office preview", path: "/office", icon: Building2 },
                  {
                    title: "Security preview",
                    path: "/security",
                    icon: ShieldCheck,
                  },
                  { title: "Driver preview", path: "/driver", icon: CarFront },
                  { title: "Board preview", path: "/board", icon: Users },
                ].map(({ title, path, icon: Icon }) => (
                  <button key={path} onClick={() => enter(path)}>
                    <Icon size={20} />
                    <span>{title}</span>
                    <ArrowRight size={18} />
                  </button>
                ))}
              </div>
              <div className={styles.links}>
                <Link to="/register">Sample registration</Link>
                <Link to="/recover">Recovery design</Link>
              </div>
            </>
          )}
          {location.search.includes("closed=1") && (
            <Feedback message="Local in-memory preview state cleared. No real authentication session was connected. Your synthetic tab records remain available for inspection." />
          )}
          <WorkspaceNote>
            Opening a workspace is not authentication. No password or real
            account credential is requested. All preview routes are inspectable.
          </WorkspaceNote>
        </div>
      </section>
    </main>
  );
}
