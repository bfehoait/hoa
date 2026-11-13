import type { ReactNode } from "react";
import { Modal } from "../../components/UI";
import Sheet from "../../components/Sheet";
import styles from "./BookingSchedule.module.css";

/** Resident booking stays in the page; pass requests retain their dialog. */
export default function BookingComposerFrame({
  inline,
  title,
  busy,
  onClose,
  children,
  sheet = false,
  footer,
}: {
  inline: boolean;
  title: string;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
  sheet?: boolean;
  footer?: ReactNode;
}) {
  return inline ? (
    <section
      className={styles.composer}
      aria-labelledby="amenity-composer-title"
    >
      <h2 id="amenity-composer-title">{title}</h2>
      {children}
    </section>
  ) : sheet ? (
    <Sheet
      title={title}
      busy={busy}
      onClose={onClose}
      footer={footer}
      protectChanges
    >
      {children}
    </Sheet>
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
