import { useId, useState, type ReactNode } from "react";
import { ArrowDown, BusFront } from "lucide-react";
import styles from "./Shuttle.module.css";
import { shuttleStopLocations } from "./shuttle-stop-data";

export const shuttleStops = shuttleStopLocations.map((stop) => stop.label);

export default function ShuttleStops({
  pickup,
  destination,
  onChange,
  disabled = false,
  action,
}: {
  pickup: string;
  destination: string;
  onChange: (pickup: string, destination: string) => void;
  disabled?: boolean;
  action?: ReactNode;
}) {
  const [choosing, setChoosing] = useState<"pickup" | "destination" | null>(
    pickup && destination ? null : "pickup",
  );
  const instruction = useId();
  const activeChoosing = pickup && destination ? null : choosing;
  return (
    <section className={styles.tripPlanner} aria-label="Choose shuttle stops">
      <div className={styles.tripHeading}>
        <BusFront size={24} aria-hidden="true" />
        <h2>Your trip</h2>
        <span>12 stops</span>
      </div>
      <div className={styles.tripEndpoints}>
        <button
          type="button"
          aria-pressed={activeChoosing === "pickup"}
          disabled={disabled}
          onClick={() => setChoosing("pickup")}
        >
          <span>From · Pickup</span>
          <strong>{pickup || "Choose a stop"}</strong>
        </button>
        <ArrowDown size={20} aria-hidden="true" />
        <button
          type="button"
          aria-pressed={activeChoosing === "destination"}
          disabled={disabled}
          onClick={() => setChoosing("destination")}
        >
          <span>To · Destination</span>
          <strong>{destination || "Choose a stop"}</strong>
        </button>
      </div>
      <p id={instruction} aria-live="polite">
        {activeChoosing === "pickup"
          ? "Choose your pickup stop."
          : activeChoosing === "destination"
            ? "Choose a different stop for your destination."
            : "Pickup and destination selected. Tap either to change it."}
      </p>
      {activeChoosing && (
        <div
          className={styles.stopChoices}
          role="group"
          aria-label={
            activeChoosing === "pickup" ? "Pickup stop" : "Destination stop"
          }
          aria-describedby={instruction}
        >
          {shuttleStops.map((stop) => (
            <button
              type="button"
              data-form-change
              key={stop}
              disabled={
                disabled ||
                (activeChoosing === "pickup"
                  ? stop === destination
                  : stop === pickup)
              }
              aria-pressed={
                (activeChoosing === "pickup" ? pickup : destination) === stop
              }
              onClick={() => {
                if (activeChoosing === "pickup") {
                  onChange(stop, destination);
                  setChoosing("destination");
                } else {
                  onChange(pickup, stop);
                  setChoosing(null);
                }
              }}
            >
              {stop}
            </button>
          ))}
        </div>
      )}
      {action && <div className={styles.tripAction}>{action}</div>}
    </section>
  );
}
