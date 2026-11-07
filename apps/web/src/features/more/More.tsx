import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { Link } from "../../components/AccessLink";
import {
  ArrowLeft,
  ArrowUpRight,
  CarFront,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Info,
  LayoutDashboard,
  Settings2,
  ShoppingBag,
  Vote,
  Users,
  CircleHelp,
} from "lucide-react";
import { profileSchema } from "../../../../../packages/shared/src";
import { DEMO_HOME } from "../../data/fixtures";
import { repository } from "../../data/repository";
import { usePortal, usePortalMutation } from "../../data/usePortal";
import {
  Button,
  Empty,
  Feedback,
  Field,
  formValues,
  Modal,
  PageIntro,
  Row,
} from "../../components/UI";
import Settings from "./Settings";
import styles from "./More.module.css";
import MoreHub from "./MoreHub";
import { useAuth } from "../../data/auth";
import MemberProfile from "./MemberProfile";

const destinations = [
  {
    to: "vehicles",
    title: "Vehicles & stickers",
    detail: "Your household vehicles and registration requests.",
    icon: CarFront,
  },
  {
    to: "permits",
    title: "Permits & clearances",
    detail: "Property work and document requests.",
    icon: ClipboardCheck,
  },
  {
    to: "marketplace",
    title: "Neighborhood market",
    detail: "Local skills, small businesses, and everyday finds.",
    icon: ShoppingBag,
  },
  {
    to: "transport",
    title: "Going the same way",
    detail: "Community rides and carpools.",
    icon: CarFront,
  },
  {
    to: "training",
    title: "Learn something together",
    detail: "Skills, safety sessions, and workshops.",
    icon: GraduationCap,
  },
  {
    to: "documents",
    title: "Community documents",
    detail: "Board documents and association information.",
    icon: FileText,
  },
  {
    to: "elections",
    title: "Your community, your voice",
    detail: "Election information and participation.",
    icon: Vote,
  },
];
export default function More() {
  const auth = useAuth();
  const path = useParams()["*"] ?? "";
  const [selected, setSelected] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const portal = usePortal();
  const save = usePortalMutation(repository.profile);
  const reset = usePortalMutation(repository.reset);
  async function profile(event: FormEvent<HTMLFormElement>) {
    const result = profileSchema.safeParse(formValues(event));
    if (!result.success) {
      const fields: Record<string, string> = {};
      result.error.issues.forEach((i) => {
        fields[String(i.path[0])] = i.message;
      });
      setErrors(fields);
      return;
    }
    setErrors({});
    save.mutate(result.data);
  }
  const attr = (name: string) => ({
    id: name,
    name,
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });
  if (!path) return <MoreHub />;
  const destination = destinations.find((d) => d.to === path);
  const intro = (
    <Link className="text-link back-link" to="/more">
      <ArrowLeft size={20} />
      Back to more
    </Link>
  );
  if (path === "profile" && !auth.preview) return <MemberProfile />;
  if (path === "profile")
    return (
      <>
        {intro}
        <PageIntro
          eyebrow="YOUR CORNER"
          title="My profile"
          icon={<Users size={28} />}
          description="Manage your sample profile and household details."
        />
        <div className="two-column">
          <form onSubmit={profile} noValidate>
            <Field label="Display name" error={errors.name}>
              <input
                key={portal.data?.profile.name}
                {...attr("name")}
                defaultValue={portal.data?.profile.name ?? DEMO_HOME.name}
                maxLength={100}
                autoComplete="off"
              />
            </Field>
            <Field label="Sample mobile number" error={errors.phone}>
              <input
                key={portal.data?.profile.phone}
                {...attr("phone")}
                type="tel"
                inputMode="tel"
                defaultValue={portal.data?.profile.phone ?? DEMO_HOME.phone}
                autoComplete="off"
              />
            </Field>
            <Feedback
              error={save.error}
              message={
                save.isSuccess
                  ? "Your sample profile was saved in this browser tab."
                  : undefined
              }
            />
            <Button pending={save.isPending} type="submit">
              {save.isPending ? "Saving…" : "Save sample profile"}
            </Button>
          </form>
          <section className="panel">
            <h2>Your household</h2>
            <dl className="detail-list">
              <div>
                <dt>Home</dt>
                <dd>{DEMO_HOME.unit}</dd>
              </div>
              <div>
                <dt>Phase</dt>
                <dd>{DEMO_HOME.phase}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{DEMO_HOME.email}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>Resident preview</dd>
              </div>
            </dl>
            <p className="note">
              Property ownership, verified contact details, and account roles
              must be managed by the authorized office.
            </p>
          </section>
        </div>
      </>
    );
  // Signed-in accounts get real settings; the preview keeps its state gallery.
  if (path === "settings" && !auth.preview && !auth.rolePreview)
    return <Settings />;
  if (path === "settings")
    return (
      <>
        {intro}
        <PageIntro
          eyebrow="TEST THE EXPERIENCE"
          title="Every state deserves a good screen."
          description="Explore the preview without connecting to a live account."
        />
        <Row
          to="/developer"
          title="Developer maintenance"
          detail="Diagnostics, sample-state lab and scoped local resets"
          icon={<Settings2 size={20} />}
        />
        <Row
          to="/office/settings"
          title="Office administration preview"
          detail="Access proposals, local history and workspace tools"
          icon={<LayoutDashboard size={20} />}
        />
        <section className="panel">
          <h2>Household account states</h2>
          <p className="muted">
            These links change only the overview’s sample presentation.
          </p>
          <div className={styles.stateGrid}>
            {[
              { id: "due", title: "Bill due" },
              { id: "overdue", title: "Overdue bill" },
              { id: "paid", title: "Payment recorded" },
              { id: "unbilled", title: "Not yet billed" },
              { id: "loading", title: "Loading records" },
              { id: "error", title: "Failed to load" },
            ].map((s) => (
              <Link to={`/?state=${s.id}`} key={s.id}>
                {s.title}
                <ArrowUpRight size={20} />
              </Link>
            ))}
          </div>
        </section>
        <section className={styles.reset}>
          <h2>Start with a clean slate.</h2>
          <p className="muted">
            Reset sample requests, bookings, saved notices, and profile edits.
            This affects this browser tab only.
          </p>
          <Button
            secondary
            pending={reset.isPending}
            onClick={() => setSelected(99)}
          >
            Reset preview data
          </Button>
          <Feedback
            error={reset.error}
            message={
              reset.isSuccess
                ? "Preview reset. The original synthetic records are restored."
                : undefined
            }
          />
        </section>
        {selected === 99 && (
          <Modal
            title="Reset your preview?"
            description="Your local sample edits will be removed. This cannot affect a real HOA account."
            onClose={() => setSelected(null)}
          >
            <div className="form-actions">
              <Button secondary onClick={() => setSelected(null)}>
                Keep my edits
              </Button>
              <Button
                pending={reset.isPending}
                onClick={async () => {
                  try {
                    await reset.mutateAsync(undefined);
                    setSelected(null);
                  } catch {
                    /* Error shown below. */
                  }
                }}
              >
                Reset sample data
              </Button>
            </div>
            <Feedback error={reset.error} />
          </Modal>
        )}
      </>
    );
  if (path === "help")
    return (
      <>
        {intro}
        <PageIntro
          eyebrow="A HAND WHEN YOU NEED IT"
          title="Help & support"
          icon={<CircleHelp size={28} />}
        />
        <div className={styles.faq}>
          {[
            [
              "Is this my real HOA account?",
              "No. This is a local product preview with synthetic names, bills, and community updates. No production backend is connected.",
            ],
            [
              "Where do my requests go?",
              "They stay in session storage in this browser tab. They are not sent to the office. Closing the tab may remove your edits.",
            ],
            [
              "Can I pay or reserve a real space?",
              "No. Payments, confirmed bookings, invitations, voting, and gate approvals need approved rules and a secure backend.",
            ],
            [
              "Can I put this on my phone?",
              "The interface adapts to phones and supports a web app manifest. Install availability depends on the browser and hosting. Native store submissions require separate signed builds and review.",
            ],
            [
              "What if I need urgent help?",
              "Use your verified local emergency or HOA security contact. This preview does not receive emergency reports. Contact numbers are not invented here.",
            ],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
        <div className="notice-note">
          <Info size={20} />
          <p>
            Official contact details: unavailable until verified by the HOA.
          </p>
        </div>
      </>
    );
  return (
    <>
      {intro}
      <PageIntro
        eyebrow="BELLEFORT"
        title={destination?.title ?? "This page isn’t here."}
      />
      <Empty title="Information unavailable.">
        Return to More to explore the preview.
      </Empty>
    </>
  );
}
