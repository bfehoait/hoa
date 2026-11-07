import { baselineModule } from "../../../../../packages/shared/src/baseline";
import { PageIntro } from "../../components/UI";
import LiveFeature from "./LiveFeature";

/**
 * A single request-and-approve workflow as a resident sees it: their own
 * submissions and the form to raise another. Review, approval and publication
 * remain office-only and are enforced by the server, not by this screen.
 */
export default function ResidentFeature({ module }: { module: string }) {
  const definition = baselineModule(module);
  return (
    <>
      <PageIntro
        eyebrow="YOUR HOME"
        title={definition.title}
        description={definition.summary}
      />
      <LiveFeature key={module} module={module} initialView="mine" />
    </>
  );
}
