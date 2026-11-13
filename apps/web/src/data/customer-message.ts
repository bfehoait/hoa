// Keep implementation details out of customer feedback, including unexpected
// database errors and schema-validation payloads. Field guidance stays intact.
export function customerMessage(message: string) {
  if (/^(?:Too small:|Too big:|Invalid input: expected)/i.test(message))
    return "Please check the highlighted fields and try again.";
  if (/server detail:/i.test(message))
    return "The photo could not be uploaded. Your text was saved; open the saved item and try adding the photo again.";
  if (
    /supabase|\b(?:rpc|sql|pgrst\d*|backend|migration|stack trace|schema cache)\b|row.level security|permission denied for|upload trigger|system owner|(?:relation|column|function) .+ does not exist|"(?:expected|invalid_type|invalid_format)"|https?:\/\//i.test(
      message,
    )
  )
    return "This service is currently unavailable. Please try again or contact the HOA office for help.";
  return message;
}
