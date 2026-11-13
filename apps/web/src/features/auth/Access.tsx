import { lazy, useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Link } from "../../components/AccessLink";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";
import {
  newPasswordSchema,
  recoveryEmailSchema,
  signInSchema,
  safeReturnPath,
} from "../../../../../packages/shared/src/auth";
import { Button, Feedback, Field, formValues } from "../../components/UI";
import { useAuth } from "../../data/auth";
import { AuthFrame } from "./AuthFrame";
const PreviewAccess = lazy(() => import("./PreviewAccess"));
const Registration = lazy(() => import("./Registration"));
import styles from "./Access.module.css";

export default function Access() {
  const auth = useAuth();
  const location = useLocation();
  if (!auth.preview && location.pathname === "/register")
    return <Registration />;
  return auth.preview ? <PreviewAccess /> : <SignIn />;
}
function SignIn() {
  const auth = useAuth();
  const location = useLocation();
  const recovery = location.pathname === "/recover";
  const resetting = location.pathname === "/reset-password";
  const registering = location.pathname === "/register";
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  if (auth.recovering && !resetting)
    return <Navigate to="/reset-password" replace />;
  if (
    !recovery &&
    !resetting &&
    !registering &&
    auth.userId &&
    !auth.identityError &&
    !auth.memberPending &&
    !auth.checking
  )
    return (
      <Navigate
        to={
          auth.member
            ? safeReturnPath(
                new URLSearchParams(location.search).get("next"),
                auth.member,
              )
            : "/workspaces"
        }
        replace
      />
    );

  async function submit(event: FormEvent<HTMLFormElement>) {
    if (pending) {
      event.preventDefault();
      return;
    }
    const values = formValues(event);
    const schema = resetting
      ? newPasswordSchema
      : recovery
        ? recoveryEmailSchema
        : signInSchema;
    const result = schema.safeParse(values);
    if (!result.success) {
      const next: Record<string, string> = {};
      for (const issue of result.error.issues)
        next[String(issue.path[0])] = issue.message;
      setErrors(next);
      requestAnimationFrame(() =>
        document.getElementById(Object.keys(next)[0])?.focus(),
      );
      return;
    }
    setErrors({});
    setError(null);
    setPending(true);
    try {
      if (resetting) {
        await auth.updatePassword(String(values.password));
        await auth.signOut();
        setSent(true);
      } else if (recovery) {
        await auth.recover(String(values.email).trim());
        setSent(true);
      } else
        await auth.signIn(String(values.email).trim(), String(values.password));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause
          : new Error("We could not complete that request. Please try again."),
      );
    } finally {
      setPending(false);
    }
  }
  const attr = (id: string) => ({
    id,
    name: id,
    "aria-invalid": !!errors[id],
    "aria-describedby": errors[id] ? `${id}-error` : undefined,
  });
  return (
    <AuthFrame>
      {(recovery || resetting || registering) && (
        <Link className="text-link back-link" to="/sign-in">
          <ArrowLeft size={20} />
          Back to sign in
        </Link>
      )}
      <span className={styles.authIcon} aria-hidden="true">
        {recovery || resetting ? (
          <KeyRound size={28} />
        ) : (
          <LockKeyhole size={28} />
        )}
      </span>
      <h1>
        {registering
          ? "Need an account?"
          : resetting
            ? "Set a new password"
            : recovery
              ? "Forgot your password?"
              : "Welcome back"}
      </h1>
      <p className="muted">
        {registering
          ? "Account invitations and membership must be reviewed by the association office."
          : resetting
            ? "Choose a strong password for your account."
            : recovery
              ? "Enter your account email to request a recovery link."
              : "Sign in with your registered email and password."}
      </p>
      {!auth.configured && !registering && (
        <div className={styles.connectionNote} role="status">
          <ShieldCheck size={22} />
          <div>
            <strong>Sign-in is not connected yet</strong>
            <p>Your administrator needs to complete the connection settings.</p>
          </div>
        </div>
      )}
      {registering ? (
        <div className={styles.connectionNote}>
          <Mail size={24} />
          <p>
            Please contact the office to confirm your account access.
            Self-registration is not open.
          </p>
        </div>
      ) : sent ? (
        <>
          <Feedback
            message={
              resetting
                ? "Password updated. Please sign in with your new password."
                : "If your account is eligible, a recovery link will be sent. Check your inbox and spam folder."
            }
          />
          <Link className="text-link" to="/sign-in">
            Back to sign in
            <ArrowRight size={20} />
          </Link>
        </>
      ) : resetting && (!auth.userId || auth.checking) ? (
        <div className={styles.connectionNote}>
          <KeyRound size={24} />
          <div>
            <strong>
              {auth.checking
                ? "Checking your recovery link..."
                : "A valid recovery link is needed"}
            </strong>
            <p>Open the link from your recovery email, or request another.</p>
            <Link className="text-link" to="/recover">
              Request recovery
              <ArrowRight size={20} />
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className={styles.authForm}>
          {!resetting && (
            <Field label="Email address" error={errors.email}>
              <input
                {...attr("email")}
                type="email"
                autoComplete="username"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={254}
                disabled={!auth.configured || pending}
              />
            </Field>
          )}
          {!recovery && (
            <Field
              label={resetting ? "New password" : "Password"}
              htmlFor="password"
              error={errors.password}
            >
              <div className={styles.passwordField}>
                <input
                  {...attr("password")}
                  type={visible ? "text" : "password"}
                  autoComplete={resetting ? "new-password" : "current-password"}
                  maxLength={resetting ? 128 : 1024}
                  disabled={!auth.configured || pending}
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={visible ? "Hide password" : "Show password"}
                  aria-pressed={visible}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </Field>
          )}
          {resetting && (
            <Field label="Confirm new password" error={errors.confirmation}>
              <input
                {...attr("confirmation")}
                type={visible ? "text" : "password"}
                autoComplete="new-password"
                maxLength={128}
                disabled={pending}
              />
            </Field>
          )}
          {!recovery && !resetting && (
            <div className={styles.forgot}>
              <Link to="/recover">Forgot password?</Link>
            </div>
          )}
          <Feedback error={error} />
          {auth.identityError && !error && (
            <Feedback
              error={
                new Error(
                  "We could not verify your saved session. Check your connection and retry verification.",
                )
              }
            />
          )}
          {auth.identityError && (
            <Button secondary type="button" onClick={auth.retry}>
              Retry verification
            </Button>
          )}
          <Button
            type="submit"
            pending={pending || (!recovery && auth.checking)}
            disabled={!auth.configured}
            className={styles.submit}
          >
            {resetting
              ? "Update password"
              : recovery
                ? "Send recovery link"
                : "Sign in"}
            <ArrowRight size={20} />
          </Button>
        </form>
      )}
      {!recovery && !resetting && !registering && (
        <div className={styles.links}>
          <Link to="/register">Need account access?</Link>
        </div>
      )}
      <p className={styles.authFootnote}>
        <ShieldCheck size={18} />
        {recovery || resetting
          ? "Use the recovery link sent to your email to reset your password."
          : "Access follows your active member record."}
      </p>
    </AuthFrame>
  );
}
