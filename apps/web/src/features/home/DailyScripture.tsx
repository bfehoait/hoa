import { BookOpen } from "lucide-react";
import { verseOfTheDay } from "../../data/scripture";
import styles from "./DailyScripture.module.css";

/**
 * A small daily scripture box for the resident home.
 *
 * One verse a day, the same for everyone in Philippine time, rotating through a
 * curated ESV list (see data/scripture.ts). Pure presentation: no
 * network call, no account data, nothing to save. The office can grow or reorder
 * the verse list without touching this component.
 */
export default function DailyScripture() {
  const today = verseOfTheDay();
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
  }).format(new Date());

  return (
    <section className={styles.box} aria-label="Today's Bible verse">
      <span className={styles.mark} aria-hidden="true">
        &rdquo;
      </span>
      <div className={styles.head}>
        <span className={styles.badge} aria-hidden="true">
          <BookOpen size={16} />
        </span>
        <span className={styles.label}>Today&rsquo;s Verse</span>
        <span className={styles.date}>{date}</span>
      </div>
      <blockquote className={styles.verse}>{today.verse}</blockquote>
      <cite className={styles.ref}>{today.reference}</cite>
    </section>
  );
}
