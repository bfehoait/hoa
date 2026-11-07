import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Link } from "../../components/AccessLink";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CarFront,
  CheckCheck,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  Eye,
  EyeOff,
  FileText,
  FolderClosed,
  KeyRound,
  MapPin,
  MessageSquare,
  ReceiptText,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { balance, money } from "../../../../../packages/shared/src";
import { invoices, notices } from "../../data/fixtures";
import { usePortal } from "../../data/usePortal";
import { Badge, Feedback, SectionTitle, Skeleton } from "../../components/UI";
import { InvoiceVisual } from "../../components/RecordVisuals";
import styles from "./Home.module.css";

const shortcuts = [
  { title: "Bills", to: "/account", icon: ReceiptText },
  { title: "Payments", to: "/account/payments", icon: CreditCard },
  { title: "Vehicles", to: "/more/vehicles", icon: CarFront },
  { title: "Concerns", to: "/services/requests", icon: MessageSquare },
  { title: "Gate pass", to: "/services/visitors", icon: KeyRound },
  { title: "Documents", to: "/more/documents", icon: FolderClosed },
  { title: "Amenities", to: "/services/bookings", icon: CalendarDays },
  { title: "Permits", to: "/more/permits", icon: ClipboardCheck },
];

export function Home() {
  const portal = usePortal();
  const [params] = useSearchParams();
  const [hidden, setHidden] = useState(false);
  const state = params.get("state") ?? "due";
  const name = portal.data?.profile.name.split(" ")[0] ?? "neighbour";
  if (state === "loading" || portal.isPending)
    return (
      <>
        <p className="eyebrow">Loading your home</p>
        <Skeleton />
      </>
    );
  if (portal.error || state === "error")
    return (
      <>
        <h1>We couldn’t load your account.</h1>
        <Feedback
          error={
            portal.error ??
            new Error(
              "Sample connection failure. Your account balance is unavailable.",
            )
          }
        />
        <Link className="text-link" to="/">
          Try again
          <ArrowRight size={20} />
        </Link>
      </>
    );
  const total = invoices.reduce((sum, invoice) => sum + balance(invoice), 0);
  const received = invoices.reduce((sum, invoice) => sum + invoice.received, 0);
  const bookings = portal.data.records.filter(
    (r) => r.kind === "booking" && r.status !== "Cancelled",
  );
  const requests = portal.data.records.filter((r) => r.kind === "request");
  const billCount = invoices.filter((invoice) => balance(invoice) > 0).length;
  return (
    <div className={styles.dashboard}>
      <header className={styles.greeting}>
        <div>
          <p>
            <span>Wednesday, </span>4 November 2026 <span>· Sample day</span>
          </p>
          <h1>
            Hello, {name}
            <span className={styles.greetingDot}>.</span>
          </h1>
        </div>
        <Link className={styles.household} to="/more/profile">
          <MapPin size={18} />
          <span>
            Block 08 · Lot 12<small>Phase 2</small>
          </span>
          <ChevronRight size={18} />
        </Link>
      </header>
      <section
        className={styles.accountGrid}
        aria-label="Sample household account"
      >
        <article className={styles.balanceCard}>
          <div className={styles.balanceHeader}>
            <h2>Household balance</h2>
            <button
              onClick={() => setHidden(!hidden)}
              className={styles.visibility}
              aria-label={
                hidden ? "Show sample balance" : "Hide sample balance"
              }
              aria-pressed={hidden}
            >
              {hidden ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {state === "unbilled" ? (
            <div className={styles.unavailable}>
              <strong>Amount unavailable</strong>
              <p>Your bill hasn’t been issued yet.</p>
            </div>
          ) : (
            <>
              <p className={styles.amount}>
                {hidden ? (
                  <span aria-label="Balance hidden">••••••</span>
                ) : (
                  money(state === "paid" ? 0 : total)
                )}
              </p>
              <p className={styles.due}>
                {state === "paid" ? <CheckCheck size={16} /> : <span />}
                {state === "paid"
                  ? "Payment recorded · sample state"
                  : state === "overdue"
                    ? "Overdue · was due 31 October"
                    : "Due 30 November 2026"}
                {state !== "paid" && (
                  <span className={styles.invoiceCount}>
                    {billCount} open bill
                  </span>
                )}
              </p>
            </>
          )}
          <Link className={styles.statementButton} to="/account">
            <ReceiptText size={20} />
            {state === "unbilled" ? "View account" : "View bills & statement"}
            <ArrowRight size={20} />
          </Link>
          <p className={styles.balanceFootnote}>
            <ShieldCheck size={14} />
            Sample balance · Not a real bill
          </p>
        </article>
        <article className={styles.paymentCard}>
          <div className={styles.paymentHeading}>
            <span className={styles.paymentIcon}>
              <CreditCard size={24} />
            </span>
            <Badge tone="green">Recorded</Badge>
          </div>
          <h2>Payment history</h2>
          <p className={styles.paymentAmount}>
            {hidden ? "••••••" : money(received)}
          </p>
          <p className={styles.paymentCopy}>
            Across 2 settled sample bills.
            <br />A clear record of what’s been paid.
          </p>
          <Link to="/account/payments">
            View history
            <ChevronRight size={18} />
          </Link>
        </article>
      </section>
      {!hidden && state !== "unbilled" && (
        <InvoiceVisual records={invoices} compact />
      )}
      <section className={styles.services} aria-labelledby="services-title">
        <div className="section-title">
          <h2 id="services-title">Your home, made simple</h2>
          <Link className="text-link" to="/services">
            All services
            <ChevronRight size={18} />
          </Link>
        </div>
        <div className={styles.shortcutGrid}>
          {shortcuts.map(({ title, to, icon: Icon }) => (
            <Link key={title} to={to}>
              <span className={styles.shortcutIcon}>
                <Icon size={28} />
                {title === "Bills" &&
                  state !== "unbilled" &&
                  state !== "paid" && (
                    <span
                      className={styles.shortcutCount}
                      aria-label={`${billCount} open sample bill`}
                    >
                      {billCount}
                    </span>
                  )}
              </span>
              <span>{title}</span>
            </Link>
          ))}
        </div>
      </section>
      <div className={styles.contentGrid}>
        <section>
          <SectionTitle
            title="Community updates"
            to="/community"
            label="View all"
          />
          <Link className={styles.advisory} to="/community/water">
            <span className={styles.advisoryIcon}>
              <Wrench size={20} />
            </span>
            <span>
              <span className={styles.advisoryLabel}>
                SAMPLE ADVISORY · PHASE 2
              </span>
              <strong>Water line maintenance on Friday</strong>
              <small>6 November · 9 AM–12 PM</small>
            </span>
            <ChevronRight size={20} />
          </Link>
          <div className={styles.newsList}>
            {notices.slice(1).map((notice, index) => (
              <Link key={notice.id} to={`/community/${notice.id}`}>
                <span className={styles.newsIcon}>
                  {index === 0 ? (
                    <CalendarDays size={24} />
                  ) : (
                    <FileText size={24} />
                  )}
                </span>
                <span>
                  <small>
                    {notice.category} · {notice.date}
                  </small>
                  <h3>{notice.title}</h3>
                </span>
                <ChevronRight size={20} />
              </Link>
            ))}
          </div>
        </section>
        <section>
          <SectionTitle
            title="Your activity"
            to="/services/requests"
            label="Track requests"
          />
          <div className={styles.activityPanel}>
            {bookings.length ? (
              <Link to="/services/bookings" className={styles.activity}>
                <span className={styles.activityIcon}>
                  <CalendarDays size={20} />
                </span>
                <span>
                  <strong>{bookings[0].title} booking</strong>
                  <small>
                    {bookings[0].date} · {bookings[0].detail}
                  </small>
                  <Badge tone="amber">{bookings[0].status}</Badge>
                </span>
                <ChevronRight size={18} />
              </Link>
            ) : (
              <div className={styles.noActivity}>
                <CalendarDays size={24} />
                <p>No upcoming bookings.</p>
                <Link className="text-link" to="/services/bookings">
                  Explore amenities
                  <ArrowUpRight size={18} />
                </Link>
              </div>
            )}
            {requests.length ? (
              <Link to="/services/requests" className={styles.activity}>
                <span className={styles.activityIcon}>
                  <MessageSquare size={20} />
                </span>
                <span>
                  <strong>{requests[0].title}</strong>
                  <small>{requests[0].id}</small>
                  <Badge
                    tone={
                      requests[0].status === "Resolved" ? "green" : "neutral"
                    }
                  >
                    {requests[0].status}
                  </Badge>
                </span>
                <ChevronRight size={18} />
              </Link>
            ) : (
              <p className={styles.noActivity}>
                No requests in this preview yet.
              </p>
            )}
          </div>
          <div className={styles.helpNote}>
            <ShieldCheck size={20} />
            <p>
              Your preview stays in this browser tab.
              <br />
              <Link to="/more/help">
                How this preview works
                <ArrowUpRight size={16} />
              </Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
