## Stack
- Backend: Spring Boot 3.5 (Java 17), Maven cu wrapper, în `backend/` (pachet de bază `ro.smarthr`)
- Frontend: Angular, în `frontend/` (npm). Încă nu există. Node local e 18; planul e upgrade la Node 22 LTS înainte de scheletul Angular. Biblioteca de UI recomandată: PrimeNG (de confirmat)
- Baze de date (local prin Docker, doar date fictive): PostgreSQL pentru datele structurate și tranzacționale, MongoDB pentru date variabile sau de volum mare (pontaj, evaluări). MongoDB nu are încă utilizare în cod. Nu se face jurnal de audit.
- Teza: aplicație HR multi-companie (multi-tenant) cu roluri și privilegii; modul AI (risc de plecare, absenteism) mai târziu.

## Structură
```
smart-hr/
├── backend/            # Spring Boot (IAM, tenancy, angajați)
├── frontend/           # Angular (nu există încă)
├── docker-compose.yml  # Postgres + MongoDB, doar pe 127.0.0.1
└── .env                # local, gitignored; șablon în .env.example
```

## Comenzi (agenții le folosesc)
- Baze de date: `docker compose up -d db mongo` (Postgres e pe portul din `POSTGRES_PORT` din `.env`, local 5433)
- Build backend: `cd backend && ./mvnw -q -DskipTests compile`
- Rulare backend: `cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev` (din `backend/`, ca să găsească `../.env`)
- Build frontend: `cd frontend && npm run build`
- Rulare frontend: `cd frontend && npm start`
- Teste de integrare/E2E: nu există. Verificarea e funcțională, cu `curl` sau scripturi pe localhost.

Fără teste unitare: nici JUnit/Mockito în backend, nici Jasmine/Karma în frontend.

## Convenții
- Branch-uri de lucru AI: `feat/<slug>`. Niciodată lucru direct pe `main`.
- Commit-uri mici, mesaje clare. **Fără** `Co-Authored-By` și fără alte mențiuni către Claude/AI în mesajele de commit sau în PR-uri (preferința explicită a utilizatorului).
- **Fără teste unitare.** Verificarea e funcțională (build, rulare, apeluri API/UI) și o face rolul Tester.
- Nu se comit `.env`, fișiere `.docx` sau alte documente personale (sunt în `.gitignore`).

## Arhitectură multi-companie și securitate
- O singură schemă Postgres, cu `company_id` pe fiecare tabel de tenant, aplicat cu Hibernate `@TenantId`. Fără `nativeQuery`, `JdbcTemplate` sau `EntityManager` pe tabele de tenant.
- Login cu `{companyCode, email, password}`. JWT HS256 cu `cid` (companie) și `perms` (privilegii); super-admin de platformă separat (`platform_admin`).
- Fiecare endpoint are `@PreAuthorize` explicit. Un id din altă companie dă 404, nu 403.
- Un user nu poate acorda privilegii pe care nu le deține el (verificat din DB, nu din token).
- Privilegiile din token sunt valabile 30 de minute (limitare cunoscută: revocarea are efect la expirare).
- Reguli pentru MongoDB (când va fi folosit): `companyId` obligatoriu în fiecare document, acces doar printr-un wrapper de tenant.

## Date personale (HR)
Proiectul lucrează cu date personale și sensibile (CNP, salarii, evaluări).
- Nu se loghează date personale (emailuri, nume, parole, tokenuri).
- La verificări manuale se folosesc doar date fictive, niciodată date reale sau de producție.
- Orice endpoint care expune date de angajați are autorizare explicită.
- Minimizarea datelor: nu se stochează CNP sau salariu până nu e nevoie, cu autorizare explicită.

