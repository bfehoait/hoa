import type { ComponentProps } from "react";
import { useLocation } from "react-router-dom";
import { PageIntro } from "../../components/UI";
import styles from "./OfficeScreens.module.css";
import { useReviewSurface } from "./ReviewSurface";

export default function OfficePage(props: ComponentProps<typeof PageIntro>) {
  const location = useLocation();
  const review = useReviewSurface();
  if (review)
    return props.action ? (
      <div className={styles.actions}>{props.action}</div>
    ) : null;
  const board =
    location.pathname === "/board" || location.pathname.startsWith("/board/");
  const security =
    location.pathname === "/security" ||
    location.pathname.startsWith("/security/");
  const driver =
    location.pathname === "/driver" || location.pathname.startsWith("/driver/");
  if (
    !location.pathname.startsWith("/office") &&
    !board &&
    !security &&
    !driver
  )
    return <PageIntro {...props} />;
  return (
    <header className={styles.pageHeader}>
      <div className={styles.titleRow}>
        <div>
          <h1>{props.title}</h1>
        </div>
      </div>
      <div className={styles.intro}>
        {props.description && <p>{props.description}</p>}
        {props.action && <div className={styles.actions}>{props.action}</div>}
      </div>
    </header>
  );
}
