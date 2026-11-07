import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "../../components/AccessLink";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../data/auth";
import { Button, Feedback } from "../../components/UI";
import { AuthFrame } from "./AuthFrame";
export default function Exit() {
  const auth = useAuth();
  return auth.preview ? <PreviewExit /> : <SignOut />;
}
function SignOut() {
  const auth = useAuth();
  const navigate = useNavigate();
  const started = useRef(false);
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);
  const signOut = useRef(auth.signOut);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void signOut
      .current()
      .then(() => navigate("/sign-in", { replace: true }))
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause
            : new Error("Sign-out failed. Please retry."),
        ),
      );
  }, [navigate, attempt]);
  return (
    <AuthFrame>
      <h1>Signing out</h1>
      {error ? (
        <>
          <Feedback error={error} />
          <Button
            onClick={() => {
              started.current = false;
              setError(null);
              setAttempt((value) => value + 1);
            }}
          >
            Retry sign out
          </Button>
        </>
      ) : (
        <p role="status">Closing your session...</p>
      )}
      <Link className="text-link" to="/sign-in">
        Back to sign in
      </Link>
    </AuthFrame>
  );
}
function PreviewExit() {
  const navigate = useNavigate();
  const client = useQueryClient();
  useEffect(() => {
    client.clear();
    try {
      sessionStorage.removeItem("bellefort-preview-entry");
    } catch {
      /* No real authentication session exists. */
    }
    navigate("/sign-in?closed=1", { replace: true });
  }, [client, navigate]);
  return (
    <main className="fatal" role="status">
      Closing the local preview…
    </main>
  );
}
