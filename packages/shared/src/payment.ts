export function buyaniAccount(phase: number, block: number, lot: number) {
  if (
    ![phase, block, lot].every(Number.isInteger) ||
    phase < 1 ||
    phase > 9999 ||
    block < 1 ||
    block > 999 ||
    lot < 1 ||
    lot > 999
  )
    return null;
  return `BF${phase}-${String(block).padStart(3, "0")}-${String(lot).padStart(3, "0")}`;
}
