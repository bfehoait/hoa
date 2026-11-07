import { DetailDisclosure } from "../../components/Navigation";
import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Link } from "../../components/AccessLink";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  CalendarDays,
  Search,
  BellRing,
  Wrench,
  Megaphone,
} from "lucide-react";
import { notices } from "../../data/fixtures";
import {
  audienceOptions,
  isPublishedContent,
  matchesAudience,
} from "../../../../../packages/shared/src/integration";
import { useWorkspace } from "../../data/workspace";
import { usePortal, usePortalMutation } from "../../data/usePortal";
import { repository } from "../../data/repository";
import {
  Badge,
  Button,
  Empty,
  Feedback,
  PageIntro,
  Skeleton,
} from "../../components/UI";
import styles from "./Community.module.css";
import { useAuth } from "../../data/auth";
import LiveFeature from "../connected/LiveFeature";

export default function Community({
  basePath = "/community",
}: { basePath?: string } = {}) {
  const auth = useAuth();
  if (!auth.preview && !auth.rolePreview)
    return <LiveFeature module="publishing" initialView="published" />;
  return <SampleCommunity basePath={basePath} />;
}
function SampleCommunity({ basePath = "/community" }: { basePath?: string }) {
  const pathname = useLocation().pathname;
  const slug = pathname.startsWith(basePath + "/")
    ? pathname.slice(basePath.length + 1)
    : "";
  const [filter, setFilter] = useState("All updates");
  const [search, setSearch] = useState("");
  const [audience, setAudience] = useState("All members");
  const portal = usePortal();
  const workspace = useWorkspace();
  const updates = [
    ...notices.map((notice) => ({
      ...notice,
      pinned: false,
      audience: "All members",
      attachments: [],
    })),
    ...(workspace.data?.items
      .filter(
        (item) =>
          item.kind === "announcement" && item.status === "Preview published",
      )
      .map((item) => ({
        id: item.id,
        title: item.title,
        summary: item.detail.slice(0, 150),
        body: item.detail,
        category: "Local preview",
        date: item.createdAt.slice(0, 10),
        urgent: false,
        author: "Sample office workspace",
        pinned: false,
        audience: "All members",
        attachments: item.attachments,
      })) ?? []),
    ...(workspace.data?.items
      .filter(
        (item) =>
          isPublishedContent(item) &&
          item.metadata.module === "publishing" &&
          matchesAudience(item, audience),
      )
      .map((item) => ({
        id: item.id,
        title: item.title,
        summary: item.detail.slice(0, 150),
        body: item.detail,
        category: "Local preview",
        date: (item.metadata.previewPublishedAt ?? item.createdAt).slice(0, 10),
        urgent: false,
        author: "Sample office workspace",
        pinned: item.metadata.pinned === "Pinned",
        audience: item.metadata.audience ?? "All members",
        attachments: item.attachments,
      })) ?? []),
  ].sort((a, b) => Number(b.pinned) - Number(a.pinned));
  const bookmark = usePortalMutation(repository.bookmark);
  const selected = updates.find((n) => n.id === slug);
  if (
    slug &&
    workspace.isPending &&
    !notices.some((notice) => notice.id === slug)
  )
    return <Skeleton />;
  if (slug && !selected && workspace.error)
    return (
      <>
        <PageIntro eyebrow="LOCAL UPDATES" title="This update is unavailable" />
        <Feedback error={workspace.error} />
        <Link className="text-link" to="/developer">
          Open local recovery tools
          <ArrowRight size={20} />
        </Link>
      </>
    );
  if (slug && !selected)
    return (
      <>
        <PageIntro eyebrow="COMMUNITY" title="That update isn’t here." />
        <Link to={basePath} className="text-link">
          Back to updates
          <ArrowUpRight size={20} />
        </Link>
      </>
    );
  if (selected)
    return (
      <>
        <Link className="text-link back-link" to={basePath}>
          <ArrowLeft size={20} />
          All community updates
        </Link>
        <PageIntro
          eyebrow={`${selected.category} · ${selected.date}`}
          title={selected.title}
        />
        <div className={styles.articleMeta}>
          <span className="avatar">BO</span>
          <div>
            <strong>{selected.author}</strong>
            <p className="small muted">Sample announcement</p>
          </div>
          <Button
            secondary
            pending={bookmark.isPending}
            onClick={() => bookmark.mutate(selected.id)}
          >
            <Bookmark
              size={20}
              fill={
                portal.data?.saved.includes(selected.id)
                  ? "currentColor"
                  : "none"
              }
            />
            {portal.data?.saved.includes(selected.id) ? "Saved" : "Save"}
          </Button>
        </div>
        <div className="article-body">
          <p>{selected.body}</p>
        </div>
        <p className="note">
          Sample audience: {selected.audience}
          {selected.pinned ? " · Pinned local notice" : ""}. This does not
          enforce private access.
        </p>
        {selected.attachments.map((file) => (
          <div className="notice-note" key={file.id}>
            <CalendarDays size={20} />
            <p>
              {file.name} · {file.kind}. Synthetic metadata only; no hosted file
              or working QR.
            </p>
          </div>
        ))}
        <div className="notice-note" style={{ marginTop: 32 }}>
          <CalendarDays size={20} />
          <p>
            This is synthetic content for the preview. No actual maintenance or
            event has been announced.
          </p>
        </div>
        <Feedback error={bookmark.error} />
      </>
    );
  const visible = updates.filter(
    (n) =>
      (filter !== "Saved" || portal.data?.saved.includes(n.id)) &&
      (filter !== "Advisories" || n.urgent) &&
      `${n.title} ${n.summary}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageIntro
        eyebrow="LIFE AT BELLEFORT"
        title="Community updates"
        description="News, notices and events in your neighborhood."
      />
      <div className="search">
        <Search size={20} />
        <input
          aria-label="Search community updates"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find an update…"
        />
      </div>
      <div className="filters" aria-label="Filter updates">
        {["All updates", "Advisories", "Saved"].map((f) => (
          <button
            key={f}
            className="filter"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>
      <div className={styles.updates}>
        {visible.map((n) => (
          <article className={styles.update} key={n.id}>
            <span className={styles.updateIcon} aria-hidden="true">
              {n.urgent ? (
                <BellRing size={28} />
              ) : n.category === "Maintenance" ? (
                <Wrench size={28} />
              ) : (
                <Megaphone size={28} />
              )}
            </span>
            <div className={styles.updateMeta}>
              <Badge tone={n.urgent ? "amber" : "neutral"}>{n.category}</Badge>
              <span>{n.date}</span>
            </div>
            <Link to={`${basePath}/${n.id}`}>
              <h2>{n.title}</h2>
              <p>{n.summary}</p>
              <span className={styles.readUpdate}>
                Read update <ArrowRight size={18} />
              </span>
            </Link>
            <button
              className="icon-button"
              aria-label={`${portal.data?.saved.includes(n.id) ? "Unsave" : "Save"} ${n.title}`}
              aria-pressed={portal.data?.saved.includes(n.id) ?? false}
              disabled={bookmark.isPending}
              onClick={() => bookmark.mutate(n.id)}
            >
              <Bookmark
                size={20}
                fill={
                  portal.data?.saved.includes(n.id) ? "currentColor" : "none"
                }
              />
            </button>
          </article>
        ))}
      </div>
      {!visible.length && (
        <Empty title="No updates here yet.">
          {search
            ? "Try a different word or clear your search."
            : "Saved updates will appear here when you bookmark them."}
        </Empty>
      )}
      <Feedback error={portal.error ?? bookmark.error} />
      <DetailDisclosure title="Preview audience options">
        <div className="filters">
          <label htmlFor="notice-audience">Simulated notice audience</label>
          <select
            id="notice-audience"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            style={{
              minHeight: 48,
              padding: 12,
              background: "var(--surface)",
              color: "var(--ink)",
              border: "1px solid var(--line-strong)",
              borderRadius: 8,
            }}
          >
            {audienceOptions.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </div>
        <p>
          This changes the synthetic display only. It does not authenticate a
          user or enforce private access.
        </p>
      </DetailDisclosure>
    </>
  );
}
