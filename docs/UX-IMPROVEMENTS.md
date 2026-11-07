# Customer-friendliness review — resident-facing UI

Written 7 November 2026, Asia/Manila. Evidence gathered by inspection of
`apps/web/src`; every count below came from a command, not an impression.

Scope: how the app feels to an ordinary resident. Ordered by benefit per unit of
work, not by severity. Items 1, 2 and 7 are the cheap ones with the largest effect.

`AGENTS.md` still governs: synthetic records stay labelled, no resident control may
confirm payments, grant roles or approve submissions, and preview is never described
as authentication.

---

## 1. Empty states are dead ends — 26 of 27

`<Empty>` appears 27 times. It accepts an `action` prop. **Exactly one call site
passes it**, and that one was added in the last pass.

So 26 times, a resident arrives somewhere, is told there is nothing, and is given no
way forward. This is the highest-value fix in the document and the cheapest: the
component already supports it.

Every empty state should answer *"then what?"*:

- No requests yet → **Make a request**
- No vehicles registered → **Register a vehicle**
- No documents → **Browse community documents**
- Nothing genuinely actionable → say when it will fill, not just that it is empty.

Rule to apply: an `<Empty>` without an `action` is only acceptable when the resident
truly cannot act, and then the body text must say who can.

## 2. A failed load looks exactly like "you have nothing"

Most of the app handles this correctly — 69 sites render `<Feedback error={…}>`.
But **22 sites collapse the error into an empty or zero value** instead:

```
query.isError ? 0 : (query.data?.unread ?? 0)
query.isError ? undefined : query.data
!data.isError && …
```

When the network fails, the resident sees "no notifications", "no requests", an
empty list. They have no way to tell a broken connection from an empty account, so
they never retry — they conclude the feature is empty and stop opening it.

Fix: these 22 sites get the same error treatment as the other 69, with a retry
control. `NotificationBell.tsx:10` matters most — a silent zero on a bell is how a
resident misses something that was actually waiting for them.

## 3. Mobile keyboards and autofill are mostly unset

95 `<input>` elements. `autoComplete` on **10**. `inputMode` on **3**.
`enterKeyHint` on **0**.

On a phone this is felt immediately: a numeric field opens the alphabetic keyboard,
a phone field will not autofill, and the enter key says "Go" when it should say
"Next" or "Send". Residents fill these forms on phones.

Pass over every form input and set:

- `type` + `inputMode` for phone, email, number and date fields
- `autoComplete` for name, phone, email, address and one-time codes
- `enterKeyHint` for the last field in each form

Low risk, no visual change, immediately noticeable.

## 4. Async results are silent for screen readers

191 `isLoading` / `isError` / `isPending` sites against `aria-live` in **2 files**.

Sighted users watch a skeleton resolve. Screen reader users get nothing — no "loading",
no "saved", no "could not save". The app has 34 `<Skeleton>` usages doing the visual
half of this job well; the announced half is missing.

Add a single polite live region per screen that announces the resolution of the
screen's primary query and the outcome of any submit. Same shape as the `<summary>`
fix: one convention, applied app-wide, rather than 191 individual decisions.

## 5. "Synthetic" appears 114 times in the interface

This labelling is required and must not be removed. But *how often* and *where* it
appears is a choice, and right now it repeats per item rather than per screen, which
makes the product read like a disclaimer with features attached.

Keep the guarantee, reduce the noise:

- One clear preview banner per screen, placed once, instead of a tag on every row.
- Keep per-item labelling only where a record could plausibly be mistaken for an
  official confirmation — receipts, payment status, approvals, election figures.
- Prefer plain phrasing: "Sample record — not an HOA confirmation" over repeated
  "synthetic" as an adjective on ordinary nouns.

Honesty is non-negotiable here; the repetition is not.

## 6. Make status legible before the resident opens anything

The More hub already does the hard parts well — search across title and detail, a
category filter, and permission-aware destination lists. What it does not do is
answer the question residents actually arrive with: *is there anything waiting for me?*

Add a count or state to destination cards where one exists — 2 open requests, 1 permit
awaiting documents, dues due in 5 days. A grid of equally weighted cards makes the
resident hunt. Counts turn the hub into a dashboard without adding a screen.

## 7. Microcopy rules worth adopting globally

- **Buttons name the outcome**, not the mechanism: "Send request", not "Submit".
- **Errors say what to do next.** "Could not load your requests. Check your connection
  and try again" beats an error code.
- **Confirmations state the consequence.** Only 6 destructive confirmations exist in
  the app; check that each names what will be lost rather than asking "Are you sure?"
- **Dates in full for residents.** "7 November" rather than "07/11", which is
  ambiguous across conventions.
- **Second person.** "Your lots", "Your requests" — already used in parts of the
  More hub; apply consistently.

## 8. `/explore` is 11,692px tall on mobile

Roughly 14 screens of continuous scroll, the longest surface in the app. It needs
sectioning or progressive disclosure, not more styling. Also carried over: it renders
two `role="status"` elements, which breaks assistive navigation and one e2e spec.

---

## Suggested order

| | Item | Effort | Felt by resident |
|---|---|---|---|
| 1 | Empty-state actions (26) | low | high |
| 2 | Error vs empty (22 sites) | low | high |
| 3 | Input attributes (95 inputs) | low | high on mobile |
| 4 | Live-region announcements | medium | high for assistive users |
| 5 | Preview-label density | low | medium |
| 6 | Status counts on hub cards | medium | high |
| 7 | Microcopy pass | medium | medium |
| 8 | `/explore` restructure | high | high on that screen |

Items 1–3 are a single focused session and would change the app's feel more than
any amount of visual refinement.

## Not assessed

Offline behaviour beyond the PWA shell, currency and date formatting consistency,
first-run onboarding, and real-data performance — every list inspected here was
synthetic and small. Authenticated-mode screens were not visually verified at all;
see `docs/NEXT-WORK-PLAN.md`, Priority 1.
