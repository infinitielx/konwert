import Link from "next/link";
import { requireUser } from "@/lib/guard";
import {
  DEFAULT_SORT, fmtDateTime, history, parseSort, parseStatus,
  type Filters, type Sort, type SortKey,
} from "@/lib/records";

export const metadata = { title: "HISTORY" };

export const dynamic = "force-dynamic";

type SP = Promise<{ [k: string]: string | string[] | undefined }>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function History({ searchParams }: { searchParams: SP }) {
  await requireUser();
  const sp = await searchParams;
  const f: Filters = {
    sno: one(sp.sno).trim(),
    from: one(sp.from),
    to: one(sp.to),
    status: parseStatus(one(sp.status)),
  };
  const sort: Sort = sp.sort ? parseSort(one(sp.sort), one(sp.dir)) : DEFAULT_SORT;
  const size = [10, 25, 50, 100].includes(+one(sp.size)) ? +one(sp.size) : 10;
  const page = Math.max(1, parseInt(one(sp.page), 10) || 1);

  let data: Awaited<ReturnType<typeof history>> | null = null;
  let error = "";
  try {
    data = await history(f, sort, size, (page - 1) * size);
  } catch (e) {
    error = e instanceof Error ? e.message : "Database error";
  }

  // Build a link that keeps the current filters and sort.
  const href = (over: Record<string, string>) => {
    const u = new URLSearchParams({
      ...f, sort: sort.key, dir: sort.dir, size: String(size), page: "1", ...over,
    });
    return `/history?${u.toString()}`;
  };
  const csv = `/api/export?${new URLSearchParams({ ...f, sort: sort.key, dir: sort.dir }).toString()}`;
  const pages = data ? Math.max(1, Math.ceil(data.total / size)) : 1;

  const stats: [string, string | number][] = [
    ["Total Tests", data?.total ?? 0],
    ["Passed", data?.passed ?? 0],
    ["Failed", data?.failed ?? 0],
    ["Last Test", data?.last ? fmtDateTime(data.last) : "-"],
  ];

  // Clickable column header: first click sorts ascending, next click flips it.
  const SortTh = ({ label, k }: { label: string; k: SortKey }) => {
    const active = sort.key === k;
    const next = active && sort.dir === "asc" ? "desc" : "asc";
    return (
      <th
        aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      >
        <Link
          href={href({ sort: k, dir: next })}
          className="inline-flex items-center gap-1 hover:text-accent"
          title={`Sort by ${label}`}
        >
          {label}
          <span aria-hidden="true" className={active ? "text-accent" : "text-muted opacity-60"}>
            {active ? (sort.dir === "asc" ? "\u25B2" : "\u25BC") : "\u21C5"}
          </span>
        </Link>
      </th>
    );
  };

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">MUX Test History</h1>
      {error && <p className="mb-4 note">Database not available: {error}</p>}

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-surface p-4 text-center shadow-sm ring-1 ring-line">
            <span className="block text-sm font-semibold text-muted">{label}</span>
            <b className="mt-1 block text-lg leading-snug sm:text-xl">
              {typeof value === "string" && value.includes(" ")
                ? value.split(" ").map((part) => <span key={part} className="block">{part}</span>)
                : value}
            </b>
          </div>
        ))}
      </div>

      <form className="card flex flex-wrap items-center gap-2.5" method="get">
        <input className="field" name="sno" placeholder="Serial No" defaultValue={f.sno} />
        <input className="field" type="date" name="from" defaultValue={f.from} />
        <input className="field" type="date" name="to" defaultValue={f.to} />
        <label className="flex items-center gap-1.5 text-sm">
          Status
          <select className="field" name="status" defaultValue={f.status}>
            <option value="">All</option>
            <option value="pass">PASS</option>
            <option value="fail">FAIL</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          Show
          <select className="field" name="size" defaultValue={size}>
            {[10, 25, 50, 100].map((n) => <option key={n}>{n}</option>)}
          </select>
        </label>
        <input type="hidden" name="sort" value={sort.key} />
        <input type="hidden" name="dir" value={sort.dir} />
        <button className="btn" type="submit">Apply</button>
        <Link className="btn-ghost" href="/history">Reset</Link>
        <a className="btn" href={csv}>CSV</a>
      </form>

      {/* Phones: sort chips + one compact card per record */}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm sm:hidden">
        <span className="text-muted">Sort:</span>
        {(
          [["created_at", "Time"], ["sno", "Serial"], ["status", "Status"], ["id", "ID"]] as [SortKey, string][]
        ).map(([k, label]) => {
          const active = sort.key === k;
          const next = active && sort.dir === "asc" ? "desc" : "asc";
          return (
            <Link
              key={k}
              href={href({ sort: k, dir: next })}
              aria-current={active ? "true" : undefined}
              className={`rounded-full px-3 py-1.5 ring-1 ring-line ${active ? "bg-brand-600 text-white" : "bg-surface"}`}
            >
              {label}
              {active ? (sort.dir === "asc" ? " \u25B2" : " \u25BC") : ""}
            </Link>
          );
        })}
      </div>

      <ul className="mb-4 space-y-2 sm:hidden">
        {data?.rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface p-3 shadow-sm ring-1 ring-line">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-bold">{r.sno}</span>
                <span className={`rounded px-2 py-0.5 text-xs font-bold ${r.pass ? "pill-pass" : "pill-fail"}`}>
                  {r.pass ? "PASS" : "FAIL"}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted">#{r.id} &middot; {fmtDateTime(r.created_at)}</p>
            </div>
            <Link className="btn shrink-0" href={`/test/${r.id}`}>View</Link>
          </li>
        ))}
        {data && data.rows.length === 0 && <li className="card text-center text-sm">No records</li>}
      </ul>

      {/* Tablets and desktops: the sortable table */}
      <div className="card hidden sm:block">
        <table className="tbl">
          <thead>
            <tr>
              <SortTh label="ID" k="id" />
              <SortTh label="Serial No" k="sno" />
              <SortTh label="Status" k="status" />
              <SortTh label="Timestamp" k="created_at" />
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {data?.rows.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.sno}</td>
                <td className={r.pass ? "ok" : "bad"}>{r.pass ? "PASS" : "FAIL"}</td>
                <td>{fmtDateTime(r.created_at)}</td>
                <td><Link className="btn" href={`/test/${r.id}`}>View</Link></td>
              </tr>
            ))}
            {data && data.rows.length === 0 && <tr><td colSpan={5}>No records</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card flex flex-wrap items-center gap-3 !py-3 text-sm">
        <span>Page {page} of {pages}</span>
        {page > 1 && <Link className="btn" href={href({ page: String(page - 1) })}>Previous</Link>}
        {page < pages && <Link className="btn" href={href({ page: String(page + 1) })}>Next</Link>}
      </div>
    </>
  );
}
