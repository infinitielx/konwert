// Display helpers. No server-only imports, so client components can use these.
const tz = "Asia/Kolkata";

export const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString("sv-SE", { timeZone: tz });
export const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString("en-GB", { timeZone: tz });

// Voltages are sent in mV by the jig; delay in ms.
export const volts = (mv: number) => `${(mv / 1000).toFixed(2)} V`;
export const secs = (ms: number) => `${(ms / 1000).toFixed(2)} s`;
