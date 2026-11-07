import { ExternalLink, MapPin } from "lucide-react";
import styles from "./CommunityMap.module.css";

/**
 * The association's address on a map.
 *
 * OpenStreetMap's embed is used rather than a mapping library: it needs no
 * dependency, no API key and no account, the tiles are free to use with
 * attribution, and nothing about the viewer is sent to a commercial mapping
 * service. The iframe is sandboxed and lazily loaded, so it costs nothing
 * until it scrolls into view.
 *
 * Co-ordinates are approximate and only centre the view; they are not a
 * surveyed location and nothing depends on their precision.
 */
export const OFFICE_ADDRESS =
  "Bellefort Estates Sales Office, Ph3, Molino IV, Bacoor, Cavite";

const LAT = 14.4093;
const LON = 120.9842;
const SPAN = 0.008;
const bbox = [LON - SPAN, LAT - SPAN / 2, LON + SPAN, LAT + SPAN / 2].join(",");
const embed = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${LAT},${LON}`;
const full = `https://www.openstreetmap.org/?mlat=${LAT}&mlon=${LON}#map=16/${LAT}/${LON}`;

export default function CommunityMap({
  title = "Where to find the office",
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <section className={styles.map} aria-labelledby="community-map-title">
      <div className={styles.head}>
        <h2 id="community-map-title">
          <MapPin size={20} aria-hidden="true" />
          {title}
        </h2>
        <p className={styles.address}>{OFFICE_ADDRESS}</p>
        {description && <p className={styles.note}>{description}</p>}
      </div>
      <iframe
        className={styles.frame}
        title={"Map showing " + OFFICE_ADDRESS}
        src={embed}
        loading="lazy"
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin allow-popups"
      />
      <p className={styles.foot}>
        <a href={full} target="_blank" rel="noreferrer noopener">
          Open a larger map
          <ExternalLink size={16} aria-hidden="true" />
        </a>
        <span>
          Map data &copy; OpenStreetMap contributors. The pin is approximate.
        </span>
      </p>
    </section>
  );
}
