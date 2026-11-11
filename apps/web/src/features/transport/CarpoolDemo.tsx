import { lazy, Suspense, useState } from "react";
import { ArrowDownUp, CarFront, Clock3, MapPin, Users } from "lucide-react";
import { Button, Feedback, Modal, PageIntro } from "../../components/UI";
import styles from "./CarpoolDemo.module.css";

const DemoMap = lazy(() => import("./CarpoolDemoMap"));
import { officeAddress, demoPlaces } from "./carpool-demo-data";

export default function CarpoolDemo() {
  const [mode, setMode] = useState<"find" | "offer">("find");
  const [pickup, setPickup] = useState(0),
    [destination, setDestination] = useState(2);
  const [date, setDate] = useState(""),
    [time, setTime] = useState("08:00"),
    [seats, setSeats] = useState(1);
  const [results, setResults] = useState(false),
    [selected, setSelected] = useState<number | null>(null);
  const [notice, setNotice] = useState(""),
    [error, setError] = useState<Error | null>(null);
  const [mapKey, setMapKey] = useState(0);
  const [today] = useState(() =>
    new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10),
  );
  function reset() {
    setResults(false);
    setNotice("");
    setError(null);
  }
  return (
    <div className={styles.page}>
      <PageIntro
        title="Carpooling"
        description="Find a shared ride. Make room for a neighbour."
      />
      <div className={styles.demoNotice}>
        <strong>Interactive demo</strong>
        <span>
          Real basemap, approximate office pin and illustrative pickup points.
          No real bookings or driver contact.
        </span>
      </div>
      <p className={styles.note}>
        {officeAddress} ? Pin location needs verification.
      </p>
      <div className={styles.layout}>
        <section
          className={styles.mapPanel}
          aria-label="Sales office area carpool demo map"
        >
          <Suspense
            fallback={
              <div className={styles.mapFallback}>Loading sample map…</div>
            }
          >
            <DemoMap key={mapKey} pickup={pickup} destination={destination} />
          </Suspense>
          <Button
            secondary
            className={styles.recenter}
            onClick={() => setMapKey((value) => value + 1)}
          >
            <MapPin size={18} aria-hidden="true" />
            Reset map
          </Button>
          <p className={styles.mapCaption}>
            Road-following demo · Office pin approximate
          </p>
        </section>
        <section
          className={styles.tripPanel}
          aria-label="Plan a sample carpool"
        >
          <div className={styles.modes} role="group" aria-label="Carpool mode">
            <button
              type="button"
              aria-pressed={mode === "find"}
              onClick={() => {
                setMode("find");
                reset();
              }}
            >
              <Users size={20} />
              Find a ride
            </button>
            <button
              type="button"
              aria-pressed={mode === "offer"}
              onClick={() => {
                setMode("offer");
                reset();
              }}
            >
              <CarFront size={20} />
              Offer a ride
            </button>
          </div>
          <h2>
            {mode === "find"
              ? "Where are you heading?"
              : "Share your next trip"}
          </h2>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setNotice("");
              if (pickup === destination) {
                setError(
                  new Error("Choose different pickup and destination points."),
                );
                return;
              }
              setError(null);
              if (mode === "find") setResults(true);
              else
                setNotice(
                  "Sample offer created in this view only. Nothing was published and no seats were reserved.",
                );
            }}
            onChange={reset}
          >
            <label className={styles.location}>
              <span>
                <MapPin size={18} />
                Pickup
              </span>
              <select
                value={pickup}
                onChange={(event) => setPickup(Number(event.target.value))}
              >
                {demoPlaces.map((place, index) => (
                  <option key={place} value={index}>
                    {place}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className={styles.swap}
              aria-label="Swap pickup and destination"
              onClick={() => {
                setPickup(destination);
                setDestination(pickup);
                reset();
              }}
            >
              <ArrowDownUp size={20} />
            </button>
            <label className={styles.location}>
              <span>
                <MapPin size={18} />
                Destination
              </span>
              <select
                value={destination}
                onChange={(event) => setDestination(Number(event.target.value))}
              >
                {demoPlaces.map((place, index) => (
                  <option key={place} value={index}>
                    {place}
                  </option>
                ))}
              </select>
            </label>
            <div className={styles.fields}>
              <label>
                Date
                <input
                  type="date"
                  required
                  min={today}
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </label>
              <label>
                Departure
                <input
                  type="time"
                  required
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                />
              </label>
              <label>
                {mode === "find" ? "Passengers" : "Seats offered"}
                <select
                  value={seats}
                  onChange={(event) => setSeats(Number(event.target.value))}
                >
                  {[1, 2, 3, 4].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
            </div>
            <Feedback error={error} message={notice} />
            <Button type="submit" block>
              {mode === "find" ? "Find sample rides" : "Create sample offer"}
            </Button>
            <p className={styles.note}>
              Philippine time · Demo locations only · Route geometry: OSRM /
              OpenStreetMap.
            </p>
          </form>
          {results && mode === "find" && (
            <section
              className={styles.results}
              aria-label="Sample ride results"
              aria-live="polite"
            >
              <h2>Sample rides</h2>
              {[1, 2].map((ride) => (
                <button
                  type="button"
                  key={ride}
                  className={styles.ride}
                  onClick={() => setSelected(ride)}
                >
                  <span className={styles.rideIcon}>
                    <CarFront size={24} />
                  </span>
                  <span>
                    <strong>Sample driver {ride}</strong>
                    <span>
                      {demoPlaces[pickup]} → {demoPlaces[destination]}
                    </span>
                    <span>
                      <Clock3 size={16} />
                      {time} · {seats} {seats === 1 ? "seat" : "seats"} ·
                      Synthetic offer
                    </span>
                  </span>
                  <span aria-hidden="true">→</span>
                </button>
              ))}
            </section>
          )}
        </section>
      </div>
      {selected !== null && (
        <Modal
          title="Sample ride details"
          presentation="task"
          onClose={() => setSelected(null)}
        >
          <div className={styles.ticket}>
            <span className={styles.demoTag}>
              Synthetic ride · Not a ticket
            </span>
            <h2>Sample driver {selected}</h2>
            <dl>
              <div>
                <dt>Pickup</dt>
                <dd>{demoPlaces[pickup]}</dd>
              </div>
              <div>
                <dt>Destination</dt>
                <dd>{demoPlaces[destination]}</dd>
              </div>
              <div>
                <dt>Departure · Philippine time</dt>
                <dd>
                  {date} · {time}
                </dd>
              </div>
              <div>
                <dt>Requested seats</dt>
                <dd>{seats}</dd>
              </div>
            </dl>
            <Button
              block
              onClick={() => {
                setNotice(
                  "Sample join request recorded in this view only. No driver was contacted and no seat is confirmed.",
                );
                setSelected(null);
              }}
            >
              Simulate request to join
            </Button>
            <p className={styles.note}>
              No payment, live tracking or actual reservation.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
