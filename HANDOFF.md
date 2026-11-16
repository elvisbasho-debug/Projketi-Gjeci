# PAKETIM I PROJEKTIT — Finbot
### Dokument për ta vazhduar punën në një bisedë/chat tjetër, pa humbur asgjë

> Lexoje këtë të parin. Përmban gjithçka: çfarë është projekti, si punon, çfarë
> është ndërtuar, si të nisësh, si ta vësh online, dhe çfarë ka mbetur për të bërë.

---

## 1. Si ta rifillosh në një chat të ri (hapi i parë)
Ke dy mënyra për ta pasur kodin te biseda e re:
- **Mënyra A (e sigurt tani):** ke skedarin **`finbot-projekti.zip`** (ta dërgova në bisedë).
  Shkarkoje dhe ruaje. Në bisedën e re, ngarkoje ose jepja kodin.
- **Mënyra B (ideale):** vendos kodin në **GitHub** (kërkon lejen e Claude GitHub App — shih pikën 11).
  Pastaj çdo bisedë e re e merr kodin automatikisht nga repo-ja.

**Mesazhi i parë që i jep bisedës së re (kopjoje):**
> "Po vazhdoj një projekt ekzistues: **Finbot**, një platformë kontabiliteti e
> automatizuar (klon funksional i Virtual Accountant) në Node.js. Kam skedarin
> `HANDOFF.md` me gjithë kontekstin — lexoje. Dua të vazhdoj nga [thuaj çfarë:
> p.sh. vendosja online te Render / lidhja e domain-it finbot.magmabots.com /
> konektorët realë]."

---

## 2. Çfarë është Finbot
Platformë web për **studiot/kontabilistët** që menaxhojnë shumë **subjekte**
(tatimpagues) dhe ekzekutojnë **robotë (RPA)** për deklarime e kontrolle.
Dizajn dhe markë **origjinale** (blu/e verdhë/jeshile), e frymëzuar nga funksionet
e Virtual Accountant — jo kopje e pamjes/markës së tyre.

## 3. Teknologjia
- **Backend:** Node.js + Express
- **Baza:** SQLite (better-sqlite3) — një skedar (`finbot.db`)
- **Robotë & PDF:** Playwright (Chromium)
- **Siguria:** JWT + bcrypt (login); AES-256-GCM (enkriptim i fjalëkalimeve e-Albania)
- **ZIP:** archiver
- **Frontend:** HTML/CSS/JavaScript i thjeshtë (SPA, pa framework)
- **Vendosja:** Docker

## 4. Struktura e skedarëve
```
server.js                # nisja: health, auto-seed, montimi i rrugëve, motori
src/
  db.js                  # skema + migrime + katalogu i 11 shërbimeve
  auth.js  crypto.js     # role/JWT + enkriptim kredencialesh
  engine.js  profiles.js # motori i automatizimit + profilet e shërbimeve
  pdf.js                 # PDF/ZIP (Playwright + archiver)
  seed.js                # mbjellja e të dhënave fillestare
  robots/                # 11 konektorë + base.js + index.js
  routes/                # auth, users, subjects, services, executions,
                         #   notifications, tickets, va, reports, settings
public/                  # index.html, app.js, styles.css, mock-portal.html
Dockerfile  docker-compose.yml  render.yaml  .env.example
README.md  UDHEZIMI.md  VENDOSJA-ONLINE.md  HANDOFF.md
```

## 5. Funksionet e ndërtuara (të gjitha punojnë)
- **Paneli** — shërbime të disponueshme/aktive, përdorimi mujor, subjekte, rekordet e fundit.
- **Subjektet** — CRUD me NIPT + fjalëkalim e-Albania/Self-Care të **enkriptuar**
  (nuk kthehet kurrë në tekst). Import/Eksport CSV. Pamje e detajuar me të gjitha shërbimet.
- **11 Shërbime (robotë)** me kuota mujore: Mbledhje faturash, Deklarim TVSH,
  Detyrime realtime, Xhiro/shpenzime, Krahasim TVSH, Tatim në Burim (Qira),
  Listëpagesa (Esig-25), Dogana, Dokumente C@ts, Të padeklaruara, PASH.
- **Automatizimi** — radhë ekzekutimesh në kohë reale (Në radhë → Në ekzekutim →
  Kryer/Dështoi), riprovime, log-e, statistika, ndalim. Rifreskim automatik.
- **Ekzekutim masiv** — zgjidh një shërbim → ekzekuto për të gjitha subjektet njëherësh.
- **Rekorde** për çdo subjekt×shërbim, me të dhëna specifike + eksport **CSV / PDF / ZIP**.
- **Pyet VA** — asistent që përmbledh gjendjen (dështimet, kuotat, TVSH).
- **Njoftime** (automatike kur dështon një ekzekutim), **Mbështetje (bileta)**.
- **Përdorues & role**, **Regjistër veprimesh (audit)**, **Cilësime**.

