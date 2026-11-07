import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  baselineModule,
  fieldVisible,
} from "../../../../../packages/shared/src/baseline";
import {
  featureFieldHint,
  featureInputSchema,
  liveFieldLabel,
  publicationLinksSchema,
  type FeatureRecord,
} from "../../../../../packages/shared/src/feature-records";
import { featureRpc } from "../../data/feature-records";
import { Button, Feedback } from "../../components/UI";
import ListingMedia, {
  listingCover,
  listingModules,
  PublicationLinkFields,
  uploadListingCover,
  type PublicationLink,
} from "./ListingMedia";
import ItemRows from "./ItemRows";
import styles from "./LiveFeature.module.css";

/** Fields the server stores as newline-separated text but a person enters as a
 *  list. Only the entry changes; the stored value and its validation do not. */
const LIST_FIELDS = ["items", "drivers", "positions"];

type Payload = {
  title: string;
  detail: string;
  fields: Record<string, string>;
  consent: boolean;
  links: PublicationLink[];
  cover: Blob | null;
};
export default function FeatureSubmissionForm({
  module,
  editing,
  clientId,
  publishable,
  onSaved,
  onBusyChange,
  onRecordSaved,
}: {
  module: string;
  editing: FeatureRecord | null;
  clientId: string;
  publishable: boolean;
  onSaved: (message: string) => void;
  onBusyChange: (busy: boolean) => void;
  onRecordSaved: () => void;
}) {
  const definition = baselineModule(module),
    cache = useQueryClient(),
    prefix = useId();
  const media = listingModules.includes(module);
  // Fields can depend on an earlier answer (see BaselineField.showWhen), so the
  // selects those fields depend on are controlled; everything else stays
  // uncontrolled and is read from FormData on submit.
  const drivers = useMemo(
    () =>
      Array.from(
        new Set(
          definition.fields
            .map((f) => f.showWhen?.key)
            .filter((key): key is string => !!key),
        ),
      ),
    [definition],
  );
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      drivers.map((key) => [key, editing?.fields?.[key] ?? ""]),
    ),
  );
  const shownFields = definition.fields.filter((f) => fieldVisible(f, answers));
  const [links, setLinks] = useState<PublicationLink[]>([]),
    [cover, setCover] = useState<Blob | null>(null),
    [photoName, setPhotoName] = useState("");
  const [preview, setPreview] = useState<string | null>(null),
    [preparing, setPreparing] = useState(false),
    [validation, setValidation] = useState<Error | null>(null);
  const [recordSaved, setRecordSaved] = useState(false);
  const saved = useRef<{
    id: string;
    linksDone: boolean;
    coverDone: boolean;
    removed: boolean;
  } | null>(null);
  const payload = useRef<Payload | null>(null);
  const previewUrl = useRef<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    };
  }, []);
  function clearCover() {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = null;
    setPreview(null);
    setCover(null);
    setPhotoName("");
  }
  const mutation = useMutation({
    mutationFn: async (input: Payload) => {
      if (!saved.current) {
        const result = await featureRpc(
          editing ? "bfe_revise_listing" : "bfe_submit_feature",
          {
            ...(editing
              ? { p_id: editing.id, p_version: editing.version }
              : { p_client: clientId, p_module: module }),
            p_title: input.title,
            p_detail: input.detail,
            p_fields: input.fields,
            p_consent: input.consent,
          },
        );
        saved.current = {
          id: editing?.id ?? z.uuid().parse(result),
          linksDone: false,
          coverDone: false,
          removed: false,
        };
        setRecordSaved(true);
        onRecordSaved();
      }
      const stage = saved.current;
      if (input.links.length && !stage.linksDone) {
        await featureRpc("bfe_save_listing_links", {
          p_record: stage.id,
          p_links: input.links,
        });
        stage.linksDone = true;
      }
      if (input.cover && !stage.coverDone) {
        if (editing && !stage.removed) {
          await featureRpc("bfe_remove_listing_cover", { p_record: stage.id });
          stage.removed = true;
        }
        await uploadListingCover(stage.id, input.cover);
        stage.coverDone = true;
      }
    },
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ["feature-records"] });
      await cache.invalidateQueries({ queryKey: ["listing-media"] });
      onSaved("Submission saved by the server. Review is pending.");
    },
  });
  const busy = preparing || mutation.isPending;
  useEffect(() => {
    onBusyChange(busy);
  }, [busy, onBusyChange]);
  useEffect(() => () => onBusyChange(false), [onBusyChange]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (saved.current && payload.current) {
      mutation.mutate(payload.current);
      return;
    }
    const values = new FormData(event.currentTarget);
    const parsed = featureInputSchema(module).safeParse({
      title: values.get("recordTitle"),
      detail: values.get("recordDetail"),
      fields: Object.fromEntries(
        definition.fields.map((f) => [
          f.key,
          shownFields.includes(f) ? String(values.get(f.key) ?? "").trim() : "",
        ]),
      ),
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const key =
        issue.path[0] === "fields"
          ? String(issue.path[1])
          : issue.path[0] === "title"
            ? "recordTitle"
            : "recordDetail";
      setValidation(new Error(issue.message));
      event.currentTarget
        .querySelector<HTMLElement>(`[name="${CSS.escape(key)}"]`)
        ?.focus();
      return;
    }
    const parsedLinks = publicationLinksSchema.safeParse(links);
    if (!parsedLinks.success) {
      setValidation(new Error(parsedLinks.error.issues[0].message));
      return;
    }
    const consent = values.get("consent") === "on";
    if ((cover || links.length) && !consent) {
      setValidation(
        new Error(
          "Choose publication consent before attaching a photo or public contact links.",
        ),
      );
      event.currentTarget
        .querySelector<HTMLElement>('[name="consent"]')
        ?.focus();
      return;
    }
    setValidation(null);
    payload.current = {
      ...parsed.data,
      consent,
      links: parsedLinks.data,
      cover,
    };
    mutation.mutate(payload.current);
  }
  return (
    <form className={styles.form} onSubmit={submit}>
      <p className={styles.formHelp}>
        Required fields are marked. Submitting does not publish or approve this
        record.
      </p>
      {recordSaved && (
        <p className={styles.notice} role="status">
          Your submission is saved. Photo or link changes are not yet fully
          confirmed. Retry below, or open the saved submission to check them.
          Retrying does not create another submission.
        </p>
      )}
      <fieldset className={styles.formFields} disabled={busy || recordSaved}>
        <label>
          Title{" "}
          <span className={styles.fieldTag} aria-hidden="true">
            Required
          </span>
          <input
            aria-label="Title"
            name="recordTitle"
            defaultValue={editing?.title}
            required
            minLength={3}
            maxLength={120}
          />
        </label>
        <label>
          Details{" "}
          <span className={styles.fieldTag} aria-hidden="true">
            Required
          </span>
          <textarea
            aria-label="Details"
            name="recordDetail"
            defaultValue={editing?.detail}
            required
            minLength={10}
            maxLength={5000}
          />
        </label>
        {shownFields.some((f) => f.type === "time" || f.type === "date") && (
          <p className={styles.formHelp}>
            Dates and times use Philippine time.
          </p>
        )}
        {shownFields.map((f) => {
          const label = liveFieldLabel(f.label),
            hint = featureFieldHint(module, f.key),
            id = prefix + f.key;
          const options =
            f.key === "assignedTo"
              ? f.options?.filter((option) => !option.startsWith("Demo staff"))
              : f.options;
          const drives = drivers.includes(f.key);
          const because = f.showWhen
            ? liveFieldLabel(
                definition.fields.find((d) => d.key === f.showWhen?.key)
                  ?.label ?? f.showWhen.key,
              )
            : "";
          return (
            <div key={f.key} className={styles.fieldGroup}>
              <label htmlFor={id}>
                {label}
                <span className={styles.fieldTag} aria-hidden="true">
                  {f.required ? "Required" : "Optional"}
                </span>
              </label>
              {options ? (
                <select
                  id={id}
                  name={f.key}
                  aria-label={label}
                  aria-describedby={
                    [hint ? id + "-hint" : "", drives ? id + "-drives" : ""]
                      .filter(Boolean)
                      .join(" ") || undefined
                  }
                  required={f.required}
                  {...(drives
                    ? {
                        value: answers[f.key] ?? "",
                        onChange: (event: ChangeEvent<HTMLSelectElement>) =>
                          setAnswers((prev) => ({
                            ...prev,
                            [f.key]: event.target.value,
                          })),
                      }
                    : { defaultValue: editing?.fields?.[f.key] ?? "" })}
                >
                  <option value="">Choose</option>
                  {options.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              ) : LIST_FIELDS.includes(f.key) ? (
                <ItemRows
                  id={id}
                  name={f.key}
                  label={label}
                  required={f.required}
                  defaultValue={editing?.fields?.[f.key] ?? ""}
                  placeholder={
                    f.key === "items" ? "Item and quantity" : undefined
                  }
                />
              ) : f.type === "textarea" ? (
                <textarea
                  id={id}
                  name={f.key}
                  aria-label={label}
                  aria-describedby={hint ? id + "-hint" : undefined}
                  defaultValue={editing?.fields?.[f.key]}
                  required={f.required}
                  maxLength={2000}
                />
              ) : (
                <input
                  id={id}
                  name={f.key}
                  aria-label={label}
                  aria-describedby={hint ? id + "-hint" : undefined}
                  defaultValue={editing?.fields?.[f.key]}
                  type={f.type ?? "text"}
                  required={f.required}
                  min={f.min}
                  max={f.max}
                  step={
                    f.type === "number"
                      ? ["capacity", "places", "passengers", "seats"].includes(
                          f.key,
                        )
                        ? "1"
                        : "0.01"
                      : undefined
                  }
                  maxLength={2000}
                />
              )}
              {hint && (
                <p id={id + "-hint"} className={styles.formHelp}>
                  {hint}
                </p>
              )}
              {f.showWhen && (
                <p className={styles.formHelp}>
                  Asked because “{because}” is “{answers[f.showWhen.key]}”.
                </p>
              )}
              {drives && (
                <p id={id + "-drives"} className={styles.formHelp}>
                  Your choice here decides which questions follow.
                </p>
              )}
            </div>
          );
        })}
        {media && (
          <section
            className={styles.mediaComposer}
            aria-label="Photo and publication links"
          >
            <h4>Photo & publication links</h4>
            <p className={styles.formHelp}>
              Optional. One cover photo and up to five HTTPS links. They stay
              private until staff review and publication. Only upload an image
              you may share.
            </p>
            {editing && (
              <>
                <ListingMedia id={editing.id} />
                <p className={styles.formHelp}>
                  A new photo replaces the current cover after saving. Adding
                  links below replaces the saved link list; leaving them empty
                  keeps existing links.
                </p>
              </>
            )}
            <label>
              Cover photo
              <input
                type="file"
                aria-label="Cover photo"
                accept="image/jpeg,image/png,image/webp"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  setPreparing(true);
                  setValidation(null);
                  clearCover();
                  try {
                    const blob = await listingCover(file);
                    if (!mounted.current) return;
                    previewUrl.current = URL.createObjectURL(blob);
                    setPreview(previewUrl.current);
                    setCover(blob);
                    setPhotoName(file.name);
                  } catch (error) {
                    setValidation(
                      error instanceof Error
                        ? error
                        : new Error("Choose another photo."),
                    );
                  } finally {
                    if (mounted.current) setPreparing(false);
                  }
                }}
              />
            </label>
            <p className={styles.formHelp}>
              JPEG, PNG or WebP up to 8 MB. The photo is resized and prepared as
              a private WebP cover under 1 MB.
            </p>
            {preparing && <p role="status">Preparing photo…</p>}
            {preview && (
              <>
                <img
                  src={preview}
                  className={styles.photoPreview}
                  alt="Selected cover preview"
                />
                <p className={styles.formHelp}>
                  {photoName} · Ready to attach when submitted
                </p>
                <Button type="button" secondary onClick={clearCover}>
                  Remove selected photo
                </Button>
              </>
            )}
            <PublicationLinkFields
              links={links}
              onChange={setLinks}
              disabled={busy || recordSaved}
            />
          </section>
        )}
        {publishable && (
          <label className={styles.check}>
            <input
              type="checkbox"
              name="consent"
              defaultChecked={editing?.publication_consent}
            />
            I allow reviewed public text
            {media ? ", the selected photo and these specific links" : ""} to be
            published to the selected community audience. Private submitted
            fields stay restricted.
          </label>
        )}
      </fieldset>
      <Feedback error={validation ?? mutation.error} />
      <div className="form-actions">
        <Button type="submit" pending={mutation.isPending} disabled={preparing}>
          {recordSaved ? "Retry photo and links" : "Submit for review"}
        </Button>
        {recordSaved && (
          <Button
            type="button"
            secondary
            disabled={busy}
            onClick={async () => {
              await cache.invalidateQueries({ queryKey: ["feature-records"] });
              await cache.invalidateQueries({ queryKey: ["listing-media"] });
              onSaved(
                "Submission saved. Check the photo and links in My submissions; they may still need attention before review.",
              );
            }}
          >
            Open saved submission
          </Button>
        )}
      </div>
    </form>
  );
}
