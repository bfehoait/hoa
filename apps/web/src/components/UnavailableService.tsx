import { ArrowRight, Clock3 } from "lucide-react";
import { Link } from "./AccessLink";
import { PageIntro } from "./UI";

export default function UnavailableService({
  title,
  backHref,
}: {
  title: string;
  backHref?: string;
}) {
  return (
    <>
      <PageIntro eyebrow="COMMUNITY SERVICES" title={title} />
      <section className="panel" aria-labelledby="service-unavailable-title">
        <Clock3 size={28} aria-hidden="true" />
        <h2 id="service-unavailable-title">Not available yet</h2>
        <p>
          This service is not connected yet. No request, approval or account
          change can be made here. Contact the office through Helpdesk if you
          need assistance.
        </p>
        <div className="form-actions">
          {backHref ? (
            <a className="text-link" href={backHref}>
              Back to developer console <ArrowRight size={20} />
            </a>
          ) : (
            <>
              <Link className="text-link" to="/services/requests">
                Open Helpdesk <ArrowRight size={20} />
              </Link>
              <Link className="text-link" to="/workspaces">
                Back to my account <ArrowRight size={20} />
              </Link>
            </>
          )}
        </div>
      </section>
    </>
  );
}
