# Si ta vësh Finbot-in online VETË (vetëm me shfletues)

Pa terminal, pa server, pa IT. Vetëm klikime në shfletues. Koha: ~15 minuta.
Unë (Claude) e kam bërë pjesën teknike; ti ndjek hapat më poshtë.

---

## Çfarë të duhet
- Një llogari **GitHub** (falas) — ku rri kodi.
- Një llogari **Render.com** (falas) — që e mban faqen online.
- 2 fjalëkalime që i zgjedh ti (për Pronarin dhe Admin-in).

> Kodi është vendosur tashmë në GitHub nga unë. Ti vetëm e lidh me Render.

---

## Hapat

### 1) Hap një llogari në Render
- Shko te **https://render.com** → **Get Started** → **Sign up with GitHub**.
- Lejo Render të shohë llogarinë tënde GitHub (klikim "Authorize").

### 2) Krijo shërbimin nga "Blueprint"
- Në Render shtyp **New +** (lart djathtas) → **Blueprint**.
- Zgjidh repo-n **`Projketi-Gjeci`** nga lista.
- Render do të lexojë vetë skedarin `render.yaml` dhe do të tregojë një shërbim me emrin **finbot**.

### 3) Vendos 2 fjalëkalimet e tua
Render do të kërkojë dy vlera (sepse i lamë bosh me qëllim, për siguri):
- **OWNER_PASS** → fjalëkalimi yt si Pronar (zgjidh një të fortë, p.sh. 12+ shkronja/numra).
- **ADMIN_PASS** → fjalëkalimi i Admin-it (nëse do një ndihmës).

> Çelësat e tjerë (JWT_SECRET, CRED_KEY) i krijon Render vetë — mos i prek.

### 4) Shtyp "Apply" / "Create"
- Render fillon ndërtimin. Zgjat **3–6 minuta** (po shkarkon gjithçka vetë).
- Kur të shkruajë **"Live"** me jeshile, është gati.

### 5) Hap faqen tënde
- Render të jep një adresë si **`https://finbot-xxxx.onrender.com`**.
- Hape → do shohësh ekranin e hyrjes së Finbot.
- Hyr me: **owner@finbot.al** dhe fjalëkalimin që vendose te OWNER_PASS.
- Ndrysho emailin/fjalëkalimin nga **Profili im** pas hyrjes së parë.

Gati — faqja jote është online dhe e gjallë. 🎉

---

## E rëndësishme për përdorim REAL (jo vetëm provë)

**a) Mos i humb të dhënat.** Plani falas i Render e fshin bazën sa herë rifreskohet.
Për ta ruajtur përgjithmonë:
- Në Render → shërbimi **finbot** → **Settings** → **Disks** → **Add Disk**.
- Emri: `finbot-data`, **Mount Path:** `/data`, Madhësia: `1 GB`. Ruaj.
- (Kjo kërkon një plan me pagesë — shiko pikën c.)

**b) Memoria (për PDF dhe robotë).** Nëse PDF-të ose robotët japin gabim "memory",
kalo te një plan me **2 GB RAM**: Render → finbot → **Settings** → **Instance Type** → zgjidh **Standard**.

**c) Kostoja (orientuese).** Provë = falas. Përdorim real me ruajtje të dhënash dhe
memorie të mjaftueshme ≈ **7–25 USD/muaj**. Pagesa bëhet te Render.

**d) Robotët realë.** Sot robotët simulojnë. Për deklarim të vërtetë në portalet e
tatimeve më thuaj dhe të ndihmoj ta plotësojmë konektorin e parë hap pas hapi.

---

## Lidhja e domain-it tënd (finbot.magmabots.com)

Programi punon te Render; adresa e bukur `finbot.magmabots.com` tregohet nga Render me një rregull DNS.

**Hapi 1 — te Render:**
- Render → shërbimi **finbot** → **Settings** → **Custom Domains** → **Add Custom Domain**.
- Shkruaj: `finbot.magmabots.com` → Render të jep një vlerë **CNAME** (diçka si `finbot-xxxx.onrender.com`). Kopjoje.

**Hapi 2 — te vendi ku menaxhohet DNS-i i magmabots.com** (Netlify, Cloudflare, ose ku e ke blerë domain-in):
- Shto një regjistrim të ri **CNAME**:
  - **Name / Host:** `finbot`
  - **Value / Target:** vlera që të dha Render (`finbot-xxxx.onrender.com`)
  - Ruaj.
- Nëse DNS-i yt është te **Netlify**: Netlify → **Domains** → magmabots.com → **Add new record** → Type **CNAME**, Name `finbot`, Value = vlera nga Render.

**Hapi 3 — prit pak:**
- Pas 5–30 minutash (ndonjëherë deri 1 orë) adresa fillon të punojë.
- Render e vendos vetë **HTTPS-në** falas për `finbot.magmabots.com`.

> Shënim: Netlify (ose kushdo tjetër) përdoret vetëm për DNS-in e adresës. Programi punon te Render.

---

## Nëse ngec diku
Më shkruaj çfarë shfaqet në ekran (ose dërgo një foto) dhe të them saktë ku të klikosh.
Gabimet më të shpeshta:
- "Blueprint nuk gjen repo-n" → sigurohu që te hapi 1 i dhe Render leje për repo-n.
- "Build failed" → dërgomë tekstin e gabimit; zakonisht zgjidhet me një ndryshim të vogël.
- Faqja hapet por s'hyn dot → sigurohu që vendose OWNER_PASS te hapi 3.
