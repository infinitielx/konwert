// Voltage limits for the MUX jig. The jig sends voltages in millivolts.
export const VOLT_MIN_V = 0; // lowest valid reading
export const VOLT_MAX_V = 14; // highest valid reading
export const VOLT_PASS_MIN_V = 11; // a reading passes at or above this

// When true, VoutM and VoutA must both pass the voltage check for the overall
// result to be PASS (in addition to SSR 1, 2 and 3). Set to false to base the
// overall result on the SSR channels only.
export const VOLTAGE_AFFECTS_OVERALL = true;

export const VOLT_PASS_MIN_MV = VOLT_PASS_MIN_V * 1000;
export const VOLT_MAX_MV = VOLT_MAX_V * 1000;
export const VOLT_MIN_MV = VOLT_MIN_V * 1000;

export type VoltStatus = "pass" | "low" | "high";

/** "pass" when 11 V to 14 V, "low" below 11 V, "high" above 14 V (out of range). */
export function voltStatus(mv: number): VoltStatus {
  if (mv > VOLT_MAX_MV) return "high";
  if (mv >= VOLT_PASS_MIN_MV) return "pass";
  return "low";
}

export const voltOk = (mv: number) => voltStatus(mv) === "pass";

export const VOLT_STATUS_LABEL: Record<VoltStatus, string> = {
  pass: "PASS",
  low: "FAIL (low)",
  high: "FAIL (over range)",
};
