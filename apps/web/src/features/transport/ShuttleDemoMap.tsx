import { lazy, Suspense, useState } from "react";
import { officeAddress } from "./carpool-demo-data";
import { Button } from "../../components/UI";
import styles from "./CarpoolDemo.module.css";
const Map = lazy(() => import("./CarpoolDemoMap"));
export default function ShuttleDemoMap({
  pickup,
  destination,
  onChange,
}: {
  pickup: string;
  destination: string;
  onChange: (from: string, to: string) => void;
}) {
  const [endpoint, setEndpoint] = useState<"pickup" | "destination">("pickup"),
    [key, setKey] = useState(0);
  const labels = Array.from(
    { length: 12 },
    (_, index) =>
      `${index + 1}${index === 0 ? "st" : index === 1 ? "nd" : index === 2 ? "rd" : "th"} stop`,
  );
  return (
    <section
      className={styles.shuttleMap}
      aria-label="Interactive shuttle stop demonstration"
    >
      <div className={styles.demoNotice}>
        <strong>Interactive demo</strong>
        <span>
          Real basemap, approximate office pin and 12 unverified sample stops.
          Existing shuttle request controls still connect to the service.
        </span>
      </div>
      <h2>Explore the 12 demo stops</h2>
      <p className={styles.note}>
        {officeAddress} · Approximate pin. Stop positions are illustrative and
        unverified.
      </p>
      <div
        className={styles.modes}
        role="group"
        aria-label="Map stop selection"
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
      <div className={styles.shuttleMapCanvas}>
        <Suspense fallback={<p>Loading map…</p>}>
          <Map
            key={key}
            shuttle
            pickup={labels.indexOf(pickup)}
            destination={labels.indexOf(destination)}
            onStop={(index) => {
              if (endpoint === "pickup") {
                if (labels[index] !== destination) {
                  onChange(labels[index], destination);
                  setEndpoint("destination");
                }
              } else if (labels[index] !== pickup)
                onChange(pickup, labels[index]);
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
      <p className={styles.note}>
        Tap numbered markers to select. The sample route follows mapped roads;
        stops are not approved pickup points. The buttons below work without a
        map. Route geometry: OSRM / OpenStreetMap.
      </p>
    </section>
  );
}
