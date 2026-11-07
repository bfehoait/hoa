import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type FormEvent,
  type RefAttributes,
} from "react";
import type { LinkProps } from "react-router-dom";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  FolderOpen,
  LoaderCircle,
  X,
} from "lucide-react";
import { Link } from "./AccessLink";
import styles from "./UI.module.css";

// One action vocabulary for the whole portal. Visual weight states intent:
// primary is the single thing a screen is for, secondary supports it, danger
// ends a session or destroys a record, and quiet is an inline, low-stakes step.
// Every tone keeps the 48px target the working rules require.
export type ButtonTone = "primary" | "secondary" | "danger" | "quiet";

function actionClass(
  tone: ButtonTone,
  size: "md" | "sm",
  block: boolean,
  extra?: string,
) {
  return [
    styles.button,
    styles[tone],
    size === "sm" ? styles.small : "",
    block ? styles.block : "",
    extra ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  children,
  pending,
  secondary = false,
  tone,
  size = "md",
  block = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  pending?: boolean;
  /** Kept so existing call sites stay valid; `tone` wins when both are set. */
  secondary?: boolean;
  tone?: ButtonTone;
  size?: "md" | "sm";
  block?: boolean;
}) {
  const resolved: ButtonTone = tone ?? (secondary ? "secondary" : "primary");
  return (
    <button
      {...props}
      disabled={props.disabled || pending}
      className={actionClass(resolved, size, block, props.className)}
    >
      {pending && <LoaderCircle size={20} className="spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

// A destination that acts like an action. Without this, screens reached for
// their own link styling and weight stopped matching meaning.
export function ButtonLink({
  children,
  tone = "secondary",
  size = "md",
  block = false,
  className,
  ...props
}: LinkProps &
  RefAttributes<HTMLAnchorElement> & {
    tone?: ButtonTone;
    size?: "md" | "sm";
    block?: boolean;
  }) {
  return (
    <Link {...props} className={actionClass(tone, size, block, className)}>
      {children}
    </Link>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "amber" | "red";
}) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>;
}
export function PageIntro({
  eyebrow,
  title,
  description,
  action,
  icon,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <header className="page-intro">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        {icon ? (
          <div className="page-title">
            <span className="page-title-icon" aria-hidden="true">
              {icon}
            </span>
            <h1>{title}</h1>
          </div>
        ) : (
          <h1>{title}</h1>
        )}
        {description && <p className="page-description">{description}</p>}
      </div>
      {action}
    </header>
  );
}
export function SectionTitle({
  title,
  to,
  label = "View all",
}: {
  title: string;
  to?: string;
  label?: string;
}) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {to && (
        <Link className="text-link" to={to}>
          {label}
          <ArrowUpRight size={18} />
        </Link>
      )}
    </div>
  );
}
export function Row({
  icon,
  title,
  detail,
  to,
  end,
}: {
  icon?: ReactNode;
  title: string;
  detail?: string;
  to?: string;
  end?: ReactNode;
}) {
  const content = (
    <>
      {icon && <span className={styles.rowIcon}>{icon}</span>}
      <span className={styles.rowText}>
        <strong>{title}</strong>
        {detail && <span>{detail}</span>}
      </span>
      <span className={styles.rowEnd}>
        {end}
        {to && <ChevronRight size={20} />}
      </span>
    </>
  );
  return to ? (
    <Link to={to} className={styles.row}>
      {content}
    </Link>
  ) : (
    <div className={styles.row}>{content}</div>
  );
}
export function Empty({
  title,
  children,
  icon = <FolderOpen size={32} />,
  action,
}: {
  title: string;
  children: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyMark} aria-hidden="true">
        {icon}
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
      {action && <div className={styles.emptyAction}>{action}</div>}
    </div>
  );
}
export function Feedback({
  error,
  message,
}: {
  error?: Error | null;
  message?: string;
}) {
  if (!error && !message) return null;
  return (
    <div
      className={`${styles.feedback} ${error ? styles.error : ""}`}
      role={error ? "alert" : "status"}
    >
      {!error && <Check size={20} />}
      <span>{error?.message ?? message}</span>
    </div>
  );
}
export function Skeleton() {
  return (
    <div
      aria-label="Loading your community"
      role="status"
      className="skeleton-layout"
    >
      <span className="sr-only">Loading your community…</span>
      <div />
      <div />
      <div />
    </div>
  );
}
let openDialogCount = 0;
let previousBodyOverflow = "";
export function Modal({
  title,
  description,
  children,
  onClose,
  className,
  busy = false,
  footer,
  size = "md",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
  busy?: boolean;
  /** Actions pinned below the scroll area so they never scroll out of reach. */
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const trigger = document.activeElement as HTMLElement | null;
    const viewport = window.visualViewport;
    const size = () => {
      if (!dialog) return;
      dialog.style.setProperty(
        "--dialog-viewport-height",
        `${viewport?.height ?? window.innerHeight}px`,
      );
      dialog.style.setProperty(
        "--dialog-keyboard-inset",
        `${Math.max(0, window.innerHeight - (viewport?.height ?? window.innerHeight) - (viewport?.offsetTop ?? 0))}px`,
      );
    };
    size();
    viewport?.addEventListener("resize", size);
    viewport?.addEventListener("scroll", size);
    if (openDialogCount++ === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    dialog?.showModal();
    // Open on the dialog itself, not on Close. Focusing the dismiss control
    // put a destructive-feeling action under the first keypress and made
    // screen readers lead with "Close" instead of the title.
    inner.current?.focus({ preventScroll: true });
    return () => {
      dialog?.close();
      viewport?.removeEventListener("resize", size);
      viewport?.removeEventListener("scroll", size);
      if (--openDialogCount === 0)
        document.body.style.overflow = previousBodyOverflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      aria-busy={busy || undefined}
      className={`${styles.dialog} ${styles[`dialog${size.toUpperCase()}` as keyof typeof styles] ?? ""} ${className ?? ""}`}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
          ),
        ).filter((el) => el.getClientRects().length);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onClick={(e) => {
        const bounds = e.currentTarget.getBoundingClientRect();
        if (
          !busy &&
          e.target === e.currentTarget &&
          (e.clientX < bounds.left ||
            e.clientX > bounds.right ||
            e.clientY < bounds.top ||
            e.clientY > bounds.bottom)
        )
          onClose();
      }}
    >
      <div className={styles.dialogInner} ref={inner} tabIndex={-1}>
        <span className={styles.dialogGrabber} aria-hidden="true" />
        <div className={styles.dialogHeader}>
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && (
              <p id={descriptionId} className={styles.dialogDescription}>
                {description}
              </p>
            )}
          </div>
          <button
            className={`icon-button ${styles.dialogClose}`}
            aria-label="Close dialog"
            disabled={busy}
            onClick={onClose}
          >
            <X size={24} />
          </button>
        </div>
        <div className={styles.dialogBody}>{children}</div>
        {footer && <div className={styles.dialogFooter}>{footer}</div>}
      </div>
    </dialog>
  );
}
export function Field({
  label,
  error,
  children,
  htmlFor,
}: {
  label: string;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  const child = children as React.ReactElement<{
    id?: string;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
  }>;
  return (
    <div className={styles.field}>
      <label htmlFor={htmlFor ?? child.props.id}>{label}</label>
      {children}
      {error && (
        <p className="field-error" id={`${htmlFor ?? child.props.id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
export function formValues(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  return Object.fromEntries(new FormData(event.currentTarget));
}
