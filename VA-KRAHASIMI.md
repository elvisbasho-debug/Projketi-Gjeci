# Krahasimi: Virtual Accountant (VA) ↔ Finbot

Shënuar më 16 Nov 2026 nga shfletimi i llogarisë VA (vetëm lexim).
Këtu ka **vetëm funksione**: asnjë të dhënë klienti, tekst, logo apo dizajn të VA-së.

Shenjat: ✅ Finbot e ka · 🟡 e ka pjesërisht · ❌ mungon

## 1. Struktura e përgjithshme
| Funksioni te VA | Finbot |
|---|---|
| Paneli: shërbime të disponueshme/aktive, përdorimi mujor (x / kuota), subjekte, rekordet e fundit | ✅ |
| Paneli: data e rinovimit të kuotës për çdo shërbim + kërkim shërbimesh | 🟡 rinovimi ka, kërkimi te paneli jo |
| Rekordet e fundit me "Hap shërbimin" / "Shiko rekordin" (link i drejtpërdrejtë te rekordi) | 🟡 pa link direkt te rekordi |
| Subjektet: kërkim sipas rekordit/subjektit/NIPT/shërbimit + filtër shërbimi + "Pastro" | 🟡 |
| Automatizimi: radha, ekzekutime gjithsej, rezultatet, **koha mediane**, ekzekutimi i fundit, Log-et, kërkim + filtër | 🟡 koha mediane mungon |
| Njoftimet, Mbështetje (bileta me kërkim) | ✅ |
| Cilësimet: profili, ndryshim fjalëkalimi, **temë e çelët/e errët**, **gjuhë Shqip/Anglisht** | 🟡 tema dhe gjuha mungojnë |
| Pamje mobile me shirit poshtë (Kreu, Shërbimet, AI, Kërko, Menu) | ❌ |

## 2. Faqja e çdo shërbimi (e njëjtë për të 11)
| Funksioni | Finbot |
|---|---|
| Tabela: #, statusi i subjektit, emri, NIPT, përditësuar + kolona **specifike për shërbimin** | 🟡 Finbot ka një "Vlerë kryesore"; VA ka 1–3 kolona të veçanta (shih §3) |
| Kërkim (transaksion, subjekt, NIPT, email, status) + **Filtra** | ❌ |
| "Shfaq panelin" (panel informues i shërbimit) | ❌ |
| "Shfaq detajet e rezultateve" (checkbox që zgjeron tabelën) | ❌ |
| Renditje sipas kolonave | ❌ |
| Shto subjekt | ✅ |
| **Importo ▾**: Importo skedar · **Importo nga shërbimet e tjera** · **Shkarko template importi** | 🟡 vetëm CSV te Subjektet |
| Eksporto | ✅ |
| **Datat masive**: data fillimi/mbarimi për të gjitha rekordet e shërbimit | ❌ |
| **Veprime ▾**: veprime specifike të shërbimit (p.sh. "Mblidh blerjet", "Mblidh shitjet") + **Fshi të gjitha subjektet** | 🟡 Finbot ka vetëm "Ekzekuto të gjitha" |
| Rifresko, **Ndalo** (ndalo shërbimin) | 🟡 Ndalo vetëm te Automatizimi |
| Udhëzues për shërbimin (p.sh. Udhëzuesi i TVSH-së) | ❌ |
| Numërues "x / y" subjekte | ❌ |

## 3. Kolonat specifike sipas shërbimit
| Shërbimi | Kolonat te VA |
|---|---|
| Mbledhja e faturave (Self-Care) | Status blerje · Status shitje |
| Deklarimi & Info TVSH | Status deklarim · Statusi info · Kredi · TVSH mujore · Totali |
| Detyrimet në kohë reale | Statusi · Detyrime gjithsej |
| Xhiro dhe shpenzime | Statusi · Të ardhurat · Shpenzimet · Bilanci i transaksioneve |
| Krahasimi TVSH (Selfcare vs C@ts) | Statusi · Rezultati i krahasimit |
| Tatim në burim (Qira) | Rezultati i deklarimit |
| Listëpagesa (Esig-25) | Statusi i rezultatit |
| Doganat (Importe) | Statusi · Totali doganor |
| Dokumentet C@ts | Statusi · Dokumenta |
| Deklaratat e padeklaruara | Statusi · Deklarata · **Afati më i afërt** |
| PASH | Statusi i mbledhjes · Të ardhura nga shitja · Fitimi neto / Humbja e vitit |

## 4. Pamja e rekordit (subjekt × shërbim), dritare me skeda
Shembulli i parë: TVSH.
| Skeda / funksioni | Finbot |
|---|---|
| **Home**: statusi, përditësuar, përshkrimi i rezultatit; butona veprimi (p.sh. Deklaro / Kontrollo deklarimin) | 🟡 Finbot ka modal "Detaje" pa veprime |
| Seksion **PDF**: periudhë datash → "Mblidh deklaratat në PDF" → "Shkarko PDF-të (.zip)" | 🟡 PDF/ZIP ka, pa zgjedhje periudhe |
| Seksion "Info": veprim i veçantë mbledhjeje (p.sh. Mblidh TVSH-në) | ❌ |
| Skeda me historik pagesash (Data · Shuma · Periudha · Lloji) + Eksporto | ❌ |
| **Statistika**: tabelë muaj × 3 vite, totale vjetore, filtër muajsh, Raport PDF, Maksimizo | ❌ |
| **Pyet VA brenda rekordit**: pyetje të sugjeruara mbi të dhënat e atij rekordi | ❌ (Finbot ka Pyet VA vetëm global) |
| **Regjistri**: aktivitet në kohë reale për rekordin, kërkim + filtër niveli (Info/Sukses/Paralajmërim/Gabim) | 🟡 log-e ka për ekzekutim, jo për rekord |
| **Cilësimet e subjektit** (emri, NIPT, fjalëkalim e-Albania i fshehur, statusi) + Fshi / Ruaj | ✅ te Subjektet, jo brenda rekordit |
| Link me URL për çdo rekord/skedë (`?recordId=…&recordPane=…`) | ❌ |

## 5. Pyet VA
| Funksioni | Finbot |
|---|---|
| Bisedë mbi të gjitha shërbimet ose **mbi një subjekt të zgjedhur** ("Analizo subjektin") | 🟡 pa zgjedhje subjekti |
| Butona të shpejtë: Përmbledhje · Dështimet · Përdorimi | 🟡 |
| Bisedë e re / historik bisedash | ❌ |

## 6. Çfarë ka Finbot që VA nuk e shfaq
Role (owner i fshehtë / admin / accountant / viewer), menaxhim përdoruesish, regjistër auditimi, ekzekutim masiv nga faqja e shërbimeve.

---
## Renditja e propozuar për ndërtim
1. **Faqja e shërbimit**: kërkim, filtra, renditje, kolona specifike sipas shërbimit, Veprime ▾, Importo ▾ (me template dhe import nga shërbime të tjera), Datat masive, Ndalo, numërues.
2. **Pamja e rekordit me skeda**: Home me veprime, PDF me periudhë, historik, Statistika, Regjistri, Cilësimet, URL e drejtpërdrejtë.
3. **Pyet VA** për subjekt të zgjedhur + pyetje të sugjeruara te rekordi.
4. **Cilësimet**: temë e errët, gjuhë SQ/EN.
5. **Automatizimi**: koha mediane, filtra. **Paneli**: kërkim shërbimesh, link te rekordi.
6. **Mobile**: shirit navigimi poshtë.
