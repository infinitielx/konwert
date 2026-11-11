/** Green tick for a passed SSR channel, red cross for a failed one. */
export default function SsrIcon({ n, value, size = "sm" }: { n: number; value: number; size?: "sm" | "lg" }) {
  const ok = value === 1;
  const dims = size === "lg" ? "h-10 w-10 text-2xl" : "h-6 w-6 text-sm";
  return (
    <span
      role="img"
      aria-label={`SSR ${n} ${ok ? "pass" : "fail"}`}
      title={`SSR ${n}: ${ok ? "pass" : "fail"}`}
      className={`inline-flex items-center justify-center rounded-full font-bold ${dims} ${ok ? "pill-pass" : "pill-fail"}`}
    >
      {ok ? "\u2713" : "\u2717"}
    </span>
  );
}
