import { lazy, Suspense, useState } from "react";
import { officeAddress } from "./carpool-demo-data";
import { Button } from "../../components/UI";
import styles from "./CarpoolDemo.module.css";
import { shuttleStopLocations } from "./shuttle-stop-data";
const Map = lazy(() => import("./CarpoolDemoMap"));
export default function ShuttleDemoMap({
  pickup,
  destination,
  onChange,
}: {
  pickup: string;
  destination: string;
  onChange: (pickup: string, destination: string) => void;
}) {
  const [key, setKey] = useState(0);
  const [endpoint, setEndpoint] = useState<"pickup" | "destination">("pickup");
  const labels = shuttleStopLocations.map((stop) => stop.label);
  return (
    <section className={styles.shuttleMap} aria-label="Shuttle area map">
      <h2>Shuttle stops</h2>
      <p className={styles.note}>{officeAddress}</p>
      <p className={styles.note}>
        Tap one of the 7 numbered stops to choose your pickup or destination.
        Live vehicle location and route estimates are unavailable.
      </p>
      <div
        className={styles.modes}
        role="group"
        aria-label="Choose what the map selects"
      >
        <button
          type="button"
          aria-pressed={endpoint === "pickup"}
          onClick={() => setEndpoint("pickup")}
        >
          Select pickup
        </button>
        <button
          type="button"
          aria-pressed={endpoint === "destination"}
          onClick={() => setEndpoint("destination")}
        >
          Select destination
        </button>
      </div>
      <p className={styles.note} role="status">
        Pickup: {pickup || "Choose a stop"} · Destination:{" "}
        {destination || "Choose a stop"}
      </p>
      <div className={styles.shuttleMapCanvas}>
        <Suspense fallback={<p>Loading map…</p>}>
          <Map
            key={key}
            shuttle
            pickup={labels.indexOf(pickup)}
            destination={labels.indexOf(destination)}
            onStop={(index) => {
              const label = labels[index];
              if (!label) return;
              if (endpoint === "pickup" && label !== destination) {
                onChange(label, destination);
                setEndpoint("destination");
              } else if (endpoint === "destination" && label !== pickup) {
                onChange(pickup, label);
              }
            }}
          />
        </Suspense>
        <Button
          secondary
          className={styles.recenter}
          onClick={() => setKey((value) => value + 1)}
        >
          Reset map
        </Button>
      </div>
    </section>
  );
}
