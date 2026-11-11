import { useId, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./BookingSchedule.module.css";
const iso = (date: Date) => date.toISOString().slice(0, 10);
export default function BookingDatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId(),
    [today] = useState(() =>
      new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10),
    );
  const [month, setMonth] = useState(() => (value || today).slice(0, 7));
  const first = new Date(month + "-01T12:00:00Z"),
    days = new Date(
      Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
    ).getUTCDate();
  const last = iso(
    new Date(new Date(today + "T12:00:00Z").getTime() + 366 * 86400000),
  );
  function shift(delta: number) {
    setMonth(
      iso(
        new Date(
          Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + delta, 1, 12),
        ),
      ).slice(0, 7),
    );
  }
  return (
    <section className={styles.calendar} aria-label="Booking date">
      <h3 className={styles.stepTitle}>Choose a date</h3>
      <div className={styles.month}>
        <button
          type="button"
          aria-label="Previous month"
          disabled={month <= today.slice(0, 7)}
          onClick={() => shift(-1)}
        >
          <ChevronLeft size={20} />
        </button>
        <strong>
          {new Intl.DateTimeFormat("en-PH", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          }).format(first)}
        </strong>
        <button
          type="button"
          aria-label="Next month"
          disabled={month >= last.slice(0, 7)}
          onClick={() => shift(1)}
        >
          <ChevronRight size={20} />
        </button>
      </div>
      <div
        className={styles.dateGrid}
        tabIndex={0}
        role="region"
        aria-label="Month dates"
      >
        <div className={styles.days}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <span key={d}>{d}</span>
          ))}
          {Array.from({ length: first.getUTCDay() }, (_, i) => (
            <span key={"pad" + i} />
          ))}
          {Array.from({ length: days }, (_, i) => {
            const date = month + "-" + String(i + 1).padStart(2, "0");
            return (
              <button
                type="button"
                key={date}
                disabled={date < today || date > last}
                aria-label={new Intl.DateTimeFormat("en-PH", {
                  dateStyle: "full",
                  timeZone: "UTC",
                }).format(new Date(date + "T12:00:00Z"))}
                aria-pressed={value === date}
                onClick={() => onChange(date)}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>
      <p className={styles.selectedDate} aria-live="polite">
        {value
          ? new Intl.DateTimeFormat("en-PH", {
              dateStyle: "full",
              timeZone: "UTC",
            }).format(new Date(value + "T12:00:00Z"))
          : "Select a day above"}
      </p>
      <details className={styles.manual}>
        <summary>Enter a date manually</summary>
        <label htmlFor={id}>Enter a date</label>
        <input
          id={id}
          name="date"
          type="date"
          min={today}
          max={last}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (e.target.value) setMonth(e.target.value.slice(0, 7));
          }}
          aria-label="Date"
        />
      </details>
      <p>Philippine time (UTC+8)</p>
    </section>
  );
}
