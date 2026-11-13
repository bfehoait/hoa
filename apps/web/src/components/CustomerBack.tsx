import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import styles from "./CustomerBack.module.css";

/** Stable parent destinations also work for a page opened from an external link. */
export default function CustomerBack() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  let to = "/more";
  if (
    pathname.startsWith("/services/") ||
    [
      "/more/transport",
      "/directory/transport",
      "/more/vehicles",
      "/more/permits",
      "/more/elections",
    ].some((path) => pathname === path || pathname.startsWith(path + "/"))
  ) {
    to = "/services";
  } else if (pathname.startsWith("/account/lots/")) {
    to = "/account/lots";
  } else if (pathname.startsWith("/more/lots/")) {
    to = "/more/lots";
  } else if (pathname.startsWith("/account/")) {
    to = "/account";
  } else if (pathname.startsWith("/community")) {
    to = "/";
  } else if (pathname.startsWith("/directory/")) {
    to = "/more";
  } else if (pathname.startsWith("/explore/")) {
    to = "/explore";
  }
  return (
    <button
      type="button"
      className={styles.back}
      data-customer-back
      aria-label="Go back"
      onClick={() => {
        if (Number(window.history.state?.idx) > 0) navigate(-1);
        else navigate(to);
      }}
    >
      <ArrowLeft size={22} aria-hidden="true" />
      <span>Back</span>
    </button>
  );
}
