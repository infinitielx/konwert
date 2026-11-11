import CopyButton from "@/components/CopyButton";
import { requireUser } from "@/lib/guard";
import { VOLTAGE_AFFECTS_OVERALL, VOLT_MAX_V, VOLT_MIN_V, VOLT_PASS_MIN_V } from "@/lib/config";

export const metadata = { title: "API DOCS" };

const BASE = (process.env.NEXT_PUBLIC_BASE_URL || "https://jig.konwertindiamotors.com").replace(/\/$/, "");
const KEY_REQUIRED = Boolean(process.env.DEVICE_KEY);

type Param = [name: string, type: string, desc: string];

const endpoints: {
  title: string; path: string; summary: string; params: Param[]; example: string;
}[] = [
  {
    title: "1. Send test details",
    path: "/api/send",
    summary: "Called first when the operator submits. Saves serial number, tested by and approved by.",
    params: [
      ["sno", "text", "Serial number / part ID (required)"],
      ["testby", "text", "Tested by name"],
      ["appby", "text", "Approved by name"],
    ],
    example: "/api/send?sno=MUX1001&testby=Ramesh&appby=Manager",
  },
  {
    title: "2. Send SSR and voltage results",
    path: "/api/send_ssr",
    summary: "Called after the first request succeeds. Saves the test result shown on the dashboard.",
    params: [
      ["sno", "text", "Serial number / part ID (required)"],
      ["delay", "number", "Delay in milliseconds (1880 = 1.88 s)"],
      ["voutm", "number", "VOUT_M in millivolts (2130 = 2.13 V)"],
      ["vout_a", "number", "VOUT_A in millivolts"],
      ["ssr_1 ... ssr_4", "0 or 1", "SSR channel result, 1 = triggered (pass)"],
    ],
    example: "/api/send_ssr?sno=MUX1001&delay=1880&voutm=2130&vout_a=0&ssr_1=1&ssr_2=1&ssr_3=1&ssr_4=1",
  },
];

const arduino = `// Konwert MUX jig API (ESP32)
const char* URL  = "${BASE}/api/send?";
const char* URL1 = "${BASE}/api/send_ssr?";${
  KEY_REQUIRED ? `

// Device key is enabled: append it to every request, e.g.
// http.begin(URL + "sno=" + part_id + ... + "&key=YOUR_DEVICE_KEY");` : ""
}`;

function Code({ children }: { children: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg bg-brand-900 p-3 text-brand-50">
      <pre className="overflow-x-auto whitespace-pre-wrap break-all text-xs leading-relaxed">{children}</pre>
      <CopyButton text={children} />
    </div>
  );
}

export default async function Docs() {
  await requireUser();
  return (
    <>
      <h1 className="mb-1 text-2xl font-bold">API Docs</h1>
      <p className="mb-5 text-muted">
        How the jig (ESP32) sends data to this app. Both endpoints use <b>GET</b> and return <code>OK</code> with status 200 on success.
      </p>

      <div className="card !p-5">
        <h2 className="mb-2 font-bold">Base URL</h2>
        <Code>{BASE}</Code>
        <p className="mt-3 text-sm text-muted">
          Device key: <b>{KEY_REQUIRED ? "required, add &key=<value> to every request" : "not enabled"}</b>.
          Set <code>DEVICE_KEY</code> in the environment variables to turn it on.
        </p>
      </div>

      {endpoints.map((e) => (
        <div key={e.path} className="card !p-5">
          <h2 className="font-bold">{e.title}</h2>
          <p className="mb-3 text-sm text-muted">{e.summary}</p>
          <p className="mb-3 text-sm">
            <span className="mr-2 rounded pill-pass px-2 py-0.5 font-bold">GET</span>
            <code className="break-all">{BASE}{e.path}</code>
          </p>
          <table className="tbl tbl-wrap mb-4">
            <thead><tr><th>Parameter</th><th>Type</th><th>Description</th></tr></thead>
            <tbody>
              {e.params.map(([n, t, d]) => (
                <tr key={n}><td><code>{n}</code></td><td>{t}</td><td className="!whitespace-normal">{d}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="mb-1 text-sm font-semibold">Example</p>
          <Code>{`${BASE}${e.example}`}</Code>
        </div>
      ))}

      <div className="card !p-5">
        <h2 className="mb-2 font-bold">Arduino config</h2>
        <p className="mb-3 text-sm text-muted">Replace the two URL constants in the sketch with these.</p>
        <Code>{arduino}</Code>
      </div>

      <div className="card !p-5">
        <h2 className="mb-2 font-bold">Pass / fail rules</h2>
        <table className="tbl tbl-wrap">
          <thead><tr><th>Check</th><th>Rule</th></tr></thead>
          <tbody>
            <tr><td>Voltage range</td><td className="!whitespace-normal">{VOLT_MIN_V} V to {VOLT_MAX_V} V. A reading above {VOLT_MAX_V} V is shown as over range and fails.</td></tr>
            <tr><td>Voltage pass</td><td className="!whitespace-normal">VoutM and VoutA each pass at {VOLT_PASS_MIN_V} V or higher. The jig sends millivolts, so {VOLT_PASS_MIN_V} V is {VOLT_PASS_MIN_V * 1000}.</td></tr>
            <tr><td>SSR channels</td><td className="!whitespace-normal">SSR 1, 2 and 3 must all be 1. SSR 4 is shown but not counted.</td></tr>
            <tr><td>Overall status</td><td className="!whitespace-normal">{VOLTAGE_AFFECTS_OVERALL ? "PASS only when the SSR rule and both voltage rules pass." : "PASS when the SSR rule passes. Voltage is shown but does not change the result."}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="card !p-5">
        <h2 className="mb-2 font-bold">Responses</h2>
        <table className="tbl tbl-wrap">
          <thead><tr><th>Status</th><th>Meaning</th></tr></thead>
          <tbody>
            <tr><td>200</td><td>Saved (body is <code>OK</code>)</td></tr>
            <tr><td>400</td><td><code>sno</code> is missing</td></tr>
            <tr><td>401</td><td>Wrong or missing <code>key</code> (only when the device key is enabled)</td></tr>
            <tr><td>500</td><td>Server or database error</td></tr>
          </tbody>
        </table>
      </div>

      <div className="card !p-5">
        <h2 className="mb-2 font-bold">Other endpoints</h2>
        <table className="tbl tbl-wrap">
          <thead><tr><th>URL</th><th>Description</th></tr></thead>
          <tbody>
            <tr><td><code>/api/export?sno=&amp;from=&amp;to=</code></td><td>CSV download. All filters optional, dates as YYYY-MM-DD.</td></tr>
            <tr><td><code>/api/report/&lt;id&gt;</code></td><td>PDF inspection report on the Konwert letterhead.</td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}