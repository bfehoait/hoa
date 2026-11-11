import { NavigationGroup, DetailDisclosure } from "../../components/Navigation";
import { useState } from "react";
import { useLocation } from "react-router-dom";
import { isBoardWorkspacePath } from "../../../../../packages/shared/src/auth";
import { useAuth } from "../../data/auth";
import { Link } from "../../components/AccessLink";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarDays,
  CarFront,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Info,
  Search,
  ShieldCheck,
  GraduationCap,
  LockKeyhole,
  ShoppingBag,
  Vote,
} from "lucide-react";
import type {
  WorkItem,
  WorkKind,
} from "../../../../../packages/shared/src/workspace";
import {
  audienceOptions,
  isPublishedContent,
  matchesAudience,
} from "../../../../../packages/shared/src/integration";
import {
  useWorkspace,
  useWorkspaceAction,
  workspaceRepository,
} from "../../data/workspace";
import { usePortal } from "../../data/usePortal";
import {
  Badge,
  Button,
  Empty,
  Feedback,
  Modal,
  PageIntro,
  Row,
  Skeleton,
} from "../../components/UI";
import {
  ProgressTimeline,
  Queue,
  Requirements,
  WorkDetail,
  WorkForm,
  WorkspaceNote,
} from "../../components/WorkspaceUI";
import styles from "./CommunityModules.module.css";
import LiveFeatureDirectory from "../connected/LiveFeatureDirectory";
import LiveFeature from "../connected/LiveFeature";
import BookingsCalendar from "../connected/BookingsCalendar";
import DocumentLibrary from "../connected/DocumentLibrary";

