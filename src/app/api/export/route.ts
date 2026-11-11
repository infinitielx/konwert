import { NextRequest } from "next/server";
import { getUser } from "@/lib/guard";
import { exportAll, fmtDateTime, parseSort, parseStatus } from "@/lib/records";

export const dynamic = "force-dynamic";

const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export async function GET(req: NextRequest) {
  if (!(await getUser())) return new Response("Unauthorized", { status: 401 });
  const p = req.nextUrl.searchParams;
  try {
    const rows = await exportAll({
      sno: (p.get("sno") ?? "").trim(),
      from: p.get("from") ?? "",
      to: p.get("to") ?? "",
      status: parseStatus(p.get("status")),
    }, parseSort(p.get("sort"), p.get("dir")));
    const head = "ID,Serial No,Status,Tested By,Approved By,Timestamp,VoutM (mV),VoutA (mV),Delay (ms),SSR1,SSR2,SSR3,SSR4";
    const lines = rows.map((r) =>
      [r.id, r.sno, r.pass ? "PASS" : "FAIL", r.testby, r.appby, fmtDateTime(r.created_at),
       r.voutm, r.vout_a, r.delay, r.ssr_1, r.ssr_2, r.ssr_3, r.ssr_4].map(esc).join(",")
    );
    return new Response([head, ...lines].join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="mux-history.csv"',
      },
    });
  } catch (e) {
    console.error(e);
    return new Response("Server error", { status: 500 });
  }
}