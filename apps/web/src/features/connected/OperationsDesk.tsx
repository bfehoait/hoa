import { useId, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  bookingDashboardSchema,
  visitorDashboardSchema,
  manilaInstant,
  bookingSchema,
  visitorPassSchema,
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
import BookingComposerFrame from "./BookingComposerFrame";
import BookingSlots from "./BookingSlots";
import BookingDatePicker from "./BookingDatePicker";
import AmenityGuidelines from "./AmenityGuidelines";
import BookingCharge from "./BookingCharge";
import {
  amenityAttendeeLimit,
  amenityKey,
  amenityGuidelines,
} from "../../../../../packages/shared/src/amenity-guidelines";
import schedule from "./BookingSchedule.module.css";
import { CalendarDays, House } from "lucide-react";
import { Link } from "../../components/AccessLink";
import { usePermissions } from "../../data/permissions";
import { hasCapability } from "../../../../../packages/shared/src/permissions";
import { useSearchParams } from "react-router-dom";
import {
  useNotificationTarget,
  useReadOpenedNotification,
} from "../../data/notification-target";
import NotificationTargetFeedback from "../../components/NotificationTargetFeedback";
const display = (s: string) =>
  new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(s));
export default function OperationsDesk({
  kind,
  office = false,
}: {
  kind: "booking" | "visitor";
  office?: boolean;
}) {
  const auth = useAuth(),
    cache = useQueryClient();
  const permissions = usePermissions();
  const [params] = useSearchParams();
  const pendingOnly = office && params.get("queue") === "pending";
  const [passKind, setPassKind] = useState(
    ["visitor", "gate", "small_delivery"].includes(params.get("type") ?? "")
      ? params.get("type")!
      : "visitor",
  );
  const [arrival, setArrival] = useState("commute");
  const passNames: Record<string, string> = {
    visitor: "Visitor pass",
    gate: "Gate pass",
    small_delivery: "Small delivery pass",
  };
  const [page, setPage] = useState(0),
    [form, setForm] = useState(
      kind === "booking" && !office && !params.has("record"),
    ),
    [configure, setConfigure] = useState(false),
    [selection, setSelected] = useState<Booking | VisitorPass | null>(null),
    [notice, setNotice] = useState("");
  const target = useNotificationTarget(
    kind,
    bookingSchema.or(visitorPassSchema),
    "",
    !office,
  );
  const selected = target.requested
    ? target.isSuccess
      ? target.data
      : null
    : selection;
  const closeDetails = () => {
    setSelected(null);
    target.clear();
  };
  const [clientId, setClientId] = useState(() => crypto.randomUUID()),
    [validation, setValidation] = useState<Error | null>(null);
  const [facility, setFacility] = useState(""),
    [date, setDate] = useState(() =>
      /^\d{4}-\d{2}-\d{2}$/.test(params.get("date") ?? "")
        ? params.get("date")!
        : "",
    );
  const [startTime, setStartTime] = useState(""),
    [endTime, setEndTime] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [bookingMember, setBookingMember] = useState("");
  const officeBookingCreate =
    office &&
    kind === "booking" &&
    [auth.member?.role, ...(auth.member?.extra_roles ?? [])].includes(
      "admin",
    ) &&
    hasCapability(permissions.data, {
      module: "calendar",
      action: "create",
      scope: "association",
    }) &&
    hasCapability(permissions.data, {
      module: "people",
      action: "view",
      scope: "association",
    });
  const members = useQuery({
    queryKey: ["office-booking-members", auth.userId, memberSearch],
    enabled: officeBookingCreate && form && memberSearch.trim().length >= 2,
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
    queryFn: async () =>
      z
        .array(
          z.object({
            user_id: z.uuid(),
            name: z.string().nullable(),
            unit: z.string().nullable(),
            roles: z.array(z.string()),
          }),
        )
        .parse(
          await featureRpc("bfe_office_booking_members", {
            p_search: memberSearch,
          }),
        ),
  });
  const selectedMember = members.data?.find((m) => m.user_id === bookingMember);
  const query = useQuery({
    queryKey: ["operations", auth.userId, kind, office, page, pendingOnly],
    retry: false,
    gcTime: 0,
    refetchInterval: 30000,
    queryFn: async () => {
      const raw = await featureRpc(
        pendingOnly
          ? "bfe_office_operation_queue"
          : kind === "booking"
            ? "bfe_booking_dashboard"
            : auth.memberPreview
              ? "bfe_visitor_dashboard"
              : "bfe_community_pass_dashboard",
        pendingOnly
          ? { p_kind: kind, p_page: page }
          : { p_office: office, p_page: page },
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
      await cache.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === "account" &&
          query.queryKey.includes("notifications"),
      });
      await cache.invalidateQueries({ queryKey: ["operations"] });
      await cache.invalidateQueries({ queryKey: ["operations-slots"] });
      await Promise.all(
        [
          "home-bookings",
          "calendar-bookings",
          "office-facility-calendar",
          "office-review-inbox",
          "notifications",
          "booking-charge",
          "registry",
          "notification-target",
        ].map((key) => cache.invalidateQueries({ queryKey: [key] })),
      );
    },
  });
  const data = query.isError ? undefined : query.data;
  useReadOpenedNotification(target.requested && !!selected && !!data);
  const eligibleFacilities =
    data?.kind === "booking"
      ? data.facilities.filter(
          (f) =>
            f.active &&
            f.name.trim().toLowerCase() !== "clubhouse" &&
            (officeBookingCreate
              ? !selectedMember ||
                f.renters ||
                selectedMember.roles.includes("homeowner")
              : f.renters ||
                [
                  auth.member?.role,
                  ...(auth.member?.extra_roles ?? []),
                ].includes("homeowner")),
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
  const canCreate =
    data &&
    (data.kind === "visitor"
      ? data.can_create && (office || data.lots.length > 0)
      : office
        ? officeBookingCreate && eligibleFacilities.length > 0
        : hasCapability(permissions.data, {
            module: "calendar",
            action: "create",
            scope: "own",
          }) &&
          eligibleFacilities.length > 0 &&
          !!auth.member &&
          [auth.member.role, ...(auth.member.extra_roles ?? [])].some(
            (r) => r === "homeowner" || r === "renter",
          ));
  const composerFormId = useId();
  const inlineBooking = kind === "booking" && !office;
  const composerActions = (!inlineBooking || chosen) && (
    <div className={schedule.footer} data-sheet-actions>
      <Button
        secondary
        type="button"
        form={composerFormId}
        disabled={mutation.isPending}
        onClick={(event) => {
          if (inlineBooking) {
            event.currentTarget.form?.reset();
            setDate("");
            setStartTime("");
            setEndTime("");
            setValidation(null);
            mutation.reset();
          } else setForm(false);
        }}
      >
        {inlineBooking ? "Reset selection" : "Cancel"}
      </Button>
      <Button
        type="submit"
        form={composerFormId}
        pending={mutation.isPending}
        disabled={
          auth.memberPreview ||
          (office && kind === "booking" && !selectedMember) ||
          (kind === "booking" &&
            (selectionBusy ||
              !chosen ||
              !date ||
              !startTime ||
              !endTime ||
              !slots.isSuccess))
        }
      >
        {kind === "booking" ? "Request booking" : "Request pass"}
      </Button>
    </div>
  );
  const composer =
    form && data && (office || canCreate) ? (
      <BookingComposerFrame
        inline={inlineBooking}
        sheet={kind === "visitor"}
        footer={kind === "visitor" ? composerActions : undefined}
        busy={mutation.isPending}
        title={kind === "booking" ? "Book an amenity" : "Request a pass"}
        onClose={() => setForm(false)}
      >
        <form
          id={composerFormId}
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            setValidation(null);
            const submittedForm = e.currentTarget;
            const f = new FormData(submittedForm);
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
                  "Choose an amenity, date and available time before submitting.",
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
                      ...(office
                        ? {
                            p_target: bookingMember,
                            p_reference: f.get("reference"),
                          }
                        : {}),
                    }
                  : {
                      p_client: clientId,
                      p_lot: f.get("lot"),
                      p_visitor: f.get("visitor"),
                      p_purpose: f.get("purpose"),
                      p_plate: f.get("plate"),
                      p_from: manilaInstant(String(f.get("from"))),
                      p_until: manilaInstant(String(f.get("until"))),
                      p_kind: passKind,
                      p_arrival: arrival,
                      p_direction:
                        passKind === "gate" ? f.get("direction") : "inbound",
                      p_count: Number(f.get("party_count") ?? 1),
                      p_items: passKind === "gate" ? f.get("items") : "",
                    };
              mutation.mutate(
                {
                  name:
                    kind === "booking"
                      ? office
                        ? "bfe_office_create_booking"
                        : "bfe_create_booking"
                      : "bfe_create_community_pass",
                  args,
                },
                {
                  onSuccess: () => {
                    setClientId(crypto.randomUUID());
                    setForm(inlineBooking);
                    if (inlineBooking) {
                      submittedForm.reset();
                      setDate("");
                      setStartTime("");
                      setEndTime("");
                    }
                    setNotice(
                      "Your request was saved. Office approval is pending.",
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
          <p>Times use Philippine time. The office will review your request.</p>
          {data.kind === "booking" ? (
            <>
              {office && (
                <fieldset>
                  <legend>Resident requesting this booking</legend>
                  <label>
                    Find by name or recorded address
                    <input
                      value={memberSearch}
                      maxLength={100}
                      minLength={2}
                      onChange={(e) => {
                        setMemberSearch(e.target.value);
                        setBookingMember("");
                        setFacility("");
                      }}
                    />
                  </label>
                  <Feedback error={members.error} />
                  {members.isFetching && (
                    <p role="status">Looking up eligible residents…</p>
                  )}
                  {members.isSuccess && (
                    <label>
                      Matching residents (up to 20)
                      <select
                        required
                        value={bookingMember}
                        onChange={(e) => {
                          setBookingMember(e.target.value);
                          setFacility("");
                          setStartTime("");
                          setEndTime("");
                        }}
                      >
                        <option value="">Choose the requesting resident</option>
                        {members.data.map((m) => (
                          <option key={m.user_id} value={m.user_id}>
                            {m.name ?? "Account holder"} ·{" "}
                            {m.unit || "Address not recorded"}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label>
                    Resident request or authorizing reference
                    <input
                      name="reference"
                      required
                      minLength={3}
                      maxLength={200}
                    />
                  </label>
                </fieldset>
              )}
              <fieldset className={schedule.facilityChoices}>
                <legend>Choose an amenity</legend>
                <div>
                  {eligibleFacilities.map((f) => (
                    <button
                      type="button"
                      key={f.id}
                      aria-pressed={facility === f.id}
                      data-form-change
                      onClick={() => {
                        setFacility(f.id);
                        setValidation(null);
                        setStartTime("");
                        setEndTime("");
                      }}
                    >
                      <CalendarDays size={24} aria-hidden="true" />
                      <strong>{f.name}</strong>
                      <span>
                        {amenityKey(f.name)
                          ? amenityGuidelines[amenityKey(f.name)!].hours
                          : `${f.opens.slice(0, 5)}–${f.closes.slice(0, 5)}`}
                      </span>
                      <span>
                        Booking limit:{" "}
                        {amenityAttendeeLimit(f.name, f.capacity)} people
                      </span>
                      <span
                        className={schedule.selectionIndicator}
                        aria-hidden="true"
                      >
                        {facility === f.id ? "✓" : ""}
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <input type="hidden" name="facility" value={facility} />
              {chosen && (
                <>
                  <details className={schedule.amenityDetails}>
                    <summary>Rates &amp; facility rules</summary>
                    <div className={schedule.amenityFacts}>
                      <span>{chosen.slot_minutes}-minute intervals</span>
                      <span>Up to {chosen.max_minutes / 60} hours</span>
                      <span>
                        Configured booking limit:{" "}
                        {amenityAttendeeLimit(chosen.name, chosen.capacity)}{" "}
                        people
                      </span>
                      <p>Policy: {chosen.policy_reference}</p>
                    </div>
                    <AmenityGuidelines name={chosen.name} />
                    <p className="note">
                      Office confirms the applicable price after reviewing the
                      booking. Confirmed charges appear under Other in My
                      account; submitting a request does not record payment.
                    </p>
                  </details>
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
                      <h3 className={schedule.timeStep}>Choose your time</h3>
                      {chosen && date ? (
                        <>
                          <Feedback error={slots.error} />
                          {slots.isPending && (
                            <p role="status">Checking available times…</p>
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
                          <strong>Choose your amenity and date</strong>
                          <p>Available and reserved times will appear here.</p>
                        </div>
                      )}
                      <input type="hidden" name="start" value={startTime} />
                      <input type="hidden" name="end" value={endTime} />
                    </div>
                  </div>
                  <label>
                    <span className={schedule.requestStep}>Your request</span>
                    Attendees
                    <input
                      required
                      name="attendees"
                      type="number"
                      min={1}
                      max={amenityAttendeeLimit(chosen.name, chosen.capacity)}
                      step={1}
                    />
                  </label>
                </>
              )}
            </>
          ) : (
            <>
              <label>
                Pass type
                <select
                  value={passKind}
                  onChange={(e) => setPassKind(e.target.value)}
                >
                  {Object.entries(passNames).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="note">
                {passKind === "visitor"
                  ? "For guests visiting your household."
                  : passKind === "gate"
                    ? "For items, deliveries and materials moving in or out."
                    : "For a delivery rider or driver dropping off a small order."}
              </p>
              <label>
                Your household
                <select
                  required
                  name="lot"
                  defaultValue={data.lots.length === 1 ? data.lots[0].id : ""}
                >
                  <option value="">Choose your linked lot</option>
                  {data.lots.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.physical_id}
                      {l.homeowner ? ` / ${l.homeowner}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              {!data.lots.length && (
                <p>
                  Your account needs an approved lot membership before creating
                  a pass. Request this through the lot register.
                </p>
              )}
              <label>
                {passKind === "visitor"
                  ? "Visitor name"
                  : "Driver / rider name"}
                <input required name="visitor" minLength={2} maxLength={120} />
              </label>
              <label>
                Arrival method
                <select
                  value={arrival}
                  onChange={(e) => setArrival(e.target.value)}
                >
                  <option value="commute">Commuting / on foot</option>
                  <option value="vehicle">With a vehicle</option>
                </select>
              </label>
              {arrival === "vehicle" ? (
                <label>
                  Vehicle plate
                  <input required name="plate" minLength={2} maxLength={30} />
                </label>
              ) : (
                <input type="hidden" name="plate" value="" />
              )}
              <label>
                Number of people
                <input
                  name="party_count"
                  type="number"
                  min={1}
                  max={100}
                  defaultValue={1}
                  required
                />
              </label>
              {passKind === "gate" && (
                <>
                  <label>
                    Movement
                    <select name="direction">
                      <option value="inbound">Inbound / delivery</option>
                      <option value="outbound">Outbound / removal</option>
                    </select>
                  </label>
                  <label>
                    Items / materials
                    <textarea
                      name="items"
                      minLength={3}
                      maxLength={2000}
                      required
                      placeholder="List what will enter or leave"
                    />
                  </label>
                </>
              )}
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
          {(data.kind !== "booking" || chosen) && (
            <label>
              Purpose
              <textarea
                required
                name="purpose"
                minLength={kind === "booking" ? 10 : 5}
                maxLength={kind === "booking" ? 1000 : 500}
              />
            </label>
          )}
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
          {kind !== "visitor" && composerActions}
        </form>
      </BookingComposerFrame>
    ) : null;
  return (
    <>
      <NotificationTargetFeedback target={target} />
      {office && kind === "booking" && (
        <Link className="text-link" to="/office/calendar">
          Calendar view
        </Link>
      )}
      {office && (
        <Link
          className="text-link"
          to={
            pendingOnly
              ? `/office/${kind === "booking" ? "bookings" : "visitors"}`
              : `/office/${kind === "booking" ? "bookings" : "visitors"}?queue=pending`
          }
        >
          {pendingOnly ? "All records & history" : "Pending approval only"}
        </Link>
      )}
      <PageIntro
        eyebrow={office ? "OFFICE OPERATIONS" : "RESIDENT SERVICES"}
        title={
          kind === "booking"
            ? office
              ? "Amenity bookings"
              : "Amenities"
            : "Security & passes"
        }
        description={
          inlineBooking
            ? "Choose an amenity, date and time. Office approval is required."
            : "Dates and times use Philippine time."
        }
      />
      {!office && data?.kind === "visitor" && !data.lots.length && (
        <section className={`${schedule.panel} ${schedule.preflight}`}>
          <span className={schedule.preflightIcon}>
            <House size={24} aria-hidden="true" />
          </span>
          <h2>Link your lot to create passes</h2>
          <p>
            The office needs to confirm your household before you can request a
            visitor, gate or delivery pass.
          </p>
          <Link className="text-link" to="/more/lots">
            Request a lot link
          </Link>
        </section>
      )}
      <div className={styles.actions}>
        {canCreate && !inlineBooking && (
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
            New {kind === "booking" ? "booking" : "pass"}
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
            Configure amenity
          </Button>
        )}
      </div>
      {notice && (
        <p className={schedule.summary} role="status">
          {notice}
        </p>
      )}
      {composer}
      <Feedback error={validation ?? query.error ?? mutation.error} />
      {query.isPending ? (
        <Skeleton />
      ) : (
        data && (
          <>
            {inlineBooking && !canCreate && (
              <section className={schedule.panel}>
                <h2>Booking unavailable</h2>
                <p>
                  {eligibleFacilities.length
                    ? "Your current account cannot submit amenity bookings. Contact the office for help."
                    : "No amenities are currently available for your membership."}
                </p>
                <Link className="text-link" to="/services/requests">
                  Contact the office
                </Link>
              </section>
            )}
            {data.kind === "booking" && !inlineBooking && (
              <section className={schedule.panel}>
                <h2>Amenities</h2>
                {data.facilities.map((f) => (
                  <article key={f.id} className={styles.card}>
                    <h3>{f.name}</h3>
                    <p>
                      {f.opens.slice(0, 5)}–{f.closes.slice(0, 5)} ·{" "}
                      {f.slot_minutes}-minute slots · maximum {f.max_minutes}{" "}
                      minutes · configured booking limit{" "}
                      {amenityAttendeeLimit(f.name, f.capacity)}
                    </p>
                    <p>
                      {f.renters ? "Homeowners and renters" : "Homeowners"} ·{" "}
                      {f.active ? "Open for booking" : "Unavailable"}
                    </p>
                    <p>Policy: {f.policy_reference}</p>
                    <AmenityGuidelines name={f.name} />
                  </article>
                ))}
                {!eligibleFacilities.length && (
                  <p>
                    {data.facilities.some((f) => f.active)
                      ? "No amenities are available for your membership. Contact the office if you need access."
                      : "Booking is not available yet. The office needs to configure approved amenities, hours and capacities."}
                  </p>
                )}
                {/* Facility setup is an office action. Sending a resident to a
                    page they cannot use is a dead end, so they get the Helpdesk
                    instead — the one route that reaches a person. */}
                {!eligibleFacilities.length &&
                  (data.can_manage ? (
                    <Link className="text-link" to="/office/bookings">
                      Open amenity setup
                    </Link>
                  ) : (
                    <Link
                      className="text-link"
                      to="/services/requests?new=Maintenance"
                    >
                      Ask the office about amenity bookings
                    </Link>
                  ))}
              </section>
            )}
            <section className={schedule.panel}>
              <h2>
                {office
                  ? "Review queue"
                  : kind === "booking"
                    ? "My bookings"
                    : "My passes"}{" "}
                · {data.total}
              </h2>
              <div className={styles.stack}>
                {data.rows.map((r) =>
                  !office ? (
                    <button
                      type="button"
                      key={r.id}
                      className={styles.recordRow}
                      onClick={() => {
                        mutation.reset();
                        setSelected(r);
                      }}
                    >
                      <span>
                        <strong>
                          {"visitor" in r ? r.visitor : r.facility_name}
                        </strong>
                        <span>
                          {"visitor" in r
                            ? passNames[r.pass_kind ?? "visitor"]
                            : r.purpose}
                        </span>
                        <span>
                          {display("visitor" in r ? r.valid_from : r.starts_at)}
                        </span>
                      </span>
                      <Badge>
                        {"effective_status" in r
                          ? r.effective_status
                          : r.status}
                      </Badge>
                    </button>
                  ) : (
                    <article key={r.id} className={styles.card}>
                      <Badge>
                        {"effective_status" in r
                          ? r.effective_status
                          : r.status}
                      </Badge>
                      <h3>{"visitor" in r ? r.visitor : r.facility_name}</h3>
                      {"visitor" in r && (
                        <p className="note">
                          {passNames[r.pass_kind ?? "visitor"]}
                          {r.pass_kind === "gate"
                            ? ` / ${r.direction === "outbound" ? "Outbound" : "Inbound"}`
                            : ""}{" "}
                          ·{" "}
                          {r.arrival_mode === "vehicle"
                            ? "With vehicle"
                            : "Commuting / on foot"}
                        </p>
                      )}
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
                  ),
                )}
              </div>
              {!data.rows.length &&
                (inlineBooking ? (
                  <p className="note">
                    No bookings yet. Submitted requests will appear here.
                  </p>
                ) : (
                  <Empty
                    title={
                      kind === "booking"
                        ? "No bookings yet"
                        : office
                          ? "No passes waiting for review"
                          : "No visitor passes yet"
                    }
                  >
                    {office
                      ? "New submissions will appear here when they need your review."
                      : kind === "booking"
                        ? "Book an amenity and the office will confirm it."
                        : "Request a pass for a guest, delivery or gate movement."}
                  </Empty>
                ))}
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
      {selected && data && (
        <Modal
          title={kind === "visitor" ? "Pass details" : "Booking details"}
          presentation={office ? "sheet" : "task"}
          busy={mutation.isPending}
          onClose={closeDetails}
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
                    closeDetails();
                    setNotice("Booking or pass updated.");
                  },
                },
              );
            }}
          >
            <Badge>{selected.status}</Badge>
            <h3>
              {"visitor" in selected
                ? selected.visitor
                : selected.facility_name}
            </h3>
            <p>{selected.purpose}</p>
            {kind === "booking" && (
              <BookingCharge id={selected.id} office={office} />
            )}
            <p>
              {display(
                "visitor" in selected
                  ? selected.valid_from
                  : selected.starts_at,
              )}{" "}
              ?{" "}
              {display(
                "visitor" in selected ? selected.valid_until : selected.ends_at,
              )}
            </p>
            {"visitor" in selected && (
              <dl className="detail-list">
                <div>
                  <dt>Pass type</dt>
                  <dd>{passNames[selected.pass_kind ?? "visitor"]}</dd>
                </div>
                <div>
                  <dt>Name</dt>
                  <dd>{selected.visitor}</dd>
                </div>
                <div>
                  <dt>Purpose</dt>
                  <dd>{selected.purpose}</dd>
                </div>
                <div>
                  <dt>Arrival</dt>
                  <dd>
                    {selected.arrival_mode === "vehicle"
                      ? selected.plate
                      : "Commuting / on foot"}
                  </dd>
                </div>
                {selected.pass_kind === "gate" && (
                  <>
                    <div>
                      <dt>Movement</dt>
                      <dd>{selected.direction}</dd>
                    </div>
                    <div>
                      <dt>Items</dt>
                      <dd>{selected.items}</dd>
                    </div>
                  </>
                )}
              </dl>
            )}
            {kind === "visitor" && (
              <p className="note">Expired passes cannot authorize entry.</p>
            )}
            <details>
              <summary>History</summary>
              <WorkflowHistory kind={kind} id={selected.id} />
            </details>
            {((!office && ["Pending", "Approved"].includes(selected.status)) ||
              (data.can_approve && selected.status === "Pending") ||
              (data.kind === "visitor" &&
                data.can_gate &&
                ["Approved", "Entered"].includes(selected.status))) && (
              <>
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
                      selected.status === "Approved" && (
                        <option>
                          {"visitor" in selected &&
                          selected.direction === "outbound"
                            ? "Exited"
                            : "Entered"}
                        </option>
                      )}
                    {data.kind === "visitor" &&
                      data.can_gate &&
                      selected.status === "Entered" && <option>Exited</option>}
                  </select>
                </label>
                <label>
                  {office ? "Reason / gate note" : "Reason for cancellation"}
                  <textarea
                    name="note"
                    required
                    minLength={5}
                    maxLength={500}
                  />
                </label>
                <Feedback error={mutation.error} />
                <Button type="submit" pending={mutation.isPending}>
                  Confirm action
                </Button>
              </>
            )}
          </form>
        </Modal>
      )}
      {configure && (
        <Modal
          title="Approved amenity configuration"
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
                    setNotice("Amenity configuration saved.");
                  },
                },
              );
            }}
          >
            <p>
              Use an approved policy reference. Future bookings must be resolved
              before changing an amenity.
            </p>
            <label>
              Existing amenity (leave blank to add)
              <select name="id">
                <option value="">New amenity</option>
                {data?.kind === "booking" &&
                  data.facilities.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Amenity name
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
