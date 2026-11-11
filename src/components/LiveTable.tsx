"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Rec } from "@/lib/records";
import { fmtDateTime, secs } from "@/lib/format";
import SsrIcon from "./SsrIcon";
import { TimeAgo } from "./TimeAgo";
import VoltGauge from "./VoltGauge";

type Key =
  | "sno" | "testby" | "pass" | "created_at" | "voutm" | "vout_a"
  | "ssr_1" | "ssr_2" | "ssr_3" | "ssr_4" | "delay";

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

function compare(a: Rec, b: Rec, key: Key) {
  switch (key) {
    case "sno": return collator.compare(a.sno, b.sno);
    case "testby": return collator.compare(a.testby ?? "", b.testby ?? "");
    case "pass": return Number(a.pass) - Number(b.pass);
    case "created_at": return Date.parse(a.created_at) - Date.parse(b.created_at);
    default: return a[key] - b[key];
  }
}

// Choices for the sort menu shown on phones (wide screens click the column headings).
const SORT_OPTIONS: [Key, string][] = [
  ["created_at", "Test time"],
  ["sno", "Serial No"],
  ["pass", "Overall status"],
  ["voutm", "VoutM"],
  ["vout_a", "VoutA"],
  ["delay", "Delay"],
];

export default function LiveTable({ recs, limit }: { recs: Rec[]; limit: number }) {
  // No sort selected = the server order (newest first).
  const [sort, setSort] = useState<{ key: Key; dir: "asc" | "desc" } | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"" | "pass" | "fail">("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = recs.filter((r) => {
      if (status === "pass" && !r.pass) return false;
      if (status === "fail" && r.pass) return false;
      if (q && !r.sno.toLowerCase().includes(q) && !(r.testby ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
    if (sort) {
      const d = sort.dir === "asc" ? 1 : -1;
      out = [...out].sort((a, b) => compare(a, b, sort.key) * d || b.id - a.id);
    }
    return out;
  }, [recs, sort, query, status]);

  // Click cycle: ascending, then descending, then back to the default order.
  function toggle(key: Key) {
    setSort((s) => {
      if (!s || s.key !== key) return { key, dir: "asc" };
      if (s.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }

  function Th({ k, label, center }: { k: Key; label: string; center?: boolean }) {
    const active = sort?.key === k;
    return (
      <th
        className={center ? "!text-center" : ""}
        aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none"}
      >
        <button
          type="button"
          onClick={() => toggle(k)}
          title={`Sort by ${label}`}
          className="inline-flex cursor-pointer items-center gap-1 font-semibold hover:text-accent"
        >
          {label}
          <span aria-hidden="true" className={active ? "text-accent" : "text-muted opacity-60"}>
            {active ? (sort!.dir === "asc" ? "\u25B2" : "\u25BC") : "\u21C5"}
          </span>
        </button>
      </th>
    );
  }

  const filtered = query.trim() !== "" || status !== "";

  return (
    <>
      <div className="card flex flex-wrap items-center gap-2.5">
        <input
          className="field min-w-0 flex-1 basis-48"
          placeholder="Search serial or tested by"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search serial number or tested by"
        />
        <label className="flex items-center gap-1.5 text-sm">
          Status
          <select
            className="field"
            value={status}
            onChange={(e) => setStatus(e.target.value as "" | "pass" | "fail")}
          >
            <option value="">All</option>
            <option value="pass">PASS</option>
            <option value="fail">FAIL</option>
          </select>
        </label>

        {/* Phones and tablets: sort menu (the column headings are not shown there). */}
        <div className="flex w-full items-center gap-2 text-sm xl:hidden">
          <label className="flex min-w-0 flex-1 items-center gap-1.5">
            <span className="shrink-0">Sort</span>
            <select
              className="field min-w-0 flex-1"
              value={sort?.key ?? ""}
              onChange={(e) => {
                const k = e.target.value as Key | "";
                setSort(k ? { key: k, dir: k === "sno" ? "asc" : "desc" } : null);
              }}
              aria-label="Sort by"
            >
              <option value="">Newest first</option>
              {SORT_OPTIONS.map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn-ghost cursor-pointer disabled:opacity-50"
            disabled={!sort}
            onClick={() => setSort((s) => (s ? { ...s, dir: s.dir === "asc" ? "desc" : "asc" } : s))}
            aria-label={sort?.dir === "asc" ? "Ascending, tap for descending" : "Descending, tap for ascending"}
          >
            {sort?.dir === "asc" ? "\u25B2 Asc" : "\u25BC Desc"}
          </button>
        </div>

        {(sort || filtered) && (
          <button
            type="button"
            className="btn-ghost cursor-pointer"
            onClick={() => { setSort(null); setQuery(""); setStatus(""); }}
          >
            Reset
          </button>
        )}
        <span className="text-xs text-muted xl:ml-auto">
          {rows.length} of {recs.length} shown
          <span className="hidden xl:inline">. Click a column heading to sort.</span>
        </span>
      </div>

      {/* Phones and tablets: one card per record (1, 2 or 3 columns) */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:hidden">
        {rows.map((rec) => (
          <article key={rec.id} className="rounded-xl bg-surface p-4 shadow-sm ring-1 ring-line">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-base font-bold">{rec.sno}</h3>
                <p className="text-xs text-muted">
                  {rec.testby ?? "-"} &middot; <TimeAgo iso={rec.created_at} />
                </p>
              </div>
              <span className={`shrink-0 rounded px-3 py-1 text-sm font-bold ${rec.pass ? "pill-pass" : "pill-fail"}`}>
                {rec.pass ? "PASS" : "FAIL"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted">{fmtDateTime(rec.created_at)}</p>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 rounded-lg bg-tint p-2">
                <VoltGauge label="VoutM" mv={rec.voutm} size={56} />
                <span className="text-xs font-semibold text-muted">VoutM<br />(volts)</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-tint p-2">
                <VoltGauge label="VoutA" mv={rec.vout_a} size={56} />
                <span className="text-xs font-semibold text-muted">VoutA<br />(volts)</span>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2 text-center">
              {[rec.ssr_1, rec.ssr_2, rec.ssr_3, rec.ssr_4].map((v, i) => (
                <div key={i} className="flex flex-col items-center gap-1 rounded-lg bg-tint py-2">
                  <span className="text-[11px] font-semibold text-muted">SSR {i + 1}</span>
                  <SsrIcon n={i + 1} value={v} />
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-sm text-muted">Delay {secs(rec.delay)}</span>
              <Link className="btn" href={`/test/${rec.id}`}>View</Link>
            </div>
          </article>
        ))}
        {rows.length === 0 && (
          <p className="card col-span-full text-center text-sm">{recs.length === 0 ? "No data yet" : "No records match the filter"}</p>
        )}
      </div>

      {/* Laptops and desktops: the sortable table */}
      <div className="card hidden xl:block">
        <table className="tbl">
          <thead>
            <tr>
              <Th k="sno" label="Serial No" />
              <Th k="testby" label="Tested By" />
              <Th k="pass" label="Overall Status" center />
              <Th k="created_at" label="Test Time" />
              <th>Time Ago</th>
              <Th k="voutm" label="VoutM" center />
              <Th k="vout_a" label="VoutA" center />
              <Th k="ssr_1" label="SSR 1" center />
              <Th k="ssr_2" label="SSR 2" center />
              <Th k="ssr_3" label="SSR 3" center />
              <Th k="ssr_4" label="SSR 4" center />
              <Th k="delay" label="Delay (s)" />
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((rec) => (
              <tr key={rec.id}>
                <td>{rec.sno}</td>
                <td>{rec.testby ?? "-"}</td>
                <td className={`!text-center font-bold ${rec.pass ? "pill-pass" : "pill-fail"}`}>
                  {rec.pass ? "PASS" : "FAIL"}
                </td>
                <td>{fmtDateTime(rec.created_at)}</td>
                <td className="text-muted"><TimeAgo iso={rec.created_at} /></td>
                <td className="!text-center"><VoltGauge label="VoutM" mv={rec.voutm} /></td>
                <td className="!text-center"><VoltGauge label="VoutA" mv={rec.vout_a} /></td>
                <td className="!text-center"><SsrIcon n={1} value={rec.ssr_1} /></td>
                <td className="!text-center"><SsrIcon n={2} value={rec.ssr_2} /></td>
                <td className="!text-center"><SsrIcon n={3} value={rec.ssr_3} /></td>
                <td className="!text-center"><SsrIcon n={4} value={rec.ssr_4} /></td>
                <td>{secs(rec.delay)}</td>
                <td><Link className="btn" href={`/test/${rec.id}`}>View</Link></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={13}>{recs.length === 0 ? "No data yet" : "No records match the filter"}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="px-1 text-xs text-muted">
        Showing the latest {limit} records.{" "}
        <Link className="text-accent underline" href="/history">See all in History</Link>
      </p>
    </>
  );
}
