import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import styles from "./DeveloperSearch.module.css";

export default function DeveloperSearch() {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  function submit(event: FormEvent) {
    event.preventDefault();
    navigate(
      `/developer/modules${search.trim() ? `?query=${encodeURIComponent(search.trim())}` : ""}`,
    );
  }
  return (
    <form className={styles.search} role="search" onSubmit={submit}>
      <Search size={20} aria-hidden="true" />
      <label className="sr-only" htmlFor="developer-module-search">
        Find a system module
      </label>
      <input
        id="developer-module-search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Find people, finance, security modules…"
        maxLength={100}
      />
      <button type="submit" aria-label="Search system modules">
        Search
      </button>
    </form>
  );
}
