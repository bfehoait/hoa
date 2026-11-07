import { NavigationGroup, DetailDisclosure } from "../../components/Navigation";
import { useState, type FormEvent } from "react";
import { Link } from "../../components/AccessLink";
import {
  ArrowRight,
  ArrowLeft,
  MessageSquare,
  Plus,
  Search,
} from "lucide-react";
import { baselineModule } from "../../../../../packages/shared/src/baseline";
import {
  conversationModules,
  messageInputSchema,
  unreadMessages,
  type LocalActor,
} from "../../../../../packages/shared/src/integration";
import {
  useWorkspace,
  useWorkspaceAction,
  workspaceRepository,
} from "../../data/workspace";
import {
  Badge,
  Button,
  Empty,
  Feedback,
  Field,
  PageIntro,
  Skeleton,
} from "../../components/UI";
import { WorkspaceNote } from "../../components/WorkspaceUI";
import { StructuredForm } from "../baseline/FeatureBaseline";
import styles from "./Connected.module.css";

export default function Inbox({ actor }: { actor: LocalActor }) {
  const data = useWorkspace();
  const reply = useWorkspaceAction(workspaceRepository.message),
    mark = useWorkspaceAction(workspaceRepository.markRead);
  const [search, setSearch] = useState(""),
    [selected, setSelected] = useState<string | null>(null),
    [text, setText] = useState(""),
    [error, setError] = useState<Error | null>(null),
    [compose, setCompose] = useState(false),
    [kind, setKind] = useState("messages");
  if (data.isPending) return <Skeleton />;
  if (data.error)
    return (
      <>
        <PageIntro
          eyebrow="LOCAL CONVERSATIONS"
          title="Conversations unavailable"
        />
        <Feedback error={data.error} />
        <Link className="text-link" to="/developer">
          Open recovery tools <ArrowRight size={20} />
        </Link>
      </>
    );
  const threads = data.data.items.filter(
    (item) =>
      item.kind === "baseline" &&
      conversationModules.includes(item.metadata.module) &&
      `${item.title} ${item.detail}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const current = threads.find((item) => item.id === selected) ?? threads[0];
  const messages = data.data.messages.filter(
    (message) => message.threadId === current?.id,
  );
  const closed = current && ["Archived", "Cancelled"].includes(current.status);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!current) return;
    const value = messageInputSchema.safeParse({
      threadId: current.id,
      actor,
      text,
    });
    if (!value.success) {
      setError(
        new Error("Use 5–1,000 characters for a synthetic local reply."),
      );
      document.getElementById("local-reply")?.focus();
      return;
    }
    setError(null);
    try {
      await reply.mutateAsync(value.data);
      setText("");
    } catch {
      /* inline */
    }
  }
  return (
    <>
      {actor === "Resident" && (
        <Link className="text-link back-link" to="/services">
          <ArrowLeft size={20} />
          All services
        </Link>
      )}
      <PageIntro
        icon={<MessageSquare size={28} />}
        eyebrow={`${actor.toUpperCase()} CONVERSATIONS · SYNTHETIC`}
        title={actor === "Office" ? "Office inbox" : "Messages"}
        description="Sample conversations. Replies stay in this browser."
        action={
          <Button onClick={() => setCompose(true)}>
            <Plus size={20} />
            Prepare conversation
          </Button>
        }
      />
      <div className={styles.toolbar}>
        <div className="search">
          <Search size={20} />
          <input
            aria-label="Search local conversations"
            placeholder="Find a subject or concern…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          aria-label="New conversation category"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          {conversationModules.map((id) => (
            <option key={id} value={id}>
              {baselineModule(id).title}
            </option>
          ))}
        </select>
      </div>
      <div className="two-column">
        <section>
          <h2 style={{ marginBottom: 16 }}>
            Sample conversations ({threads.length})
          </h2>
          <div className={styles.list}>
            {threads.map((thread) => {
              const unread = unreadMessages(
                data.data.messages,
                data.data.readMarks,
                thread.id,
                actor,
              );
              return (
                <button
                  className={styles.row}
                  aria-pressed={thread.id === current?.id}
                  key={thread.id}
                  onClick={() => {
                    setSelected(thread.id);
                    setText("");
                    setError(null);
                    reply.reset();
                  }}
                >
                  <span className={styles.icon}>
                    <MessageSquare size={22} />
                  </span>
                  <div>
                    <strong>{thread.title}</strong>
                    <small>
                      {baselineModule(thread.metadata.module).title} ·{" "}
                      {thread.status}
                    </small>
                  </div>
                  {unread > 0 && (
                    <Badge tone="amber">{unread} local unread</Badge>
                  )}
                </button>
              );
            })}
          </div>
          {!threads.length && (
            <Empty title="No local conversations yet.">
              Prepare a sample thread or load the synthetic walkthrough from the
              directory.
            </Empty>
          )}
        </section>
        <section className="panel">
          {current ? (
            <>
              <div className="split-heading">
                <h2>{current.title}</h2>
                <Badge>{current.status}</Badge>
              </div>
              <p className="note">{current.detail}</p>
              <Button
                secondary
                pending={mark.isPending}
                onClick={() => mark.mutate({ threadId: current.id, actor })}
              >
                Mark local thread read
              </Button>
              <div className={styles.thread}>
                {messages.map((message) => (
                  <article
                    className={styles.bubble}
                    data-own={message.actor === actor}
                    key={message.id}
                  >
                    <strong>{message.actor} · sample</strong>
                    <small>
                      {new Date(message.at).toLocaleString("en-PH", {
                        timeZone: "Asia/Manila",
                      })}
                    </small>
                    <p>{message.text}</p>
                    <small>Local only · no external delivery</small>
                  </article>
                ))}
              </div>
              {!messages.length && (
                <p className="note">No local replies have been saved.</p>
              )}
              {closed ? (
                <p className="note">
                  This local thread is closed. Its history remains visible.
                </p>
              ) : (
                <form onSubmit={submit} noValidate>
                  <Field label="Synthetic local reply" error={error?.message}>
                    <textarea
                      id="local-reply"
                      maxLength={1000}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      aria-invalid={!!error}
                      aria-describedby={error ? "local-reply-error" : undefined}
                    />
                  </Field>
                  <Button type="submit" pending={reply.isPending}>
                    Save local reply
                  </Button>
                </form>
              )}
              <Feedback
                error={reply.error ?? mark.error}
                message={
                  reply.isSuccess
                    ? "Reply saved in this tab. No real message was delivered."
                    : mark.isSuccess
                      ? "Local read marker saved; no delivery receipt was sent."
                      : undefined
                }
              />
            </>
          ) : (
            <Empty title="Choose a sample conversation.">
              Local messages will appear here.
            </Empty>
          )}
        </section>
      </div>
      <DetailDisclosure title="Conversation tools">
        <NavigationGroup aria-label="Conversation workspace views">
          <Link to={actor === "Office" ? "/services/inbox" : "/office/inbox"}>
            Inspect {actor === "Office" ? "resident" : "office"} sample view
          </Link>
          <Link to="/office/review">Review linked records</Link>
        </NavigationGroup>
      </DetailDisclosure>
      <WorkspaceNote>
        Switching preview views does not authenticate a resident or staff
        member. Private participants, confidentiality, delivery, read receipts
        and protected attachments need server enforcement.
      </WorkspaceNote>
      {compose && (
        <StructuredForm
          definition={baselineModule(kind)}
          onClose={() => setCompose(false)}
        />
      )}
    </>
  );
}
