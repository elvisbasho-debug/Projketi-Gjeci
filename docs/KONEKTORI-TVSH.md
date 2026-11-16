# Konektori real i TVSH-së: si e bën VA (vëzhguar më 16 Nov 2026)

Burimi: një ekzekutim i vetëm i "Mblidh TVSH-në" (vetëm lexim) te Virtual Accountant,
ndjekur nga regjistri i robotit. Këtu shënohet **vetëm rrjedha**, asnjë e dhënë klienti.

## Rrjedha e plotë (~55 sekonda)
| Koha | Hapi | Shënim |
|---|---|---|
| 0s | Run queued | prioritet 100; maks. 3 paralel për përdorues, 12 për organizatë |
| 0s | Collector started | |
| 0s → 52s | **AUTH** te dy portalet: **SELF_CARE** dhe **CATS** | një hyrje e vetme me kredencialet e subjektit, rreth 52s (pjesa më e ngadaltë) |
| 52s | Processor started | |
| 52s | **Pasqyra Mujore** për muajin aktual | 29 vlera libri, 4 jo-zero |
| 52s | **Libri kontabël CATS, TaxTypeId = 7** (TVSH) | 10 rreshta = periudhat e TVSH-së së paguar, 3 vitet e fundit |
| 54s | Të dhënat u përditësuan → rezultati u publikua | |

## Çfarë do të thotë për Finbot
1. **Burimi i TVSH-së është C@ts** (Tatimet), plus Self-Care. Nuk është e-Albania.
2. **Hyrja** është 90% e kohës. Duhet ruajtur **sesioni** (cookies) për çdo subjekt për disa minuta,
   që kërkesa e dytë e klientit të mos rihyjë.
3. Pas hyrjes, të dhënat merren me thirrje të shpejta (libri sipas `TaxTypeId`, pasqyra mujore),
   ka gjasa API JSON të portalit dhe jo lexim faqesh. Duhet konfirmuar duke parë portalin.
4. **Regjistri me ngjarje** (`AUTH_STARTED`, `AUTH_SUCCEEDED`, `…_STARTED/SUCCEEDED`) me fazë dhe metadata.
   Finbot e ka gati regjistrin për rekord dhe do t'i shtohen kodet e ngjarjeve.
5. **Kufijtë paralelë:** 3 për përdorues dhe 12 për studio. Finbot sot ka 3 globalisht.

## Hapi tjetër (kërkon pronarin e llogarisë)
Për të shkruar konektorin duhen adresat dhe formati i saktë i thirrjeve në C@ts / Self-Care.
Mënyra e sigurt:
- Kontabilisti hyn **vetë** në C@ts (në shfletuesin e aplikacionit) me një subjekt për të cilin ka autorizim.
- Ne shohim vetëm kërkesat e rrjetit (pa ndryshuar asgjë): hyrja, libri TVSH (TaxTypeId 7), pasqyra mujore.
- Fjalëkalimet nuk shkruhen në kod. Ruhen të enkriptuara te subjekti si sot (AES-256-GCM).
