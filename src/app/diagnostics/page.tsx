import dns from "node:dns/promises";
import net from "node:net";
import tls from "node:tls";
import { MongoClient } from "mongodb";
import { requireUser } from "@/lib/guard";

export const metadata = { title: "DIAGNOSTICS" };
export const dynamic = "force-dynamic";

// Step-by-step check of the database connection, run from the server this page
// is served from (for example Vercel). Only visible after login. Never prints
// the username, password or connection string.

type Check = { name: string; ok: boolean; detail: string; ms: number };

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);

async function timed(name: string, fn: () => Promise<string>): Promise<Check> {
  const t = Date.now();
  try {
    return { name, ok: true, detail: await fn(), ms: Date.now() - t };
  } catch (e) {
    return { name, ok: false, detail: errText(e), ms: Date.now() - t };
  }
}

async function publicIp(url: string) {
  const r = await fetch(url, { signal: AbortSignal.timeout(4000), cache: "no-store" });
  return (await r.text()).trim();
}

function tcp(host: string, port: number) {
  return new Promise<string>((resolve, reject) => {
    const s = net.connect({ host, port, timeout: 5000 });
    s.once("connect", () => { s.destroy(); resolve(`connected to ${host}:${port}`); });
    s.once("timeout", () => { s.destroy(); reject(new Error("timed out")); });
    s.once("error", reject);
  });
}

function tlsHandshake(host: string, port: number) {
  return new Promise<string>((resolve, reject) => {
    const s = tls.connect({ host, port, servername: host, timeout: 6000 });
    s.once("secureConnect", () => { const p = s.getProtocol(); s.destroy(); resolve(`handshake ok (${p})`); });
    s.once("timeout", () => { s.destroy(); reject(new Error("timed out")); });
    s.once("error", reject);
  });
}

export default async function Diagnostics() {
  await requireUser();

  const uri = process.env.MONGODB_URI ?? "";
  const dbName = process.env.MONGODB_DB || "konwert_jig";
  const m = uri.match(/^mongodb(\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)/);
  const isSrv = Boolean(m?.[1]);
  const host = m?.[2]?.split(",")[0].split(":")[0] ?? "";

  const checks: Check[] = [];
  const info: [string, string][] = [
    ["Node.js / OpenSSL", `${process.version} / ${process.versions.openssl}`],
    ["Environment", `${process.env.VERCEL_ENV ?? "local"}${process.env.VERCEL_REGION ? ` (region ${process.env.VERCEL_REGION})` : ""}`],
    ["Database name", dbName],
    ["Connection string", uri ? `set, ${isSrv ? "mongodb+srv" : "mongodb"}, host ${host || "not recognised"}` : "NOT SET in this environment"],
  ];

  checks.push(await timed("Outbound IPv4 address of this server", () => publicIp("https://api.ipify.org")));
  checks.push(await timed("Outbound address (IPv4 or IPv6)", () => publicIp("https://api64.ipify.org")));

  let target = { host, port: 27017 };
  if (uri && host) {
    if (isSrv) {
      const dnsCheck = await timed("DNS: look up the cluster servers", async () => {
        const recs = await dns.resolveSrv(`_mongodb._tcp.${host}`);
        if (!recs.length) throw new Error("no servers returned");
        target = { host: recs[0].name, port: recs[0].port };
        return `${recs.length} servers, first: ${recs[0].name}`;
      });
      checks.push(dnsCheck);
    } else {
      const port = Number(m?.[2]?.split(",")[0].split(":")[1]) || 27017;
      target = { host, port };
    }

    if (target.host !== host || !isSrv) {
      checks.push(await timed("Network: open a connection to the database server", () => tcp(target.host, target.port)));
      checks.push(await timed("TLS: secure handshake with the database server", () => tlsHandshake(target.host, target.port)));
    }

    checks.push(
      await timed("Driver: connect and ping the database", async () => {
        const c = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
        try {
          await c.connect();
          await c.db(dbName).command({ ping: 1 });
          return "ping ok";
        } finally {
          await c.close().catch(() => {});
        }
      })
    );
  }

  // Plain-language reading of the results.
  const by = (prefix: string) => checks.find((c) => c.name.startsWith(prefix));
  let hint = "All checks passed. The database is reachable from this server.";
  if (!uri) hint = "MONGODB_URI is not set for this environment. Add it in Vercel (Settings, Environment Variables) for Production, then redeploy.";
  else if (by("DNS") && !by("DNS")!.ok) hint = "This server cannot look up the cluster address. The connection string may be wrong, or DNS is blocked.";
  else if (by("Network") && !by("Network")!.ok) hint = "This server cannot reach the database port. Check the cluster hostname and that the cluster is running (not paused).";
  else if (by("TLS") && !by("TLS")!.ok) hint = "The server can reach the database but Atlas closes the secure connection. This means Atlas is rejecting this server's IP address. In Atlas, open Network Access and check that 0.0.0.0/0 is listed as Active, in the same project as this cluster. Changes can take several minutes to apply.";
  else if (by("Driver") && !by("Driver")!.ok) hint = "The network and TLS steps work but the driver cannot log in. Check the username and password in MONGODB_URI, and that the database user exists in this Atlas project.";

  const failed = checks.some((c) => !c.ok && !c.name.startsWith("Outbound"));

  return (
    <>
      <h1 className="mb-1 text-2xl font-bold">Diagnostics</h1>
      <p className="mb-5 text-sm text-muted">Database connection test, run from the server serving this page.</p>

      <div className={`mb-4 rounded-lg p-4 text-sm font-medium ${failed ? "pill-fail" : "pill-pass"}`} role="status">
        {hint}
      </div>

      <div className="card">
        <table className="tbl tbl-wrap">
          <tbody>
            {info.map(([k, v]) => (
              <tr key={k}><th className="w-48">{k}</th><td>{v}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <table className="tbl tbl-wrap">
          <thead><tr><th>Check</th><th>Result</th><th>Details</th><th>Time</th></tr></thead>
          <tbody>
            {checks.map((c) => (
              <tr key={c.name}>
                <td className="font-medium">{c.name}</td>
                <td className={c.ok ? "ok" : "bad"}>{c.ok ? "PASS" : "FAIL"}</td>
                <td className="font-mono text-xs">{c.detail}</td>
                <td className="text-muted">{c.ms} ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
