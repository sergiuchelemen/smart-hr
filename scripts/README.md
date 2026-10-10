# Scripturi

## seed_demo.py

Populează o companie demo cu date **fictive** (doar bibliotecă standard Python 3). Necesită backend-ul pornit
(`http://localhost:8080`) și bazele de date din `docker compose` (psql și mongosh rulează prin `docker compose exec`).

```
python3 scripts/seed_demo.py                       # companie "nordic", parola demo
python3 scripts/seed_demo.py --code acme --password 'Alta-Parola-2026!' --base-url http://localhost:8080
```

Parametri:
- `--code` (implicit `nordic`): codul companiei; emailurile sunt `prenume.nume@<cod>.example`.
- `--name` (implicit `Nordic Tech SRL`), `--seed` (implicit 2026; același seed dă aceleași date).
- `--password` (implicit `Demo-Parola-2026!`, minim 12 caractere): parola tuturor conturilor demo, inclusiv `admin@<cod>.example` (HR_ADMIN).
- `--base-url`, `--env-file` (implicit `.env` din rădăcina repo-ului; de acolo se citesc `PLATFORM_ADMIN_EMAIL`/`PLATFORM_ADMIN_PASSWORD`), `--compose-file`.
- `--real-user-email` / `--real-user-password` (opționale): adaugă un cont HR_ADMIN pe acest email, legat de angajatul „Sergiu Chelemen” (HR Manager). Fără ele, angajatul HR Manager e fictiv și nu are cont real.

Idempotent: dacă `--code` există deja, scriptul afișează un mesaj și iese fără modificări. La o rulare întreruptă la mijloc, folosește alt `--code`.

Ce creează:
- compania, 10 departamente în ierarhie, 14 posturi, 81 de angajați (hireDate 2016-2026) cu ierarhie de manageri, conturi pentru toți (MANAGER pentru cei cu subordonați, EMPLOYEE pentru ceilalți, 3 HR_ADMIN);
- solduri de concediu 2025 și 2026; concedii aprobate pe tot anul (SQL, cu sezonalitate), câteva în săptămâna curentă, iar în următoarele două săptămâni prin API aprobate, plus cereri în așteptare și respinse;
- pontaj în MongoDB: ultimele 3 luni complete (aprobate, cu câteva trimise spre aprobare) și luna curentă parțial;
- evaluări: „Evaluare anuală 2025” (închis, complet) și „Evaluare semestrială 2026” (deschis, stări mixte);
- 6 documente TXT cu vizibilități diferite (ALL, MANAGERS, HR).

Notă: datele relative la „azi” (concedii curente/viitoare, pontaj) se calculează din data rulării. Concediile istorice și pontajul se inserează direct în Postgres/MongoDB deoarece API-ul nu permite date în trecut.
