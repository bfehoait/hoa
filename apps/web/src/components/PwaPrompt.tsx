import { useRegisterSW } from "virtual:pwa-register/react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "./UI";
import styles from "./PwaPrompt.module.css";

export function PwaPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <aside
      className={styles.prompt}
      role="status"
      aria-label="App update available"
    >
      <div>
        <strong>A fresh version is ready.</strong>
        <p>Finish any edits, then reload to update.</p>
      </div>
      <Button onClick={() => updateServiceWorker(true)}>
        <RefreshCw size={20} />
        Update app
      </Button>
      <button
        className="icon-button"
        aria-label="Dismiss update notice"
        onClick={() => setNeedRefresh(false)}
      >
        <X size={20} />
      </button>
    </aside>
  );
}
