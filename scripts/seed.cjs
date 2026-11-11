// Local testing only: fills the DEV database with sample jig data.
// Usage: npm run seed          (adds sample rows)
//        npm run seed -- --reset   (clears dev data first)
require("./dns-fix.cjs");
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
const get = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m")) || [])[1]?.trim();
const uri = get("MONGODB_URI");
const dbName = get("MONGODB_DB");

// Safety: never touch the production database.
if (!uri || !dbName || !dbName.endsWith("_dev")) {
  console.error(`Refusing to seed: MONGODB_DB must end with "_dev" (got "${dbName}").`);
  process.exit(1);
}

const people = ["Ramesh", "Suresh", "Karthik", "Anand"];
const approvers = ["Manager A", "Manager B"];
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

(async () => {
  const client = await new MongoClient(uri).connect();
  const db = client.db(dbName);
  const tests = db.collection("jig_tests");
  const ssr = db.collection("jig_ssr");
  const counters = db.collection("counters");

  if (process.argv.includes("--reset")) {
    await Promise.all([tests.deleteMany({}), ssr.deleteMany({}), counters.deleteMany({})]);
    console.log("Cleared dev data");
  }
  await ssr.createIndex({ id: 1 }, { unique: true });

  const COUNT = 30;
  const now = Date.now();
  let seq = (await counters.findOne({ _id: "jig_ssr" }))?.seq ?? 0;

  // Walk forward in time from ~10 days ago so ids increase with time.
  let clock = now - 10 * 24 * 3600 * 1000;
  for (let i = 0; i < COUNT; i++) {
    clock += rand(5, 9) * 3600 * 1000;
    const t = new Date(Math.min(clock, now - 60 * 1000));
    const sno = `MUX${1001 + (i % 12)}`;
    // Pass needs SSR 1-3 on and both voltages between 11 V and 14 V (values in mV).
    const failed = Math.random() < 0.25;
    const lowVolt = failed && Math.random() < 0.5; // half of the failures are low voltage
    const ssrs = [1, 1, 1, 1];
    if (failed && !lowVolt) ssrs[rand(0, 2)] = 0;

    await tests.insertOne({
      sno,
      testby: people[rand(0, people.length - 1)],
      appby: approvers[rand(0, approvers.length - 1)],
      created_at: new Date(t.getTime() - 60 * 1000),
    });
    await ssr.insertOne({
      id: ++seq,
      sno,
      delay: rand(1500, 2300),
      voutm: lowVolt ? rand(2000, 10500) : rand(11000, 13900),
      vout_a: lowVolt ? rand(0, 10500) : rand(11000, 13900),
      ssr_1: ssrs[0], ssr_2: ssrs[1], ssr_3: ssrs[2], ssr_4: ssrs[3],
      created_at: t,
    });
  }
  await counters.updateOne({ _id: "jig_ssr" }, { $set: { seq } }, { upsert: true });
  console.log(`Seeded ${COUNT} sample tests into "${dbName}"`);
  await client.close();
})().catch((e) => { console.error(e.message); process.exit(1); });