const listings = [
  {
    title: "Plants for a greener doorstep",
    category: "Gardening",
    icon: ShoppingBag,
    description:
      "Sample neighborhood nursery listing. No real seller, price, stock or contact is represented.",
  },
  {
    title: "A hand with home repairs",
    category: "Home services",
    icon: ClipboardCheck,
    description:
      "Sample home-repair listing. Provider verification and contact sharing rules are pending.",
  },
  {
    title: "Something homemade for the table",
    category: "Food",
    icon: ShoppingBag,
    description:
      "Sample home-kitchen listing. No actual food business or order service is connected.",
  },
];
export default function CommunityModules({ area }: { area: string }) {
  const auth = useAuth();
  if (!auth.preview && !auth.rolePreview) {
    if (area === "calendar") return <BookingsCalendar />;
    if (["marketplace", "training", "transport"].includes(area))
      return (
        <LiveFeatureDirectory
          section={
            area === "marketplace"
              ? "Market"
              : area === "training"
                ? "Learning"
                : "Transport"
          }
        />
      );
    if (area === "documents")
      return auth.memberPreview ? (
        <LiveFeature module="board-records" initialView="published" />
      ) : (
        <DocumentLibrary />
      );
    if (area === "elections")
      return (
        <LiveFeature module="election-candidates" initialView="published" />
      );
  }
  return <SampleCommunityModules area={area} />;
}
function SampleCommunityModules({ area }: { area: string }) {
  const board = isBoardWorkspacePath(useAuth().member, useLocation().pathname);
  const data = useWorkspace();
  const preference = useWorkspaceAction(workspaceRepository.preferences);
  const [form, setForm] = useState<WorkKind | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [detail, setDetail] = useState<WorkItem | null>(null);
  const [documentSearch, setDocumentSearch] = useState("");
  const [audience, setAudience] = useState("All members");
  const back = (
    <Link className="text-link back-link" to={board ? "/board" : "/more"}>
      <ArrowLeft size={20} />
      {board ? "Board overview" : "All features"}
    </Link>
  );
  if (area === "calendar") return <CalendarPreview />;
  if (area === "vehicles" || area === "permits") {
    const isVehicle = area === "vehicles";
    const Icon = isVehicle ? CarFront : ClipboardCheck;
    return (
      <>
        {back}
        <PageIntro
          eyebrow="YOUR HOUSEHOLD"
          title={isVehicle ? "Vehicles & stickers" : "Permits & clearances"}
          icon={<Icon size={28} />}
          description={
            isVehicle
              ? "Manage vehicle and sticker requests."
              : "Track requests for property work and clearances."
          }
        />
        <div className={styles.serviceLayout}>
          <Queue
            kind={isVehicle ? "vehicle" : "permit"}
            title={isVehicle ? "Vehicle requests" : "Your permit requests"}
            empty={
              isVehicle ? "No vehicle requests yet" : "No permit requests yet"
            }
            createLabel={isVehicle ? "Add vehicle" : "Request a permit"}
          />
          <aside
            className={styles.serviceGuide}
            aria-label="Request information"
          >
            <div className={styles.serviceHint}>
              <ShieldCheck size={22} />
              <p>
                Sample requests only. No sticker, permit or clearance is issued.
              </p>
            </div>
            <ol className={styles.steps} aria-label="Request steps">
              <li>
                <span>1</span>
                <strong>Prepare</strong>
              </li>
              <li>
                <span>2</span>
                <strong>Review</strong>
              </li>
              <li>
                <span>3</span>
                <strong>Track</strong>
              </li>
            </ol>
            <DetailDisclosure title="Requirements & review">
              <Requirements
                items={[
                  { label: "HOA requirements", state: "Not confirmed" },
                  { label: "Household verification", state: "Not connected" },
                  { label: "Fees and approval", state: "Not confirmed" },
                ]}
              />
              <p className="note">
                Requests stay in this browser. Official review and issuance are
                not connected.
              </p>
            </DetailDisclosure>
          </aside>
        </div>
      </>
    );
  }
  if (area === "documents") {
    const documents =
      data.data?.items.filter(
        (item) =>
          (item.kind === "document" && item.status === "Preview published") ||
          (isPublishedContent(item) &&
            item.metadata.module === "board-records" &&
            matchesAudience(item, audience)),
      ) ?? [];
    const visibleDocuments = documents.filter((item) =>
      `${item.title} ${item.detail}`
        .toLowerCase()
        .includes(documentSearch.toLowerCase()),
    );
    return (
      <>
        {back}
        <PageIntro
          eyebrow="YOUR COMMUNITY"
          title="Community documents"
          icon={<FileText size={28} />}
          description="Find association records and reference documents."
        />
        <div className="search">
          <Search size={20} aria-hidden="true" />
          <input
            aria-label="Search community documents"
            placeholder="Search documents..."
            value={documentSearch}
            onChange={(event) => setDocumentSearch(event.target.value)}
          />
        </div>
        <div className={styles.libraryStatus}>
          <FileText size={20} />
          <span>Document library</span>
          <Badge>{documents.length} sample records</Badge>
        </div>
        {data.isPending ? (
          <Skeleton />
        ) : visibleDocuments.length ? (
          <div className={styles.cards}>
            {visibleDocuments.map((item) => (
              <button
                className={styles.documentCard}
                key={item.id}
                onClick={() => setDetail(item)}
              >
                <span className={styles.listingIcon}>
                  <FileText size={28} />
                </span>
                <strong>{item.title}</strong>
                <span>Sample record - file unavailable</span>
                <span className={styles.cardAction}>
                  View details <ChevronRight size={18} />
                </span>
              </button>
            ))}
          </div>
        ) : (
          <Empty
            title={
              documentSearch
                ? "No matching documents"
                : "No documents available yet"
            }
            icon={<FileText size={32} />}
          >
            {documentSearch
              ? "Try another title or clear your search."
              : "Official files have not been supplied. They will appear here once available."}
          </Empty>
        )}
        <div className={styles.serviceHint}>
          <LockKeyhole size={20} />
          <p>
            Official downloads are unavailable. Listed sample records contain
            metadata only.
          </p>
        </div>
        <DetailDisclosure title="Document tools">
          <NavigationGroup aria-label="Document connections">
            <Link to="/explore/board-records">Structured document drafts</Link>
            <Link to="/office/review?module=board-records">
              Document review desk
            </Link>
            <Link to="/directory/governance">Governance samples</Link>
          </NavigationGroup>
          <Requirements
            items={[
              { label: "Verified source", state: "Pending" },
              { label: "Approved version", state: "Pending" },
              { label: "Protected downloads", state: "Not connected" },
            ]}
          />
        </DetailDisclosure>
        <DetailDisclosure title="Preview audience options">
          <label className={styles.controlLabel} htmlFor="document-audience">
            Simulated document audience
          </label>
          <select
            className="standalone-control"
            id="document-audience"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
          >
            {audienceOptions.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <p className="note">
            Display simulation only. This does not enforce access.
          </p>
        </DetailDisclosure>
        {detail && <WorkDetail item={detail} onClose={() => setDetail(null)} />}
        <Feedback error={data.error} />
      </>
    );
  }
  if (area === "elections")
    return (
      <>
        {back}
        <PageIntro
          eyebrow="GOVERNANCE · RULES PENDING"
          title="Community elections"
          icon={<Vote size={28} />}
          description="Election information and participation."
        />
        <div className={styles.election}>
          <span className={styles.lock}>
            <LockKeyhole size={32} />
          </span>
          <div>
            <Badge tone="amber">No election configured</Badge>
            <h2>Voting is not open.</h2>
            <p>
              No candidate lists, votes or tallies are invented. Eligibility and
              secrecy must be designed and approved first.
            </p>
          </div>
          <Button disabled>
            <Vote size={20} />
            Voting unavailable
          </Button>
        </div>
        <DetailDisclosure title="Election readiness & requirements">
          <div className="two-column">
            <section className="panel">
              <h2>Election readiness</h2>
              <Requirements
                items={[
                  { label: "Election schedule", state: "Not confirmed" },
                  { label: "Eligibility / proxies", state: "Not approved" },
                  { label: "Secret-ballot design", state: "Not implemented" },
                  {
                    label: "Server submission and tally",
                    state: "Not connected",
                  },
                ]}
              />
            </section>
            <section className="panel">
              <h2>Planned participation flow</h2>
              <ProgressTimeline
                items={[
                  {
                    label: "Verify eligibility",
                    detail: "Approved rules and trusted records",
                  },
                  {
                    label: "Review your ballot",
                    detail: "Only approved candidates or resolutions",
                  },
                  {
                    label: "Submit securely",
                    detail:
                      "Server confirmation without exposing secret choices",
                  },
                  {
                    label: "Publish authorized results",
                    detail: "No browser-side counting",
                  },
                ]}
              />
            </section>
          </div>
        </DetailDisclosure>
        <DetailDisclosure title="Election tools">
          <NavigationGroup aria-label="Election preparation">
            <Link to="/explore/election-setup">
              Schedule and rule proposals
            </Link>
            <Link to="/explore/election-candidates">Candidate proposals</Link>
            <Link to="/directory/governance">
              Synthetic candidate information
            </Link>
          </NavigationGroup>
        </DetailDisclosure>
      </>
    );
  if (area === "marketplace")
    return (
      <>
        {back}
        <PageIntro
          eyebrow="NEIGHBORHOOD MARKET · SAMPLE LISTINGS"
          title="Neighborhood market"
          icon={<ShoppingBag size={28} />}
          description="Sample local finds and services. No purchases are available."
          action={
            <Button secondary onClick={() => setForm("listing")}>
              New sample listing
            </Button>
          }
        />
        <Link className="text-link" to="/directory/market">
          Browse locally published market samples <ArrowRight size={20} />
        </Link>
        <div className={styles.cards}>
          {listings.map(
            ({ title, category, icon: Icon, description }, index) => (
              <article className={styles.listing} key={title}>
                <span className={styles.listingIcon}>
                  <Icon size={32} />
                </span>
                <Badge>{category}</Badge>
                <h2>{title}</h2>
                <p>{description}</p>
                <button
                  className="text-link"
                  onClick={() => setSelected(index)}
                >
                  View sample listing
                  <ArrowRight size={18} />
                </button>
              </article>
            ),
          )}
        </div>
        <div style={{ marginTop: 32 }}>
          <Queue kind="listing" title="Your local listing drafts" />
        </div>
        {selected !== null && (
          <Modal
            title={listings[selected].title}
            description="Synthetic listing · no order service"
            onClose={() => setSelected(null)}
          >
            <p>{listings[selected].description}</p>
            <Requirements
              items={[
                { label: "Price / availability", state: "Not supplied" },
                { label: "Seller contact", state: "Unavailable" },
                { label: "Provider verification", state: "Not verified" },
              ]}
            />
            <Button secondary onClick={() => setSelected(null)}>
              Close listing
            </Button>
          </Modal>
        )}
        {form && (
          <WorkForm
            kind={form}
            title="New sample listing"
            onClose={() => setForm(null)}
          />
        )}
        <DetailDisclosure title="Listing tools">
          <NavigationGroup aria-label="Marketplace workflows">
            {[
              ["businesses", "Businesses"],
              ["buy-sell", "Buy & sell"],
              ["jobs", "Jobs"],
              ["garage-sales", "Garage sales"],
              ["booth-events", "Booth events"],
              ["booth-applications", "Vendor applications"],
            ].map(([id, label]) => (
              <Link key={id} to={`/explore/${id}`}>
                {label}
              </Link>
            ))}
          </NavigationGroup>
        </DetailDisclosure>
      </>
    );
  if (area === "training")
    return (
      <>
        {back}
        <PageIntro
          eyebrow="LEARN TOGETHER · LOCAL PREVIEW"
          title="Community learning"
          icon={<GraduationCap size={28} />}
          description="Explore workshops and save a sample interest."
        />
        <Link className="text-link" to="/directory/learning">
          Browse published sample sessions <ArrowRight size={20} />
        </Link>
        <div className={styles.session}>
          <span className={styles.listingIcon}>
            <GraduationCap size={32} />
          </span>
          <div>
            <Badge>Sample workshop concept</Badge>
            <h2>First-aid basics for the household</h2>
            <p>
              No session, trainer, venue or capacity is confirmed. Saving
              interest is not enrollment.
            </p>
          </div>
          <Button secondary onClick={() => setForm("enrollment")}>
            Save sample interest
          </Button>
        </div>
        <div className="two-column">
          <Queue kind="enrollment" title="Your sample interests" />
          <section className="panel">
            <h2>Session details</h2>
            <Requirements
              items={[
                { label: "Date and venue", state: "Not confirmed" },
                { label: "Facilitator", state: "Not verified" },
                { label: "Capacity / enrollment", state: "Not open" },
              ]}
            />
          </section>
        </div>
        {form && (
          <WorkForm
            kind={form}
            title="Sample workshop interest"
            initialTitle="First-aid basics"
            onClose={() => setForm(null)}
          />
        )}
        <DetailDisclosure title="Learning tools">
          <NavigationGroup aria-label="Learning workflows">
            <Link to="/explore/workshops">Prepare training sessions</Link>
            <Link to="/explore/participation">
              Local participation interests
            </Link>
          </NavigationGroup>
        </DetailDisclosure>
      </>
    );
  if (area === "transport")
    return (
      <>
        {back}
        <PageIntro
          eyebrow="COMMUNITY RIDES · NOT A BOOKABLE SERVICE"
          title="Rides & carpools"
          icon={<CarFront size={28} />}
        />
        <div className="two-column">
          <section className="panel">
            <div className="split-heading">
              <CarFront size={32} />
              <Badge>Route concept</Badge>
            </div>
            <h2 style={{ marginTop: 16 }}>Bellefort → Bacoor</h2>
            <ProgressTimeline
              items={[
                {
                  label: "Bellefort pickup",
                  detail: "Exact stop not confirmed",
                },
                { label: "Departure", detail: "No scheduled time" },
                {
                  label: "Bacoor destination",
                  detail: "Exact stop not confirmed",
                },
              ]}
            />
            <Requirements
              items={[
                { label: "Driver and vehicle", state: "Not verified" },
                { label: "Seats and fare", state: "Unavailable" },
              ]}
            />
            <Button secondary onClick={() => setForm("ride")}>
              Save sample ride interest
            </Button>
          </section>
          <Queue kind="ride" title="Your sample ride interests" />
        </div>
        {form && (
          <WorkForm
            kind={form}
            title="Sample ride interest"
            initialTitle="Bellefort to Bacoor"
            onClose={() => setForm(null)}
          />
        )}
        <WorkspaceNote>
          No actual seat, fare, departure or trip confirmation is created.
          Driver and contact-sharing rules need approval.
        </WorkspaceNote>
        <DetailDisclosure title="Transport tools">
          <NavigationGroup aria-label="Connected transport views">
            <Link to="/directory/transport">Sample carpool directory</Link>
            <Link to="/driver/dispatch">Dispatch simulation desk</Link>
          </NavigationGroup>
          <NavigationGroup aria-label="Transport workflows">
            <Link to="/explore/ride-requests">Ride requests & simulation</Link>
            <Link to="/explore/carpools">Carpools</Link>
            <Link to="/explore/carpool-interests">Seat interests</Link>
            <Link to="/explore/stations">Stations</Link>
          </NavigationGroup>
        </DetailDisclosure>
      </>
    );
  if (area === "notifications")
    return (
      <>
        {back}
        <PageIntro
          eyebrow="LOCAL ACTIVITY · NO PUSH OR EMAIL DELIVERY"
          title="Your notifications"
          icon={<Bell size={28} />}
          description="Activity from your sample requests and records."
        />
        <div className="two-column">
          <section className="panel">
            <h2>Recent activity</h2>
            {data.data?.items.slice(0, 8).map((item) => (
              <Row
                key={item.id}
                title={item.title}
                detail={`${item.status} · ${item.id}`}
                icon={<Bell size={20} />}
              />
            ))}
            {!data.isPending && !data.error && !data.data?.items.length && (
              <Empty title="You are all caught up" icon={<Bell size={32} />}>
                Updates from your sample records will appear here.
              </Empty>
            )}
          </section>
          <section className="panel">
            <h2>Preview preferences</h2>
            <p className="note">
              This controls the local preference only. Real subscription, push
              tokens and delivery need a backend.
            </p>
            <Button
              secondary
              pending={preference.isPending}
              onClick={() =>
                preference.mutate({
                  inApp: !data.data?.preferences.inApp,
                  email: false,
                })
              }
            >
              {data.data?.preferences.inApp
                ? "Disable local inbox preference"
                : "Enable local inbox preference"}
            </Button>
            <div style={{ marginTop: 16 }}>
              <Button disabled>Email and push not connected</Button>
            </div>
            <Feedback
              error={preference.error}
              message={
                preference.isSuccess
                  ? "Local inbox preference saved. No subscription was sent."
                  : undefined
              }
            />
          </section>
        </div>
      </>
    );
  return (
    <Empty title="This module is unavailable.">
      Return to More to explore the local preview.
    </Empty>
  );
}

function CalendarPreview() {
  const office = useLocation().pathname.startsWith("/office/");
  const portal = usePortal();
  const workspace = useWorkspace();
  const [offset, setOffset] = useState(0);
  const month = new Date(Date.UTC(2026, 10 + offset, 1));
  const year = month.getUTCFullYear();
  const index = month.getUTCMonth();
  const monthKey = `${year}-${String(index + 1).padStart(2, "0")}`;
  const monthLabel = month.toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const days = new Date(Date.UTC(year, index + 1, 0)).getUTCDate();
  const blanks = (month.getUTCDay() + 6) % 7;
  const bookings =
    portal.data?.records.filter(
      (item) => item.kind === "booking" && item.status !== "Cancelled",
    ) ?? [];
  const proposals =
    workspace.data?.items.filter(
      (item) =>
        item.kind === "baseline" &&
        ["events", "workshops", "booth-events"].includes(
          item.metadata.module,
        ) &&
        !["Archived", "Cancelled"].includes(item.status),
    ) ?? [];
  const entries = [
    ...bookings.map((item) => ({
      id: item.id,
      title: item.title,
      date: item.date ?? "",
      status: item.status,
      to: office ? "/office/operations" : "/services/bookings",
    })),
    ...proposals.map((item) => ({
      id: item.id,
      title: item.title,
      date: item.metadata.date ?? "",
      status: item.status,
      to: `/explore/${item.metadata.module}`,
    })),
  ]
    .filter((item) => item.date.startsWith(monthKey + "-"))
    .sort((a, b) => a.date.localeCompare(b.date));
  return (
    <>
      <Link
        className="text-link back-link"
        to={office ? "/office" : "/services"}
      >
        <ArrowLeft size={20} />
        {office ? "Office overview" : "All services"}
      </Link>
      <PageIntro
        eyebrow="YOUR NEIGHBORHOOD"
        title="Community calendar"
        icon={<CalendarDays size={28} />}
        description="Bookings and events, organized by date."
      />
      <div className={styles.calendarLayout}>
        <section
          className={`panel ${styles.monthPanel}`}
          aria-label="Monthly calendar"
        >
          <div className="split-heading">
            <button
              className="icon-button"
              aria-label="Previous sample month"
              onClick={() => setOffset(offset - 1)}
            >
              <ChevronLeft size={24} />
            </button>
            <h2 aria-live="polite">{monthLabel}</h2>
            <button
              className="icon-button"
              aria-label="Next sample month"
              onClick={() => setOffset(offset + 1)}
            >
              <ChevronRight size={24} />
            </button>
          </div>
          <div
            className={styles.calendar}
            role="group"
            aria-label={`Read-only sample month: ${monthLabel}`}
          >
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <strong key={day}>{day}</strong>
            ))}
            {Array.from({ length: blanks }, (_, i) => (
              <span key={`blank-${i}`} aria-hidden="true" />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const date = `${monthKey}-${String(i + 1).padStart(2, "0")}`;
              const count = entries.filter((item) => item.date === date).length;
              return (
                <span
                  className={count ? styles.hasBooking : ""}
                  style={
                    count
                      ? {
                          background: `color-mix(in srgb, var(--accent) ${Math.min(12 + count * 10, 45)}%, var(--surface))`,
                        }
                      : undefined
                  }
                  key={date}
                  aria-label={`${date}${count ? `, ${count} sample requests` : ""}`}
                >
                  {i + 1}
                  {count > 0 && <small aria-hidden="true">{count}</small>}
                </span>
              );
            })}
          </div>
          <div className={styles.calendarLegend}>
            <span>
              <i />
              Sample booking or event
            </span>
            <Button
              secondary
              disabled={offset === 0}
              onClick={() => setOffset(0)}
            >
              Reset month
            </Button>
          </div>
        </section>
        <section className={styles.agenda} aria-label="Monthly agenda">
          <div className="section-title">
            <h2>This month's agenda</h2>
            <Badge>{entries.length} sample items</Badge>
          </div>
          {portal.isPending || workspace.isPending ? (
            <Skeleton />
          ) : entries.length ? (
            entries.map((item) => (
              <Link className={styles.agendaItem} to={item.to} key={item.id}>
                <span className={styles.dateTile}>
                  <strong>{Number(item.date.slice(8, 10))}</strong>
                  <span>
                    {month.toLocaleDateString("en-PH", {
                      month: "short",
                      timeZone: "UTC",
                    })}
                  </span>
                </span>
                <span>
                  <strong>{item.title}</strong>
                  <span>{item.status}</span>
                </span>
                <ChevronRight size={20} />
              </Link>
            ))
          ) : (
            <Empty
              title="Nothing scheduled this month"
              icon={<CalendarDays size={32} />}
            >
              Try another month or prepare a sample booking request.
            </Empty>
          )}
          <Feedback error={portal.error ?? workspace.error} />
          <Link
            className={styles.calendarAction}
            to={office ? "/office/operations" : "/services/bookings"}
          >
            <CalendarDays size={22} />
            <span>{office ? "Office operations" : "Manage bookings"}</span>
            <ChevronRight size={20} />
          </Link>
          <div className={styles.serviceHint}>
            <Info size={20} />
            <p>
              Sample requests only. Dates do not confirm availability or a
              reservation.
            </p>
          </div>
          <WorkspaceNote>
            Capacity, fees and booking conflicts require server verification. No
            real reservation is made.
          </WorkspaceNote>
        </section>
      </div>
    </>
  );
}
