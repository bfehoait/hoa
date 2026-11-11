import type { ReactNode } from "react";
import { Modal } from "../../components/UI";
import styles from "./BookingSchedule.module.css";

/** Resident booking stays in the page; pass requests retain their dialog. */
export default function BookingComposerFrame({
  inline,
  title,
  busy,
  onClose,
  children,
}: {
  inline: boolean;
  title: string;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return inline ? (
    <section
      className={styles.composer}
      aria-labelledby="amenity-composer-title"
    >
      <h2 id="amenity-composer-title">{title}</h2>
      {children}
    </section>
  ) : (
    <Modal
      title={title}
      busy={busy}
      onClose={onClose}
      presentation="task"
      protectChanges
    >
      {children}
    </Modal>
  );
}
