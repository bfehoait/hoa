import {
  amenityKey,
  amenityGuidelines,
  amenityGuidelineDate,
  generalAmenityRestrictions,
} from "../../../../../packages/shared/src/amenity-guidelines";

export default function AmenityGuidelines({ name }: { name: string }) {
  const key = amenityKey(name);
  if (!key) return null;
  const guide = amenityGuidelines[key];
  return (
    <details>
      <summary>{guide.name} hours, rates & rules</summary>
      <p>
        Guideline dated {amenityGuidelineDate}. Office confirms availability and
        charges; this is not a payment confirmation.
      </p>
      <p>{guide.hours}</p>
      <p>{guide.capacity}</p>
      <ul>
        {guide.rates.map((rate) => (
          <li key={rate}>{rate}</li>
        ))}
      </ul>
      <ul>
        {guide.restrictions.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>
      <details>
        <summary>Rules for all amenities</summary>
        <ul>
          {generalAmenityRestrictions.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </details>
    </details>
  );
}
