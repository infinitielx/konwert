import type { Document } from "mongodb";
import { getDb, type SsrDoc } from "./db";
import { VOLTAGE_AFFECTS_OVERALL, VOLT_MAX_MV, VOLT_PASS_MIN_MV, voltOk } from "./config";

export { fmtDateTime, fmtTime, volts, secs } from "./format";

export type Rec = {
  id: number;
  sno: string;
  testby: string | null;
  appby: string | null;
  delay: number;
  voutm: number;
  vout_a: number;
  ssr_1: number;
  ssr_2: number;
  ssr_3: number;
  ssr_4: number;
  created_at: string;
  pass: boolean;
};

export type StatusFilter = "" | "pass" | "fail";
export type Filters = { sno: string; from: string; to: string; status: StatusFilter };

export type SortKey = "id" | "sno" | "status" | "created_at";
export type SortDir = "asc" | "desc";
export type Sort = { key: SortKey; dir: SortDir };

export const DEFAULT_SORT: Sort = { key: "created_at", dir: "desc" };

export function parseStatus(v: string | null | undefined): StatusFilter {
  return v === "pass" || v === "fail" ? v : "";
}

export function parseSort(key: string | null | undefined, dir: string | null | undefined): Sort {
  const k: SortKey[] = ["id", "sno", "status", "created_at"];
  if (!k.includes(key as SortKey)) return DEFAULT_SORT;
  return { key: key as SortKey, dir: dir === "asc" ? "asc" : "desc" };
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const IST = "+05:30";

// Overall PASS as an aggregation expression. Must match toRec() below:
// SSR 1, 2 and 3 on, and (optionally) both voltages inside the pass window.
const inWindow = (field: string): Document => ({
  $and: [{ $gte: [field, VOLT_PASS_MIN_MV] }, { $lte: [field, VOLT_MAX_MV] }],
});
const passExpr: Document = {
  $and: [
    { $eq: ["$ssr_1", 1] },
    { $eq: ["$ssr_2", 1] },
    { $eq: ["$ssr_3", 1] },
    ...(VOLTAGE_AFFECTS_OVERALL ? [inWindow("$voutm"), inWindow("$vout_a")] : []),
  ],
};

function matchStage(f: Filters): Document {
  const m: Document = {};
  if (f.sno) m.sno = { $regex: esc(f.sno), $options: "i" };
  const range: Document = {};
  if (/^\d{4}-\d{2}-\d{2}$/.test(f.from)) range.$gte = new Date(`${f.from}T00:00:00${IST}`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(f.to)) {
    range.$lt = new Date(new Date(`${f.to}T00:00:00${IST}`).getTime() + 86400000);
  }
  if (Object.keys(range).length) m.created_at = range;
  if (f.status === "pass") m.$expr = passExpr;
  if (f.status === "fail") m.$expr = { $not: [passExpr] };
  return m;
}

function sortStages(s: Sort): Document[] {
  const d = s.dir === "asc" ? 1 : -1;
  switch (s.key) {
    case "id":
      return [{ $sort: { id: d } }];
    case "sno":
      return [{ $sort: { sno: d, id: d } }];
    case "status":
      return [{ $addFields: { _pass: passExpr } }, { $sort: { _pass: d, created_at: -1, id: -1 } }];
    default:
      return [{ $sort: { created_at: d, id: d } }];
  }
}

// "SNO" values like MUX2 and MUX10 should sort in natural order.
const COLLATION = { locale: "en", numericOrdering: true } as const;

// Attach the most recent "send" (tested by / approved by) at or before each result.
const joinTests: Document[] = [
  {
    $lookup: {
      from: "jig_tests",
      let: { sno: "$sno", t: "$created_at" },
      pipeline: [
        { $match: { $expr: { $and: [{ $eq: ["$sno", "$$sno"] }, { $lte: ["$created_at", "$$t"] }] } } },
        { $sort: { created_at: -1 } },
        { $limit: 1 },
      ],
      as: "t",
    },
  },
  { $addFields: { testby: { $arrayElemAt: ["$t.testby", 0] }, appby: { $arrayElemAt: ["$t.appby", 0] } } },
  { $project: { _id: 0, t: 0, _pass: 0 } },
];

// Overall PASS matches the firmware rule: SSR 1, 2 and 3 must all be 1.
function toRec(d: Document): Rec {
  return {
    id: d.id, sno: d.sno, testby: d.testby ?? null, appby: d.appby ?? null,
    delay: d.delay, voutm: d.voutm, vout_a: d.vout_a,
    ssr_1: d.ssr_1, ssr_2: d.ssr_2, ssr_3: d.ssr_3, ssr_4: d.ssr_4,
    created_at: new Date(d.created_at).toISOString(),
    pass:
      d.ssr_1 === 1 && d.ssr_2 === 1 && d.ssr_3 === 1 &&
      (!VOLTAGE_AFFECTS_OVERALL || (voltOk(d.voutm) && voltOk(d.vout_a))),
  };
}

async function ssr() {
  return (await getDb()).collection<SsrDoc>("jig_ssr");
}

export async function latest(): Promise<Rec | null> {
  const rows = await (await ssr())
    .aggregate([{ $sort: { created_at: -1, id: -1 } }, { $limit: 1 }, ...joinTests]).toArray();
  return rows[0] ? toRec(rows[0]) : null;
}

export async function recent(n: number): Promise<Rec[]> {
  const rows = await (await ssr())
    .aggregate([{ $sort: { created_at: -1, id: -1 } }, { $limit: n }, ...joinTests]).toArray();
  return rows.map(toRec);
}

export async function byId(id: number): Promise<Rec | null> {
  const rows = await (await ssr())
    .aggregate([{ $match: { id } }, { $limit: 1 }, ...joinTests]).toArray();
  return rows[0] ? toRec(rows[0]) : null;
}

export async function history(f: Filters, sort: Sort, limit: number, offset: number) {
  const col = await ssr();
  const m = matchStage(f);
  const [rows, total, passed, last] = await Promise.all([
    col.aggregate(
      [{ $match: m }, ...sortStages(sort), { $skip: offset }, { $limit: limit }, ...joinTests],
      { collation: COLLATION }
    ).toArray(),
    col.countDocuments(m),
    col.countDocuments({ $and: [m, { $expr: passExpr }] }),
    col.find(m).sort({ created_at: -1 }).limit(1).toArray(),
  ]);
  return {
    rows: rows.map(toRec),
    total,
    passed,
    failed: total - passed,
    last: last[0] ? new Date(last[0].created_at).toISOString() : null,
  };
}

export async function exportAll(f: Filters, sort: Sort = DEFAULT_SORT) {
  const rows = await (await ssr())
    .aggregate(
      [{ $match: matchStage(f) }, ...sortStages(sort), { $limit: 50000 }, ...joinTests],
      { collation: COLLATION }
    ).toArray();
  return rows.map(toRec);
}
