# Si ta vini Finbot-in online te Render (vetëm me shfletues)

Koha: ~20 minuta. Pjesa teknike është gati (Dockerfile + `render.yaml`); ju ndiqni hapat.

---

## 0) Para se të nisni
1. **Bashkoni PR-në** në GitHub: [Pull Request #1](https://github.com/elvisbasho-debug/Projketi-Gjeci/pull/1) → **Merge pull request**.
   Render ndërton degën **`main`**.
2. (E këshillueshme) GitHub → repo → **Settings → General → Default branch** → `main`.
3. Zgjidhni një **fjalëkalim të fortë për pronarin** (të paktën 10 karaktere). Pa të, aplikacioni nuk niset.

## 1) Llogari te Render
- **https://render.com** → **Get Started** → **Sign up with GitHub** → lejoni qasjen te `Projketi-Gjeci`.

## 2) Krijoni shërbimin nga Blueprint
- Render → **New +** → **Blueprint** → zgjidhni **`Projketi-Gjeci`**.
- Render lexon `render.yaml` dhe tregon shërbimin **finbot** me:
  - planin **Starter** (~7 $/muaj, i nevojshëm sepse plani falas nuk ka disk dhe të dhënat do të humbnin),
  - diskun **finbot-data** te `/data` (1 GB), ku ruhet baza.

## 3) Plotësoni vlerat që kërkon Render
| Fusha | Çfarë vendosni |
|---|---|
| **OWNER_PASS** | fjalëkalimi juaj si pronar (i detyrueshëm, 10+ karaktere) |
| ADMIN_PASS | bosh, ose fjalëkalim për një admin të dytë të platformës |
| ANTHROPIC_API_KEY | bosh, ose çelësi për Pyet VA me Claude |
| CATS_MONTHLY_PATH / CATS_LEDGER_PATH | bosh tani (plotësohen kur të konfirmohet C@ts) |

`JWT_SECRET` dhe `CRED_KEY` i krijon Render vetë. **Mos i ndryshoni më pas**:
`CRED_KEY` enkripton fjalëkalimet e bizneseve dhe, po ta ndryshoni, ato nuk lexohen më.

## 4) Apply
- Ndërtimi zgjat **5–10 minuta**, sepse shkarkon edhe Chromium-in për PDF-të.
- Kur shfaqet **Live** me ngjyrë jeshile, aplikacioni është gati.

## 5) Hyrja e parë
- Hapni adresën që jep Render (`https://finbot-xxxx.onrender.com`).
- Hyni me **owner@finbot.al** dhe OWNER_PASS.
- Në një instalim të ri **nuk ka studio**. Shkoni te **Studiot → Studio e re**, krijoni studion e parë
  me administratorin e saj, pastaj **Hyr** për të punuar brenda saj.
- Te **Studiot → Faturat → Të dhënat e lëshuesit** plotësoni emrin, NIPT-in dhe IBAN-in tuaj për faturat.

---

## Domain-i: finbot.magmabots.com
1. Render → **finbot** → **Settings → Custom Domains → Add** → `finbot.magmabots.com`. Render jep një vlerë **CNAME**.
2. Te DNS-i i `magmabots.com` (Netlify, Cloudflare ose regjistruesi) shtoni:
   **CNAME**, Name `finbot`, Value = vlera nga Render.
3. Pritni 5–30 minuta. Render vendos vetë **HTTPS**-në.

---

## E rëndësishme
- **Memoria:** Starter ka 512 MB. Nëse PDF-të ose robotët japin gabim memorieje, kaloni te **Standard** (2 GB)
  te Render → Settings → Instance Type.
- **Kopje rezervë:** Render → Disks → **Snapshots** bën kopje ditore të diskut. Kontrollojeni që është aktiv.
- **Robotët:** sipas parazgjedhjes punojnë në simulim. Konektori real i TVSH-së aktivizohet me
  `ROBOTS_REAL=tvsh_deklarim` pasi të plotësohen adresat e C@ts (shih `docs/KONEKTORI-TVSH.md`).
- **Deklarimi real** mbetet i bllokuar pa `ROBOTS_ALLOW_DECLARE=1`. Vendoseni vetëm me autorizim me shkrim nga klientët.

## Nëse ngec diku
- **"Build failed"**: kopjoni tekstin e gabimit nga Render → Logs dhe ma dërgoni.
- **Faqja hapet por s'mund të hyni**: kontrolloni që OWNER_PASS është vendosur para nisjes së parë.
- **"Zgjidhni studion"**: si pronar, krijoni ose zgjidhni një studio te **Studiot**.
