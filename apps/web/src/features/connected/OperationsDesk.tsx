import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  bookingDashboardSchema,
  visitorDashboardSchema,
  manilaInstant,
  type Booking,
  type VisitorPass,
} from "../../../../../packages/shared/src/operations";
import { featureRpc } from "../../data/feature-records";
import { useAuth } from "../../data/auth";
import {
  Badge,
  Button,
  Empty,
  Feedback,
  Modal,
  PageIntro,
  Skeleton,
} from "../../components/UI";
import styles from "./LiveFeature.module.css";
import WorkflowHistory from "./WorkflowHistory";
import BookingSlots from "./BookingSlots";
import BookingDatePicker from "./BookingDatePicker";
import schedule from "./BookingSchedule.module.css";
import { CalendarDays } from "lucide-react";
import { Link } from "../../components/AccessLink";
import { usePermissions } from "../../data/permissions";
import { hasCapability } from "../../../../../packages/shared/src/permissions";
const display = (s: string) =>
  new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(s));
export default function OperationsDesk({
  kind,
  office = false,
  requestDate,
}: {
  kind: "booking" | "visitor";
  office?: boolean;
  /** A date chosen elsewhere, such as the month view above this desk. Each
   *  distinct value opens the form on that day; the server still decides
   *  whether the booking is allowed. */
  requestDate?: string;
}) {
  const auth = useAuth(),
    cache = useQueryClient();
  const permissions = usePermissions();
  const [page, setPage] = useState(0),
    [form, setForm] = useState(false),
    [configure, setConfigure] = useState(false),
    [selected, setSelected] = useState<Booking | VisitorPass | null>(null),
    [notice, setNotice] = useState("");
  const [clientId, setClientId] = useState(() => crypto.randomUUID()),
    [validation, setValidation] = useState<Error | null>(null);
  const [facility, setFacility] = useState(""),
    [date, setDate] = useState("");
  const [startTime, setStartTime] = useState(""),
    [endTime, setEndTime] = useState("");
  const query = useQuery({
    queryKey: ["operations", auth.userId, kind, office, page],
    retry: false,
    gcTime: 0,
    refetchInterval: 30000,
    queryFn: async () => {
      const raw = await featureRpc(
        kind === "booking" ? "bfe_booking_dashboard" : "bfe_visitor_dashboard",
        { p_office: office, p_page: page },
      );
      return kind === "booking"
        ? { kind: "booking" as const, ...bookingDashboardSchema.parse(raw) }
        : { kind: "visitor" as const, ...visitorDashboardSchema.parse(raw) };
    },
  });
  const slots = useQuery({
    queryKey: ["operations-slots", auth.userId, facility, date],
    enabled: form && kind === "booking" && !!facility && !!date,
    retry: false,
    gcTime: 0,
    refetchInterval: 5000,
    queryFn: async () =>
      z.array(z.object({ start: z.string(), end: z.string() })).parse(
        await featureRpc("bfe_booking_availability", {
          p_facility: facility,
          p_date: date,
        }),
      ),
  });
  const mutation = useMutation({
    mutationFn: ({
      name,
      args,
    }: {
      name: string;
      args: Record<string, unknown>;
    }) => featureRpc(name, args),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ["operations"] });
      await cache.invalidateQueries({ queryKey: ["operations-slots"] });
    },
  });
  const data = query.isError ? undefined : query.data;
  const eligibleFacilities =
    data?.kind === "booking"
      ? data.facilities.filter(
          (f) =>
            f.active &&
            (f.renters ||
              [auth.member?.role, ...(auth.member?.extra_roles ?? [])].includes(
                "homeowner",
              )),
        )
      : [];
  const chosen = eligibleFacilities.find((f) => f.id === facility);
  const selectionBusy = !!(
    date &&
    startTime &&
    endTime &&
    slots.data?.some(
      (s) =>
        Date.parse(s.start) < Date.parse(date + "T" + endTime + ":00+08:00") &&
        Date.parse(s.end) > Date.parse(date + "T" + startTime + ":00+08:00"),
    )
  );
  // A day picked on the calendar opens this form on that date. Adjusting state
  // during render on a changed prop is React's documented pattern for this and
  // avoids the extra paint an effect would cause; it runs once per new value,
  // so closing the form does not immediately reopen it.
  const [lastRequest, setLastRequest] = useState(requestDate);
  if (kind === "booking" && requestDate && requestDate !== lastRequest) {
    setLastRequest(requestDate);
    setValidation(null);
    setFacility(eligibleFacilities.length === 1 ? eligibleFacilities[0].id : "");
    setDate(requestDate);
    setStartTime("");
    setEndTime("");
    setClientId(crypto.randomUUID());
    setForm(true);
  }
  const canCreate =
    data &&
    (data.kind === "visitor"
      ? data.can_create
      : !office &&
        hasCapability(permissions.data, {
          module: "calendar",
          action: "create",
          scope: "own",
        }) &&
        eligibleFacilities.length > 0 &&
        !!auth.member &&
        [auth.member.role, ...(auth.member.extra_roles ?? [])].some(
          (r) => r === "homeowner" || r === "renter",
        ));
  return (
    <>
      <PageIntro
        eyebrow={office ? "OFFICE OPERATIONS" : "RESIDENT SERVICES"}
        title={kind === "booking" ? "Facility bookings" : "Visitor passes"}
        description="Confirmed server records. Dates and times are shown in Philippine time."
      />
      <div className={styles.actions}>
        {canCreate && (
          <Button
            onClick={() => {
              mutation.reset();
              setValidation(null);
              setFacility(
                eligibleFacilities.length === 1 ? eligibleFacilities[0].id : "",
              );
              setDate("");
              setStartTime("");
              setEndTime("");
              setClientId(crypto.randomUUID());
              setForm(true);
            }}
          >
            New {kind === "booking" ? "booking" : "visitor pass"}
          </Button>
        )}
        {data?.kind === "booking" && data.can_manage && (
          <Button
            secondary
            onClick={() => {
              mutation.reset();
              setConfigure(true);
            }}
          >
            Configure facility
          </Button>
        )}
      </div>
      {notice && <p role="status">{notice}</p>}
      <Feedback error={validation ?? query.error ?? mutation.error} />
      {query.isPending ? (
        <Skeleton />
      ) : (
        data && (
          <>
            {data.kind === "booking" && (
              <section className={schedule.panel}>
                <h2>Facilities</h2>
                {data.facilities.map((f) => (
                  <article key={f.id} className={styles.card}>
                    <h3>{f.name}</h3>
                    <p>
                      {f.opens.slice(0, 5)}–{f.closes.slice(0, 5)} ·{" "}
                      {f.slot_minutes}-minute slots · maximum {f.max_minutes}{" "}
                      minutes · capacity {f.capacity}
                    </p>
                    <p>
                      {f.renters ? "Homeowners and renters" : "Homeowners"} ·{" "}
                      {f.active ? "Open for booking" : "Unavailable"}
                    </p>
                    <p>Policy: {f.policy_reference}</p>
                  </article>
                ))}
                {!eligibleFacilities.length && (
                  <p>
                    {data.facilities.some((f) => f.active)
                      ? "No facilities are available for your membership. Contact the office if you need access."
                      : "Booking is not available yet. The office needs to configure approved facilities, hours and capacities. No reservation can be made until setup is complete."}
                  </p>
                )}
                {/* Facility setup is an office action. Sending a resident to a
                    page they cannot use is a dead end, so they get the Helpdesk
                    instead — the one route that reaches a person. */}
                {!eligibleFacilities.length &&
                  (data.can_manage ? (
                    <Link className="text-link" to="/office/bookings">
                      Open facility setup
                    </Link>
                  ) : (
                    <Link className="text-link" to="/services/requests?new=Maintenance">
                      Ask the office about facility bookings
                    </Link>
                  ))}
              </section>
            )}
            <section className={schedule.panel}>
              <h2>
                {office ? "Review queue" : "My records"} · {data.total}
              </h2>
              <div className={styles.stack}>
                {data.rows.map((r) => (
                  <article key={r.id} className={styles.card}>
                    <Badge>
                      {"effective_status" in r ? r.effective_status : r.status}
                    </Badge>
                    <h3>{"visitor" in r ? r.visitor : r.facility_name}</h3>
                    <p>{r.purpose}</p>
                    {"visitor" in r ? (
                      <p>
                        Lot {r.physical_id} ·{" "}
                        {r.plate || "No vehicle plate supplied"}
                        <br />
                        {display(r.valid_from)} – {display(r.valid_until)}
                      </p>
                    ) : (
                      <p>
                        {display(r.starts_at)} – {display(r.ends_at)} ·{" "}
                        {r.attendees} attendees
                      </p>
                    )}
                    <Button
                      secondary
                      onClick={() => {
                        mutation.reset();
                        setSelected(r);
                      }}
                    >
                      View actions
                    </Button>
                  </article>
                ))}
              </div>
              {!data.rows.length && (
                <Empty title="No records yet.">
                  New submissions appear here after the server confirms them.
                </Empty>
              )}
              {data.total > 20 && (
                <div className={styles.actions}>
                  <Button
                    secondary
                    disabled={!page}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    secondary
                    disabled={(page + 1) * 20 >= data.total}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </section>
          </>
        )
      )}
      {form && data && (
        <Modal
          busy={mutation.isPending}
          className={kind === "booking" ? schedule.bookingDialog : undefined}
          title={
            kind === "booking"
              ? "Request a facility booking"
              : "Request a visitor pass"
          }
          onClose={() => setForm(false)}
        >
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              setValidation(null);
              const f = new FormData(e.currentTarget);
              try {
                if (kind === "booking" && selectionBusy)
                  throw new Error(
                    "That time was just reserved. Choose another time.",
                  );
                if (
                  kind === "booking" &&
                  (!slots.isSuccess || !chosen || !startTime || !endTime)
                )
                  throw new Error(
                    "Choose a facility, date and available time before submitting.",
                  );
                const args =
                  kind === "booking"
                    ? {
                        p_client: clientId,
                        p_facility: f.get("facility"),
                        p_start: manilaInstant(
                          String(f.get("date")) + "T" + f.get("start"),
                        ),
                        p_end: manilaInstant(
                          String(f.get("date")) + "T" + f.get("end"),
                        ),
                        p_purpose: f.get("purpose"),
                        p_attendees: Number(f.get("attendees")),
                      }
                    : {
                        p_client: clientId,
                        p_lot: f.get("lot"),
                        p_visitor: f.get("visitor"),
                        p_purpose: f.get("purpose"),
                        p_plate: f.get("plate"),
                        p_from: manilaInstant(String(f.get("from"))),
                        p_until: manilaInstant(String(f.get("until"))),
                      };
                mutation.mutate(
                  {
                    name:
                      kind === "booking"
                        ? "bfe_create_booking"
                        : "bfe_create_visitor_pass",
                    args,
                  },
                  {
                    onSuccess: () => {
                      setClientId(crypto.randomUUID());
                      setForm(false);
                      setNotice(
                        "Saved by the server. Office approval is pending.",
                      );
                    },
                  },
                );
              } catch (error) {
                setValidation(
                  error instanceof Error
                    ? error
                    : new Error("Check the supplied dates."),
                );
              }
            }}
          >
            <p>
              Use Philippine time (UTC+8). Submission does not confirm approval
              or payment.
            </p>
            {data.kind === "booking" ? (
              <>
                <label>
                  Facility
                  <select
                    required
                    name="facility"
                    value={facility}
                    onChange={(e) => {
                      setFacility(e.target.value);
                      setValidation(null);
                      setStartTime("");
                      setEndTime("");
                    }}
                  >
                    <option value="">Choose a facility</option>
                    {data.facilities
                      .filter((f) =>
                        eligibleFacilities.some((x) => x.id === f.id),
                      )
                      .map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name} ? {f.slot_minutes}-minute slots ?{" "}
                          {f.opens.slice(0, 5)}?{f.closes.slice(0, 5)}
                        </option>
                      ))}
                  </select>
                </label>
                <div className={schedule.layout}>
                  <BookingDatePicker
                    value={date}
                    onChange={(value) => {
                      setDate(value);
                      setStartTime("");
                      setEndTime("");
                      setValidation(null);
                    }}
                  />
                  <div>
                    {chosen && date ? (
                      <>
                        <Feedback error={slots.error} />
                        {slots.isPending && (
                          <p role="status">Checking available times?</p>
                        )}
                        {slots.isSuccess && (
                          <BookingSlots
                            key={chosen.id + date}
                            facility={chosen}
                            date={date}
                            occupied={slots.data}
                            start={startTime}
                            end={endTime}
                            onChange={(start, end) => {
                              setStartTime(start);
                              setEndTime(end);
                              setValidation(null);
                            }}
                          />
                        )}
                      </>
                    ) : (
                      <div className={schedule.placeholder}>
                        <CalendarDays size={32} aria-hidden="true" />
                        <strong>Choose your facility and date</strong>
                        <p>Available and reserved times will appear here.</p>
                      </div>
                    )}
                    <details className={schedule.manual}>
                      <summary>Enter times manually</summary>
                      <div className={schedule.pair}>
                        <label>
                          Start time
                          <input
                            name="start"
                            type="time"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                          />
                        </label>
                        <label>
                          End time
                          <input
                            name="end"
                            type="time"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                          />
                        </label>
                      </div>
                    </details>
                  </div>
                </div>
                <label>
                  Attendees
                  <input
                    required
                    name="attendees"
                    type="number"
                    min={1}
                    max={chosen?.capacity ?? 10000}
                    step={1}
                  />
                </label>
              </>
            ) : (
              <>
                <label>
                  Verified lot
                  <select required name="lot">
                    <option value="">Choose your verified lot</option>
                    {data.lots.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.physical_id}
                      </option>
                    ))}
                  </select>
                </label>
                {!data.lots.length && (
                  <p>
                    Your account needs an approved lot membership before
                    creating a pass. Request this through the lot register.
                  </p>
                )}
                <label>
                  Visitor name
                  <input
                    required
                    name="visitor"
                    minLength={2}
                    maxLength={120}
                  />
                </label>
                <label>
                  Vehicle plate (optional)
                  <input name="plate" maxLength={30} />
                </label>
                <label>
                  Valid from
                  <input required name="from" type="datetime-local" />
                </label>
                <label>
                  Valid until
                  <input required name="until" type="datetime-local" />
                </label>
              </>
            )}
            <label>
              Purpose
              <textarea
                required
                name="purpose"
                minLength={kind === "booking" ? 10 : 5}
                maxLength={kind === "booking" ? 1000 : 500}
              />
            </label>
            <Feedback error={validation ?? mutation.error} />
            {auth.memberPreview && (
              <p className={schedule.summary}>
                Read-only account preview. You can explore dates and times; sign
                in directly as a test member to submit a booking.
              </p>
            )}
            {kind === "booking" && selectionBusy && (
              <p role="alert">
                That time was just reserved. Choose another time.
              </p>
            )}
            <div className={schedule.footer}>
              <Button secondary onClick={() => setForm(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                pending={mutation.isPending}
                disabled={
                  auth.memberPreview ||
                  (kind === "booking" &&
                    (selectionBusy ||
                      !chosen ||
                      !date ||
                      !startTime ||
                      !endTime ||
                      !slots.isSuccess))
                }
              >
                Submit for approval
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {selected && data && (
        <Modal
          title="Record actions"
          busy={mutation.isPending}
          onClose={() => setSelected(null)}
        >
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              mutation.mutate(
                {
                  name:
                    kind === "booking"
                      ? "bfe_decide_booking"
                      : "bfe_update_visitor_pass",
                  args: {
                    p_id: selected.id,
                    p_version: selected.version,
                    p_status: f.get("status"),
                    p_note: f.get("note"),
                  },
                },
                {
                  onSuccess: () => {
                    setSelected(null);
                    setNotice("Action confirmed by the server.");
                  },
                },
              );
            }}
          >
            <Badge>{selected.status}</Badge>
            <p>
              Only permitted actions are accepted by the server. Expired passes
              cannot authorize entry.
            </p>
            <WorkflowHistory kind={kind} id={selected.id} />
            <label>
              Action
              <select required name="status">
                <option value="">Choose</option>
                {!office &&
                  ["Pending", "Approved"].includes(selected.status) && (
                    <option>Cancelled</option>
                  )}
                {data.can_approve && selected.status === "Pending" && (
                  <>
                    <option>Approved</option>
                    <option>Rejected</option>
                  </>
                )}
                {data.kind === "visitor" &&
                  data.can_gate &&
                  selected.status === "Approved" && <option>Entered</option>}
                {data.kind === "visitor" &&
                  data.can_gate &&
                  selected.status === "Entered" && <option>Exited</option>}
              </select>
            </label>
            <label>
              Reason / gate note
              <textarea name="note" required minLength={5} maxLength={500} />
            </label>
            <Feedback error={mutation.error} />
            <Button type="submit" pending={mutation.isPending}>
              Confirm action
            </Button>
          </form>
        </Modal>
      )}
      {configure && (
        <Modal
          title="Approved facility configuration"
          busy={mutation.isPending}
          onClose={() => setConfigure(false)}
        >
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              mutation.mutate(
                {
                  name: "bfe_configure_facility",
                  args: {
                    p_id: f.get("id") || null,
                    p_name: f.get("name"),
                    p_opens: f.get("opens"),
                    p_closes: f.get("closes"),
                    p_slot: Number(f.get("slot")),
                    p_max: Number(f.get("max")),
                    p_capacity: Number(f.get("capacity")),
                    p_renters: f.get("renters") === "on",
                    p_active: f.get("active") === "on",
                    p_reference: f.get("reference"),
                  },
                },
                {
                  onSuccess: () => {
                    setConfigure(false);
                    setNotice("Facility configuration saved by the server.");
                  },
                },
              );
            }}
          >
            <p>
              Use an approved policy reference. Future bookings must be resolved
              before changing a facility.
            </p>
            <label>
              Existing facility (leave blank to add)
              <select name="id">
                <option value="">New facility</option>
                {data?.kind === "booking" &&
                  data.facilities.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Facility name
              <input name="name" required minLength={3} maxLength={100} />
            </label>
            <label>
              Opens
              <input name="opens" type="time" required />
            </label>
            <label>
              Closes (same day)
              <input name="closes" type="time" required />
            </label>
            <label>
              Slot minutes
              <select name="slot">
                <option>15</option>
                <option>30</option>
                <option>60</option>
              </select>
            </label>
            <label>
              Maximum booking minutes
              <input name="max" type="number" min={15} max={1440} required />
            </label>
            <label>
              Capacity
              <input
                name="capacity"
                type="number"
                min={1}
                max={10000}
                required
              />
            </label>
            <label className={styles.check}>
              <input name="renters" type="checkbox" />
              Renters may book
            </label>
            <label className={styles.check}>
              <input name="active" type="checkbox" />
              Open for new bookings
            </label>
            <label>
              Policy / approval reference
              <input name="reference" required minLength={5} maxLength={500} />
            </label>
            <Feedback error={mutation.error} />
            <Button type="submit" pending={mutation.isPending}>
              Save approved configuration
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
