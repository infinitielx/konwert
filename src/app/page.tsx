import AutoRefresh from "@/components/AutoRefresh";
import LiveTable from "@/components/LiveTable";
import { LiveClock } from "@/components/TimeAgo";
import { recent, type Rec } from "@/lib/records";

export const dynamic = "force-dynamic";

const LIMIT = 15;

export default async function LiveStatus() {
  let recs: Rec[] = [];
  let error = "";
  try {
    recs = await recent(LIMIT);
  } catch (e) {
    error = e instanceof Error ? e.message : "Database error";
  }
  return (
    <>
      <AutoRefresh seconds={5} />
      <h1 className="text-xl font-bold">MUX Testing Live Status</h1>
      <h2 className="mt-1 text-3xl font-bold">Latest Live Records</h2>
      <p className="mb-4 text-sm text-muted">Current time (IST): <LiveClock /></p>
      {error && <p className="mb-4 note">Database not available: {error}</p>}
      <LiveTable recs={recs} limit={LIMIT} />
    </>
  );
}
