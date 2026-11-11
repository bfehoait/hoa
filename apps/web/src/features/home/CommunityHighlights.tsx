import { useEffect, useRef, useState } from "react";
import { Pause, Play, ChevronRight } from "lucide-react";
import { Link } from "../../components/AccessLink";
import { Button, Feedback, Modal, Skeleton } from "../../components/UI";
import { useFeatureRecords } from "../../data/feature-records";
import styles from "./ResidentHome.module.css";
import ListingMedia from "../connected/ListingMedia";

export default function CommunityHighlights() {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const suppressClickUntil = useRef(0);
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const notices = useFeatureRecords("publishing", "published", 0, "");
  const [index, setIndex] = useState(0),
    [opened, setOpened] = useState<string | null>(null);
  const rows = notices.data?.rows.slice(0, 4) ?? [];
  const currentIndex = Math.min(index, Math.max(0, rows.length - 1));
  const current = rows[currentIndex];
  const selected = rows.find((notice) => notice.id === opened);
  const rowCount = rows.length;
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (
      rowCount < 2 ||
      paused ||
      interacting ||
      focused ||
      opened ||
      reducedMotion
    )
      return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible")
        setIndex((value) => (value + 1) % rowCount);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [rowCount, paused, interacting, focused, opened, reducedMotion, index]);
  return (
    <section
      className={styles.notices}
      aria-labelledby="community-notices"
      onMouseEnter={() => setInteracting(true)}
      onMouseLeave={() => setInteracting(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
    >
      <div className={styles.heading}>
        <h2 id="community-notices">Announcements</h2>
        <Link className={styles.sectionLink} to="/community">
          See all <ChevronRight size={16} aria-hidden="true" />
        </Link>
      </div>
      {notices.isPending ? (
        <Skeleton />
      ) : notices.isError ? (
        <>
          <Feedback error={notices.error} />
          <Button secondary onClick={() => void notices.refetch()}>
            Try again
          </Button>
        </>
      ) : current ? (
        <>
          <div className={styles.carouselSlides}>
            {rows.map((notice, slideIndex) => (
              <article
                key={notice.id}
                data-active={slideIndex === currentIndex}
                aria-hidden={slideIndex !== currentIndex}
                inert={slideIndex !== currentIndex}
                className={styles.announcement}
                aria-label="Featured HOA announcement"
                onPointerDown={(event) => {
                  if (event.pointerType === "touch") setInteracting(true);
                  touchStart.current =
                    event.pointerType === "touch"
                      ? { x: event.clientX, y: event.clientY }
                      : null;
                }}
                onPointerCancel={() => {
                  touchStart.current = null;
                  setInteracting(false);
                }}
                onPointerUp={(event) => {
                  const start = touchStart.current;
                  touchStart.current = null;
                  setInteracting(false);
                  if (!start || rows.length < 2) return;
                  const dx = event.clientX - start.x;
                  const dy = event.clientY - start.y;
                  if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.4)
                    return;
                  suppressClickUntil.current = performance.now() + 400;
                  setIndex(
                    (currentIndex + (dx < 0 ? 1 : -1) + rows.length) %
                      rows.length,
                  );
                }}
              >
                <div className={styles.bannerImage}>
                  <ListingMedia
                    key={notice.id}
                    id={notice.id}
                    announcement
                    coverOnly
                    preload
                    alt={"Image for " + notice.title}
                  />
                </div>
                <div className={styles.announcementBody}>
                  <h3>
                    <button
                      type="button"
                      className={styles.announcementLink}
                      aria-haspopup="dialog"
                      aria-label={"Read announcement: " + notice.title}
                      onClick={() => {
                        if (performance.now() >= suppressClickUntil.current)
                          setOpened(notice.id);
                      }}
                    >
                      <span>{notice.title}</span>
                      <ChevronRight size={18} aria-hidden="true" />
                    </button>
                  </h3>
                </div>
              </article>
            ))}
          </div>
          {rows.length > 1 && (
            <div
              className={styles.carouselControls}
              role="group"
              aria-label="Choose an announcement"
            >
              <div className={styles.dots}>
                {rows.map((notice, i) => (
                  <button
                    type="button"
                    key={notice.id}
                    aria-label={
                      "Show announcement " + (i + 1) + ": " + notice.title
                    }
                    aria-pressed={i === currentIndex}
                    onClick={() => setIndex(i)}
                  >
                    <span />
                  </button>
                ))}
              </div>
              {!reducedMotion && (
                <button
                  type="button"
                  className={styles.carouselArrow}
                  aria-label={
                    paused ? "Play announcements" : "Pause announcements"
                  }
                  onClick={() => setPaused((value) => !value)}
                >
                  {paused ? (
                    <Play size={18} aria-hidden="true" />
                  ) : (
                    <Pause size={18} aria-hidden="true" />
                  )}
                </button>
              )}
              <span className={styles.counter}>
                {currentIndex + 1} / {rows.length}
              </span>
            </div>
          )}
        </>
      ) : (
        <div className={styles.emptyNotice}>
          <h3>Your community, in the loop</h3>
          <p>New HOA announcements will appear here when published.</p>
        </div>
      )}
      {selected && (
        <Modal
          title={selected.title}
          onClose={() => setOpened(null)}
          presentation="task"
        >
          <time
            className={styles.announcementMeta}
            dateTime={selected.created_at}
          >
            {new Date(selected.created_at).toLocaleDateString("en-PH", {
              timeZone: "Asia/Manila",
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </time>
          <ListingMedia
            id={selected.id}
            announcement
            alt={"Image for " + selected.title}
          />
          <p className={styles.fullNotice}>{selected.detail}</p>
        </Modal>
      )}
    </section>
  );
}
