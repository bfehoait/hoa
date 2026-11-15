import { FileText } from "lucide-react";
import PdfAttachment from "../../components/PdfAttachment";
import { amenityGuidelineDate } from "../../../../../packages/shared/src/amenity-guidelines";
import styles from "./BookingSchedule.module.css";

export default function AmenityPolicyLink() {
  return (
    <div className={styles.policyLink}>
      <FileText size={22} aria-hidden="true" />
      <div>
        <strong>Bellefort amenity guidelines (PDF)</strong>
        <small>{amenityGuidelineDate}</small>
        <PdfAttachment
          title="Bellefort amenity guidelines"
          filename="bfe-amenities-guidelines-2025-10-21.pdf"
          loadFile={async () => {
            const response = await fetch(
              `${import.meta.env.BASE_URL}documents/bfe-amenities-guidelines-2025-10-21.pdf`,
            );
            if (!response.ok) throw new Error("PDF unavailable.");
            return response.blob();
          }}
        />
      </div>
    </div>
  );
}
