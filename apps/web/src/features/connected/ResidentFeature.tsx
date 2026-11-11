import LiveFeature from "./LiveFeature";

/**
 * A single request-and-approve workflow as a resident sees it: their own
 * submissions and the form to raise another. Review, approval and publication
 * remain office-only and are enforced by the server, not by this screen.
 */
export default function ResidentFeature({ module }: { module: string }) {
  return (
    <>
      <LiveFeature key={module} module={module} initialView="mine" resident />
    </>
  );
}
