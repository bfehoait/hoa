import { CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";
import type { z } from "zod";
import {
  facilitySchema,
  manilaInstant,
} from "../../../../../packages/shared/src/operations";
import styles from "./BookingSlots.module.css";
const minutes = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const time = (value: number) =>
  `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
const label = (value: number) =>
  `${Math.floor(value / 60) % 12 || 12}:${String(value % 60).padStart(2, "0")} ${value < 720 ? "AM" : "PM"}`;
export default function BookingSlots({
  facility,
  date,
  occupied,
  start,
  end,
  onChange,
}: {
  facility: z.infer<typeof facilitySchema>;
  date: string;
  occupied: { start: string; end: string }[];
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [hint, setHint] = useState("");
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const slots: { at: number; reserved: boolean; past: boolean }[] = [];
  for (
    let at = minutes(facility.opens);
    at + facility.slot_minutes <= minutes(facility.closes);
    at += facility.slot_minutes
  ) {
    const from = Date.parse(manilaInstant(`${date}T${time(at)}`));
    const until = from + facility.slot_minutes * 60_000;
    const reserved = occupied.some(
      (s) => Date.parse(s.start) < until && Date.parse(s.end) > from,
    );
    slots.push({ at, reserved, past: from <= now });
  }
  function pick(at: number) {
    const from = start ? minutes(start) : -1;
    const until = at + facility.slot_minutes;
    if (from >= 0 && at > from) {
      if (until - from > facility.max_minutes) {
        setHint(
          "This selection exceeds the facility’s maximum booking duration.",
        );
        return;
      }
      if (
        slots.some(
          (s) => s.at >= from && s.at < until && (s.reserved || s.past),
        )
      ) {
        setHint("Choose a continuous range without reserved or past slots.");
        return;
      }
    }
    setHint("");
    const extend =
      from >= 0 &&
      at > from &&
      until - from <= facility.max_minutes &&
      !slots.some(
        (s) => s.at >= from && s.at < until && (s.reserved || s.past),
      );
    onChange(time(extend ? from : at), time(until));
  }
  return (
    <section className={styles.picker} aria-label="Choose booking time">
      <h3>
        <CalendarDays size={22} aria-hidden="true" />
        Choose your time
      </h3>
      <p>
        {new Intl.DateTimeFormat("en-PH", {
          weekday: "long",
          month: "long",
          day: "numeric",
          timeZone: "UTC",
        }).format(new Date(date + "T12:00:00Z"))}
      </p>
      <p>
        {facility.slot_minutes}-minute slots · up to {facility.max_minutes / 60}{" "}
        hours · Philippine time
      </p>
      <p className={styles.legend}>
        Available · Reserved times are disabled. Choose a start, then the last
        slot you need.
      </p>
      <div className={styles.slots}>
        {slots.map((s) => (
          <button
            type="button"
            key={s.at}
            disabled={s.reserved || s.past}
            aria-pressed={
              !!start && s.at >= minutes(start) && s.at < minutes(end)
            }
            onClick={() => pick(s.at)}
          >
            <span>{label(s.at)}</span>
            {s.reserved && <small>Reserved</small>}
            {s.past && !s.reserved && <small>Past</small>}
          </button>
        ))}
      </div>
      {hint && (
        <p role="alert" className={styles.legend}>
          {hint}
        </p>
      )}
      <p className={styles.summary} role="status">
        {start && end
          ? `${label(minutes(start))} – ${label(minutes(end))}`
          : "No time selected yet"}
      </p>
      {start && (
        <button
          type="button"
          className={styles.clear}
          onClick={() => {
            onChange("", "");
            setHint("");
          }}
        >
          Clear selected time
        </button>
      )}
      <p className={styles.legend}>
        Other residents’ booking details stay private. Availability is checked
        again when you submit.
      </p>
    </section>
  );
}
