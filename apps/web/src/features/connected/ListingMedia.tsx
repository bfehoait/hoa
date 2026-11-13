import { useLayoutEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { ImagePlus, Image as ImageIcon, ExternalLink } from "lucide-react";
import { useAuth, makeClient, makeRealClient } from "../../data/auth";
import { featureRpc } from "../../data/feature-records";
import { Button, Feedback } from "../../components/UI";
import { publicationLinksSchema } from "../../../../../packages/shared/src/feature-records";
import styles from "./ListingMedia.module.css";
const assetSchema = z.object({
  cover_path: z.string().nullable(),
  links: z.array(z.object({ label: z.string(), url: z.string() })),
});
type SignedAsset = z.infer<typeof assetSchema> & {
  url: string | null;
  expiresAt: number;
};
function SignedCoverImage({
  url,
  expiresAt,
  className,
  alt,
  preload,
}: {
  url: string;
  expiresAt: number;
  className: string;
  alt: string;
  preload: boolean;
}) {
  const ref = useRef<HTMLImageElement>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  // The image resource is assigned only after checking its lifetime. An old
  // inactive slide can otherwise start loading an expired URL on reactivation.
  useLayoutEffect(() => {
    const image = ref.current;
    if (!image) return;
    if (!(expiresAt > Date.now())) {
      image.hidden = true;
      image.style.visibility = "hidden";
      image.removeAttribute("src");
      return;
    }
    image.hidden = false;
    image.style.visibility = "visible";
    if (image.getAttribute("src") !== url) image.src = url;
  }, [url, expiresAt]);
  if (failedUrl === url)
    return (
      <div
        className={styles.placeholder}
        role="img"
        aria-label="Photo unavailable"
      >
        <ImageIcon size={32} aria-hidden="true" />
      </div>
    );
  return (
    <img
      ref={ref}
      className={className}
      alt={alt}
      loading={preload ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailedUrl(url)}
    />
  );
}
export const listingModules = [
  "businesses",
  "buy-sell",
  "jobs",
  "garage-sales",
  "workshops",
  "booth-events",
];
export async function listingCover(file: File): Promise<Blob> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 8 * 1024 * 1024
  )
    throw new Error("Choose a JPEG, PNG or WebP photo up to 8 MB.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(
      "This photo could not be opened. Choose a valid JPEG, PNG or WebP image.",
    );
  }
  try {
    if (bitmap.width * bitmap.height > 40_000_000)
      throw new Error("Choose a smaller photo.");
    const ratio = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height)),
      canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("Photo conversion is unavailable on this device.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) =>
          b ? resolve(b) : reject(new Error("Unable to prepare this photo.")),
        "image/webp",
        0.8,
      ),
    );
    if (blob.type !== "image/webp" || blob.size > 1048576)
      throw new Error(
        "Choose a smaller photo; the prepared cover must be WebP under 1 MB.",
      );
    return blob;
  } finally {
    bitmap.close();
  }
}
export async function uploadListingCover(id: string, blob: Blob) {
  const path = z
    .string()
    .parse(await featureRpc("bfe_prepare_listing_cover", { p_record: id }));
  const client = makeClient();
  if (!client) throw new Error("Sign in to upload.");
  const { error } = await client.storage
    .from("bfe-listing-covers")
    .upload(path, blob, { contentType: "image/webp", upsert: false });
  if (error) {
    // Show actionable categories without exposing raw server messages,
    // object paths, account data or request credentials.
    const status = String("statusCode" in error ? error.statusCode : ""),
      message = error.message.toLowerCase();
    const diagnostic = /new row violates row.level security policy/.test(
      message,
    )
      ? "Server detail: new row violates row-level security policy."
      : /permission denied for function [a-z_][a-z_0-9]*/.test(message)
        ? `Server detail: ${message.match(/permission denied for function [a-z_][a-z_0-9]*/)?.[0]}.`
        : /permission denied for (?:table|schema) [a-z_][a-z_0-9]*/.test(
              message,
            )
          ? `Server detail: ${message.match(/permission denied for (?:table|schema) [a-z_][a-z_0-9]*/)?.[0]}.`
          : /photo upload is no longer permitted/.test(message)
            ? "Server detail: the upload trigger refused this record."
            : /this module is hidden or view only/.test(message)
              ? "Server detail: the module write guard refused the record update."
              : "Server detail: unclassified Storage rejection; inspect the upload Response.";
    const reason =
      status === "409" || /already exists|duplicate/.test(message)
        ? "A file already exists for this saved cover. Open the saved announcement to check it before retrying."
        : status === "401" || /jwt|unauthorized|expired token/.test(message)
          ? "The upload session was refused. Sign in again, then open the saved announcement."
          : status === "403" ||
              /row.level security|not authorized|permission denied/.test(
                message,
              )
            ? "Storage refused the image upload. The system owner needs to check the cover policies and upload trigger."
            : /bucket.*not found|bucket.*does not exist/.test(message)
              ? "The private cover-image bucket is missing. Ask the system owner to check image storage setup."
              : status === "413" ||
                  /mime|file.*size|payload too large/.test(message)
                ? "Storage rejected the image type or size. The prepared cover must be WebP under 1 MB."
                : Number(status) >= 500
                  ? "The image storage service or database upload trigger failed. Check the failed Storage response before retrying."
                  : "Image upload was not confirmed. Check the failed Storage response or connection before retrying.";
    throw new Error(
      `${reason}${/^\d{3}$/.test(status) ? ` Storage status: ${status}.` : ""} ${diagnostic} The announcement text is saved; do not create another copy.`,
    );
  }
  return path;
}
export type PublicationLink = { label: string; url: string };
export function PublicationLinkFields({
  links,
  onChange,
  disabled = false,
}: {
  links: PublicationLink[];
  onChange: (links: PublicationLink[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className={styles.editor}>
      {links.map((link, i) => (
        <div className={styles.linkRow} key={i}>
          <label>
            Link label
            <input
              maxLength={40}
              value={link.label}
              disabled={disabled}
              onChange={(e) =>
                onChange(
                  links.map((v, n) =>
                    n === i ? { ...v, label: e.target.value } : v,
                  ),
                )
              }
            />
          </label>
          <label>
            HTTPS address
            <input
              type="url"
              maxLength={2000}
              value={link.url}
              disabled={disabled}
              onChange={(e) =>
                onChange(
                  links.map((v, n) =>
                    n === i ? { ...v, url: e.target.value } : v,
                  ),
                )
              }
            />
          </label>
          <Button
            type="button"
            secondary
            size="sm"
            disabled={disabled}
            onClick={() => onChange(links.filter((_, n) => n !== i))}
          >
            Remove link {i + 1}
          </Button>
        </div>
      ))}
      <Button
        type="button"
        secondary
        disabled={disabled || links.length >= 5}
        onClick={() =>
          onChange([...links, { label: "Website", url: "https://" }])
        }
      >
        Add link
      </Button>
    </div>
  );
}
export default function ListingMedia({
  id,
  editable = false,
  announcement = false,
  alt = "Listing cover",
  coverOnly = false,
  hideEmpty = false,
  preload = false,
  active = true,
}: {
  id: string;
  editable?: boolean;
  announcement?: boolean;
  alt?: string;
  coverOnly?: boolean;
  hideEmpty?: boolean;
  preload?: boolean;
  active?: boolean;
}) {
  const auth = useAuth(),
    cache = useQueryClient();
  const [editing, setEditing] = useState(false),
    [links, setLinks] = useState<{ label: string; url: string }[]>([]),
    [message, setMessage] = useState("");
  const query = useQuery<SignedAsset>({
    queryKey: ["listing-media", auth.userId, id],
    enabled: active,
    retry: false,
    // Retain Home covers for tab returns; expiresAt still gates every render.
    gcTime: announcement ? 300_000 : 0,
    // Reuse a signed cover inside its existing 60-second lifetime. Keep the
    // metadata authorization and signing together on every renewal.
    staleTime: (query) => {
      const asset = query.state.data;
      return asset?.url
        ? Math.max(
            0,
            Math.min(
              45000,
              asset.expiresAt - query.state.dataUpdatedAt - 15000,
            ),
          )
        : 45000;
    },
    refetchInterval: 45000,
    queryFn: async () => {
      const asset = assetSchema.parse(
        await featureRpc("bfe_listing_media", { p_record: id }),
      );
      if (!asset.cover_path) return { ...asset, url: null, expiresAt: 0 };
      // Preview metadata was authorized for the target by the audited gateway.
      // Only sign that returned cover path; the real developer login stays active.
      const client = auth.memberPreview ? makeRealClient() : makeClient();
      if (!client) throw new Error("Sign in to view listing photos.");
      const requestedAt = Date.now();
      const { data, error } = await client.storage
        .from("bfe-listing-covers")
        .createSignedUrl(asset.cover_path, 60);
      const expiresAt = requestedAt + 60000;
      // Home keeps its few slides mounted. Decode ahead of displaying each
      // signed image so switching slides cannot expose a partially loaded photo.
      if (preload && !error && data.signedUrl) {
        const image = new Image();
        image.src = data.signedUrl;
        await image.decode();
      }
      return { ...asset, url: error ? null : data.signedUrl, expiresAt };
    },
  });
  const mutation = useMutation({
    mutationFn: async (file: File | null | "remove") => {
      if (auth.memberPreview)
        throw new Error("Changes are disabled in account preview.");
      if (file === "remove")
        return featureRpc("bfe_remove_listing_cover", { p_record: id });
      if (file) {
        const blob = await listingCover(file);
        await uploadListingCover(id, blob);
      } else {
        await featureRpc("bfe_save_listing_links", {
          p_record: id,
          p_links: publicationLinksSchema.parse(links),
        });
      }
    },
    onSuccess: async () => {
      setEditing(false);
      setMessage(
        announcement
          ? "Image saved. Review is required before publication."
          : "Saved. Your photo and links need staff review before publication.",
      );
      await cache.invalidateQueries({ queryKey: ["listing-media"] });
      await cache.invalidateQueries({ queryKey: ["feature-records"] });
    },
  });
  if (!active) return null;
  if (query.isPending)
    if (coverOnly)
      return (
        <div
          className={styles.placeholder}
          role="img"
          aria-label="Loading photo"
        >
          <ImageIcon size={32} aria-hidden="true" />
        </div>
      );
    else
      return (
        <p className={styles.note}>
          {announcement ? "Loading image..." : "Loading photo and links…"}
        </p>
      );
  if (
    coverOnly &&
    announcement &&
    (query.isError || (!query.isPending && !query.data?.url))
  )
    return null;
  if (query.isError)
    return coverOnly ? (
      <div
        className={styles.placeholder}
        role="img"
        aria-label="Photo unavailable"
      >
        <ImageIcon size={32} aria-hidden="true" />
      </div>
    ) : (
      <Feedback error={query.error} />
    );
  if (coverOnly && hideEmpty && !query.data?.url) return null;
  if (coverOnly && !query.data?.url)
    return (
      <div
        className={styles.placeholder}
        role="img"
        aria-label={query.data?.cover_path ? "Photo unavailable" : "No photo"}
      >
        <ImageIcon size={32} aria-hidden="true" />
      </div>
    );
  if (announcement && !editable && !query.data?.cover_path) return null;
  return (
    <section
      className={styles.media}
      aria-label={
        announcement ? "Announcement image" : "Listing photo and links"
      }
    >
      {query.data?.url && (
        <SignedCoverImage
          className={coverOnly ? styles.cardCover : styles.cover}
          url={query.data.url}
          expiresAt={query.data.expiresAt}
          alt={alt}
          preload={preload}
        />
      )}
      {query.data?.cover_path && !query.data.url && (
        <p className={styles.note}>
          {editable
            ? "Cover upload has not completed or cannot be loaded. Refresh and check the photo before approval."
            : "Image unavailable. Try refreshing the page."}
        </p>
      )}
      {!coverOnly && (
        <div className={styles.links}>
          {query.data?.links.map(
            (link, i) =>
              /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}([/:?#][^\s<>]*)?$/i.test(
                link.url,
              ) && (
                <a
                  className="text-link"
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink size={18} />
                  {link.label}
                </a>
              ),
          )}
        </div>
      )}
      {editable && !auth.memberPreview && (
        <div className={styles.actions}>
          {query.data?.cover_path && (
            <Button
              secondary
              pending={mutation.isPending}
              onClick={() => mutation.mutate("remove")}
            >
              Remove cover photo
            </Button>
          )}
          {!query.data?.url && (
            <label className={styles.upload}>
              <ImagePlus size={20} />
              Add cover photo
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={mutation.isPending}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) mutation.mutate(file);
                  e.target.value = "";
                }}
              />
            </label>
          )}
          {!announcement && (
            <Button
              secondary
              disabled={mutation.isPending}
              onClick={() => {
                setLinks(query.data?.links ?? []);
                setEditing(!editing);
              }}
            >
              Edit publication links
            </Button>
          )}
          <p className={styles.note}>
            One cover photo. Only upload images you may share with members.
            {announcement
              ? "Text-only announcements are supported."
              : "Links and contact details are optional."}
          </p>
        </div>
      )}
      {editing && (
        <div className={styles.editor}>
          <PublicationLinkFields
            links={links}
            onChange={setLinks}
            disabled={mutation.isPending}
          />
          <div className={styles.actions}>
            <Button
              pending={mutation.isPending}
              onClick={() => mutation.mutate(null)}
            >
              Save links for review
            </Button>
            <Button secondary onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
          <p className={styles.note}>
            Saving links means you agree that staff may publish these specific
            contact links with your listing after review. No home address is
            added automatically.
          </p>
        </div>
      )}
      <Feedback error={mutation.error} message={message} />
    </section>
  );
}
