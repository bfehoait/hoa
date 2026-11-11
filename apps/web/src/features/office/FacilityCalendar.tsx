import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { bookingSchema } from "../../../../../packages/shared/src/operations";
import { useAuth, makeClient } from "../../data/auth";
import { Link } from "../../components/AccessLink";
import {
  Badge,
  Button,
  Feedback,
  Modal,
  PageIntro,
  Skeleton,
} from "../../components/UI";
import styles from "./FacilityCalendar.module.css";

const schema = z.object({
  days: z.array(
    z.object({
      day: z.string(),
      total: z.number().int(),
      pending: z.number().int(),
      approved: z.number().int(),
    }),
  ),
  rows: z.array(bookingSchema.extend({ requestor: z.string() })),
  total: z.number().int(),
  month_total: z.number().int(),
  facilities: z.array(
    z.object({ id: z.uuid(), name: z.string(), active: z.boolean() }),
  ),
});
type Booking = z.infer<typeof schema>["rows"][number];
const zone = "Asia/Manila";
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const dateLabel = (day: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-PH", { timeZone: zone, ...options }).format(
    new Date(day + "T12:00:00+08:00"),
  );
const time = (iso: string) =>
  new Intl.DateTimeFormat("en-PH", {
    timeZone: zone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
export default function FacilityCalendar() {
  const auth = useAuth();
  const [day, setDay] = useState(today),
    [facility, setFacility] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState<Booking | null>(null);
  const month = day.slice(0, 7) + "-01";
  const query = useQuery({
    queryKey: [
      "office-facility-calendar",
      auth.userId,
      month,
      facility,
      status,
      day,
      page,
    ],
    enabled:
      !!auth.userId &&
      !auth.checking &&
      !auth.preview &&
      !auth.rolePreview &&
      !auth.memberPreview,
    retry: false,
    gcTime: 0,
    refetchInterval: 30000,
    queryFn: async ({ signal }) => {
      const r = await makeClient()!
        .rpc("bfe_office_facility_calendar", {
          p_month: month,
          p_facility: facility || null,
          p_status: status,
          p_day: day,
          p_page: page,
        })
        .abortSignal(signal);
      if (r.error)
        throw new Error(
          ["PGRST202", "42883"].includes(r.error.code)
            ? "The facility calendar needs database update 039. The booking list remains available."
            : "Facility bookings could not be loaded. Refresh or check your calendar access.",
        );
      return schema.parse(r.data);
    },
  });
  const changeDay = (value: string) => {
    setDay(value);
    setPage(0);
    setSelected(null);
  };
  const moveMonth = (amount: number) => {
    const d = new Date(month + "T12:00:00Z");
    d.setUTCMonth(d.getUTCMonth() + amount);
    changeDay(d.toISOString().slice(0, 10));
  };
  const daysInMonth = new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
  ).getUTCDate();
  const offset = new Date(month + "T12:00:00Z").getUTCDay();
  const rows = query.isError ? [] : (query.data?.rows ?? []);
  return (
    <>
      <PageIntro
        title="Facility calendar"
        description="All facility reservations available to your staff account. Dates and times use Philippine time."
        icon={<CalendarDays size={28} />}
        action={
          <Link className="text-link" to="/office/bookings">
            Booking list & approvals
          </Link>
        }
      />
      <div className={styles.filters}>
        <label>
          Facility
          <select
            value={facility}
            onChange={(e) => {
              setFacility(e.target.value);
              setPage(0);
              setSelected(null);
            }}
          >
            <option value="">All facilities</option>
            {query.data?.facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
                {f.active ? "" : " (inactive)"}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
              setSelected(null);
            }}
          >
            <option value="">All statuses</option>
            {["Pending", "Approved", "Rejected", "Cancelled"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <Button
          secondary
          pending={query.isFetching}
          onClick={() => {
            setSelected(null);
            void query.refetch();
          }}
        >
          <RefreshCw size={18} />
          Refresh
        </Button>
      </div>
      <div className={styles.layout}>
        <section className={styles.month} aria-label="Reservation month">
          <div className={styles.monthHeading}>
            <Button
              secondary
              aria-label="Previous month"
              onClick={() => moveMonth(-1)}
            >
              <ChevronLeft size={20} />
            </Button>
            <h2>{dateLabel(month, { month: "long", year: "numeric" })}</h2>
            <Button
              secondary
              aria-label="Next month"
              onClick={() => moveMonth(1)}
            >
              <ChevronRight size={20} />
            </Button>
          </div>
          <div className={styles.heading}>
            <Button secondary onClick={() => changeDay(today())}>
              Today
            </Button>
            <span>
              {query.isSuccess
                ? `${query.data.month_total} reservations this month`
                : "Checking month…"}
            </span>
          </div>
          <div className={styles.grid}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <span className={styles.weekday} key={d}>
                {d}
              </span>
            ))}
            {Array.from({ length: offset }, (_, i) => (
              <span key={"blank" + i} aria-hidden="true" />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const key = month.slice(0, 8) + String(i + 1).padStart(2, "0"),
                entry = query.isError
                  ? undefined
                  : query.data?.days.find((d) => d.day === key);
              return (
                <button
                  type="button"
                  key={key}
                  className={styles.day}
                  aria-pressed={day === key}
                  aria-current={key === today() ? "date" : undefined}
                  aria-label={`${dateLabel(key, { dateStyle: "full" })}${entry ? `, ${entry.total} reservations` : ""}`}
                  onClick={() => changeDay(key)}
                >
                  <strong>{i + 1}</strong>
                  {!!entry?.total && (
                    <>
                      <small>{entry.total} booked</small>
                      <span className={styles.dots}>
                        {entry.approved > 0 && (
                          <i className={styles.approved} />
                        )}
                        {entry.pending > 0 && <i className={styles.pending} />}
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
          <p className={styles.legend}>
            <span>
              <i className={styles.approved} />
              Approved
            </span>
            <span>
              <i className={styles.pending} />
              Pending
            </span>
            Cancelled and rejected bookings stay labelled in the daily list.
          </p>
        </section>
        <section
          className={styles.agenda}
          aria-label="Selected day reservations"
        >
          <h2>
            {dateLabel(day, { weekday: "long", month: "long", day: "numeric" })}
          </h2>
          {query.isPending ? (
            <Skeleton />
          ) : query.isError ? (
            <Feedback error={query.error} />
          ) : (
            <>
              <p>{query.data.total} reservations</p>
              {!rows.length ? (
                <p className={styles.muted}>
                  No reservations match this day and these filters.
                </p>
              ) : (
                <ul className={styles.records}>
                  {rows.map((r) => (
                    <li key={r.id}>
                      <button type="button" onClick={() => setSelected(r)}>
                        <span className={styles.heading}>
                          <strong>{r.facility_name}</strong>
                          <Badge>{r.status}</Badge>
                        </span>
                        <span>
                          {time(r.starts_at)} – {time(r.ends_at)}
                        </span>
                        <span className={styles.muted}>{r.requestor}</span>
                        <span className={styles.muted}>{r.purpose}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {query.data.total > 20 && (
                <nav className={styles.heading} aria-label="Reservation pages">
                  <Button
                    secondary
                    disabled={!page || query.isFetching}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <span>Page {page + 1}</span>
                  <Button
                    secondary
                    disabled={
                      (page + 1) * 20 >= query.data.total || query.isFetching
                    }
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </nav>
              )}
            </>
          )}
        </section>
      </div>
      {selected && (
        <Modal title={selected.facility_name} onClose={() => setSelected(null)}>
          <Badge>{selected.status}</Badge>
          <dl className="detail-list">
            <div>
              <dt>Reserved by</dt>
              <dd>{selected.requestor}</dd>
            </div>
            <div>
              <dt>Schedule</dt>
              <dd>
                {new Date(selected.starts_at).toLocaleString("en-PH", {
                  timeZone: zone,
                })}{" "}
                –{" "}
                {new Date(selected.ends_at).toLocaleString("en-PH", {
                  timeZone: zone,
                })}
              </dd>
            </div>
            <div>
              <dt>Purpose</dt>
              <dd>{selected.purpose}</dd>
            </div>
            <div>
              <dt>Attendees</dt>
              <dd>{selected.attendees}</dd>
            </div>
          </dl>
          <Link className="text-link" to="/office/bookings?queue=pending">
            Open booking approvals
          </Link>
        </Modal>
      )}
    </>
  );
}
