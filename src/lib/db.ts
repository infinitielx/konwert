import { MongoClient, type Db } from "mongodb";

export type TestDoc = { sno: string; testby: string; appby: string; created_at: Date };
export type SsrDoc = {
  id: number; sno: string; delay: number; voutm: number; vout_a: number;
  ssr_1: number; ssr_2: number; ssr_3: number; ssr_4: number; created_at: Date;
};

// Reuse one client across hot reloads / warm serverless invocations.
const g = globalThis as unknown as { _mongo?: Promise<MongoClient>; _mongoReady?: boolean };

function client() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  g._mongo ??= new MongoClient(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 10000 }).connect();
  return g._mongo;
}

export async function getDb(): Promise<Db> {
  const db = (await client()).db(process.env.MONGODB_DB || "konwert_jig");
  if (!g._mongoReady) {
    await db.collection("jig_ssr").createIndex({ id: 1 }, { unique: true });
    await db.collection("jig_ssr").createIndex({ sno: 1, created_at: -1 });
    await db.collection("jig_ssr").createIndex({ created_at: -1, id: -1 });
    await db.collection("jig_tests").createIndex({ sno: 1, created_at: -1 });
    g._mongoReady = true;
  }
  return db;
}

export async function insertTest(d: Omit<TestDoc, "created_at">) {
  const db = await getDb();
  await db.collection<TestDoc>("jig_tests").insertOne({ ...d, created_at: new Date() });
}

export async function insertSsr(d: Omit<SsrDoc, "id" | "created_at">) {
  const db = await getDb();
  const counter = await db
    .collection<{ _id: string; seq: number }>("counters")
    .findOneAndUpdate({ _id: "jig_ssr" }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" });
  await db.collection<SsrDoc>("jig_ssr").insertOne({ ...d, id: counter!.seq, created_at: new Date() });
}

/** Returns true when the request is allowed. If DEVICE_KEY is set, ?key= must match. */
export function authorized(params: URLSearchParams) {
  const key = process.env.DEVICE_KEY;
  return !key || params.get("key") === key;
}

export function toInt(v: string | null) {
  const n = parseInt(v ?? "", 10);
  return Number.isFinite(n) ? n : 0;
}

/** Strip non-printable bytes the ESP32 may send from unterminated char buffers. */
export function clean(v: string | null) {
  return (v ?? "").replace(/[^\x20-\x7E]/g, "").trim().slice(0, 50);
}