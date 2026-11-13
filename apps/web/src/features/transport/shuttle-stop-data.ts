// Stop positions supplied by the owner on 13 November 2026, numbered 1–7.
// Input was latitude, longitude; MapLibre consumes [longitude, latitude].
// These are stop pins, not live vehicle positions or a surveyed driving route.
export const shuttleStopLocations: readonly {
  label: string;
  coordinate: [number, number];
}[] = [
  { label: "1st stop", coordinate: [120.981078, 14.370376] },
  { label: "2nd stop", coordinate: [120.992655, 14.366413] },
  { label: "3rd stop", coordinate: [120.995318, 14.365803] },
  { label: "4th stop", coordinate: [120.995438, 14.364559] },
  { label: "5th stop", coordinate: [120.996946, 14.365874] },
  { label: "6th stop", coordinate: [120.996066, 14.36724] },
  { label: "7th stop", coordinate: [120.99362, 14.369319] },
];