## Design
- Design system privat (artifact pe claude.ai): https://claude.ai/artifact/UpQsh7o1onzbULHJg9JJqi. Tokeni, reguli și componente de referință; UI în română, calm, neutru, un singur accent albastru.
- Skill-ul `design-taste-frontend` e instalat în `.claude/skills/` (pentru pagini precum login; nu pentru dashboard-uri, tabele sau formulare, unde el însuși recomandă o bibliotecă de componente).
- **Orice sarcină de UI (frontend, machete, ecrane):** orchestratorul invocă întâi skill-ul `design-taste-frontend` (tool-ul Skill; subagenții nu îl au) și declară „Design Read" înainte de cod. Apoi pune în promptul developer-ului: linkul design system-ului, regulile skill-ului care se aplică (un singur accent, fără alb/negru pur, regulă unică de raze, stări de încărcare/gol/eroare, fără em-dash, fără decor) și instrucțiunea de a citi `.claude/skills/design-taste-frontend/SKILL.md` (secțiunile 4, 9 și 14) și `README.md` din design system. Tester-ul verifică aceste reguli la UI, în ambele teme.
- Pentru dashboard, tabele și formulare: biblioteca de componente (PrimeNG, de confirmat) cu tema din tokenii design system-ului, nu CSS scris de mână.

## Flux AI SDLC
Roluri (în `.claude/agents/`): tech-lead → developer → tester → code-reviewer.
Orchestrare: `.claude/skills/feature/SKILL.md`.
- Munca mare se împarte în etape mici, fiecare pe propriul branch `feat/*` (poate porni din branch-ul etapei anterioare).
- **REGULĂ FERMĂ: nu întreba utilizatorul despre push sau merge, nici înainte, nici după.** Când o etapă e gata, le faci direct și raportezi ce s-a făcut. „Gata" înseamnă: build-ul trece, Code Reviewer = APPROVED și, unde se poate rula funcțional (backend/API), Tester = PASS. La UI, unde tester-ul nu poate folosi un browser, ajung build-ul și Reviewer = APPROVED; testul manual al utilizatorului vine ulterior și se corectează într-o etapă nouă, nu blochează push-ul.
- **Flux rapid pentru interfață (UI):** la etapele de frontend se sare peste tester și peste reviewer-ul pe etapă. Developer-ul își verifică munca (build, grep-urile de design, curl prin proxy); orchestratorul rulează build-ul și face push și merge în `main` direct. Un SINGUR review (code-reviewer) se face la finalul feature-ului întreg (de exemplu după ce zonele de companie și de platformă sunt gata), cu observațiile reparate într-o etapă ulterioară. Utilizatorul testează manual în browser.
- **Optimizare timp și tokeni (cerință explicită):** (1) prompturi scurte către subagenți: trimit la `CLAUDE.md`, la fișiere și la plan, nu retranscriu; (2) cere rapoarte scurte (maxim ~25 de linii, doar rezultate, probleme și ce n-a putut verifica); (3) tech-lead doar la module mari sau noi, nu la ecrane, formulare sau adăugiri mici; (4) combină etape mici într-o singură rulare de developer; (5) tester și reviewer la backend de securitate o singură rundă, iar re-verificarea doar pentru blocante, nu pentru sugestii minore (acestea se strâng și se repară la final); (6) nu opri sau reporni serviciile fără nevoie; (7) pentru reparații mici (o linie, un fișier) le fac direct, fără subagent.
- **Backend, autentificare, privilegii și orice cod de securitate:** fluxul complet rămâne (developer, tester, reviewer pe etapă, reparații, re-verificare), pentru că greșelile aici sunt costisitoare.
- **Push automat:** când o etapă are Tester = PASS și Code Reviewer = APPROVED (și build-ul trece), orchestratorul face `git push -u origin <branch-feat>` fără să mai ceară acord. Autentificarea e prin token GitHub salvat în Keychain (HTTPS).
- **Merge automat în `main`:** după push, când Tester = PASS și Code Reviewer = APPROVED, orchestratorul unește branch-ul în `main` (`git merge --no-ff`, fără `--force`), rulează build-ul pe `main` și face `git push origin main`. Etapele stivuite se unesc în ordinea dependenței. `main` de pe GitHub poate avea istorie separată de cea locală (are doar un `README.md`): se unește cu `--allow-unrelated-histories`.
- Dacă permisiunile refuză merge-ul sau push-ul pe `main`, orchestratorul se oprește și raportează; nu ocolește și nu modifică el permisiunile.
- Fără deploy, fără `--force`, fără ștergerea branch-urilor, fără push pe `master`.
- Permisiunile sunt în `.claude/settings.local.json` și le modifică omul. Pentru merge automat trebuie permise `git push origin main`, `git checkout main`, `git merge --no-ff ...` și eliminată interdicția `git push * main*`.
