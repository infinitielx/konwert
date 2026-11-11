import { NextRequest } from "next/server";
import { authorized, clean, insertTest } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/send?sno=1&testby=2&appby=3
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (!authorized(p)) return new Response("Unauthorized", { status: 401 });
  const sno = clean(p.get("sno"));
  if (!sno) return new Response("sno required", { status: 400 });
  try {
    await insertTest({ sno, testby: clean(p.get("testby")), appby: clean(p.get("appby")) });
    return new Response("OK");
  } catch (e) {
    console.error(e);
    return new Response("Server error", { status: 500 });
  }
}