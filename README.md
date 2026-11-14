# Finbot — Platformë Kontabiliteti e Automatizuar

Platformë për **studiot/kontabilistët** që menaxhojnë shumë **subjekte** (tatimpagues)
dhe ekzekutojnë **robotë (RPA)** për deklarime e kontrolle. Përfshin katalog shërbimesh
me kuota, radhë automatizimi në kohë reale, ruajtje të enkriptuar të kredencialeve,
asistent "Pyet VA", mbështetje me bileta dhe sistem rolesh me **pronar (owner) të fshehtë**.

> Aplikacion i pavarur, origjinal. Nuk përmban marka, pamje apo kod të kopjuar nga
> platforma të tjera — frymëzohet vetëm nga funksionaliteti standard i kontabilitetit.

## Funksionet

- **Paneli** — shërbime të disponueshme/aktive, përdorimi mujor, subjekte, rekordet e fundit.
- **Subjektet** — tatimpagues me NIPT dhe **fjalëkalim e-Albania/Self-Care të enkriptuar** (AES-GCM); kredencialet nuk kthehen kurrë në tekst. Import/Eksport CSV.
- **11 Shërbime (robotë)** me kuota mujore: Mbledhje faturash, Deklarim TVSH, Detyrime realtime + Urdhërpagesa, Xhiro/shpenzime, Krahasim TVSH, Tatim në Burim (Qira), Listëpagesa (Esig-25), Deklaratë Doganore, Kontroll dokumentesh (C@ts), Deklarata të padeklaruara, PASH.
- **Automatizimi** — radhë ekzekutimesh në kohë reale (Në radhë → Në ekzekutim → Kryer/Dështoi), riprovime, log-e, statistika, ndalim.
- **Rekorde** për çdo subjekt×shërbim, me të dhëna specifike + eksport **CSV / PDF / ZIP**.
- **Pyet VA** — asistent që përmbledh gjendjen e platformës.
- **Njoftime**, **Mbështetje (bileta)**, **Cilësime**, **Përdorues & role**, **Regjistër veprimesh**.

## Sistemi i roleve

| Roli | Të drejtat |
|------|-----------|
| **owner** (pronar) | Të drejta të plota. **I padukshëm** për të gjithë. Vetëm owner-i menaxhon admin dhe sheh regjistrin e plotë. |
| **admin** | Të drejta të plota operative, **pa dijeni/akses te owner-i**. |
| **accountant** | Subjekte, shërbime, ekzekutime, eksporte. Pa menaxhim përdoruesish. |
| **viewer** | Vetëm lexim. |

Owner-i mund ta **pezullojë/fshijë** admin-in; çdo tentativë e admin-it për owner-in shënohet në regjistër (`tentoi_akses_owner`).

## Robotët (RPA)

Motori (`src/engine.js`) përpunon radhën e ekzekutimeve. Për çdo shërbim kontrollon
nëse ka një **konektor real** te `src/robots/<kodi>.js`; nëse po, e thërret me
kredencialet e **dekriptuara** të subjektit, përndryshe përdor **simulim** (profilet te `src/profiles.js`).

- Si parazgjedhje konektorët janë joaktivë (simulim). Aktivizoji me `ROBOTS_REAL=1`.
- Shembull funksional: `src/robots/tvsh_deklarim.js` hap një browser (Playwright), hyn në
  një **portal demo** (`public/mock-portal.html`), lexon vlerat dhe përgatit deklarimin.

### Lidhja me portalet reale
Për deklarim **real** në e-Albania/Self-Care/C@ts/DIVA/Doganë, te konektori përkatës:
1. vendos URL-në reale (`MOCK_PORTAL_URL` ose brenda modulit),
2. përshtat selektorët (fushat e hyrjes, butonat, vlerat),
3. shto hapat e deklarimit dhe trajtimin e OTP/captcha.

> Ruajtja e fjalëkalimeve të klientëve dhe deklarimi në emër të tyre kanë **përgjegjësi
> ligjore** dhe kërkojnë **autorizim** nga vetë subjektet.

## Nisja (zhvillim)

```bash
npm install
npm run seed     # krijon owner/admin dhe të dhëna demo
npm start        # http://localhost:3000
```

Llogaritë fillestare (ndryshoji pas hyrjes): `owner@finbot.al / Owner1234!` · `admin@finbot.al / Admin1234!`

## Vendosja në prodhim (Docker)

```bash
cp .env.example .env
# gjenero sekretet:
node -e "console.log('JWT_SECRET='+require('crypto').randomBytes(48).toString('hex'))"
node -e "console.log('CRED_KEY='+require('crypto').randomBytes(48).toString('hex'))"
# plotëso .env (JWT_SECRET, CRED_KEY, OWNER_PASS, ADMIN_PASS)

docker compose up -d --build
```

- Baza ruhet në volumen `finbot-data` (`/data/finbot.db`).
- Mbjellja bëhet automatikisht në nisjen e parë (kërkon `OWNER_PASS` në prodhim).
- Health: `GET /api/health`.
- Vendose pas një **reverse proxy me HTTPS** (p.sh. Nginx/Caddy). Cookie-t janë `sameSite=lax`.

### Pa Docker
```bash
NODE_ENV=production JWT_SECRET=... CRED_KEY=... OWNER_PASS=... node server.js
```

## Variablat e mjedisit

| Variabël | Përshkrim | Default |
|----------|-----------|---------|
| `PORT` | Porta | `3000` |
| `NODE_ENV` | `production` kërkon sekretet | — |
| `JWT_SECRET` | Çelësi i token-ave | *(detyrim në prodhim)* |
| `CRED_KEY` | Çelësi i enkriptimit të kredencialeve | *(detyrim në prodhim)* |
| `DB_PATH` | Vendndodhja e bazës | `./data.db` |
| `ROBOTS_REAL` | `1` aktivizon konektorët realë | `0` |
| `MOCK_PORTAL_URL` | URL-ja e portalit për robotin shembull | demo lokal |

## Struktura

```
server.js                # pika e nisjes, health, auto-seed, montimi i rrugëve
src/
  db.js                  # skema + migrime + katalogu i shërbimeve
  auth.js  crypto.js     # JWT/role + enkriptim kredencialesh (AES-GCM)
  engine.js  profiles.js # motori i automatizimit + profilet e shërbimeve
  pdf.js                 # gjenerim PDF/ZIP (Playwright + archiver)
  robots/                # konektorët e robotëve (realë, pluggable)
  routes/                # auth, users, subjects, services, executions, …
public/                  # ndërfaqja (SPA) + portali demo
Dockerfile  docker-compose.yml  .env.example
```

## Siguria

- Vendos `JWT_SECRET` dhe `CRED_KEY` të forta (serveri refuzon nisjen në prodhim pa to).
- Fjalëkalimet e subjekteve ruhen të enkriptuara (AES-256-GCM) dhe nuk kthehen kurrë në API.
- Përdor HTTPS në prodhim; ndrysho fjalëkalimet default menjëherë.
