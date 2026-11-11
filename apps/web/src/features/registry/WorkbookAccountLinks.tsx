import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { workbookAccountMatchesSchema } from "../../../../../packages/shared/src/registry";
import { featureRpc } from "../../data/feature-records";
import { Button, Feedback, Modal } from "../../components/UI";
import { Link } from "../../components/AccessLink";
import styles from "./LotRegister.module.css";

// Metadata from the owner-supplied, locally validated workbook; no source rows.
const checksum =
  "4cbbf76d44cbbb6b89e6a48ddcd0533673320938415676bb40fb3f361bf5d49e";
const reasons: Record<string, string> = {
  exact_match: "Name and phase/block/lot match",
  inactive: "Inactive or missing account",
  not_homeowner: "Ownership needs separate review",
  duplicate_name: "Duplicate account name — review separately",
  missing_name: "No account name",
  unrecognized_address: "No recognized phase/block/lot",
  no_matching_lot: "No active lot found",
  different_workbook: "Lot belongs to a different import",
  owner_record_corrected: "Owner record has been corrected",
  name_mismatch: "Workbook owner name differs",
  self_review_required: "Another reviewer must link your account",
  existing_link_needs_review: "Existing relationship needs review",
};
export default function WorkbookAccountLinks({
  targets,
  onClose,
}: {
  targets: string[];
  onClose: () => void;
}) {
  const cache = useQueryClient();
  const [reference, setReference] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const check = useMutation({
    mutationFn: async () =>
      workbookAccountMatchesSchema.parse(
        await featureRpc("bfe_workbook_account_matches", {
          p_targets: targets,
          p_checksum: checksum,
        }),
      ),
    onSuccess: () => {
      setConfirmed(false);
      save.reset();
    },
  });
  const save = useMutation({
    mutationFn: async () =>
      z
        .object({ linked: z.number().int(), already_linked: z.number().int() })
        .parse(
          await featureRpc("bfe_link_workbook_accounts", {
            p_targets: targets,
            p_checksum: checksum,
            p_expected: check.data,
            p_reference: reference.trim(),
          }),
        ),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ["registry"] });
    },
  });
  const report = check.data;
  return (
    <Modal
      title="Match accounts to workbook lots"
      size="lg"
      busy={save.isPending || check.isPending}
      onClose={onClose}
    >
      <p>
        Check the {targets.length} accounts on this member page against BFE Lot
        Register v2. Only exact name and phase/block/lot matches are eligible.
        Historical receipt access remains a separate finance review.
      </p>
      <div className={styles.actions}>
        <Button
          secondary
          pending={check.isPending}
          disabled={save.isPending}
          onClick={() => check.mutate()}
        >
          Check workbook matches
        </Button>
      </div>
      <Feedback error={check.error ?? save.error} />
      {report && !report.workbook_installed && (
        <p role="alert">
          The exact assessed workbook is not installed as an active import. No
          links can be prepared from this file.
        </p>
      )}
      {report?.workbook_installed && (
        <>
          <p className="note">
            {report.ready} exact matches · {report.rows.length - report.ready}{" "}
            require separate review
          </p>
          <div className={styles.list}>
            {report.rows.map((row) => (
              <article className={styles.card} key={row.target_id}>
                <h3>{row.name || "Account without a name"}</h3>
                <p>{row.unit || "No recorded address"}</p>
                {row.match?.candidate && (
                  <p>
                    Lot {row.match.candidate.physical_id} · Recorded owner:{" "}
                    {row.match.candidate.recorded_homeowner || "Not recorded"}
                  </p>
                )}
                <p>{reasons[row.status] ?? "Separate review required"}</p>
                {row.match?.relationships.some(
                  (link) =>
                    link.relationship === "owner" && link.state === "approved",
                ) && (
                  <p className="note">
                    An owner link already exists; it will not be duplicated.
                  </p>
                )}
              </article>
            ))}
          </div>
          {!save.isSuccess && report.ready > 0 && (
            <form
              className={styles.form}
              onSubmit={(event) => {
                event.preventDefault();
                if (confirmed) save.mutate();
              }}
            >
              <label>
                Verification reference
                <input
                  required
                  minLength={3}
                  maxLength={100}
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  placeholder="Office review or verification reference"
                  disabled={save.isPending || check.isPending}
                />
              </label>
              <label
                style={{
                  display: "flex",
                  alignItems: "start",
                  minHeight: 48,
                  gap: 12,
                }}
              >
                <input
                  type="checkbox"
                  disabled={save.isPending || check.isPending}
                  required
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                  style={{ width: 24, minWidth: 24, minHeight: 24 }}
                />
                I reviewed the exact matches above and confirm their
                account-to-property ownership links.
              </label>
              <div className="form-actions">
                <Button
                  type="submit"
                  pending={save.isPending}
                  disabled={
                    check.isPending || !confirmed || reference.trim().length < 3
                  }
                >
                  Link {report.ready} verified matches
                </Button>
              </div>
            </form>
          )}
        </>
      )}
      {save.isSuccess && (
        <>
          <p role="status">
            {save.data.linked} linked · {save.data.already_linked} already
            linked. No receipt access was granted automatically.
          </p>
          <Link to="/office/lots" className="text-link">
            Review historical receipt access in the lot register
          </Link>
        </>
      )}
    </Modal>
  );
}