## 6. Sistemi i roleve — "owner i fshehtë"
- **owner** (pronar): të drejta të plota, **i padukshëm** për të gjithë të tjerët.
- **admin**: të drejta të plota operative, **pa dijeni/akses te owner-i**.
- **accountant**: subjekte/shërbime/ekzekutime. **viewer**: vetëm lexim.
- Owner-i mund ta **pezullojë/fshijë** admin-in; tentativat e admin-it për owner-in
  regjistrohen (`tentoi_akses_owner`). Të testuara dhe funksionale.

## 7. Robotët / konektorët (RPA)
- Motori (`src/engine.js`) për çdo shërbim kontrollon te `src/robots/<kodi>.js`.
- Me `ROBOTS_REAL=1` ngarkohen 11 konektorët realë; ndryshe **simulim** (`profiles.js`).
- Shembulli i plotë: `src/robots/tvsh_deklarim.js` hap browser (Playwright), hyn në
  **portal demo** (`public/mock-portal.html`) me kredencialet e subjektit, lexon vlerat.
- **Për portalet reale** (e-Albania/Self-Care/C@ts/DIVA/Doganë): te secili konektor
  vendos URL-në reale dhe hapat; login-i me kredencialet është gati. Kërkon
  **autorizim ligjor** nga klientët.

## 8. Si të nisësh (në kompjuter / zhvillim)
```bash
npm install
npm run seed      # krijon llogaritë + të dhëna demo
npm start         # http://localhost:3000
```
**Llogaritë fillestare** (ndryshoji pas hyrjes):
- Owner (i fshehtë): `owner@finbot.al` / `Owner1234!`
- Admin: `admin@finbot.al` / `Admin1234!`

## 9. Vendosja online (gati — shih VENDOSJA-ONLINE.md)
- **Host:** Render.com (lexon `render.yaml` vetë; Docker; HTTPS falas).
- **Domain:** `finbot.magmabots.com` → CNAME te DNS-i yt drejt Render.
- **Netlify** nuk e mban dot programin (është për faqe statike); përdoret vetëm për DNS.

## 10. Kostot mujore (orientuese — verifiko te render.com/pricing)
- **Provë:** 0 USD (Render Free — të dhënat humbasin te rifreskimi; vetëm për test).
- **Real minimal:** ~7 USD/muaj (Render Starter + Disk 1GB).
- **Real i rekomanduar:** ~25 USD/muaj (Render Standard 2GB + Disk).
- **Domain:** ~1 USD/muaj (e ke tashmë). HTTPS: falas.
- **Rregulli i të dhënave:** shto **Disk-un te `/data` PARA** se të fusësh të dhëna reale → nuk humbet asgjë.

## 11. Çfarë ka mbetur pezull (hapat e ardhshëm)
1. **GitHub (bllokuar):** jepi lejen Claude GitHub App te
   `elvisbasho-debug/Projketi-Gjeci` nga https://claude.ai/connect-github →
   pastaj kodi dërgohet (push) dhe Render e merr.
2. **Render:** krijo llogari → New + → Blueprint → zgjidh repo-n → vendos
   OWNER_PASS/ADMIN_PASS → Apply.
3. **Domain:** Render → Custom Domains → `finbot.magmabots.com` → shto CNAME te DNS.
   (Më duhet të di ku menaxhohet DNS-i: Netlify / Cloudflare / regjistruesi.)
4. **Disk** (për përdorim real): Render → Settings → Disks → `/data`, 1GB.
5. **Konektorët realë:** plotëso portalet e vërteta te `src/robots/` kur të kesh
   qasjen + autorizimin ligjor.

## 12. Historiku i vendimeve (nga biseda jonë)
- Kërkesa: klon funksional i Virtual Accountant, me rol owner të fshehtë + admin.
- Markë **Finbot**; paletë **e bardhë/blu/e verdhë/jeshile**; logo origjinale.
- Pas screenshot-eve të VA: u rindërtua si **platformë me subjekte + robotë**, jo aplikacion i thjeshtë faturimi.
- Robotët: **me kredencialet e klientit** (si VA), të ruajtura të enkriptuara.
- U shtuan: 11 konektorë, ekzekutim masiv, CSV/PDF/ZIP, pamja e subjektit, njoftime automatike.
- Vendosje: **Render** (jo Netlify); domain `finbot.magmabots.com` via CNAME.
- Udhëzimet u shkruan **për ekonomist** (jo programues).

## 13. Commit-et (historiku i plotë ruhet te .git brenda zip-it)
Nëntë hapa kryesorë, nga "Defteri" fillestar → rebranding Finbot → platforma e plotë
→ konektorët + ekzekutim masiv → paketimi i vendosjes. (`git log` i tregon të gjithë.)

---

### Shënim i rëndësishëm për të mos humbur punën
Kodi tani ndodhet brenda kësaj seance pune dhe te skedari **`finbot-projekti.zip`**.
Për ta ruajtur përgjithmonë dhe për ta vazhduar lehtë nga kudo, **dërgoje në GitHub**
(pika 11). Deri atëherë, mbaje zip-in të ruajtur.
