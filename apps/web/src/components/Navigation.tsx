import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, type To } from "react-router-dom";
import { Link } from "./AccessLink";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CalendarDays,
  CarFront,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  FileText,
  House,
  LayoutGrid,
  MessageSquare,
  Settings2,
  ShieldCheck,
  Store,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import styles from "./Navigation.module.css";
import { useAuth } from "../data/auth";
import { visibleDestination } from "./AccessLink";

export type Destination = {
  to: string;
  title: string;
  detail?: string;
  icon: LucideIcon;
  badge?: string;
};
export function DestinationGrid({
  items,
  compact = false,
  variant = "cards",
}: {
  items: Destination[];
  compact?: boolean;
  variant?: "cards" | "tiles" | "rows";
}) {
  return (
    <div
      className={`${styles.destinations} ${compact ? styles.compact : ""} ${styles[variant] ?? ""}`}
    >
      {items.map(({ to, title, detail, icon: Icon, badge }) => (
        <Link key={to} to={to} className={styles.destination}>
          <span className={styles.tileIcon}>
            <Icon size={26} aria-hidden="true" />
          </span>
          <span className={styles.tileText}>
            <strong>{title}</strong>
            {detail && <span>{detail}</span>}
          </span>
          {badge && <span className={styles.count}>{badge}</span>}
          <ChevronRight
            className={styles.tileArrow}
            size={18}
            aria-hidden="true"
          />
        </Link>
      ))}
    </div>
  );
}

export function ActionLink({
  to,
  children,
  icon: Icon = ArrowRight,
}: {
  to: string;
  children: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <Link to={to} className={styles.actionLink}>
      <Icon size={20} aria-hidden="true" />
      <span>{children}</span>
    </Link>
  );
}
export function BackLink({
  to,
  children,
}: {
  to: string;
  children: ReactNode;
}) {
  return (
    <ActionLink to={to} icon={ArrowLeft}>
      {children}
    </ActionLink>
  );
}

function routeIcon(path: string): LucideIcon {
  if (/inbox|messages|concerns|complaints|tickets/.test(path))
    return MessageSquare;
  if (/requests|operations/.test(path)) return Wrench;
  if (/calendar|bookings|events|workshops|training|participation/.test(path))
    return CalendarDays;
  if (/vehicles|dispatch|ride|carpool|transport|stations/.test(path))
    return CarFront;
  if (/visitors|security|gate|access|election/.test(path)) return ShieldCheck;
  if (/documents|board-records|statement|disclosure/.test(path))
    return FileText;
  if (/finance|payment|billing|expenses|budgets|reconciliation/.test(path))
    return Wallet;
  if (/residents|household|registry|profile/.test(path)) return Users;
  if (/market|business|buy-sell|jobs|garage|booth/.test(path)) return Store;
  if (/settings|developer/.test(path)) return Settings2;
  if (/coverage|source|explore/.test(path)) return LayoutGrid;
  if (path === "/") return House;
  return Building2;
}
type NavChild = { to?: To; children?: ReactNode };
function childPath(node: ReactNode) {
  if (!isValidElement<NavChild>(node)) return "";
  return typeof node.props.to === "string"
    ? node.props.to
    : (node.props.to?.pathname ?? "");
}
export function NavigationGroup(props: {
  children: ReactNode;
  "aria-label": string;
  limit?: number;
}) {
  const { pathname } = useLocation();
  return <NavigationItems key={pathname} {...props} pathname={pathname} />;
}
function NavigationItems({
  children,
  "aria-label": label,
  limit = 3,
  pathname,
}: {
  children: ReactNode;
  "aria-label": string;
  limit?: number;
  pathname: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  const auth = useAuth();
  const nodes = Children.toArray(children).filter(
    (node) =>
      auth.preview ||
      visibleDestination(
        auth.member,
        childPath(node),
        pathname,
        !!auth.rolePreview,
      ),
  );
  const visible = nodes.map((_, index) => index).slice(0, limit);
  const current = nodes.findIndex(
    (node) => childPath(node).split("?")[0] === pathname,
  );
  if (current >= limit && visible.length) visible[visible.length - 1] = current;
  const hidden = nodes.length - visible.length;
  return (
    <nav
      className={styles.navigation}
      aria-label={label}
      onKeyDown={(event) => {
        if (event.key === "Escape" && expanded) {
          setExpanded(false);
          toggle.current?.focus();
        }
      }}
    >
      <div className={styles.routeGrid} id={id}>
        {nodes.map((node, index) => {
          if (!expanded && !visible.includes(index)) return null;
          if (!isValidElement<NavChild>(node) || !node.props.to) return node;
          const Icon = routeIcon(childPath(node));
          const content = Children.toArray(node.props.children).filter(
            (child) =>
              !isValidElement(child) ||
              ![ArrowRight, ArrowUpRight, ChevronRight].includes(
                child.type as typeof ArrowRight,
              ),
          );
          return cloneElement(node, {
            children: (
              <>
                <span className={styles.routeIcon}>
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span className={styles.routeLabel}>{content}</span>
                <ChevronRight size={16} aria-hidden="true" />
              </>
            ),
          });
        })}
      </div>
      {hidden > 0 && (
        <button
          className={styles.more}
          ref={toggle}
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded(!expanded)}
        >
          <LayoutGrid size={18} aria-hidden="true" />
          {expanded ? "Fewer sections" : `More sections (${hidden})`}
          <ChevronDown
            size={18}
            aria-hidden="true"
            className={expanded ? styles.rotate : undefined}
          />
        </button>
      )}
    </nav>
  );
}

export function DetailDisclosure({
  title = "How this preview works",
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <details className={styles.disclosure}>
      <summary>
        <ClipboardCheck size={20} aria-hidden="true" />
        <span>{title}</span>
        <ChevronDown size={18} aria-hidden="true" />
      </summary>
      <div>{children}</div>
    </details>
  );
}
