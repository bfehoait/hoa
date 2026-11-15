import { useId, useState, type ReactNode } from "react";
import { Megaphone } from "lucide-react";
import { Badge } from "../../components/UI";
import styles from "./AnnouncementCard.module.css";
import ListingMedia from "./ListingMedia";

export function AnnouncementGrid({ children }: { children: ReactNode }) {
  return <div className={styles.grid}>{children}</div>;
}

/** Shared presentation; each desk retains its own reader and authorized actions. */
export default function AnnouncementCard({
  id,
  title,
  detail,
  date,
  status,
  audience,
  actions,
}: {
  id: string;
  title: string;
  detail: string;
  date: string;
  status: string;
  audience?: string;
  actions?: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const textId = useId();
  const longText = detail.length > 240;
  return (
    <article className={styles.card}>
      <div className={styles.meta}>
        <Badge>{status}</Badge>
        <time dateTime={date}>
          {new Date(date).toLocaleDateString("en-PH", {
            timeZone: "Asia/Manila",
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </time>
      </div>
      <div className={styles.heading}>
        <span className={styles.icon}>
          <Megaphone size={20} aria-hidden="true" />
        </span>
        <h2>{title}</h2>
      </div>
      <div className={styles.postText}>
        <p
          id={textId}
          className={`${styles.excerpt} ${longText && !expanded ? styles.collapsed : ""}`}
        >
          {detail}
        </p>
        {longText && (
          <button
            type="button"
            className={styles.expand}
            aria-expanded={expanded}
            aria-controls={textId}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "See less" : "See more"}
          </button>
        )}
      </div>
      <div className={styles.image}>
        <ListingMedia
          id={id}
          announcement
          hideEmpty
          alt={`Image for ${title}`}
        />
      </div>
      {audience && <p className={styles.audience}>Audience: {audience}</p>}
      {actions && (
        <div className={styles.footer}>
          <div className={styles.actions}>{actions}</div>
        </div>
      )}
    </article>
  );
}
