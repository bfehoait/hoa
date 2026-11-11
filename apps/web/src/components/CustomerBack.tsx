import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import styles from "./CustomerBack.module.css";

/** Stable parent destinations also work for a page opened from an external link. */
export default function CustomerBack() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  let to = "/more";
  if (pathname.startsWith("/services/")) {
    to = "/services";
  } else if (pathname.startsWith("/account/")) {
    to = "/account";
  } else if (pathname.startsWith("/community")) {
    to = "/";
  } else if (pathname.startsWith("/directory/")) {
    to = "/more";
  }
  return (
    <button
      type="button"
      className={styles.back}
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
