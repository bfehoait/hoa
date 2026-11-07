import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { bookingDashboardSchema } from "../../../../../packages/shared/src/operations";
import { useAuth } from "../../data/auth";
import { featureRpc, useFeatureRecords } from "../../data/feature-records";
import { Empty, Feedback, PageIntro, Skeleton } from "../../components/UI";
import styles from "./CommunityCalendar.module.css";

type Entry = {
  day: string;
  label: string;
  detail: string;
  kind: "booking" | "event";
};

const MANILA = "Asia/Manila";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayKey = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
const timeLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: MANILA,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
const monthLabel = (year: number, month: number) =>
  new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(
    new Date(Date.UTC(year, month, 1, 12)),
  );
const pad = (value: number) => String(value).padStart(2, "0");

/**
 * One month of what is actually happening: the household's own facility
 * bookings and the community events the office has published. Both come from
 * endpoints that already carry their own authorization, so this screen shows
 * nothing a resident could not already open, and grants nothing.
 */
export default function CommunityCalendar({
  onPickDay,
}: {
  /** Given a YYYY-MM-DD date when a day is chosen. Without it the month view
   *  stays read-only, which is correct wherever booking is not offered. */
  onPickDay?: (date: string) => void;
}) {
  const auth = useAuth();
  const connected = !!auth.userId && !auth.checking;
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const bookings = useQuery({
    queryKey: ["calendar-bookings", auth.userId],
    enabled: connected,
    retry: false,
    queryFn: async () =>
      bookingDashboardSchema.parse(
        await featureRpc("bfe_booking_dashboard", {
          p_office: false,
          p_page: 0,
        }),
      ),
  });
  const events = useFeatureRecords("events", "published", 0, "");

  const entries = useMemo(() => {
    const out: Entry[] = [];
    for (const row of bookings.data?.rows ?? []) {
      if (row.status === "Cancelled" || row.status === "Rejected") continue;
      out.push({
        day: dayKey(row.starts_at),
        label: row.facility_name,
        detail:
          timeLabel(row.starts_at) +
          "–" +
          timeLabel(row.ends_at) +
          " · " +
          row.status,
        kind: "booking",
      });
    }
    for (const row of events.data?.rows ?? []) {
      const date = row.fields?.date;
      if (!date) continue;
      const detail = [row.fields?.start, row.fields?.venue]
        .filter(Boolean)
        .join(" · ");
      out.push({
        day: date,
        label: row.title,
        detail: detail || "Community event",
        kind: "event",
      });
    }
    return out;
  }, [bookings.data, events.data]);

  const byDay = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const entry of entries)
      map.set(entry.day, [...(map.get(entry.day) ?? []), entry]);
    return map;
  }, [entries]);

  const first = new Date(Date.UTC(cursor.year, cursor.month, 1, 12));
  const days = new Date(
    Date.UTC(cursor.year, cursor.month + 1, 0, 12),
  ).getUTCDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: first.getUTCDay() }, () => null),
    ...Array.from({ length: days }, (_, index) => index + 1),
  ];
  const shift = (delta: number) =>
    setCursor((prev) => {
      const next = new Date(Date.UTC(prev.year, prev.month + delta, 1, 12));
      return { year: next.getUTCFullYear(), month: next.getUTCMonth() };
    });
  const todayKey = dayKey(new Date().toISOString());
  const pending = bookings.isPending || events.isPending;
  const error = (bookings.error ?? events.error) as Error | null;

  return (
    <>
      <PageIntro
        eyebrow="COMMUNITY SERVICES"
        title="Community calendar"
        description="Your facility bookings and the events the office has published. Dates and times use Philippine time."
      />
      {error ? (
        <Feedback error={error} />
      ) : pending ? (
        <Skeleton />
      ) : (
        <>
          <section className={styles.calendar} aria-label="Month view">
            <header className={styles.header}>
              <button
                type="button"
                className="icon-button"
                onClick={() => shift(-1)}
                aria-label="Previous month"
              >
                <ChevronLeft size={24} aria-hidden="true" />
              </button>
              <h2 aria-live="polite">
                {monthLabel(cursor.year, cursor.month)}
              </h2>
              <button
                type="button"
                className="icon-button"
                onClick={() => shift(1)}
                aria-label="Next month"
              >
                <ChevronRight size={24} aria-hidden="true" />
              </button>
            </header>
            <ol className={styles.weekdays} aria-hidden="true">
              {WEEKDAYS.map((day) => (
                <li key={day}>{day}</li>
              ))}
            </ol>
            <ol className={styles.grid}>
              {cells.map((day, index) => {
                if (day === null)
                  return <li key={"lead-" + index} aria-hidden="true" />;
                const key =
                  cursor.year + "-" + pad(cursor.month + 1) + "-" + pad(day);
                const items = byDay.get(key) ?? [];
                const picker = onPickDay && key >= todayKey;
                return (
                  <li
                    key={key}
                    className={key === todayKey ? styles.today : undefined}
                  >
                    {picker ? (
                      <button
                        type="button"
                        className={styles.pick}
                        onClick={() => onPickDay(key)}
                      >
                        <span className={styles.date}>{day}</span>
                        <span className={styles.pickHint}>Request this day</span>
                      </button>
                    ) : (
                      <span className={styles.date}>{day}</span>
                    )}
                    {items.map((item, position) => (
                      <span
                        key={position}
                        className={
                          item.kind === "event" ? styles.event : styles.booking
                        }
                      >
                        <strong>{item.label}</strong>
                        <small>{item.detail}</small>
                      </span>
                    ))}
                  </li>
                );
              })}
            </ol>
            <p className={styles.legend}>
              <span>
                <span className={styles.swatch} aria-hidden="true" />
                Your facility bookings
              </span>
              <span>
                <span
                  className={styles.swatch + " " + styles.swatchEvent}
                  aria-hidden="true"
                />
                Published community events
              </span>
            </p>
          </section>
          {entries.length === 0 && (
            <Empty icon={<CalendarDays size={32} />} title="Nothing scheduled">
              Your approved facility bookings and the events the office
              publishes will appear here.
            </Empty>
          )}
        </>
      )}
    </>
  );
}
