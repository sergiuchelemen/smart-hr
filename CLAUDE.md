## Stack
- Backend: Spring Boot (Java), în `backend/` (build: Maven — presupunere, de confirmat)
- Frontend: Angular, în `frontend/` (npm)
- Bază de date: PostgreSQL (local prin Docker, doar date fictive)

## Structură (presupusă, de confirmat la primul feature)
```
smart-hr/
├── backend/    # Spring Boot
└── frontend/   # Angular
```

## Comenzi (agenții le folosesc; ajustează după ce există proiectele)
- Build backend: `cd backend && ./mvnw -q -DskipTests compile`
- Rulare backend: `cd backend && ./mvnw spring-boot:run`
- Build frontend: `cd frontend && npm run build`
- Rulare frontend: `cd frontend && npm start`
- Postgres local: `docker compose up -d db` (după ce există `docker-compose.yml`)
- Teste de integrare/E2E (opțional, dacă există): `<comandă>`

Fără teste unitare: nici JUnit/Mockito în backend, nici Jasmine/Karma în frontend.

## Convenții
- Branch-uri de lucru AI: `feat/<slug>`. Niciodată lucru direct pe `main`.
- Commit-uri mici, mesaje clare.
- **Fără teste unitare.** Verificarea e funcțională (build, rulare, apeluri API/UI) și o face rolul Tester.

## Date personale (HR)
Proiectul lucrează cu date personale și sensibile (CNP, salarii, evaluări).
- Nu se loghează date personale.
- La verificări manuale se folosesc doar date fictive, niciodată date reale sau de producție.
- Orice endpoint care expune date de angajați are autorizare explicită.

## Flux AI SDLC
Roluri (în `.claude/agents/`): tech-lead → developer → tester → code-reviewer.
Orchestrare: `.claude/skills/feature/SKILL.md`.
Fără deploy: agenții fac doar `git push` pe `feat/*`. Permisiunile sunt în `.claude/settings.local.json`.
