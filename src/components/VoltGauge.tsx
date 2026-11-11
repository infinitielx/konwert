import { VOLT_MAX_V, VOLT_MIN_V, VOLT_PASS_MIN_V, VOLT_STATUS_LABEL, voltStatus } from "@/lib/config";

const START = 135; // degrees, measured clockwise from 3 o'clock

/**
 * Round gauge for a voltage reading (input in millivolts).
 * Fills from 0 V to 14 V, goes red outside the pass window, and shows
 * the value inside the ring without a unit. `size` is in pixels.
 */
export default function VoltGauge({ label, mv, size = 52 }: { label: string; mv: number; size?: number }) {
  const status = voltStatus(mv);
  const ok = status === "pass";
  const v = mv / 1000;
  const span = VOLT_MAX_V - VOLT_MIN_V;
  const frac = Math.min(Math.max((v - VOLT_MIN_V) / span, 0), 1);

  // Everything scales with the size so small and large gauges look the same.
  const c = size / 2;
  const stroke = size * 0.096;
  const r = size * 0.385;
  const circ = 2 * Math.PI * r;
  const arc = circ * 0.75; // 270 degree gauge, open at the bottom
  const fontSize = Math.max(10, size * 0.215);

  // Small gold tick on the track marking the minimum pass voltage.
  const tickAngle = ((START + 270 * ((VOLT_PASS_MIN_V - VOLT_MIN_V) / span)) * Math.PI) / 180;
  const tick = (d: number) => [c + d * Math.cos(tickAngle), c + d * Math.sin(tickAngle)];
  const [x1, y1] = tick(r - stroke * 0.8);
  const [x2, y2] = tick(r + stroke * 0.8);

  return (
    <span
      role="img"
      aria-label={`${label} ${v.toFixed(2)} volts, ${VOLT_STATUS_LABEL[status]}`}
      title={`${label}: ${v.toFixed(2)} V (${VOLT_STATUS_LABEL[status]}). Range ${VOLT_MIN_V} to ${VOLT_MAX_V} V, pass at ${VOLT_PASS_MIN_V} V or more.`}
      className="relative inline-flex"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        {/* track */}
        <circle
          cx={c} cy={c} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          className="stroke-slate-200 dark:stroke-slate-700"
          strokeDasharray={`${arc} ${circ}`}
          transform={`rotate(${START} ${c} ${c})`}
        />
        {/* value */}
        {frac > 0 && (
          <circle
            cx={c} cy={c} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
            className={ok ? "stroke-green-600 dark:stroke-green-400" : "stroke-red-500 dark:stroke-red-400"}
            strokeDasharray={`${arc * frac} ${circ}`}
            transform={`rotate(${START} ${c} ${c})`}
          />
        )}
        {/* minimum pass marker */}
        <line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={Math.max(1.5, size * 0.03)} className="stroke-gold-500" />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center font-bold leading-none ${ok ? "ok" : "bad"}`}
        style={{ fontSize }}
      >
        {v.toFixed(2)}
      </span>
    </span>
  );
}
