# Defteri — Kontabilitet Online

Platformë kontabiliteti për biznese të vogla: fatura, klientë, produkte/shërbime,
shpenzime, TVSH dhe raporte — me një sistem rolesh që përfshin një **pronar (owner)
të fshehtë**.

> Ky është një aplikacion i pavarur, origjinal. Nuk përmban marka, pamje apo kod të
> kopjuar nga platforma të tjera; frymëzohet vetëm nga funksionaliteti standard i
> kontabilitetit.

## Çfarë bën

- **Panel (Dashboard)** — të ardhura, shpenzime, fitim, TVSH, qarkullim 12-mujor.
- **Fatura** — krijim me shumë artikuj, TVSH automatike, numër serial (`FAT-VITI-NNNN`),
  statuse (draft / dërguar / paguar / vonuar / anuluar), printim.
- **Klientë** — regjistër me NIPT, kontakte, kërkim.
- **Produkte & Shërbime** — çmime dhe normë TVSH, të përdorshme në fatura.
- **Shpenzime** — me TVSH të zbritshme.
- **Raporte & TVSH** — deklaratë TVSH për periudhë (shitje – blerje).
- **Përdorues & role** — menaxhim ekipi.
- **Regjistri i veprimeve (audit)** — kush bëri çfarë e kur.
- **Cilësimet** — të dhënat e kompanisë (emër, NIPT, monedhë, IBAN, TVSH default).

## Sistemi i roleve

| Roli | Të drejtat |
|------|-----------|
| **owner** (pronar) | Të drejta të plota. **I padukshëm** për të gjithë të tjerët. Vetëm owner-i krijon/heq admin dhe sheh regjistrin e plotë. |
| **admin** | Të drejta të plota operative (përdorues, fatura, klientë, cilësime), **por nuk e di që owner-i ekziston** dhe nuk mund ta prekë. |
| **accountant** (kontabilist) | Krijon/ndryshon fatura, klientë, produkte, shpenzime. Pa menaxhim përdoruesish. |
| **viewer** (vëzhgues) | Vetëm lexim. |

### Logjika e "owner-it të fshehtë"
- Në çdo listë/kërkesë, llogaritë me rol `owner` **filtrohen** nëse kërkuesi s'është owner
  (nuk shfaqen, nuk numërohen).
- Nëse një admin provon të hapë/ndryshojë/fshijë një owner përmes ID-së, serveri përgjigjet
  **"nuk ekziston"** (404) dhe e shënon tentativën në regjistër (`tentoi_akses_owner`).
- Owner-i mund ta **pezullojë ose fshijë** admin-in në çdo moment ("abuzim besimi"); admin-i
  i pezulluar nuk hyn dot.
- Owner-i sheh në regjistër çdo veprim, përfshirë tentativat e admin-it.

## Nisja

```bash
npm install
npm run seed     # krijon owner-in, admin-in dhe pak të dhëna demo
npm start        # http://localhost:3000
```

### Llogaritë fillestare (ndryshoji fjalëkalimet pas hyrjes)

| Roli | Email | Fjalëkalimi |
|------|-------|-------------|
| Owner (i fshehtë) | `owner@defteri.al` | `Owner1234!` |
| Admin | `admin@defteri.al` | `Admin1234!` |

Mund t'i ndryshosh me variabla mjedisi para `npm run seed`:
`OWNER_EMAIL`, `OWNER_PASS`, `ADMIN_EMAIL`, `ADMIN_PASS`.

## Teknologjia

- **Backend:** Node.js + Express + SQLite (`better-sqlite3`)
- **Auth:** JWT (cookie httpOnly) + bcrypt
- **Frontend:** HTML/CSS/JavaScript i pastër (SPA, pa framework)
- Baza e të dhënave: skedar lokal `data.db` (krijohet automatikisht)

## Konfigurim (variabla mjedisi, opsionale)

| Variabël | Përshkrim | Default |
|----------|-----------|---------|
| `PORT` | Porta e serverit | `3000` |
| `JWT_SECRET` | Çelësi i token-ave | *(ndryshoje në prodhim)* |
| `DB_PATH` | Vendndodhja e bazës | `./data.db` |

## Struktura

```
server.js            # pika e nisjes + montimi i rrugëve
src/
  db.js              # skema + migrime + cilësime fillestare
  auth.js            # JWT, bcrypt, middleware rolesh
  audit.js           # regjistrimi i veprimeve
  seed.js            # mbjellja e të dhënave fillestare
  routes/            # auth, users, clients, products, invoices, expenses, reports, settings
public/
  index.html, app.js, styles.css   # ndërfaqja
```

## Siguria — shënime për prodhim

- Vendos një `JWT_SECRET` të fortë.
- Përdor HTTPS (cookie-t janë `sameSite=lax`, shto `secure` pas HTTPS).
- Ndrysho fjalëkalimet default menjëherë.
