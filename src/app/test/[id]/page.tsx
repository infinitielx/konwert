import Link from "next/link";
import { requireUser } from "@/lib/guard";
import { notFound } from "next/navigation";
import { byId, fmtDateTime, secs } from "@/lib/records";
import SsrIcon from "@/components/SsrIcon";
import VoltGauge from "@/components/VoltGauge";
import { VOLT_MAX_V, VOLT_MIN_V, VOLT_PASS_MIN_V, VOLT_STATUS_LABEL, voltStatus } from "@/lib/config";

export const dynamic = "force-dynamic";

function Tile({
  label, children, valueClass = "text-lg",
}: { label: string; children: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center justify-center rounded-xl bg-surface px-3 py-3 text-center shadow-sm ring-1 ring-line">
      <span className="block text-xs font-semibold text-accent sm:text-sm">{label}</span>
      <b className={`mt-1 block max-w-full truncate ${valueClass}`}>{children}</b>
    </div>
  );
}

function VoltCard({ label, mv }: { label: string; mv: number }) {
  const status = voltStatus(mv);
  const ok = status === "pass";
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg p-3 ring-1 ring-line">
      <span className="font-semibold">
        {label} <span className="text-xs font-normal text-muted">(volts)</span>
      </span>
      <VoltGauge label={label} mv={mv} size={125} />
      <span className={`rounded px-2 py-0.5 text-xs font-bold ${ok ? "pill-pass" : "pill-fail"}`}>
        {VOLT_STATUS_LABEL[status]}
      </span>
    </div>
  );
}

export default async function Detail({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const id = parseInt((await params).id, 10);
  if (!Number.isFinite(id)) notFound();
  const r = await byId(id);
  if (!r) notFound();

  const ssr = (n: number, v: number) => (
    <span className="flex flex-col items-center gap-1">
      <SsrIcon n={n} value={v} size="lg" />
      <span className={`text-xs ${v === 1 ? "ok" : "bad"}`}>{v === 1 ? "PASS" : "FAIL"}</span>
    </span>
  );
  const voltage: [string, number][] = [
    ["VoutM", r.voutm],
    ["VoutA", r.vout_a],
  ];

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">Detailed Power MUX Test Report</h1>
        <div className="flex flex-wrap gap-2">
          <a className="btn-gold" href={`/api/export?sno=${encodeURIComponent(r.sno)}`}>Download CSV</a>
          <a className="btn !bg-rose-500 hover:!bg-rose-600" href={`/api/report/${r.id}`} target="_blank">Export PDF</a>
          <Link className="btn-ghost" href="/">&larr; Back to Live Status</Link>
        </div>
      </div>

      <h2 className="mb-3 text-xl font-bold">
        Test: {r.sno}{" "}
        <span className={`ml-2 rounded px-2 py-0.5 text-sm ${r.pass ? "pill-pass" : "pill-fail"}`}>
          {r.pass ? "PASS" : "FAIL"}
        </span>
      </h2>

      {/* Left: test details. Right: voltage parameters. Stacks on small screens. */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="min-w-0">
          <h3 className="mb-2 font-bold">General Information</h3>
          <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Tile label="Serial No">{r.sno}</Tile>
            <Tile label="Tested By">{r.testby ?? "-"}</Tile>
            <Tile label="Approved By">{r.appby ?? "-"}</Tile>
            <Tile label="Test Time" valueClass="text-sm sm:text-base">{fmtDateTime(r.created_at)}</Tile>
          </div>

          <h3 className="mb-2 font-bold">SSR Status and Delay</h3>
          <div className="grid grid-cols-3 gap-3 xl:grid-cols-5">
            <Tile label="SSR 1">{ssr(1, r.ssr_1)}</Tile>
            <Tile label="SSR 2">{ssr(2, r.ssr_2)}</Tile>
            <Tile label="SSR 3">{ssr(3, r.ssr_3)}</Tile>
            <Tile label="SSR 4">{ssr(4, r.ssr_4)}</Tile>
            <Tile label="Delay (s)">{secs(r.delay)}</Tile>
          </div>
        </div>

        <aside className="card !mb-0 !p-4">
          <h3 className="text-center font-bold">Voltage Parameters (V)</h3>
          <p className="mb-3 text-center text-xs text-muted">
            Valid range {VOLT_MIN_V} to {VOLT_MAX_V} V. Minimum pass voltage is {VOLT_PASS_MIN_V} V.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {voltage.map(([k, v]) => <VoltCard key={k} label={k} mv={v} />)}
          </div>
        </aside>
      </div>
    </>
  );
}
