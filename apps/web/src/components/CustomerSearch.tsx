import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import styles from "./CustomerSearch.module.css";

export default function CustomerSearch() {
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  useEffect(() => {
    setQuery(
      location.pathname === "/search"
        ? (new URLSearchParams(location.search).get("q") ?? "")
        : "",
    );
  }, [location.pathname, location.search]);
  function submit(event: FormEvent) {
    event.preventDefault();
    navigate(
      "/search" +
        (query.trim() ? "?q=" + encodeURIComponent(query.trim()) : ""),
    );
  }
  return (
    <form
      className={`${styles.search} ${location.pathname === "/search" ? styles.searchPage : ""}`}
      role="search"
      onSubmit={submit}
    >
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search"
        aria-label="Search app features"
        maxLength={100}
        enterKeyHint="search"
      />
      <button type="submit" aria-label="Search features">
        <Search size={20} aria-hidden="true" />
      </button>
    </form>
  );
}
