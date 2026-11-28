import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { areaNavigation } from "../../components/AccountNavigation";
import { Link } from "../../components/AccessLink";
import { usePermissions } from "../../data/permissions";
import styles from "./OfficeSearch.module.css";

export default function OfficeSearch({
  workspace = "office",
}: {
  workspace?: "office" | "board" | "security" | "driver";
}) {
  const [value, setValue] = useState("");
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const permissions = usePermissions();
  const matches = value.trim()
    ? areaNavigation[workspace].links.filter(
        (item) =>
          item.label.toLowerCase().includes(value.trim().toLowerCase()) &&
          permissions.allowsPath(item.to),
      )
    : [];
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k" &&
        !document.querySelector("dialog[open]")
      ) {
        event.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (matches.length) {
      navigate(matches[0].to);
      setValue("");
    }
  }
  return (
    <div className={styles.search}>
      <form role="search" onSubmit={submit}>
        <Search size={18} aria-hidden="true" />
        <label className="sr-only" htmlFor={id}>
          Find a screen in {workspace === "driver" ? "Transport" : workspace}
        </label>
        <input
          id={id}
          ref={input}
          value={value}
          maxLength={100}
          placeholder="Find a screen"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setValue("");
          }}
          aria-controls={value.trim() ? `${id}-results` : undefined}
        />
        <button
          type="submit"
          aria-label={`Open first matching ${workspace} screen`}
        >
          <kbd title="Control or Command + K">⌘/Ctrl K</kbd>
        </button>
      </form>
      {value.trim() && (
        <ul id={`${id}-results`} aria-label={`Matching ${workspace} screens`}>
          {matches.map((item) => (
            <li key={item.to}>
              <Link to={item.to} onClick={() => setValue("")}>
                {item.label}
              </Link>
            </li>
          ))}
          {!matches.length && (
            <li className={styles.empty} role="status">
              No matching screens.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
