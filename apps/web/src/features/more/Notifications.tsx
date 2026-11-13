import { useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  MessageSquare,
  ShieldCheck,
  UserRound,
  ChevronRight,
} from "lucide-react";
import { Link } from "../../components/AccessLink";
import { Button, Feedback, PageIntro, Skeleton } from "../../components/UI";
import { useNotifications, useAccountActions } from "../../data/accounts";
import { useAuth } from "../../data/auth";
import { usePermissions } from "../../data/permissions";
import { visibleDestination } from "../../components/AccessLink";
import {
  notificationGroup,
  relativeNotificationTime,
  type AppNotification,
} from "../../../../../packages/shared/src/accounts";
import styles from "./Notifications.module.css";

export function NotificationList({
  compact = false,
  onNavigate,
}: {
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const [params] = useSearchParams();
  const auth = useAuth();
  const [unread, setUnread] = useState(false);
  const [page, setPage] = useState(0);
  const query = useNotifications(page, unread);
  const actions = useAccountActions();
  const sample = auth.preview || !!auth.rolePreview;
  const rows = query.isError ? [] : (query.data?.rows ?? []);
  return (
    <div className={styles.center}>
      {params.get("unavailable") === "1" && (
        <Feedback
          error={
            new Error(
              "This item is no longer available, or your account cannot view it.",
            )
          }
        />
      )}
      <div className={styles.toolbar}>
        <div role="group" aria-label="Notification filters">
          <button
            aria-pressed={!unread}
            onClick={() => {
              setUnread(false);
              setPage(0);
            }}
          >
            All
          </button>
          <button
            aria-pressed={unread}
            onClick={() => {
              setUnread(true);
              setPage(0);
            }}
          >
            Unread{query.data?.unread ? ` (${query.data.unread})` : ""}
          </button>
        </div>
        <Button
          secondary
          disabled={!query.data?.unread || actions.markRead.isPending}
          onClick={() =>
            void actions.markRead.mutateAsync(null).catch(() => {})
          }
        >
          <CheckCheck size={18} />
          <span>Mark all read</span>
        </Button>
      </div>
      {sample && (
        <p className="note">Synthetic notifications for this preview.</p>
      )}
      <Feedback error={actions.markRead.error} />
      {query.isPending ? (
        <Skeleton />
      ) : query.isError ? (
        <>
          <Feedback error={query.error} />
          <Button secondary onClick={() => void query.refetch()}>
            Try again
          </Button>
        </>
      ) : !rows.length ? (
        <div className={styles.empty}>
          <Bell size={36} />
          <h2>{unread ? "You’re all caught up" : "No notifications yet"}</h2>
          <p>Account and request updates will appear here.</p>
        </div>
      ) : (
        ["New", "Today", "Earlier"].map((group) => {
          const items = rows.filter((n) => notificationGroup(n) === group);
          return items.length ? (
            <section key={group} className={styles.group}>
              <h2>{group}</h2>
              <ul>
                {items.map((item) => (
                  <NotificationRow
                    key={item.id}
                    item={item}
                    onNavigate={onNavigate}
                    markRead={() =>
                      void actions.markRead
                        .mutateAsync([item.id])
                        .catch(() => {})
                    }
                  />
                ))}
              </ul>
            </section>
          ) : null;
        })
      )}
      {query.data && query.data.total > 20 && (
        <nav className={styles.pagination} aria-label="Notification pages">
          <Button
            secondary
            disabled={!page || query.isFetching}
            onClick={() => setPage((v) => v - 1)}
          >
            Previous
          </Button>
          <span>Page {page + 1}</span>
          <Button
            secondary
            disabled={(page + 1) * 20 >= query.data.total || query.isFetching}
            onClick={() => setPage((v) => v + 1)}
          >
            Earlier notifications
          </Button>
        </nav>
      )}
      {compact && (
        <Link
          className={styles.seeAll}
          to="/more/notifications"
          onClick={onNavigate}
        >
          See all notifications
          <ChevronRight size={18} />
        </Link>
      )}
      <p className={styles.deliveryNote}>
        In-app updates · refreshes every 30 seconds
      </p>
    </div>
  );
}
function NotificationRow({
  item,
  markRead,
  onNavigate,
}: {
  item: AppNotification;
  markRead: () => void;
  onNavigate?: () => void;
}) {
  const auth = useAuth();
  const permissions = usePermissions();
  const location = useLocation();
  const destination = new URL(item.path, "https://route.invalid");
  const unavailable = destination.pathname === "/more/notifications";
  const hasRecord = destination.searchParams.has("record");
  if (hasRecord) destination.searchParams.set("notification", item.id);
  const to = destination.pathname + destination.search;
  const canOpen =
    !unavailable &&
    (auth.preview ||
      (permissions.allowsPath(to) &&
        visibleDestination(
          auth.member,
          to,
          location.pathname,
          !!auth.rolePreview,
        )));
  const Icon =
    item.kind === "request"
      ? MessageSquare
      : item.kind === "access"
        ? ShieldCheck
        : item.kind === "account"
          ? UserRound
          : Bell;
  return (
    <li className={`${styles.row} ${!item.read_at ? styles.unread : ""}`}>
      <span className={styles.avatar}>
        <Icon size={22} />
      </span>
      <div>
        <strong>{item.title}</strong>
        <p>{item.body}</p>
        <div className={styles.rowActions}>
          {canOpen ? (
            <Link
              to={to}
              onClick={(event) => {
                if (
                  event.ctrlKey ||
                  event.metaKey ||
                  event.shiftKey ||
                  event.altKey ||
                  event.button !== 0
                )
                  return;
                if (!hasRecord) markRead();
                onNavigate?.();
              }}
            >
              Open update
              <ChevronRight size={15} />
            </Link>
          ) : (
            <span className={styles.unavailable}>
              This item is unavailable for your account.
            </span>
          )}
          <time
            dateTime={item.created_at}
            title={new Date(item.created_at).toLocaleString()}
          >
            {relativeNotificationTime(item.created_at)}
          </time>
          {!item.read_at && (
            <button onClick={markRead} aria-label={`Mark read: ${item.title}`}>
              Mark read
            </button>
          )}
        </div>
      </div>
      {!item.read_at && (
        <span className={styles.dot} role="img" aria-label="Unread" />
      )}
    </li>
  );
}
export default function Notifications() {
  return (
    <>
      <PageIntro
        eyebrow="YOUR UPDATES"
        title="Notifications"
        description="Account activity and updates that matter to you."
        icon={<Bell size={28} />}
      />
      <div className={styles.page}>
        <NotificationList />
      </div>
    </>
  );
}
