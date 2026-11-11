// Approximate office pin reused from the existing portal area map; not surveyed.
export const officeAddress =
  "Bellefort Estates Sales Office, Ph3, Molino IV, Bacoor, Cavite";
export const officeCoordinate: [number, number] = [120.9842, 14.4093];
export const demoPlaces = [
  "Sales office - approximate pin",
  "Demo pickup A",
  "Demo pickup B",
  "Demo pickup C",
];
// Static road-following sample prepared once with OSRM / OpenStreetMap.
// Not an approved HOA route; sampled points are demonstration stops only.
export const demoRoadRoute: [number, number][] = [
  [120.984465, 14.409423],
  [120.984443, 14.409468],
  [120.983747, 14.410862],
  [120.983366, 14.411071],
  [120.983041, 14.411226],
  [120.983201, 14.411577],
  [120.983708, 14.412523],
  [120.984076, 14.412465],
  [120.984318, 14.412427],
  [120.984368, 14.412425],
  [120.984405, 14.412445],
  [120.984426, 14.41247],
  [120.984441, 14.412501],
  [120.984518, 14.412672],
  [120.98473, 14.413238],
  [120.984709, 14.413528],
  [120.984702, 14.413706],
  [120.984751, 14.413781],
  [120.985059, 14.414071],
  [120.98533, 14.414333],
  [120.985448, 14.414454],
  [120.985534, 14.41554],
  [120.985887, 14.41561],
  [120.98623, 14.415679],
  [120.986194, 14.414173],
  [120.986008, 14.413992],
  [120.985824, 14.413812],
  [120.985589, 14.414067],
  [120.98533, 14.414333],
  [120.985059, 14.414071],
  [120.984713, 14.414408],
  [120.984265, 14.414489],
  [120.983841, 14.41449],
  [120.98321, 14.414414],
  [120.982259, 14.41431],
  [120.980404, 14.413992],
  [120.979075, 14.413754],
  [120.979002, 14.414059],
  [120.978784, 14.414726],
  [120.978563, 14.415405],
  [120.978531, 14.415549],
  [120.978605, 14.41581],
  [120.978616, 14.41591],
  [120.978625, 14.416003],
  [120.978628, 14.416025],
  [120.978782, 14.416158],
  [120.978977, 14.416147],
  [120.979195, 14.416136],
  [120.979208, 14.416135],
];
export const demoStopRouteIndices = [
  0, 3, 6, 15, 21, 24, 28, 32, 34, 35, 38, 48,
];
export const demoStopCoordinates: [number, number][] = demoStopRouteIndices.map(
  (index) => demoRoadRoute[index],
);

export const demoCarpoolRouteIndices = [0, 15, 32, 48];
export const demoCoordinates: [number, number][] = demoCarpoolRouteIndices.map(
  (index) => demoRoadRoute[index],
);
