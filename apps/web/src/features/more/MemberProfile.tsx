import { Link } from "../../components/AccessLink";
import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  KeyRound,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Users,
  Pencil,
  Download,
  Bell,
} from "lucide-react";
import {
  memberRoles,
  memberWorkspaces,
} from "../../../../../packages/shared/src/auth";
import { useAuth } from "../../data/auth";
import { Badge, Button, ButtonLink, Feedback, Field, Modal, PageIntro } from "../../components/UI";
import { useOwnProfile, useAccountActions } from "../../data/accounts";
import { useInstall } from "../../data/install";
import {
  profilePreferencesSchema,
  type ProfilePreferences,
} from "../../../../../packages/shared/src/accounts";
import styles from "./More.module.css";

export default function MemberProfile() {
  const auth = useAuth();
  const preferences = useOwnProfile();
  const install = useInstall();
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  const member = auth.member;
  if (!member) return null;
  const name =
    (!preferences.isError && preferences.data?.display_name) ||
    member.name ||
    "Member";
  return (
    <>
      <Link className="text-link back-link" to="/workspaces">
        <ArrowLeft size={20} />
        Back to home
      </Link>
      <PageIntro
        eyebrow={auth.rolePreview ? "SYNTHETIC ROLE PREVIEW" : "YOUR ACCOUNT"}
        title="My profile"
        icon={<Users size={28} />}
        description={
          auth.rolePreview
            ? "Invented details for the selected role."
            : "Your account details and assigned access."
        }
        action={
          !auth.rolePreview && (
            <Button
              secondary
              disabled={!preferences.data || preferences.isError}
              onClick={(event) => {
                event.currentTarget.focus();
                setEditing(true);
              }}
            >
              <Pencil size={18} />
              Edit profile
            </Button>
          )
        }
      />
      <section className={styles.profileHero}>
        <span className={styles.profileAvatar} aria-hidden="true">
          {name
            .split(/\s+/)
            .map((word) => word[0])
            .slice(0, 2)
            .join("")}
        </span>
        <div>
          <h2>{name}</h2>
          <p>{member.title || "Association member"}</p>
          {preferences.data?.bio && <p>{preferences.data.bio}</p>}
          <div className={styles.profileRoles}>
            {memberRoles(member).map((role) => (
              <Badge key={role}>{role}</Badge>
            ))}
          </div>
        </div>
      </section>
      <Feedback message={notice} />
      {!auth.rolePreview && preferences.isError && (
        <Feedback error={preferences.error} />
      )}
      <div className="two-column">
        <section className={`panel ${styles.profileDetails}`}>
          <div className="section-title">
            <h2>Member details</h2>
            <ShieldCheck size={24} />
          </div>
          <dl className="detail-list">
            <div>
              <dt>Registered member name</dt>
              <dd>{member.name || "Not supplied"}</dd>
            </div>
            <div>
              <dt>Sign-in email</dt>
              <dd>
                {auth.accountEmail ||
                  (auth.rolePreview ? "Hidden in role preview" : "Unavailable")}
              </dd>
            </div>
            <div>
              <dt>Mobile number</dt>
              <dd>
                {(!preferences.isError && preferences.data?.phone) ||
                  member.phone ||
                  "Not supplied"}
              </dd>
            </div>
            <div>
              <dt>Recorded unit</dt>
              <dd>{member.unit || "Not assigned"}</dd>
            </div>
            <div>
              <dt>Member status</dt>
              <dd>
                <Badge tone="green">{member.status}</Badge>
              </dd>
            </div>
          </dl>
          <p className="note">
            Display name and profile contact are your preferences. Your official
            member name, login email, roles and property assignments are managed
            separately.
          </p>
        </section>
        <section className="panel">
          <h2>Your access</h2>
          <div className={styles.profileWorkspaceList}>
            {memberWorkspaces(member).map((workspace) => (
              <Link
                key={workspace.id}
                className="text-link"
                to={workspace.path}
              >
                <ShieldCheck size={20} />
                {workspace.title}
              </Link>
            ))}
          </div>
          {!auth.rolePreview && (
            <div className={styles.profileActions}>
              <Button secondary onClick={auth.retry}>
                <RefreshCw size={20} />
                Refresh profile
              </Button>
              <ButtonLink to="/recover">
                <KeyRound size={20} />
                Reset password
              </ButtonLink>
              <ButtonLink tone="danger" to="/sign-out">
                <LogOut size={20} />
                Sign out
              </ButtonLink>
              <Link className="text-link" to="/more/notifications">
                <Bell size={20} />
                Notifications
              </Link>
              <Button
                secondary
                disabled={install.installed}
                onClick={install.open}
              >
                <Download size={20} />
                {install.installed
                  ? "App installed"
                  : "Add Bellefort to this device"}
              </Button>
            </div>
          )}
          {auth.rolePreview && (
            <p className="note">
              Account changes and real contact details are unavailable in role
              preview.
            </p>
          )}
        </section>
      </div>
      {editing && preferences.data && !auth.rolePreview && (
        <ProfileEditor
          initial={preferences.data}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setNotice("Your profile was saved.");
          }}
        />
      )}
    </>
  );
}

function ProfileEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: ProfilePreferences;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<ProfilePreferences>({ ...initial });
  const [error, setError] = useState<Error | null>(null);
  const actions = useAccountActions();
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = profilePreferencesSchema.safeParse(draft);
    if (!parsed.success) {
      setError(new Error(parsed.error.issues[0].message));
      return;
    }
    try {
      await actions.saveProfile.mutateAsync(parsed.data);
      onSaved();
    } catch {
      /* Keep entered fields for retry. */
    }
  }
  return (
    <Modal
      busy={actions.saveProfile.isPending}
      title="Edit your profile"
      description="Your login identity and assigned access stay separate."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <Field label="Display name">
          <input
            id="profile-display-name"
            disabled={actions.saveProfile.isPending}
            value={draft.display_name}
            maxLength={80}
            autoComplete="nickname"
            onChange={(event) =>
              setDraft({ ...draft, display_name: event.target.value })
            }
          />
        </Field>
        <Field label="Profile contact number">
          <input
            id="profile-contact"
            disabled={actions.saveProfile.isPending}
            value={draft.phone}
            type="tel"
            maxLength={30}
            autoComplete="tel"
            onChange={(event) =>
              setDraft({ ...draft, phone: event.target.value })
            }
          />
        </Field>
        <Field label="About you">
          <textarea
            id="profile-bio"
            disabled={actions.saveProfile.isPending}
            value={draft.bio}
            maxLength={240}
            onChange={(event) =>
              setDraft({ ...draft, bio: event.target.value })
            }
          />
        </Field>
        <Feedback error={error ?? actions.saveProfile.error} />
        <div className="form-actions">
          <Button type="submit" pending={actions.saveProfile.isPending}>
            Save profile
          </Button>
          <Button
            secondary
            type="button"
            disabled={actions.saveProfile.isPending}
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
