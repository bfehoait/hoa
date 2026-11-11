import { useState, type FormEvent } from "react";
import { useParams, useSearchParams, useLocation } from "react-router-dom";
import { Link } from "../../components/AccessLink";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  FileText,
  Plus,
  ShieldCheck,
  Users,
} from "lucide-react";
import { z } from "zod";
import {
  bookingSchema,
  manilaDate,
  requestSchema,
  visitorSchema,
} from "../../../../../packages/shared/src";
import { type LocalRecord } from "../../data/fixtures";
import { repository } from "../../data/repository";
import { usePortal, usePortalMutation } from "../../data/usePortal";
import {
  Badge,
  Button,
  Empty,
  Feedback,
  Field,
  formValues,
  Modal,
  PageIntro,
  Skeleton,
} from "../../components/UI";
import styles from "./Services.module.css";
import ServiceHub from "./ServiceHub";
import { BackLink, NavigationGroup } from "../../components/Navigation";
import { RequestStatusVisual } from "../../components/RecordVisuals";
import RequestDesk from "./RequestDesk";
import { useAuth } from "../../data/auth";
import OperationsDesk from "../connected/OperationsDesk";
import BookingsCalendar from "../connected/BookingsCalendar";

type Kind = "request" | "booking" | "visitor";
const amenities = [
  {
    name: "Clubhouse",
    icon: Users,
    line: "For gathering, celebrating, and being together.",
    meta: "Capacity and fees · not yet confirmed",
  },
  {
    name: "Basketball court",
    icon: CircleCourt,
    line: "Make a little room for a good game.",
    meta: "Booking rules · awaiting HOA confirmation",
  },
  {
    name: "Swimming pool",
    icon: PoolIcon,
    line: "A slower afternoon, close to home.",
    meta: "Operating hours · not yet confirmed",
  },
];
function CircleCourt({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3v18M6 5c6 4 6 10 0 14M18 5c-6 4-6 10 0 14" />
    </svg>
  );
}
function PoolIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
    >
      <path d="M3 16c3-3 6 3 9 0s6 3 9 0M3 20c3-3 6 3 9 0s6 3 9 0M8 13V5a2 2 0 0 1 4 0M15 13V5a2 2 0 0 1 4 0M8 8h7M8 12h7" />
    </svg>
  );
}

