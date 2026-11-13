import { useEffect, useRef, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import type { LiveRequest } from "../../../../../packages/shared/src/requests";
import { requestCategoryLabel } from "../../../../../packages/shared/src/requests";
import { Badge, Button, Feedback, Skeleton } from "../../components/UI";
import styles from "./MobileRequestConversation.module.css";

type Message = {
  id: string;
  author_kind: "Office" | "Resident";
  body: string;
  created_at: string;
};
const dayKey = (value: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
const timeLabel = (value: string) =>
  new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
function dayLabel(value: string) {
  return dayKey(value) === dayKey(new Date().toISOString())
    ? "Today"
    : new Intl.DateTimeFormat("en-PH", {
        timeZone: "Asia/Manila",
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(value));
}

/** Presentation only: RequestDesk retains the authorized reads and reply handler. */
export default function MobileRequestConversation({
  request,
  messages,
  pending,
  fetching,
  error,
  notice,
  sample,
  busy,
  dirty,
  page,
  canOlder,
  onPage,
  onRefresh,
  onClose,
  details,
  footer,
}: {
  request: LiveRequest;
  messages: Message[];
  pending: boolean;
  fetching: boolean;
  error: Error | null;
  notice: string;
  sample: boolean;
  busy: boolean;
  dirty: boolean;
  page: number;
  canOlder: boolean;
  onPage: (page: number) => void;
  onRefresh: () => void;
  onClose: () => void;
  details: ReactNode;
  footer: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const pageRef = useRef<HTMLElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    document
      .getElementById("content")
      ?.scrollIntoView({ behavior: "instant", block: "start" });
  }, [request.id]);
  useEffect(() => {
    if (!dirty) return;
    const leaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    // Keep the existing unsent-reply confirmation for navigation links too.
    const navigate = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest("a[href]");
      if (!link || pageRef.current?.contains(link)) return;
      if (
        !window.confirm(
          "Leave this conversation and discard your unsent reply?",
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", leaving);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", leaving);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty]);
  // Keep the reply above the phone keyboard without moving the bottom nav.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      const editing =
        !!pageRef.current?.contains(document.activeElement) &&
        document.activeElement?.tagName === "TEXTAREA";
      const inset = editing
        ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
        : 0;
      pageRef.current?.style.setProperty(
        "--thread-keyboard-inset",
        `${inset}px`,
      );
    };
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
    };
  }, []);
  return (
    <article
      className={styles.page}
      data-request-conversation
      ref={pageRef}
      aria-labelledby="request-conversation-title"
    >
      <header className={styles.header}>
        <div className={styles.topRow}>
          <button
            type="button"
            onClick={() => {
              if (
                !busy &&
                (!dirty || window.confirm("Discard your unsent reply?"))
              )
                onClose();
            }}
            disabled={busy}
          >
            <ArrowLeft size={20} aria-hidden="true" /> Back
          </button>
          <Badge tone={request.status === "Resolved" ? "green" : "neutral"}>
            {request.status}
          </Badge>
        </div>
        <h1 id="request-conversation-title" ref={heading} tabIndex={-1}>
          {request.title}
        </h1>
        <p>
          {requestCategoryLabel(request.category)} · Ref{" "}
          {request.id.slice(0, 8)} ·{" "}
          {new Intl.DateTimeFormat("en-PH", {
            timeZone: "Asia/Manila",
            month: "short",
            day: "numeric",
            year: "numeric",
          }).format(new Date(request.created_at))}
        </p>
        {sample && <p>Sample conversation · This tab only</p>}
      </header>
      <div className={styles.body}>
        <div className={styles.date}>
          <time dateTime={request.created_at}>
            {dayLabel(request.created_at)}
          </time>
        </div>
        <div className={`${styles.bubble} ${styles.resident}`}>
          <p>{request.description}</p>
          <time dateTime={request.created_at}>
            {timeLabel(request.created_at)}
          </time>
        </div>
        {pending ? (
          <Skeleton />
        ) : error ? (
          <>
            <Feedback error={error} />
            <Button secondary onClick={onRefresh}>
              Try again
            </Button>
          </>
        ) : (
          <>
            <ol className={styles.messages}>
              {messages.map((message, i) => (
                <li key={message.id}>
                  {dayKey(message.created_at) !==
                    dayKey(
                      messages[i - 1]?.created_at ?? request.created_at,
                    ) && (
                    <div className={styles.date}>
                      <time dateTime={message.created_at}>
                        {dayLabel(message.created_at)}
                      </time>
                    </div>
                  )}
                  <div
                    className={`${styles.bubble} ${message.author_kind === "Resident" ? styles.resident : styles.office}`}
                  >
                    {message.author_kind === "Office" && <span>Office</span>}
                    <p>{message.body}</p>
                    <time dateTime={message.created_at}>
                      {timeLabel(message.created_at)}
                    </time>
                  </div>
                </li>
              ))}
            </ol>
            {!messages.length && <p className={styles.note}>No replies yet.</p>}
          </>
        )}
        {(page > 0 || canOlder) && (
          <nav className={styles.pagination} aria-label="Conversation pages">
            <Button
              secondary
              disabled={!canOlder || fetching}
              onClick={() => onPage(page + 1)}
            >
              Older replies
            </Button>
            <span>Page {page + 1}</span>
            <Button
              secondary
              disabled={!page || fetching}
              onClick={() => onPage(page - 1)}
            >
              Newer replies
            </Button>
          </nav>
        )}
        <div className={styles.tools}>
          <details>
            <summary>Request details</summary>
            {details}
          </details>
        </div>
        <Feedback message={notice} />
        <div className={styles.composer}>{footer}</div>
      </div>
    </article>
  );
}
