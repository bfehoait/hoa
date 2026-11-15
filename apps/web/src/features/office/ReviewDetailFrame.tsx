import { useEffect, useState, type ComponentProps } from "react";
import { Modal } from "../../components/UI";
import { useReviewSurface } from "./ReviewSurface";
import styles from "./OfficeScreens.module.css";

// This changes the presentation of the existing form, never its submission.
export default function ReviewDetailFrame(props: ComponentProps<typeof Modal>) {
  const surface = useReviewSurface();
  const [dirty, setDirty] = useState(false);
  const onLock = surface?.onLockChange;
  const inline = !!surface;
  useEffect(() => {
    if (inline) onLock?.(dirty || !!props.busy);
    return () => onLock?.(false);
  }, [inline, onLock, dirty, props.busy]);
  useEffect(() => {
    if (!inline || !dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [inline, dirty]);
  if (!surface) return <Modal {...props} />;
  return (
    <section
      className={styles.reviewBody}
      aria-label={
        typeof props.title === "string" ? props.title : "Submission details"
      }
      onChangeCapture={() => setDirty(true)}
    >
      {props.description && <p>{props.description}</p>}
      {props.children}
      {props.footer}
      {dirty && !props.busy && (
        <div className={styles.discardActions}>
          <button
            type="button"
            className="text-link"
            onClick={() => {
              if (window.confirm("Discard your unsaved changes?")) {
                setDirty(false);
                props.onClose();
              }
            }}
          >
            Discard changes
          </button>
        </div>
      )}
    </section>
  );
}
