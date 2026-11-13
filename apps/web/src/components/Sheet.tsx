import type { ReactNode } from "react";
import { Modal } from "./UI";
import styles from "./Sheet.module.css";

/** Reuses the native-dialog focus trap, body lock, Escape/scrim handling,
 * keyboard viewport sizing and focus restoration shared by portal dialogs.
 * A drop-in for Modal that always presents as the bottom sheet, so resident
 * forms and popups share one look. */
export default function Sheet({
  title,
  description,
  children,
  footer,
  onClose,
  busy = false,
  size = "md",
  protectChanges = false,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  busy?: boolean;
  size?: "sm" | "md" | "lg";
  /** Accepted for drop-in parity with Modal; a Sheet always presents as the
   * bottom sheet, so the value is ignored. */
  presentation?: "sheet" | "task";
  protectChanges?: boolean;
  className?: string;
}) {
  return (
    <Modal
      title={title}
      description={description}
      onClose={onClose}
      busy={busy}
      size={size}
      protectChanges={protectChanges}
      footer={footer}
      className={`${styles.sheet} ${className ?? ""}`}
    >
      {children}
    </Modal>
  );
}
