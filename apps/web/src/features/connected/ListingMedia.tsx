import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { ImagePlus, ExternalLink } from "lucide-react";
import { useAuth, makeClient, makeRealClient } from "../../data/auth";
import { featureRpc } from "../../data/feature-records";
import { Button, Feedback } from "../../components/UI";
import { publicationLinksSchema } from "../../../../../packages/shared/src/feature-records";
import styles from "./ListingMedia.module.css";
const assetSchema = z.object({
  cover_path: z.string().nullable(),
  links: z.array(z.object({ label: z.string(), url: z.string() })),
});
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
  if (error)
    throw new Error(
      "Photo upload could not be confirmed. The submission is saved. Retry, or open your saved submission to check the cover before making further changes.",
    );
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
}: {
  id: string;
  editable?: boolean;
}) {
  const auth = useAuth(),
    cache = useQueryClient();
  const [editing, setEditing] = useState(false),
    [links, setLinks] = useState<{ label: string; url: string }[]>([]),
    [message, setMessage] = useState("");
  const query = useQuery({
    queryKey: ["listing-media", auth.userId, id],
    retry: false,
    gcTime: 0,
    refetchInterval: 45000,
    queryFn: async () => {
      const asset = assetSchema.parse(
        await featureRpc("bfe_listing_media", { p_record: id }),
      );
      if (!asset.cover_path) return { ...asset, url: null };
      // Preview metadata was authorized for the target by the audited gateway.
      // Only sign that returned cover path; the real developer login stays active.
      const client = auth.memberPreview ? makeRealClient() : makeClient();
      if (!client) throw new Error("Sign in to view listing photos.");
      const { data, error } = await client.storage
        .from("bfe-listing-covers")
        .createSignedUrl(asset.cover_path, 60);
      return { ...asset, url: error ? null : data.signedUrl };
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
        "Saved. Your photo and links need staff review before publication.",
      );
      await cache.invalidateQueries({ queryKey: ["listing-media"] });
      await cache.invalidateQueries({ queryKey: ["feature-records"] });
    },
  });
  if (query.isPending)
    return <p className={styles.note}>Loading photo and links…</p>;
  if (query.isError) return <Feedback error={query.error} />;
  return (
    <section className={styles.media} aria-label="Listing photo and links">
      {query.data?.url && (
        <img
          className={styles.cover}
          src={query.data.url}
          alt="Listing cover"
          loading="lazy"
        />
      )}
      {query.data?.cover_path && !query.data.url && (
        <p className={styles.note}>
          Cover upload has not completed or cannot be loaded. Refresh and check
          the photo before approval.
        </p>
      )}
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
          <p className={styles.note}>
            One cover photo. Only upload images you may share with members.
            Links and contact details are optional.
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
