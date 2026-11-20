import { useState } from "react";
import { requestTopics } from "../../../../../packages/shared/src/request-topics";
import {
  requestCategoryLabel,
  type requestCategories,
} from "../../../../../packages/shared/src/requests";
import { Field } from "../../components/UI";

/** Splits "Group: Specific" into a listed type and specific type for the
 *  category, or returns null when it isn't one of the listed choices. */
export function listedTopic(category: string, topic: string | null) {
  const choices =
    requestTopics[category as (typeof requestCategories)[number]] ?? {};
  const at = topic?.indexOf(": ") ?? -1;
  if (!topic || at < 0) return null;
  const group = topic.slice(0, at),
    specific = topic.slice(at + 2);
  return choices[group]?.includes(specific) ? { group, specific } : null;
}

export default function RequestTopicFields({
  category,
  disabled,
  error,
  onChange,
  initial,
}: {
  category: string;
  disabled: boolean;
  error?: string;
  onChange: (value: string) => void;
  /** A listed type to start with, for example from a link that pre-fills it. */
  initial?: { group: string; specific: string } | null;
}) {
  const choices =
    requestTopics[category as (typeof requestCategories)[number]] ?? {};
  const [group, setGroup] = useState(initial?.group ?? "");
  const [specific, setSpecific] = useState(initial?.specific ?? "");
  const [other, setOther] = useState("");
  const emit = (g: string, s: string, o: string) =>
    onChange(
      !g || (g !== "Other" && !s)
        ? ""
        : g === "Other"
          ? o.trim()
            ? `Other: ${o.trim()}`
            : ""
          : s === "Other"
            ? o.trim()
              ? `${g}: ${o.trim()}`
              : ""
            : `${g}: ${s}`,
    );
  return (
    <>
      <Field label={`${requestCategoryLabel(category)} type`} error={error}>
        <select
          id="request-topic-type"
          value={group}
          required
          disabled={disabled}
          onChange={(event) => {
            const value = event.target.value;
            setGroup(value);
            setSpecific("");
            setOther("");
            emit(value, "", "");
          }}
        >
          <option value="">Choose a type</option>
          {Object.keys(choices).map((name) => (
            <option key={name}>{name}</option>
          ))}
          <option>Other</option>
        </select>
      </Field>
      {group && group !== "Other" && (
        <Field label="Specific type">
          <select
            value={specific}
            required
            disabled={disabled}
            onChange={(event) => {
              const value = event.target.value;
              setSpecific(value);
              setOther("");
              emit(group, value, "");
            }}
          >
            <option value="">Choose a specific type</option>
            {(choices[group] ?? []).map((name) => (
              <option key={name}>{name}</option>
            ))}
            <option>Other</option>
          </select>
        </Field>
      )}
      {(group === "Other" || specific === "Other") && (
        <Field label="Describe the other type">
          <input
            value={other}
            required
            maxLength={60}
            disabled={disabled}
            onChange={(event) => {
              setOther(event.target.value);
              emit(group, specific, event.target.value);
            }}
          />
        </Field>
      )}
    </>
  );
}
