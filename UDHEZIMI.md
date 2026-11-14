# Udhëzim për vënien në përdorim — Finbot

Ky udhëzim është shkruar **për ekonomistin/kontabilistin**, jo për programues.
Shpjegon hap pas hapi si ta kthesh Finbot-in në një **faqe reale online**, të gjallë,
që ta përdorësh çdo ditë.

---

## 1. Çfarë është Finbot

Është një program që punon në internet (si faqja që më tregove). Ti hyn me email
dhe fjalëkalim, shton **subjektet** (bizneset që mban), dhe nis **shërbimet**
(robotët) që bëjnë punën: mbledhje faturash, deklarim TVSH, listëpagesa, PASH, etj.
Çdo punë shfaqet te **Automatizimi** me statusin e vet (Në radhë / Kryer / Dështoi).

Tani gjithçka punon. Mbetet **një hap teknik**: ta vendosësh në një server që të jetë
online 24 orë, dhe (kur të duash deklarim real) t'i lidhësh robotët me portalet e
tatimeve. Më poshtë e kam ndarë në pjesë të thjeshta.

---

## 2. Tri mënyra për ta pasur online (nga më e lehta)

### Mënyra A — I kërkon një IT-je / programuesi (më e shpejta për ty)
Ti nuk ke pse ta bësh vetë. Jepi këtij personi **dosjen e projektit** dhe thuaji:

> "Më vër këtë program online, në një server me Docker, me adresë (domain) dhe me HTTPS.
> Brenda është skedari `README.md` dhe `docker-compose.yml` me gjithçka gati."

Kjo i mjafton një IT-je për ta nisur për ~1 orë. Pjesa 3 më poshtë i tregon çfarë
fjalëkalimesh të vendosë.

### Mënyra B — Një server me qira (VPS) + Docker
Nëse do ta provosh vetë ose me pak ndihmë:
1. Merr me qira një server të vogël (VPS) te një ofrues (p.sh. Hetzner, DigitalOcean,
   Contabo). Mjafton paketa më e vogël (1–2 GB RAM). Kushton pak euro në muaj.
2. Merr një **adresë** (domain), p.sh. `finbot.studioime.al`.
3. IT-ja instalon **Docker** në server, kopjon dosjen, dhe jep komandën:
   `docker compose up -d --build`
4. Vendos një **certifikatë HTTPS** (falas me Let's Encrypt) që lidhja të jetë e sigurt.

### Mënyra C — Platformë "cloud" që e pret vetë
Ka platforma ku ngarkon kodin dhe ato e mbajnë online (p.sh. Render, Railway, Fly.io).
Kanë nevojë për pak konfigurim; një IT-je e bën shpejt duke ndjekur `README.md`.

> Këshillë: për fillim, **Mënyra A** është më e qeta — gjej një person IT dhe jepi këtë dosje.

---

## 3. Fjalëkalimet e sigurisë (bëhen një herë)

Programi, para se të nisë online, kërkon dy "çelësa" sekretë dhe fjalëkalimet e
llogarive. Këta i gjeneron personi IT me dy komanda (dalin tekste të gjata të
rastësishme) dhe i vendos në një skedar `.env`. Ti thjesht duhet të vendosësh:

- **Fjalëkalimin tënd si Pronar (owner)** — llogaria kryesore, e padukshme.
- **Fjalëkalimin e Admin-it** — nëse do një person tjetër që menaxhon, por që nuk e
  di që ekziston pronari.

> Mbaji këta fjalëkalime vetëm për vete. Pronari mund ta heqë Admin-in në çdo moment.

---

## 4. Përdorimi i përditshëm (pasi të jetë online)

1. **Hyr** me email dhe fjalëkalim.
2. Te **Subjektet** → "Shto subjekt": vendos emrin, NIPT-in dhe (nëse do automatizim)
   fjalëkalimin e-Albania të atij biznesi. Fjalëkalimi ruhet i **koduar** dhe
   përdoret vetëm nga roboti.
   - Mund t'i fusësh shumë subjekte njëherësh me **Importo CSV**.
3. Te **Shërbimet**: hap një shërbim dhe shtyp **"Ekzekuto të gjitha"**, ose përdor
   **"Ekzekutim masiv"** për ta nisur për të gjitha subjektet njëherësh.
4. Te **Automatizimi**: shiko punën në kohë reale (Në radhë / Kryer / Dështoi), hap
   **Log-et** për detaje, ose **Ndalo** nëse duhet.
5. Shkarko rezultatet me **Eksporto (CSV)**, **PDF** ose **ZIP**.
6. Te **Njoftimet** të dalin automatikisht paralajmërimet kur diçka dështon.

---

## 5. Robotët realë (deklarimi i vërtetë në tatime)

Sot robotët **simulojnë** punën (që ta provosh gjithçka pa rrezik). Që ata të
deklarojnë **vërtet** në e-Albania / Self-Care / C@ts / DIVA / Doganë, duhet një hap
teknik që e bën një programues:

- Për çdo shërbim ka një skedar gati te `src/robots/` (p.sh. `pash.js`, `tvsh_deklarim.js`).
- Programuesi vendos aty **adresën reale të portalit** dhe hapat (ku të klikojë, çfarë
  të lexojë, ku të deklarojë). Pjesa e hyrjes me fjalëkalimin e subjektit është gati.
- Pastaj ndizet me një çelës (`ROBOTS_REAL=1`) dhe robotët fillojnë punën reale.

### Kujdes ligjor (e rëndësishme)
- Ti ruan fjalëkalimet e-Albania të klientëve dhe deklaron në emër të tyre. Merr
  **autorizim me shkrim** nga çdo klient për këtë.
- Deklaratat zyrtare duhet të jenë nën kontrollin tënd — kontrollo shifrat para se të
  dërgohen.

---

## 6. Çfarë t'i thuash IT-së / programuesit (kopjoje këtë)

> "Kam një program gati (Node.js + Docker). Të lutem:
> 1. Vëre online në një server me Docker, ndiq `README.md` dhe `UDHEZIMI.md`.
> 2. Lidhe me një domain dhe aktivizo HTTPS.
> 3. Gjenero `JWT_SECRET` dhe `CRED_KEY`, vendos fjalëkalimet e owner/admin te `.env`.
> 4. Kur të jemi gati për deklarime reale, plotëso konektorët te `src/robots/` me
>    portalet reale dhe ndize `ROBOTS_REAL=1`."

---

## 7. Siguria — rregulla të thjeshta

- Përdor gjithmonë **HTTPS** (lidhje e sigurt).
- Ndrysho fjalëkalimet fillestare pas hyrjes së parë.
- Mos i jep askujt fjalëkalimin tënd të Pronarit.
- Bëj **kopje rezervë** (backup) të bazës së të dhënave rregullisht (skedari `finbot.db`).

Për çdo pjesë teknike, personi IT gjen gjithçka te `README.md`.
