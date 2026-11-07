import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Download, Share2, PlusSquare, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useAuth } from "./auth";
import { previewScope } from "./preview-scope";
import { Button, Modal } from "../components/UI";
import {
  installDismissMs,
  shouldSuggestInstall,
} from "../../../../packages/shared/src/accounts";
import styles from "../components/PwaPrompt.module.css";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
type InstallState = { installed: boolean; open: () => void };
const InstallContext = createContext<InstallState>({
  installed: false,
  open: () => {},
});
function standalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    !!(navigator as Navigator & { standalone?: boolean }).standalone
  );
}
export function InstallProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();
  const [installed, setInstalled] = useState(standalone);
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [suggest, setSuggest] = useState(false);
  const [guide, setGuide] = useState(false);
  const [error, setError] = useState("");
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const eligible =
    !!auth.userId &&
    !!auth.member &&
    !auth.checking &&
    !auth.memberError &&
    !auth.preview &&
    !auth.rolePreview &&
    !previewScope &&
    !["/sign-in", "/register", "/recover", "/reset-password"].includes(
      location.pathname,
    );
  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const before = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallEvent);
    };
    const done = () => {
      setInstalled(true);
      setSuggest(false);
      setGuide(false);
      setPrompt(null);
    };
    const changed = () => {
      if (standalone()) done();
    };
    window.addEventListener("beforeinstallprompt", before);
    window.addEventListener("appinstalled", done);
    media.addEventListener("change", changed);
    return () => {
      window.removeEventListener("beforeinstallprompt", before);
      window.removeEventListener("appinstalled", done);
      media.removeEventListener("change", changed);
    };
  }, []);
  useEffect(() => {
    if (!eligible || installed || (!prompt && !ios)) return;
    let visits: number;
    let until: number;
    try {
      visits = Number(localStorage.getItem("bellefort-install-visits")) || 0;
      if (!sessionStorage.getItem("bellefort-install-visit-counted")) {
        visits += 1;
        localStorage.setItem("bellefort-install-visits", String(visits));
        sessionStorage.setItem("bellefort-install-visit-counted", "1");
      }
      until =
        Number(localStorage.getItem("bellefort-install-dismissed-until")) || 0;
    } catch {
      return;
    }
    if (!shouldSuggestInstall(visits, until, installed)) return;
    const timer = window.setTimeout(() => {
      if (
        !document.querySelector('[aria-label="App update available"]') &&
        !document.querySelector("dialog[open]")
      )
        setSuggest(true);
    }, 10000);
    return () => window.clearTimeout(timer);
  }, [eligible, installed, prompt, ios]);
  function dismiss() {
    setSuggest(false);
    try {
      localStorage.setItem(
        "bellefort-install-dismissed-until",
        String(Date.now() + installDismissMs),
      );
    } catch {
      /* Device preference only. */
    }
  }
  async function open() {
    if (installed) return;
    setError("");
    setSuggest(false);
    if (!prompt) {
      setGuide(true);
      return;
    }
    const current = prompt;
    setPrompt(null);
    try {
      await current.prompt();
      const choice = await current.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      else dismiss();
    } catch {
      setError(
        "The browser could not open installation. Use its menu instead.",
      );
      setGuide(true);
    }
  }
  return (
    <InstallContext.Provider value={{ installed, open: () => void open() }}>
      {children}
      {suggest && eligible && !installed && (
        <aside
          className={styles.prompt}
          role="region"
          aria-label="Add Bellefort to your home screen"
        >
          <Download size={28} />
          <div>
            <strong>Your community, one tap away.</strong>
            <p>
              Add Bellefort to your home screen. No app-store download needed.
            </p>
          </div>
          <Button onClick={() => void open()}>Add app</Button>
          <Button secondary onClick={dismiss}>
            Not now
          </Button>
          <button
            className="icon-button"
            aria-label="Dismiss install suggestion for seven days"
            onClick={dismiss}
          >
            <X size={18} />
          </button>
        </aside>
      )}
      {guide && eligible && !installed && (
        <Modal
          title="Add Bellefort to your home screen"
          onClose={() => setGuide(false)}
        >
          <p>Open Bellefort directly from an app icon on this device.</p>
          {error && <p role="alert">{error}</p>}
          <ol className={styles.steps}>
            {ios ? (
              <>
                <li>
                  <Share2 size={22} />
                  Open the browser’s Share menu.
                </li>
                <li>
                  <PlusSquare size={22} />
                  Choose Add to Home Screen (you may need More).
                </li>
                <li>Confirm Add, then open Bellefort from the new icon.</li>
              </>
            ) : (
              <>
                <li>Open your browser’s menu.</li>
                <li>
                  <Download size={22} />
                  Choose Install app or Add to Home Screen, if available.
                </li>
                <li>Confirm installation and open the new Bellefort icon.</li>
              </>
            )}
          </ol>
          <p className="note">
            Installation options depend on your browser and device. Your account
            and permissions stay the same.
          </p>
          <Button onClick={() => setGuide(false)}>Got it</Button>
        </Modal>
      )}
    </InstallContext.Provider>
  );
}
export function useInstall() {
  return useContext(InstallContext);
}
