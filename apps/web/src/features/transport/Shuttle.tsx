import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import {
  BusFront,
  Clock3,
  Phone,
  RefreshCw,
  MapPin,
  Check,
} from "lucide-react";
import {
  shuttleDashboardSchema,
  shuttleInput,
  shuttleActions,
  shuttleCodes,
  type ShuttleDashboard,
  type ShuttleRequest,
} from "../../../../../packages/shared/src/shuttle";
import { memberRoles } from "../../../../../packages/shared/src/auth";
import { useAuth, makeClient } from "../../data/auth";
import {
  Badge,
  Button,
  Feedback,
  Modal,
  PageIntro,
  Skeleton,
} from "../../components/UI";
import styles from "./Shuttle.module.css";
import { usePermissions } from "../../data/permissions";
import ShuttleStops, { shuttleStops } from "./ShuttleStops";
import ShuttleDemoMap from "./ShuttleDemoMap";

const exampleId = "78000000-0000-4000-8000-000000000001";
const passengerId = "78000000-0000-4000-8000-000000000002";
const pickupSteps = [
  { status: "Waiting for Shuttle", label: "Request sent" },
  { status: "Accepted", label: "Driver assigned" },
  { status: "On the way", label: "Heading to pickup" },
  { status: "Arrived", label: "At your pickup" },
  { status: "Picked up", label: "Pickup complete" },
];
const when = (value: string) =>
  new Date(value).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  });
async function rpc(
  name: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
) {
  const api = makeClient();
  if (!api) throw new Error("Sign-in is not connected.");
  let call = api.rpc(name, args);
  if (signal) call = call.abortSignal(signal);
  const { data, error } = await call;
  if (error) {
    if (["PGRST202", "42883", "42P01"].includes(error.code))
      throw new Error(
        "Shuttle service is not available yet. Contact the office for assistance.",
      );
    if (error.code === "42501")
      throw new Error(
        "Your account cannot perform this shuttle action. Refresh or ask the office.",
      );
    if (error.code === "40001")
      throw new Error("This request changed. Refresh before retrying.");
    if (error.code === "23505")
      throw new Error(
        "This driver already has an active shuttle. Refresh the roster before retrying.",
      );
    if (["P0001", "22023"].includes(error.code)) throw new Error(error.message);
    throw new Error(
      "The shuttle action could not be confirmed. Refresh before retrying.",
    );
  }
  return data;
}

