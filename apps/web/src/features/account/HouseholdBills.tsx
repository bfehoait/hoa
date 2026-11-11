export default function HouseholdBills({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <section aria-label="Bills and payments">
      {!compact && (
        <>
          <h1>Bills & payments</h1>
          <p>Your household charges and recorded payments.</p>
        </>
      )}
      <p role="status">
        <strong>Balance unavailable</strong> — approved bills have not been
        connected yet.
      </p>
      {!compact && (
        <dl className="detail-list">
          <div>
            <dt>HOA dues</dt>
            <dd>Not available yet</dd>
          </div>
          <div>
            <dt>Water dues</dt>
            <dd>Not available yet</dd>
          </div>
          <div>
            <dt>Amenity bookings & other charges</dt>
            <dd>Not available yet</dd>
          </div>
        </dl>
      )}
      <p className="note">
        An unavailable balance does not mean there is nothing to pay. Contact
        the office for an official bill. Any imported receipts below are payment
        records, not a current balance.
      </p>
    </section>
  );
}
