import { useEffect, useId, useState, type FormEvent } from "react";
import { Moon, Sun, Bell, ArrowRight } from "lucide-react";
import { Link } from "../../components/AccessLink";
import { useAccountActions, useOwnProfile } from "../../data/accounts";
import { Button, Feedback, PageIntro, Skeleton } from "../../components/UI";
import styles from "./Settings.module.css";
import PrivateHealthNote from "./PrivateHealthNote";
import { esvCopyrightNotice } from "../../data/scripture";

const THEME_KEY = "bellefort-theme";

/**
 * Account and appearance settings.
 *
 * Appearance is a per-device preference and stays in this browser. Contact
 * details go to bfe_save_profile, which validates and stores them server side.
 * Nothing here changes a role, a permission or an approval — those are office
 * decisions and are refused by the server regardless of what this page shows.
 */
export default function Settings() {
  const profile = useOwnProfile();
  const actions = useAccountActions();
  const ids = useId();
  const [dark, setDark] = useState(
    () => document.documentElement.dataset.theme === "dark",
  );
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    try {
      localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
    } catch {
      // A browser with storage blocked still gets the theme for this visit.
    }
  }, [dark]);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setSaved(false);
    actions.saveProfile.mutate(
      {
        display_name: String(values.get("display_name") ?? "").trim(),
        phone: String(values.get("phone") ?? "").trim(),
        bio: String(values.get("bio") ?? "").trim(),
      },
      { onSuccess: () => setSaved(true) },
    );
  }

  return (
    <>
      <PageIntro
        eyebrow="YOUR ACCOUNT"
        title="Settings"
        description="Appearance on this device, and the contact details the office holds for you."
      />
      <PrivateHealthNote />

      <section className={styles.panel} aria-labelledby={ids + "-appearance"}>
        <h2 id={ids + "-appearance"}>Appearance</h2>
        <p className={styles.help}>
          This choice is saved in this browser only. Signing in elsewhere keeps
          that device&rsquo;s own setting.
        </p>
        <div className={styles.themeRow}>
          <span className={styles.themeLabel}>
            {dark ? (
              <Moon size={20} aria-hidden="true" />
            ) : (
              <Sun size={20} aria-hidden="true" />
            )}
            {dark ? "Dark" : "Light"}
          </span>
          <label className={styles.switch}>
            <input
              type="checkbox"
              role="switch"
              checked={dark}
              aria-label="Dark appearance"
              onChange={(event) => setDark(event.target.checked)}
            />
            <span className={styles.track} aria-hidden="true" />
            <span className={styles.switchText}>
              Dark appearance
              <small>Lower contrast for evening reading.</small>
            </span>
          </label>
        </div>
      </section>

      <section className={styles.panel} aria-labelledby={ids + "-contact"}>
        <h2 id={ids + "-contact"}>Your contact details</h2>
        <p className={styles.help}>
          The office uses these to reach you about your requests. Your name on
          the member record and your unit are set by the office, not here.
        </p>
        {profile.isPending ? (
          <Skeleton />
        ) : profile.error ? (
          <Feedback error={profile.error as Error} />
        ) : (
          <form className={styles.form} onSubmit={save}>
            <label htmlFor={ids + "-name"}>Display name</label>
            <input
              id={ids + "-name"}
              name="display_name"
              defaultValue={profile.data?.display_name ?? ""}
              maxLength={80}
              autoComplete="name"
              enterKeyHint="next"
            />
            <label htmlFor={ids + "-phone"}>Contact number</label>
            <input
              id={ids + "-phone"}
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              enterKeyHint="next"
              defaultValue={profile.data?.phone ?? ""}
              maxLength={30}
            />
            <p className={styles.help}>Digits, spaces and + ( ) . - only.</p>
            <label htmlFor={ids + "-bio"}>About you</label>
            <textarea
              id={ids + "-bio"}
              name="bio"
              defaultValue={profile.data?.bio ?? ""}
              maxLength={240}
              rows={3}
            />
            <div className="form-actions">
              <Button pending={actions.saveProfile.isPending}>
                Save details
              </Button>
            </div>
            {actions.saveProfile.error && (
              <Feedback error={actions.saveProfile.error as Error} />
            )}
            {saved && !actions.saveProfile.isPending && (
              <Feedback message="Your details were saved." />
            )}
          </form>
        )}
      </section>

      <section className={styles.panel} aria-labelledby={ids + "-notice"}>
        <h2 id={ids + "-notice"}>Notifications</h2>
        <p className={styles.help}>
          The office notifies you about your own requests and account changes.
          Per-notification preferences are not available yet, so every message
          about your records is delivered.
        </p>
        <Link className="text-link" to="/more/notifications">
          <Bell size={20} aria-hidden="true" />
          Open your notifications
          <ArrowRight size={20} aria-hidden="true" />
        </Link>
      </section>
      <details className={styles.panel}>
        <summary>Scripture copyright</summary>
        <p className={styles.help}>{esvCopyrightNotice}</p>
        <a
          className="text-link"
          href="https://www.esv.org/"
          target="_blank"
          rel="noopener noreferrer"
        >
          ESV Bible source
        </a>
      </details>
    </>
  );
}
