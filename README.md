# Konwert Power MUX

Dashboard and API for the Konwert Power MUX test jig (ESP32). The jig sends each test result to this app, and the app shows live status, history, detailed reports and a PDF on the Konwert letterhead.

Live site: https://jig.konwertindiamotors.com

## Features

- **Live Status**: the latest 15 results, auto-refreshing every 5 seconds, with sortable columns, search, status filter, voltage gauges and SSR tick/cross marks.
- **History**: all results with filters (serial number, dates, status), sortable columns, paging and CSV export.
- **Detailed report**: one test with general information, SSR 1 to 4, delay and voltage gauges.
- **PDF report**: generated on the company letterhead (`assets/letter_head.pdf`).
- **API docs**: the `/docs` page lists the jig endpoints and the Arduino settings.
- **Login**: every page and download needs a signed-in session (7 days). A Sign out button sits after the theme toggle.
- **Light and dark theme** with a toggle in the header.

## Tech stack

Next.js (App Router), React, TypeScript, Tailwind CSS v4, MongoDB (Atlas), pdf-lib. Hosted on Vercel.

## Getting started

Requirements: Node.js 20 or newer and a MongoDB database (Atlas free tier works).

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Open http://localhost:3000.

### Environment variables

| Name | Required | Description |
|---|---|---|
| `MONGODB_URI` | yes | MongoDB connection string |
| `MONGODB_DB` | no | Database name. Defaults to `konwert_jig`. Use `konwert_jig_dev` locally. |
| `AUTH_USERNAME` | yes | Dashboard login username |
| `AUTH_PASSWORD` | yes | Dashboard login password. Put it in double quotes if it contains `#`. |
| `AUTH_SECRET` | yes | Random string (16+ characters) that signs login sessions |
| `DEVICE_KEY` | no | If set, the jig must add `&key=<value>` to every request |
| `NEXT_PUBLIC_BASE_URL` | no | Base URL shown on the Docs page |

Never commit `.env.local`. It is ignored by git.

Generate `AUTH_SECRET` with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. If the AUTH_ variables are missing, the site stays locked.

The jig endpoints `/api/send` and `/api/send_ssr` do not use the login (the ESP32 cannot sign in). Protect them with `DEVICE_KEY` instead.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run dev:local` | Dev server with public DNS, for networks that block `mongodb+srv://` lookups |
| `npm run build` / `npm start` | Production build and start |
| `npm run seed -- --reset` | Fill the **dev** database with sample data. It refuses to run unless `MONGODB_DB` ends in `_dev`. |

## Voltage and pass rules

Set in `src/lib/config.ts`:

- Valid range 0 to 14 V, a reading passes at 11 V or more (the jig sends millivolts).
- Overall PASS needs SSR 1, 2 and 3 on, plus both VoutM and VoutA passing. Set `VOLTAGE_AFFECTS_OVERALL` to `false` to use the SSR rule only.

## Jig API

Both endpoints use GET and return `OK` (status 200).

```
/api/send?sno=<serial>&testby=<name>&appby=<name>
/api/send_ssr?sno=<serial>&delay=<ms>&voutm=<mV>&vout_a=<mV>&ssr_1=<0|1>&ssr_2=<0|1>&ssr_3=<0|1>&ssr_4=<0|1>
```

More detail is on the `/docs` page.

## Firmware (ESP32)

The sketch is in `firmware/konwert_mux_jig/`.

1. Copy `secrets.example.h` to `secrets.h` in the same folder.
2. Fill in the Wi-Fi name, Wi-Fi password and (optionally) the device key.
3. Open `konwert_mux_jig.ino` in the Arduino IDE and upload.

`secrets.h` is ignored by git, so the Wi-Fi password is not published.

## Deploying to Vercel

1. Import this repository in Vercel (framework: Next.js).
2. Add the environment variables above (including `AUTH_USERNAME`, `AUTH_PASSWORD` and `AUTH_SECRET`). Use `MONGODB_DB=konwert_jig` for production.
3. In MongoDB Atlas, open Network Access and allow `0.0.0.0/0`. Vercel does not use fixed IP addresses.
4. In Project Settings, Domains, add `jig.konwertindiamotors.com`. At the DNS provider, add a CNAME record with host `jig` pointing to `cname.vercel-dns.com` (or the value Vercel shows).

## Project structure

```
src/app/          pages and API routes (live status, history, test report, docs, /api/*)
src/components/   header, tables, gauges, theme toggle
src/lib/          database, records, pass rules (config.ts), PDF report
assets/           letterhead PDF used by the report
public/           logo
scripts/          seed script and local DNS helper
firmware/         ESP32 sketch
```
