import { useEffect, useId, useState } from "react";
import type { z } from "zod";
import {
  facilitySchema,
  manilaInstant,
} from "../../../../../packages/shared/src/operations";
import styles from "./BookingSlots.module.css";
const minutes = (value: string) =>
  Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
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
  const instructionId = useId();
  const [choosing, setChoosing] = useState<"start" | "end">("start");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const opens = Math.max(420, minutes(facility.opens)),
    closes = Math.min(1320, minutes(facility.closes));
  const slots: { at: number; blocked: boolean }[] = [];
  // Retain the configured slot alignment even if operating hours are narrower.
  for (
    let at = minutes(facility.opens);
    at + facility.slot_minutes <= closes;
    at += facility.slot_minutes
  ) {
    if (at < opens) continue;
    const from = Date.parse(manilaInstant(`${date}T${time(at)}`)),
      until = from + facility.slot_minutes * 60000;
    slots.push({
      at,
      blocked:
        from <= now ||
        occupied.some(
          (s) => Date.parse(s.start) < until && Date.parse(s.end) > from,
        ),
    });
  }
  const first = start ? minutes(start) : -1;
  const ends = slots.filter(
    (s) =>
      s.at >= first &&
      !s.blocked &&
      s.at + facility.slot_minutes - first <= facility.max_minutes &&
      !slots.some((x) => x.at >= first && x.at <= s.at && x.blocked),
  );
  const choosingEnd = choosing === "end" && !!start;
  const last = end ? minutes(end) : -1;
  const boundaries = slots.length
    ? [
        ...slots.map((slot) => slot.at),
        slots[slots.length - 1].at + facility.slot_minutes,
      ]
    : [];
  const validEnds = new Set(
    ends.map((slot) => slot.at + facility.slot_minutes),
  );
  return (
    <section className={styles.picker} aria-label="Choose amenity time">
      <h3>Choose your time</h3>
      <p className={styles.legend}>
        Philippine time · Unavailable times are disabled
      </p>
      <div className={styles.timeLayout}>
        <div
          className={styles.rangeFields}
          role="group"
          aria-label="Edit time range"
        >
          <button
            type="button"
            aria-pressed={!choosingEnd}
            onClick={() => setChoosing("start")}
          >
            <span>Start</span>
            <strong>{start ? label(first) : "Choose time"}</strong>
          </button>
          <span aria-hidden="true">→</span>
          <button
            type="button"
            aria-pressed={choosingEnd}
            disabled={!start}
            onClick={() => setChoosing("end")}
          >
            <span>End</span>
            <strong>{end ? label(last) : "Choose time"}</strong>
          </button>
        </div>
        <p id={instructionId} className={styles.legend} aria-live="polite">
          {choosingEnd
            ? "Now choose a later time to finish your range."
            : start && end
              ? "Range selected. Tap a time to start a new range, or edit End above."
              : "Tap your start time, then tap your end time."}
        </p>
        <div
          className={styles.timeGrid}
          role="group"
          aria-label={choosingEnd ? "Choose range end" : "Choose range start"}
          aria-describedby={instructionId}
        >
          {boundaries.map((at) => {
            const disabled = choosingEnd
              ? !validEnds.has(at)
              : !slots.some((slot) => slot.at === at && !slot.blocked);
            const endpoint = at === first || at === last;
            const inside = !!end && at > first && at < last;
            return (
              <button
                key={at}
                type="button"
                className={`${styles.timeChoice} ${endpoint ? styles.endpoint : inside ? styles.inRange : ""}`}
                aria-pressed={endpoint || inside}
                aria-label={`${label(at)}${at === first ? ", selected start" : at === last ? ", selected end" : inside ? ", within selected range" : ""}`}
                disabled={disabled}
                onClick={() => {
                  if (choosingEnd) {
                    onChange(start, time(at));
                    setChoosing("start");
                  } else {
                    onChange(time(at), "");
                    setChoosing("end");
                  }
                }}
              >
                {label(at)}
              </button>
            );
          })}
        </div>
      </div>
      {start && end && (
        <p className={styles.summary} role="status">
          {label(minutes(start))} – {label(minutes(end))} ·{" "}
          {minutes(end) - minutes(start)} minutes
        </p>
      )}
      {!slots.some((s) => !s.blocked) && (
        <p role="status">
          No times are available on this date. Choose another date.
        </p>
      )}
      <p>
        Up to {facility.max_minutes / 60} hours, in {facility.slot_minutes}
        -minute intervals.
      </p>
    </section>
  );
}
