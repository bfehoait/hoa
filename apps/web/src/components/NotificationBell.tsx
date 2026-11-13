import { useState } from "react";
import { Bell } from "lucide-react";
import { useNotifications } from "../data/accounts";
import { NotificationList } from "../features/more/Notifications";
import { Modal } from "./UI";
import Sheet from "./Sheet";
import { useLocation } from "react-router-dom";
import styles from "./NotificationBell.module.css";
export function NotificationBell() {
  const { pathname } = useLocation();
  const Dialog = /^\/(office|admin|developer|board|security|driver)(\/|$)/.test(
    pathname,
  )
    ? Modal
    : Sheet;
  const [open, setOpen] = useState(false);
  const query = useNotifications();
  const unread = query.isError ? 0 : (query.data?.unread ?? 0);
  return (
    <>
      <button
        className={`icon-button ${styles.bell}`}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(event) => {
          event.currentTarget.focus();
          setOpen(true);
        }}
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className={styles.badge} aria-hidden="true">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <Dialog
          className={styles.popup}
          title="Notifications"
          onClose={() => setOpen(false)}
        >
          <NotificationList compact onNavigate={() => setOpen(false)} />
        </Dialog>
      )}
    </>
  );
}