export default function Services() {
  const location = useLocation();
  const auth = useAuth();
  if (location.pathname === "/services/requests") return <RequestDesk />;
  if (
    !auth.preview &&
    !auth.rolePreview &&
    ["/services/bookings", "/services/calendar", "/services/visitors"].includes(
      location.pathname,
    )
  )
    return !location.pathname.endsWith("visitors") ? (
      <BookingsCalendar key={location.pathname} />
    ) : (
      <OperationsDesk key={location.pathname} kind="visitor" />
    );
  return <ServicesPage key={location.pathname + location.search} />;
}
function ServicesPage() {
  const path = useParams()["*"] ?? "";
  const [params] = useSearchParams();
  const [form, setForm] = useState<Kind | null>(() =>
    params.has("new")
      ? path === "visitors"
        ? "visitor"
        : path === "bookings"
          ? "booking"
          : "request"
      : null,
  );
  const [amenity, setAmenity] = useState("Clubhouse");
  const [detail, setDetail] = useState<LocalRecord | null>(null);
  const [status, setStatus] = useState("All");
  const portal = usePortal();
  const cancel = usePortalMutation(repository.cancel);
  const kind: Kind =
    path === "bookings"
      ? "booking"
      : path === "visitors"
        ? "visitor"
        : "request";
  const records =
    portal.data?.records.filter(
      (r) =>
        r.kind === kind &&
        (status === "All" ||
          (status === "Active"
            ? r.status !== "Cancelled"
            : r.status === "Cancelled")),
    ) ?? [];
  const open = (type: Kind, name?: string) => {
    if (name) setAmenity(name);
    setForm(type);
  };
  const title =
    path === "requests"
      ? "My requests"
      : path === "bookings"
        ? "Amenities & bookings"
        : path === "visitors"
          ? "Visitor passes"
          : "The everyday, made easier.";
  if (!path) return <ServiceHub />;
  if (!["requests", "bookings", "visitors"].includes(path))
    return (
      <>
        <PageIntro eyebrow="SERVICES" title="This service isn’t available." />
        <Link className="text-link" to="/services">
          Back to services
          <ArrowLeft size={20} />
        </Link>
      </>
    );
  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <BackLink to="/services">All services</BackLink>
      </div>
      <PageIntro
        eyebrow="YOUR COMMUNITY OFFICE"
        title={title}
        icon={
          kind === "booking" ? (
            <CalendarDays size={28} />
          ) : kind === "visitor" ? (
            <ShieldCheck size={28} />
          ) : (
            <FileText size={28} />
          )
        }
        description={
          path === "visitors"
            ? "Prepare a sample visitor request. Real gate access requires security approval."
            : path === "bookings"
              ? "Choose a space and prepare a sample booking request."
              : "Track repairs, questions and document requests."
        }
        action={
          path ? (
            <Button onClick={() => open(kind)}>
              <Plus size={20} />
              {kind === "request"
                ? "New request"
                : kind === "booking"
                  ? "Request a booking"
                  : "Add a visitor"}
            </Button>
          ) : undefined
        }
      />
      {path === "bookings" && (
        <div className={styles.amenities}>
          {amenities.map(({ name, icon: Icon, line, meta }) => (
            <article key={name}>
              <span className={styles.amenityIcon}>
                <Icon size={24} />
              </span>
              <h2>{name}</h2>
              <p>{line}</p>
              <span>{meta}</span>
              <Button secondary onClick={() => open("booking", name)}>
                Request a time
                <ArrowUpRight size={18} />
              </Button>
            </article>
          ))}
        </div>
      )}
      {path === "visitors" && (
        <div className="notice-note">
          <ShieldCheck size={20} />
          <p>
            A local preview pass is not valid at the gate. No QR code or access
            authorization is issued.
          </p>
        </div>
      )}
      <div className="section-title">
        <h2>
          {kind === "request"
            ? "Your requests"
            : kind === "booking"
              ? "Your bookings"
              : "Your visitors"}
        </h2>
        <span className="small muted">
          {records.length} sample {records.length === 1 ? "record" : "records"}
        </span>
      </div>
      {kind !== "request" && (
        <div className="filters" aria-label="Filter records">
          {["All", "Active", "Cancelled"].map((s) => (
            <button
              className="filter"
              key={s}
              aria-pressed={status === s}
              onClick={() => setStatus(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}
      {portal.isPending ? (
        <Skeleton />
      ) : !records.length ? (
        <Empty
          title={
            kind === "request"
              ? "Nothing waiting on you."
              : "No records here yet."
          }
        >
          Create a sample {kind} to explore how it works. It stays in this
          browser tab.
        </Empty>
      ) : (
        <div className="list">
          {records.map((r) => (
            <button
              className={styles.record}
              key={r.id}
              onClick={() => {
                cancel.reset();
                setDetail(r);
              }}
            >
              <span className={styles.recordIcon}>
                {kind === "request" ? (
                  <FileText size={24} />
                ) : kind === "booking" ? (
                  <CalendarDays size={24} />
                ) : (
                  <Users size={24} />
                )}
              </span>
              <span>
                <strong>{r.title}</strong>
                <small>{r.date ?? r.id}</small>
                <small>
                  {r.detail.length > 90
                    ? r.detail.slice(0, 90) + "…"
                    : r.detail}
                </small>
              </span>
              <Badge tone={r.status === "Cancelled" ? "neutral" : "amber"}>
                {r.status}
              </Badge>
              <ChevronRight size={20} />
            </button>
          ))}
        </div>
      )}
      {path === "requests" && !portal.isPending && !portal.isError && (
        <RequestStatusVisual
          records={records}
          label="Synthetic requests in this view"
        />
      )}
      <NavigationGroup aria-label="Related service views" limit={2}>
        {path !== "requests" && (
          <Link to="/services/requests">My requests</Link>
        )}
        <Link to="/services/calendar">Calendar</Link>
        <Link to="/services/inbox">Messages</Link>
      </NavigationGroup>
      <Feedback error={portal.error} />
      {form && (
        <RecordForm
          kind={form}
          amenity={amenity}
          onClose={() => setForm(null)}
        />
      )}
      {detail && (
        <Modal
          title={detail.title}
          description={`${detail.id} · sample record`}
          onClose={() => setDetail(null)}
        >
          <dl className="detail-list">
            <div>
              <dt>Status</dt>
              <dd>{cancel.isSuccess ? "Cancelled" : detail.status}</dd>
            </div>
            {detail.date && (
              <div>
                <dt>Date</dt>
                <dd>{detail.date}</dd>
              </div>
            )}
            <div>
              <dt>Created</dt>
              <dd>
                {new Date(detail.createdAt).toLocaleDateString("en-PH", {
                  timeZone: "Asia/Manila",
                })}
              </dd>
            </div>
          </dl>
          <p>{detail.detail}</p>
          <p className="note">
            No request has been sent to the real HOA. This record is stored only
            in your browser tab.
          </p>
          <Feedback
            error={cancel.error}
            message={
              cancel.isSuccess
                ? `${detail.title} cancelled in this preview.`
                : undefined
            }
          />
          <div className="form-actions">
            <Button secondary onClick={() => setDetail(null)}>
              Close
            </Button>
            {detail.kind !== "request" &&
              detail.status !== "Cancelled" &&
              !cancel.isSuccess && (
                <Button
                  pending={cancel.isPending}
                  onClick={() => cancel.mutate(detail.id)}
                >
                  {cancel.isPending ? "Cancelling…" : "Cancel preview request"}
                </Button>
              )}
          </div>
        </Modal>
      )}
    </>
  );
}

function RecordForm({
  kind,
  amenity,
  onClose,
}: {
  kind: Kind;
  amenity: string;
  onClose: () => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<LocalRecord | null>(null);
  const mutation = usePortalMutation(repository.add);
  const attr = (name: string) => ({
    id: name,
    name,
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });
  async function submit(event: FormEvent<HTMLFormElement>) {
    const values = formValues(event);
    setErrors({});
    try {
      let record: Omit<LocalRecord, "id" | "createdAt">;
      if (kind === "request") {
        const data = requestSchema.parse(values);
        record = {
          kind,
          title: data.title,
          detail: data.details,
          category: data.category,
          status: "Open",
        };
      } else if (kind === "booking") {
        const data = bookingSchema.parse(values);
        record = {
          kind,
          title: data.amenity,
          date: data.date,
          detail: `${data.time} · ${data.guests} guests`,
          status: "Saved locally",
        };
      } else {
        const data = visitorSchema.parse(values);
        record = {
          kind,
          title: data.name,
          date: data.date,
          detail: `${data.purpose}${data.plate ? " · " + data.plate : ""}`,
          status: "Saved locally",
        };
      }
      const row = await mutation.mutateAsync(record);
      setResult(row as LocalRecord);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fields: Record<string, string> = {};
        error.issues.forEach((i) => {
          fields[String(i.path[0])] = i.message;
        });
        setErrors(fields);
        requestAnimationFrame(() =>
          document.getElementById(String(error.issues[0]?.path[0]))?.focus(),
        );
      }
    }
  }
  return (
    <Modal
      title={
        result
          ? "Saved in your preview."
          : kind === "request"
            ? "What can we help with?"
            : kind === "booking"
              ? "Make a little room."
              : "Who’s coming over?"
      }
      description="Local demonstration · nothing is sent to the HOA"
      onClose={onClose}
    >
      {result ? (
        <>
          <Feedback
            message={`${result.title}${result.date ? " · " + result.date : ""} saved in this browser tab. Reference: ${result.id}.`}
          />
          <p className="muted">
            This is not an office confirmation, space reservation, or valid gate
            pass.
          </p>
          <div className="form-actions">
            <Button onClick={onClose}>
              <Check size={20} />
              Done
            </Button>
          </div>
        </>
      ) : (
        <form onSubmit={submit} noValidate>
          {kind === "request" ? (
            <>
              <Field label="What is this about?" error={errors.category}>
                <select {...attr("category")} defaultValue="Maintenance">
                  {["Maintenance", "Concern", "Complaint", "Document"].map(
                    (c) => (
                      <option key={c}>{c}</option>
                    ),
                  )}
                </select>
              </Field>
              <Field label="A short title" error={errors.title}>
                <input
                  {...attr("title")}
                  placeholder="For example, a streetlight that needs fixing"
                  maxLength={100}
                  required
                />
              </Field>
              <Field label="Tell us a little more" error={errors.details}>
                <textarea
                  {...attr("details")}
                  placeholder="Where is it? What happened? What would help?"
                  maxLength={2000}
                  required
                />
              </Field>
            </>
          ) : kind === "booking" ? (
            <>
              <Field label="Community space" error={errors.amenity}>
                <select {...attr("amenity")} defaultValue={amenity}>
                  {amenities.map((a) => (
                    <option key={a.name}>{a.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Preferred date" error={errors.date}>
                <input
                  {...attr("date")}
                  type="date"
                  min={manilaDate()}
                  required
                />
              </Field>
              <Field label="Preferred time" error={errors.time}>
                <select {...attr("time")}>
                  {["09:00–11:00", "14:00–16:00", "17:00–19:00"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Number of guests" error={errors.guests}>
                <input
                  {...attr("guests")}
                  type="number"
                  min="1"
                  max="50"
                  defaultValue="4"
                  required
                />
              </Field>
              <p className="note">
                Sample time slots and form limits only. Actual availability,
                capacity, fees and approval rules are not confirmed.
              </p>
            </>
          ) : (
            <>
              <Field label="Visitor’s full name" error={errors.name}>
                <input
                  {...attr("name")}
                  autoComplete="off"
                  maxLength={100}
                  required
                />
              </Field>
              <Field label="Date of visit" error={errors.date}>
                <input
                  {...attr("date")}
                  type="date"
                  min={manilaDate()}
                  required
                />
              </Field>
              <Field label="Reason for visit" error={errors.purpose}>
                <select {...attr("purpose")}>
                  {["Family or friend", "Delivery", "Service provider"].map(
                    (p) => (
                      <option key={p}>{p}</option>
                    ),
                  )}
                </select>
              </Field>
              <Field label="Vehicle plate (optional)" error={errors.plate}>
                <input
                  {...attr("plate")}
                  maxLength={16}
                  autoCapitalize="characters"
                />
              </Field>
            </>
          )}
          <Feedback error={mutation.error} />
          <div className="form-actions">
            <Button type="button" secondary onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" pending={mutation.isPending}>
              {mutation.isPending ? "Saving locally…" : "Save preview request"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