export default function Shuttle() {
  const auth = useAuth();
  const location = useLocation();
  const permissions = usePermissions();
  const readOnly = permissions.readOnlyPath(location.pathname);
  const sample = auth.preview || !!auth.rolePreview;
  const roles = auth.member ? memberRoles(auth.member) : [];
  const sampleDriver = roles.includes("driver");
  const passengerView =
    !location.pathname.startsWith("/driver") &&
    !location.pathname.startsWith("/office") &&
    ((sample && !sampleDriver) ||
      roles.some((role) => role === "homeowner" || role === "renter"));
  const uid = auth.userId ?? exampleId;
  const [history, setHistory] = useState(false);
  const [outcomeFilter, setOutcomeFilter] = useState("");
  const [page, setPage] = useState(0);
  const [form, setForm] = useState(false);
  const [pickupStop, setPickupStop] = useState("");
  const [destinationStop, setDestinationStop] = useState("");
  const [roster, setRoster] = useState(false);
  const [selectedShuttle, setSelectedShuttle] = useState("");
  const [message, setMessage] = useState("");
  const [tick, setTick] = useState(() => Date.now());
  const [sampleDuty, setSampleDuty] = useState(true);
  const [sampleReady, setSampleReady] = useState(true);
  const [sampleRows, setSampleRows] = useState<ShuttleRequest[]>(() =>
    sample
      ? [
          {
            id: exampleId,
            owner_id: sampleDriver ? passengerId : uid,
            driver_id: null,
            shuttle_code: null,
            pickup: "Sample clubhouse",
            destination: "Sample main gate",
            passengers: 1,
            status: "Waiting for Shuttle",
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 3_600_000).toISOString(),
            arrived_at: null,
            version: 1,
            reason: null,
            prior_day: false,
          },
        ]
      : [],
  );
  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const query = useQuery({
    queryKey: ["shuttle", uid, auth.rolePreview, history, page, outcomeFilter],
    enabled:
      !sample &&
      !!auth.userId &&
      !auth.checking &&
      !auth.memberPending &&
      !auth.memberError,
    gcTime: 0,
    retry: false,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    queryFn: async ({ signal }) => {
      const parsed = shuttleDashboardSchema.safeParse(
        await rpc(
          "bfe_shuttle_journey_dashboard",
          {
            p_history: history,
            p_page: page,
            p_outcome: history ? outcomeFilter : "",
          },
          signal,
        ),
      );
      if (!parsed.success)
        throw new Error(
          "The shuttle response could not be verified. Refresh or contact the office.",
        );
      return parsed.data;
    },
  });
  const cache = useQueryClient();
  const action = useMutation({
    mutationFn: async ({
      name,
      args,
    }: {
      name: string;
      args: Record<string, unknown>;
    }) => {
      if (sample)
        throw new Error("Preview actions cannot change real shuttle records.");
      if (readOnly)
        throw new Error(
          "This module is view only. Ask an access manager to enable changes.",
        );
      return rpc(name, args);
    },
    onSuccess: () => cache.invalidateQueries({ queryKey: ["shuttle"] }),
  });
  const data: ShuttleDashboard | undefined = sample
    ? {
        server_now: new Date(tick).toISOString(),
        driver: sampleDriver,
        reviewer: roles.includes("developer") || roles.includes("board"),
        manager: false,
        total: sampleRows.length,
        waiting_count: sampleRows.filter(
          (r) =>
            r.status === "Waiting for Shuttle" &&
            Date.parse(r.expires_at) > tick,
        ).length,
        latest_outcome: null,
        rows: sampleRows,
        eligible_drivers: [],
        shuttles: [
          {
            code: "Shuttle 1",
            driver_name: "Sample shuttle driver",
            capacity: 4,
            on_duty: sampleDuty,
            available: sampleDuty,
            ready: sampleReady,
            contact: "",
            active: true,
            busy:
              !sampleReady ||
              sampleRows.some(
                (r) =>
                  r.driver_id === uid &&
                  ["Accepted", "On the way", "Arrived"].includes(r.status),
              ),
            driver_id: sampleDriver ? uid : null,
          },
        ],
      }
    : query.isError
      ? undefined
      : query.data;
  const ownShuttle = data?.shuttles.find((s) => s.driver_id === uid);
  const activeVehicles = data?.shuttles.filter((s) => s.active) ?? [];
  const inspectedVehicle =
    activeVehicles.find((s) => s.code === selectedShuttle) ?? activeVehicles[0];
  const ownDuty = ownShuttle?.on_duty ?? false;
  useEffect(() => {
    if (auth.memberPreview || sample || readOnly || !data?.driver || !ownDuty)
      return;
    const ping = () => {
      if (document.visibilityState === "visible")
        void rpc("bfe_shuttle_presence", { p_on_duty: null })
          .then(() => cache.invalidateQueries({ queryKey: ["shuttle"] }))
          .catch(() =>
            setMessage(
              "Driver connection could not be refreshed. Availability will expire unless you reconnect.",
            ),
          );
    };
    ping();
    const timer = window.setInterval(ping, 30_000);
    return () => clearInterval(timer);
  }, [auth.memberPreview, sample, readOnly, data?.driver, ownDuty, cache]);
  const now = sample
    ? tick
    : data
      ? Date.parse(data.server_now) + (tick - query.dataUpdatedAt)
      : tick;
  const effectiveRows =
    data?.rows.map((r) => ({
      ...r,
      status: (["Waiting for Shuttle", "Accepted", "On the way"].includes(
        r.status,
      ) && Date.parse(r.expires_at) <= now
        ? "Lapsed / Unserved"
        : r.status) as ShuttleRequest["status"],
    })) ?? [];
  const activeStatuses = [
    "Waiting for Shuttle",
    "Accepted",
    "On the way",
    "Arrived",
  ];
  const rows = effectiveRows.filter((r) =>
    history
      ? !activeStatuses.includes(r.status) &&
        (!outcomeFilter || r.status === outcomeFilter)
      : activeStatuses.includes(r.status),
  );
  const expiredOwn = effectiveRows.find(
    (r) => r.owner_id === uid && r.status === "Lapsed / Unserved",
  );
  const outcome = expiredOwn?.status ?? data?.latest_outcome?.status;
  async function update(row: ShuttleRequest, status: string) {
    setMessage("");
    if (sample) {
      if (status === "Accepted") setSampleReady(false);
      setSampleRows((current) =>
        current.map((r) =>
          r.id === row.id
            ? {
                ...r,
                status: status as ShuttleRequest["status"],
                driver_id: status === "Accepted" ? uid : r.driver_id,
                shuttle_code:
                  status === "Accepted" ? "Shuttle 1" : r.shuttle_code,
                arrived_at:
                  status === "Arrived"
                    ? new Date().toISOString()
                    : r.arrived_at,
                version: r.version + 1,
              }
            : r,
        ),
      );
      setMessage(
        "Sample status updated in this screen only. No driver or passenger was contacted.",
      );
      return;
    }
    try {
      await action.mutateAsync({
        name: "bfe_update_shuttle_request",
        args: { p_id: row.id, p_version: row.version, p_status: status },
      });
      setMessage("Shuttle request updated.");
    } catch {
      /* Visible error below; no optimistic success. */
    }
  }
  const requestAction =
    data &&
    !history &&
    ((sample && !sampleDriver) ||
      roles.some((role) => role === "homeowner" || role === "renter")) ? (
      <>
        <Button
          disabled={
            readOnly ||
            (passengerView && (!pickupStop || !destinationStop)) ||
            !data.shuttles.some(
              (vehicle) => vehicle.active && vehicle.available,
            ) ||
            rows.some((row) => row.owner_id === uid) ||
            !!data.prior_day_request
          }
          onClick={() => {
            setForm(true);
            setMessage("");
          }}
        >
          Request a shuttle
        </Button>
        {readOnly ? (
          <p>Your account has view-only access.</p>
        ) : data.prior_day_request ? (
          <p>Review your earlier request below before requesting again.</p>
        ) : rows.some((row) => row.owner_id === uid) ? (
          <p>You already have an active request. Follow its progress below.</p>
        ) : !data.shuttles.some(
            (vehicle) => vehicle.active && vehicle.available,
          ) ? (
          <p>No shuttle is available right now. Check again later.</p>
        ) : null}
      </>
    ) : null;
  return (
    <>
      <PageIntro
        eyebrow={
          sample ? "SYNTHETIC SHUTTLE PREVIEW" : "AUTHORIZED SHUTTLE SERVICE"
        }
        title="Shuttle service"
        icon={<BusFront size={28} />}
        description="Choose your stops, check availability and follow your pickup."
      />
      {passengerView && (
        <ShuttleDemoMap
          pickup={pickupStop}
          destination={destinationStop}
          onChange={(pickup, destination) => {
            setPickupStop(pickup);
            setDestinationStop(destination);
          }}
        />
      )}
      {passengerView && (
        <ShuttleStops
          pickup={pickupStop}
          action={requestAction}
          destination={destinationStop}
          onChange={(pickup, destination) => {
            setPickupStop(pickup);
            setDestinationStop(destination);
          }}
        />
      )}
      <div className={`${styles.toolbar} ${styles.navigation}`}>
        <Button
          secondary
          aria-pressed={!history}
          onClick={() => {
            setHistory(false);
            setPage(0);
          }}
        >
          Today’s requests
        </Button>
        {(data?.driver || data?.reviewer) && (
          <Button
            secondary
            aria-pressed={history}
            onClick={() => {
              setHistory(true);
              setPage(0);
            }}
          >
            Service history
          </Button>
        )}
        {!sample && (
          <Button
            secondary
            pending={query.isFetching}
            onClick={() => void query.refetch()}
          >
            <RefreshCw size={18} />
            Refresh
          </Button>
        )}
        {data?.manager && (
          <Button secondary onClick={() => setRoster(true)}>
            Manage authorized shuttles
          </Button>
        )}
        {data?.driver && (
          <Button
            secondary
            pending={action.isPending}
            disabled={readOnly}
            onClick={async () => {
              if (sample) {
                setSampleDuty(!sampleDuty);
                setMessage("Sample duty changed in this screen only.");
                return;
              }
              try {
                await action.mutateAsync({
                  name: "bfe_shuttle_presence",
                  args: { p_on_duty: !ownDuty },
                });
                setMessage(
                  ownDuty
                    ? "You are now off duty."
                    : "You are on duty. Keep the shuttle screen connected; handle requests only when safely parked.",
                );
              } catch {
                /* Visible action error. */
              }
            }}
          >
            {ownDuty ? "Go off duty" : "Go on duty"}
          </Button>
        )}
      </div>
      <Feedback message={message} error={query.error ?? action.error} />
      {!sample && query.isPending && <Skeleton />}
      {data && (
        <>
          <div className={styles.serviceSummary}>
            <span className={styles.serviceMark}>
              <BusFront size={30} aria-hidden="true" />
            </span>
            <div>
              <strong>Getting around Bellefort</strong>
              <p>
                {data.waiting_count} waiting today{" "}
                <span aria-hidden="true">·</span> Philippine time
              </p>
            </div>
            <span className={styles.waitLimit}>
              <Clock3 size={18} aria-hidden="true" /> Arrival limit: 60 minutes
            </span>
          </div>
          <section className={`${styles.panel} ${styles.availability}`}>
            <h2 className={styles.sectionTitle}>
              <BusFront size={24} aria-hidden="true" />
              Shuttle availability
            </h2>
            {!data.shuttles.some((s) => s.active && s.available) && (
              <div className={styles.unavailable}>
                <BusFront size={28} aria-hidden="true" />
                <div>
                  <strong>No shuttle available right now</strong>
                  <p>
                    Contact the office for assistance, or check again later. A
                    request can be made when a shuttle is available.
                  </p>
                </div>
              </div>
            )}
            <div
              className={styles.vehicleChoices}
              role="group"
              aria-label="Browse shuttles"
            >
              {activeVehicles.map((s) => (
                <button
                  key={s.code}
                  type="button"
                  aria-pressed={s.code === inspectedVehicle?.code}
                  onClick={() => setSelectedShuttle(s.code)}
                >
                  <BusFront size={23} aria-hidden="true" />
                  <span>
                    {s.code}
                    <small>
                      {s.busy
                        ? "On a trip"
                        : !s.on_duty
                          ? "Off duty"
                          : !s.available
                            ? "Not connected"
                            : !s.ready
                              ? "Preparing vehicle"
                              : "Ready for pickup"}
                    </small>
                  </span>
                </button>
              ))}
            </div>
            <div className={styles.vehicleDetail}>
              {activeVehicles
                .filter((s) => s.code === inspectedVehicle?.code)
                .map((s) => (
                  <article key={s.code}>
                    <h3>{s.code}</h3>
                    <p>
                      {s.driver_name} <span aria-hidden="true">·</span>{" "}
                      {s.capacity} passengers maximum
                    </p>
                    <Badge>
                      {s.busy
                        ? "Serving a request"
                        : !s.on_duty
                          ? "Off duty"
                          : !s.available
                            ? "No recent connection"
                            : !s.ready
                              ? "Preparing vehicle"
                              : "Available for requests"}
                    </Badge>
                    {s.contact && (
                      <a className="text-link" href={`tel:${s.contact}`}>
                        <Phone size={18} />
                        Call shuttle
                      </a>
                    )}
                  </article>
                ))}
            </div>
            <p className={styles.note}>
              Your request joins the service queue. Browsing a vehicle does not
              assign it to your trip.
            </p>
            <details className={styles.serviceNotes}>
              <summary>Service information</summary>
              <p className={styles.note}>
                Availability is not a guaranteed arrival time. Calls do not
                create a request. Drivers should respond only when safely
                parked.{" "}
                {sample
                  ? "Sample vehicles are not verified."
                  : `Last checked ${when(data.server_now)}. Updates refresh every 15 seconds while connected.`}
                Arrival must be within 60 minutes of the request; acceptance
                does not restart the clock.
              </p>
            </details>
          </section>
          {!passengerView && requestAction}
          {!history &&
            page === 0 &&
            data.driver &&
            ownDuty &&
            ownShuttle?.ready === false &&
            !rows.some((r) => r.driver_id === uid) && (
              <section className={styles.panel}>
                <h2>Vehicle readiness</h2>
                <p>
                  Confirm only when your vehicle is free and safely parked.
                  Pickup confirmation does not automatically free the shuttle.
                </p>
                <Button
                  pending={action.isPending}
                  disabled={readOnly}
                  onClick={async () => {
                    if (sample) {
                      setSampleReady(true);
                      setMessage("Sample vehicle ready for another pickup.");
                      return;
                    }
                    try {
                      await action.mutateAsync({
                        name: "bfe_shuttle_ready",
                        args: {},
                      });
                      setMessage("Vehicle marked ready for the next pickup.");
                    } catch {
                      /* Visible action error. */
                    }
                  }}
                >
                  Ready for next pickup
                </Button>
              </section>
            )}
          {!history && outcome && (
            <p role="status">
              Your latest closed request: <strong>{outcome}</strong>.{" "}
              {outcome === "Lapsed / Unserved" &&
                "The shuttle did not arrive within the waiting limit. You can make a new request or contact the office."}
            </p>
          )}
          {!history && data.prior_day_request && (
            <section className={styles.panel}>
              <h2>Earlier request needs resolution</h2>
              <p>
                Your previous-day request is still{" "}
                {data.prior_day_request.status.toLowerCase()}. It is outside
                today’s queue. Contact the shuttle or cancel it before
                requesting again.
              </p>
              <Button
                secondary
                pending={action.isPending}
                disabled={readOnly}
                onClick={async () => {
                  const previous = data.prior_day_request;
                  if (!previous || sample) return;
                  try {
                    await action.mutateAsync({
                      name: "bfe_update_shuttle_request",
                      args: {
                        p_id: previous.id,
                        p_version: previous.version,
                        p_status: "Cancelled",
                      },
                    });
                    setMessage("Previous request cancelled.");
                  } catch {
                    /* Error displayed with the action state. */
                  }
                }}
              >
                Cancel earlier request
              </Button>
            </section>
          )}
          <section className={styles.panel}>
            <h2>{history ? "Service history" : "Active requests today"}</h2>
            {history && (
              <label className={styles.historyFilter}>
                Outcome
                <select
                  value={outcomeFilter}
                  onChange={(event) => {
                    setOutcomeFilter(event.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">All closed outcomes</option>
                  {[
                    "Lapsed / Unserved",
                    "Picked up",
                    "Cancelled",
                    "Passenger absent",
                  ].map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
            )}
            <p className={styles.note}>
              {history
                ? "Closed requests are retained for authorized evaluation. Lapsed / Unserved is not the same as passenger cancellation or absence."
                : "Residents see their own request details. Other households’ names, locations and phone numbers are private."}
            </p>
            {rows.length === 0 && (
              <div className={styles.empty}>
                <BusFront size={32} aria-hidden="true" />
                <h3>{history ? "No trips to show" : "No active requests"}</h3>
                <p>
                  {history
                    ? "No permitted history on this page."
                    : "No active requests visible to your account today."}
                </p>
              </div>
            )}
            {rows.map((r) => (
              <article className={styles.request} key={r.id}>
                <div>
                  <Badge
                    tone={r.status === "Lapsed / Unserved" ? "red" : "neutral"}
                  >
                    {r.status}
                  </Badge>
                  {r.prior_day && (
                    <Badge tone="amber">
                      Prior-day assignment · resolve before accepting another
                    </Badge>
                  )}
                </div>
                <div className={styles.routeSummary}>
                  <MapPin size={22} aria-hidden="true" />
                  <div>
                    <small>Pickup</small>
                    <h3>{r.pickup}</h3>
                  </div>
                  <span className={styles.destinationDot} aria-hidden="true" />
                  <div>
                    <small>Destination</small>
                    <h3>{r.destination}</h3>
                  </div>
                </div>
                {pickupSteps.some((step) => step.status === r.status) && (
                  <ol
                    className={styles.tripTimeline}
                    aria-label="Pickup progress"
                  >
                    {pickupSteps.map((step, index) => {
                      const current = pickupSteps.findIndex(
                        (item) => item.status === r.status,
                      );
                      const done = index < current;
                      return (
                        <li
                          key={step.status}
                          aria-current={index === current ? "step" : undefined}
                          className={
                            done
                              ? styles.stepDone
                              : index === current
                                ? styles.stepCurrent
                                : ""
                          }
                        >
                          <span
                            className={styles.stepMarker}
                            aria-hidden="true"
                          >
                            {done && <Check size={13} />}
                          </span>
                          <span>{step.label}</span>
                          {index === current && <small>Current status</small>}
                        </li>
                      );
                    })}
                  </ol>
                )}
                <p>
                  {r.passengers} passenger{r.passengers === 1 ? "" : "s"} ·
                  Requested {when(r.created_at)}
                </p>
                {r.shuttle_code && (
                  <p>
                    {r.shuttle_code} ·{" "}
                    {r.driver_name ??
                      data.shuttles.find((s) => s.code === r.shuttle_code)
                        ?.driver_name ??
                      "Assigned driver"}
                  </p>
                )}
                {activeStatuses.includes(r.status) && (
                  <p>
                    {r.status === "Arrived"
                      ? "Shuttle at pickup. Confirm pickup once the passenger has boarded."
                      : `Arrival deadline ${when(r.expires_at)} · ${Math.max(0, Math.ceil((Date.parse(r.expires_at) - now) / 60_000))} minutes remaining`}
                  </p>
                )}
                {r.reason && <p>{r.reason}</p>}
                {r.pickup_note && (
                  <p>
                    <strong>Pickup note:</strong> {r.pickup_note}
                  </p>
                )}
                {r.driver_note && (
                  <p>
                    <strong>Driver note:</strong> {r.driver_note}
                  </p>
                )}
                {r.estimated_arrival && (
                  <p>
                    Estimated arrival {when(r.estimated_arrival)}. This is an
                    estimate.
                  </p>
                )}
                {!sample &&
                  !readOnly &&
                  data.driver &&
                  r.driver_id === uid &&
                  ["Accepted", "On the way"].includes(r.status) &&
                  Date.parse(r.expires_at) > now && (
                    <JourneyEstimate request={r} />
                  )}
                {!history && (
                  <div className={styles.toolbar}>
                    {shuttleActions(
                      r,
                      r.owner_id === uid,
                      data.driver,
                      uid,
                      now,
                    ).map((status) => (
                      <Button
                        key={status}
                        secondary={
                          status === "Cancelled" ||
                          status === "Passenger absent"
                        }
                        pending={action.isPending}
                        disabled={
                          readOnly ||
                          (status === "Accepted" &&
                            !data.shuttles.some(
                              (s) =>
                                s.driver_id === uid &&
                                s.available &&
                                !s.busy &&
                                s.capacity >= r.passengers,
                            ))
                        }
                        onClick={() => void update(r, status)}
                      >
                        {
                          (
                            {
                              Accepted: "Accept request",
                              "On the way": "On the way",
                              Arrived: "Arrived",
                              "Picked up": "Confirm pickup",
                              Cancelled: "Cancel my request",
                              "Passenger absent":
                                "Passenger absent after 5 minutes",
                            } as Record<string, string>
                          )[status]
                        }
                      </Button>
                    ))}
                  </div>
                )}
              </article>
            ))}
            {data.total > 20 && (
              <div className={styles.toolbar}>
                <Button
                  secondary
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <span>Page {page + 1}</span>
                <Button
                  secondary
                  disabled={sample || (page + 1) * 20 >= data.total}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </section>
        </>
      )}
      {form && (
        <NewShuttleRequest
          initialPickup={pickupStop}
          initialDestination={destinationStop}
          sample={sample}
          busy={action.isPending}
          onClose={() => setForm(false)}
          onSubmit={async (input, client) => {
            if (sample) {
              setSampleRows((current) => [
                ...current,
                {
                  ...input,
                  id: crypto.randomUUID(),
                  owner_id: uid,
                  driver_id: null,
                  shuttle_code: null,
                  status: "Waiting for Shuttle",
                  created_at: new Date().toISOString(),
                  expires_at: new Date(Date.now() + 3_600_000).toISOString(),
                  arrived_at: null,
                  version: 1,
                  reason: null,
                  prior_day: false,
                },
              ]);
              setMessage(
                "Sample request saved in this screen only. No shuttle was dispatched.",
              );
            } else {
              await action.mutateAsync({
                name: "bfe_create_shuttle_journey",
                args: {
                  p_client: client,
                  p_pickup: input.pickup,
                  p_destination: input.destination,
                  p_passengers: input.passengers,
                  p_note: input.pickup_note ?? "",
                },
              });
              setMessage(
                "Request recorded. Waiting for an authorized shuttle to accept; pickup is not yet confirmed.",
              );
            }
            setForm(false);
            setHistory(false);
            setPage(0);
          }}
        />
      )}
      {roster && data && (
        <Roster
          data={data}
          busy={action.isPending}
          onClose={() => setRoster(false)}
          save={async (args) => {
            await action.mutateAsync({ name: "bfe_configure_shuttle", args });
            setRoster(false);
            setMessage("Authorized shuttle roster updated.");
          }}
        />
      )}
    </>
  );
}

function NewShuttleRequest({
  initialPickup,
  initialDestination,
  sample,
  busy,
  onClose,
  onSubmit,
}: {
  initialPickup: string;
  initialDestination: string;
  sample: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (
    input: {
      pickup: string;
      destination: string;
      passengers: number;
      pickup_note?: string;
    },
    client: string,
  ) => Promise<void>;
}) {
  const [error, setError] = useState<Error | null>(null);
  const [client, setClient] = useState(() => crypto.randomUUID());
  const [pickup, setPickup] = useState(initialPickup);
  const [destination, setDestination] = useState(initialDestination);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const parsed = shuttleInput.safeParse(
      Object.fromEntries(new FormData(event.currentTarget)),
    );
    if (!parsed.success) {
      setError(
        new Error(
          "Enter pickup and destination (3–200 characters) and 1–20 passengers.",
        ),
      );
      return;
    }
    if (
      !shuttleStops.includes(parsed.data.pickup) ||
      !shuttleStops.includes(parsed.data.destination) ||
      parsed.data.pickup === parsed.data.destination
    ) {
      setError(
        new Error("Choose two different stops for pickup and destination."),
      );
      return;
    }
    try {
      await onSubmit(parsed.data, client);
    } catch (e) {
      setError(
        e instanceof Error
          ? e
          : new Error("Request not confirmed. Retry with the same details."),
      );
    }
  }
  return (
    <Modal
      title="Request a shuttle"
      presentation="task"
      protectChanges
      description={
        sample
          ? "Synthetic preview only. No dispatch or notification."
          : "Request when ready for pickup. The arrival waiting limit starts when your request is saved."
      }
      busy={busy}
      onClose={onClose}
    >
      <form
        className={styles.form}
        onSubmit={submit}
        onChange={() => setClient(crypto.randomUUID())}
      >
        <ShuttleStops
          pickup={pickup}
          destination={destination}
          disabled={busy}
          onChange={(from, to) => {
            setPickup(from);
            setDestination(to);
            setClient(crypto.randomUUID());
            setError(null);
          }}
        />
        <input type="hidden" name="pickup" value={pickup} />
        <input type="hidden" name="destination" value={destination} />
        <label>
          Passengers
          <input
            name="passengers"
            type="number"
            min={1}
            max={20}
            defaultValue={1}
            required
          />
        </label>
        <label>
          Pickup note (optional)
          <textarea
            name="pickup_note"
            maxLength={1000}
            placeholder="Landmark or pickup instructions"
          />
        </label>
        <Feedback error={error} />
        <Button type="submit" pending={busy}>
          {sample ? "Save sample request" : "Send shuttle request"}
        </Button>
      </form>
    </Modal>
  );
}
function JourneyEstimate({ request }: { request: ShuttleRequest }) {
  const [open, setOpen] = useState(false);
  const cache = useQueryClient();
  const save = useMutation({
    mutationFn: async (f: FormData) => {
      await rpc("bfe_update_shuttle_journey", {
        p_id: request.id,
        p_version: request.version,
        p_minutes: Number(f.get("minutes")),
        p_note: f.get("note"),
      });
    },
    onSuccess: async () => {
      setOpen(false);
      await cache.invalidateQueries({ queryKey: ["shuttle"] });
    },
  });
  return (
    <>
      <Button
        secondary
        onClick={() => {
          save.reset();
          setOpen(true);
        }}
      >
        Update arrival estimate
      </Button>
      {open && (
        <Modal
          title="Arrival estimate"
          description="Update only when safely parked. This does not extend the arrival deadline."
          busy={save.isPending}
          protectChanges
          onClose={() => setOpen(false)}
        >
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(new FormData(e.currentTarget));
            }}
          >
            <fieldset disabled={save.isPending}>
              <label>
                Minutes until arrival
                <input name="minutes" type="number" min={1} max={60} required />
              </label>
              <label>
                Message to passenger (optional)
                <textarea
                  name="note"
                  maxLength={1000}
                  defaultValue={request.driver_note ?? ""}
                />
              </label>
              <Feedback error={save.error} />
              <div className="form-actions">
                <Button secondary onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" pending={save.isPending}>
                  Save estimate
                </Button>
              </div>
            </fieldset>
          </form>
        </Modal>
      )}
    </>
  );
}
function Roster({
  data,
  busy,
  onClose,
  save,
}: {
  data: ShuttleDashboard;
  busy: boolean;
  onClose: () => void;
  save: (args: Record<string, unknown>) => Promise<void>;
}) {
  const [error, setError] = useState<Error | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = Object.fromEntries(new FormData(event.currentTarget));
    setError(null);
    try {
      await save({
        p_code: f.code,
        p_driver: f.driver,
        p_name: f.name,
        p_contact: f.contact,
        p_active: f.active === "on",
        p_reference: f.reference,
        p_capacity: Number(f.capacity),
      });
    } catch (e) {
      setError(
        e instanceof Error ? e : new Error("Roster change not confirmed."),
      );
    }
  }
  return (
    <Modal
      title="Authorized shuttle roster"
      description="Assign only accredited operator or approved BFE alternate vehicles. Display names and operational phone numbers are visible to signed-in members."
      busy={busy}
      onClose={onClose}
    >
      <form className={styles.form} onSubmit={submit}>
        <label>
          Approved passenger capacity
          <input name="capacity" type="number" min={1} max={50} required />
        </label>
        <label>
          Shuttle
          <select name="code">
            {shuttleCodes.map((code) => (
              <option key={code}>{code}</option>
            ))}
          </select>
        </label>
        <label>
          Authorized driver
          <select name="driver" required>
            <option value="">Choose an active driver account</option>
            {data.eligible_drivers.map((d) => (
              <option value={d.id} key={d.id}>
                {d.name ?? "Driver account"}
              </option>
            ))}
          </select>
        </label>
        <label>
          Public driver display name
          <input name="name" required minLength={2} maxLength={100} />
        </label>
        <label>
          Approved operational phone (optional)
          <input
            name="contact"
            type="tel"
            pattern="\+[0-9]{8,15}"
            placeholder="International format with +"
          />
        </label>
        <label>
          Approval reference
          <input name="reference" required minLength={3} maxLength={200} />
        </label>
        <label>
          <input name="active" type="checkbox" />
          Enable this authorized shuttle
        </label>
        <p>
          Resolve existing assignments before changing a roster. Each driver can
          have only one active shuttle.
        </p>
        <Feedback error={error} />
        <Button type="submit" pending={busy}>
          Save roster
        </Button>
      </form>
    </Modal>
  );
}
