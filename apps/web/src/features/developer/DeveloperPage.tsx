import type { ReactNode } from "react";
import styles from "./DeveloperScreens.module.css";

export default function DeveloperPage({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>{title}</h1>

        <div className={styles.intro}>
          <p>{description}</p>
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
      </header>
      {children}
    </div>
  );
}
