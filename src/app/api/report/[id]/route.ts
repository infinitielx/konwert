import { NextRequest } from "next/server";
import { getUser } from "@/lib/guard";
import { byId } from "@/lib/records";
import { buildReport } from "@/lib/report";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getUser())) return new Response("Unauthorized", { status: 401 });
  const id = parseInt((await ctx.params).id, 10);
  if (!Number.isFinite(id)) return new Response("Bad id", { status: 400 });
  try {
    const rec = await byId(id);
    if (!rec) return new Response("Not found", { status: 404 });
    const pdf = await buildReport(rec);
    const safe = rec.sno.replace(/[^A-Za-z0-9_-]/g, "_") || "report";
    return new Response(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Power_MUX_Report_${safe}_${rec.id}.pdf"`,
      },
    });
  } catch (e) {
    console.error(e);
    return new Response("Server error", { status: 500 });
  }
}