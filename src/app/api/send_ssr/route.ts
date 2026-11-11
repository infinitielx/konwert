import { NextRequest } from "next/server";
import { authorized, clean, insertSsr, toInt } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/send_ssr?sno=1&delay=2&voutm=3&vout_a=4&ssr_1=1&ssr_2=1&ssr_3=1&ssr_4=0
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (!authorized(p)) return new Response("Unauthorized", { status: 401 });
  const sno = clean(p.get("sno"));
  if (!sno) return new Response("sno required", { status: 400 });
  try {
    await insertSsr({
      sno,
      delay: toInt(p.get("delay")),
      voutm: toInt(p.get("voutm")),
      vout_a: toInt(p.get("vout_a")),
      ssr_1: toInt(p.get("ssr_1")),
      ssr_2: toInt(p.get("ssr_2")),
      ssr_3: toInt(p.get("ssr_3")),
      ssr_4: toInt(p.get("ssr_4")),
    });
    return new Response("OK");
  } catch (e) {
    console.error(e);
    return new Response("Server error", { status: 500 });
  }
}