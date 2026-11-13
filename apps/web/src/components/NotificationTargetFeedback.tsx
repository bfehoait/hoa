import { Button, Feedback } from "./UI";

export default function NotificationTargetFeedback({
  target,
}: {
  target: {
    requested: boolean;
    unavailable: boolean;
    isError: boolean;
    isPending: boolean;
    clear: () => void;
    refetch: () => unknown;
  };
}) {
  if (!target.requested) return null;
  if (target.isError || target.unavailable)
    return (
      <div>
        <Feedback
          error={
            new Error(
              target.isError
                ? "We couldn’t open this item. Try again or contact the HOA office."
                : "This item is no longer available, or your account cannot view it.",
            )
          }
        />
        {target.isError && (
          <Button
            secondary
            onClick={() => {
              void target.refetch();
            }}
          >
            Try again
          </Button>
        )}
        <Button secondary onClick={target.clear}>
          Show all records
        </Button>
      </div>
    );
  return target.isPending ? <p role="status">Opening your update…</p> : null;
}
