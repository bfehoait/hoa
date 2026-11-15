import { useState } from "react";
import { Search, Plus } from "lucide-react";
import { Button } from "../../components/UI";
import { committees } from "./AccessManager";
import styles from "./DeveloperScreens.module.css";

export default function CommitteeCatalog() {
  const [search, setSearch] = useState("");
  const rows = committees.filter(([, name]) =>
    name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  return (
    <section aria-label="Defined committee groups">
      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Search size={20} aria-hidden="true" />
          <input
            aria-label="Search defined committees"
            placeholder="Search committees"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <Button secondary disabled aria-describedby="committee-creation-status">
          <Plus size={18} />
          New committee
        </Button>
      </div>
      <p className={styles.result}>{rows.length} defined committees</p>
      <div
        className={styles.tableWrap}
        role="region"
        aria-label="Defined committee directory"
        tabIndex={0}
      >
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Committee</th>
              <th scope="col">Members</th>
              <th scope="col">Module</th>
              <th scope="col">Scope</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([id, name]) => (
              <tr key={id}>
                <th scope="row">{name}</th>
                <td>Not aggregated</td>
                <td>Configured through permissions</td>
                <td>Per grant</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className={styles.empty}>No matching committee groups.</p>
        )}
      </div>
      <p id="committee-creation-status" className={styles.note}>
        Committee creation and membership totals are not connected. Manage
        existing member assignments and group defaults below; this directory
        does not grant access.
      </p>
    </section>
  );
}
