import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ImgHTMLAttributes,
} from "react";
import { Image as ImageIcon } from "lucide-react";
import styles from "./LoadingImage.module.css";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet"> & {
  src: string;
  validUntil?: number;
};

export function ImageSkeleton({ className = "" }: { className?: string }) {
  return (
    <span
      data-image-frame="true"
      className={`${styles.placeholder} ${className}`}
      role="status"
      aria-label="Loading image"
    >
      <span className={styles.shimmer} aria-hidden="true" />
    </span>
  );
}

/** Keeps the original image dimensions while the network resource loads. */
export default function LoadingImage({
  src,
  validUntil,
  className = "",
  alt = "",
  width,
  height,
  style,
  onLoad,
  onError,
  ...props
}: Props) {
  const ref = useRef<HTMLImageElement>(null);
  const [result, setResult] = useState<{
    src: string;
    state: "ready" | "error";
  } | null>(null);
  const state = result?.src === src ? result.state : "loading";
  const allowed = () => validUntil === undefined || validUntil > Date.now();
  useLayoutEffect(() => {
    const image = ref.current;
    if (!image) return;
    // Never assign an expired signed URL, including when an old slide reopens.
    if (validUntil !== undefined && validUntil <= Date.now()) {
      image.removeAttribute("src");
      return;
    }
    if (image.getAttribute("src") !== src) image.src = src;
  }, [src, validUntil]);
  const dimensions = {
    "--image-width": width ? `${Number(width)}px` : "100%",
    "--image-ratio": width && height ? `${width} / ${height}` : "4 / 3",
    ...style,
  } as CSSProperties;
  return (
    <span
      data-image-frame="true"
      data-image-state={state}
      className={`${styles.frame} ${className}`}
      style={dimensions}
      aria-busy={state === "loading"}
    >
      {state === "loading" && (
        <span className={styles.shimmer} aria-hidden="true" />
      )}
      <img
        {...props}
        ref={ref}
        width={width}
        height={height}
        alt={alt}
        className={styles.image}
        onLoad={(event) => {
          if (event.currentTarget.getAttribute("src") !== src || !allowed())
            return;
          setResult({ src, state: "ready" });
          onLoad?.(event);
        }}
        onError={(event) => {
          if (event.currentTarget.getAttribute("src") !== src) return;
          setResult({ src, state: "error" });
          onError?.(event);
        }}
      />
      {state === "error" && (
        <span
          className={styles.fallback}
          role="img"
          aria-label={alt ? `${alt} — image unavailable` : "Image unavailable"}
        >
          <ImageIcon size={24} aria-hidden="true" />
          <span>Image unavailable</span>
        </span>
      )}
    </span>
  );
}
