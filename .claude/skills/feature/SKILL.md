---
name: feature
description: Rulează fluxul AI SDLC complet (tech-lead → developer → tester → code-reviewer) pentru o cerință și face push pe un branch feat/*. Fără deploy.
disable-model-invocation: true
argument-hint: "<descrierea cerinței>"
---

# /feature — flux AI SDLC

Cerința: **$ARGUMENTS**

Tu ești orchestratorul. Nu implementezi, nu testezi și nu revizuiești tu însuți: deleghi fiecărui rol prin tool-ul Agent (subagenții `tech-lead`, `developer`, `tester`, `code-reviewer`) și treci rezultatul de la unul la altul. Fiecare subagent pornește fără context, deci îi dai în prompt tot ce are nevoie (cerința, planul, feedback-ul).

## Pasul 0: pregătire
1. Dacă `$ARGUMENTS` e gol, cere cerința și oprește-te.
2. Verifică `git status`. Dacă există modificări necomise, **oprește-te** și întreabă utilizatorul.
3. Creează branch-ul `feat/<slug-scurt-din-cerință>` pornind de la `main` (`git checkout -b feat/...`). Dacă există deja, adaugă un sufix numeric.

## Pasul 1: Tech Lead
Apelează `tech-lead` cu cerința. Primești planul și criteriile de acceptare.
- Dacă planul conține „Riscuri / întrebări deschise" care blochează implementarea, **oprește-te** și întreabă utilizatorul.
- Altfel, prezintă planul pe scurt și continuă.

## Pasul 1b: dacă cerința are UI (frontend, ecrane, machete)
Subagenții nu pot invoca skill-uri. Tu, orchestratorul:
1. Invocă skill-ul `design-taste-frontend` (tool-ul Skill), declară „Design Read" și parametrii (varianță, mișcare, densitate).
2. În promptul developer-ului include: design system-ul (link în `CLAUDE.md`), regulile aplicabile ale skill-ului (un singur accent, fără alb/negru pur, regulă unică de raze, stări de încărcare/gol/eroare, etichetă deasupra câmpului, fără em-dash, fără decor), biblioteca de componente aleasă, și cere-i să citească `.claude/skills/design-taste-frontend/SKILL.md` (secțiunile 4, 9, 14).
3. În promptul tester-ului include verificarea acelor reguli în tema luminoasă și în cea întunecată.
Skill-ul nu se aplică dashboard-urilor și tabelelor de date (vezi `CLAUDE.md`).

## Flux rapid pentru UI (cerință explicită a utilizatorului)
Dacă cerința e DOAR interfață (frontend): după Pasul 1b, rulează doar `developer` (el verifică build-ul, grep-urile de design și endpoint-urile prin proxy). NU rula `tester` și NU rula `code-reviewer` pe etapă: treci direct la Pasul 3 (push) și 3b (merge) după ce build-ul trece. Un singur `code-reviewer` rulează la finalul feature-ului întreg, pe tot diff-ul de UI, iar observațiile se repară într-o etapă ulterioară. Backend-ul, autentificarea, privilegiile și orice cod de securitate folosesc bucla completă de mai jos.

## Pasul 2: bucla de calitate (maxim 3 iterații)
Pentru `iterația = 1..3`:
1. **Developer**: apelează `developer` cu planul (și, de la iterația 2, cu feedback-ul complet de la Tester/Reviewer).
2. **Tester**: apelează `tester` cu criteriile de acceptare. Dacă `VERDICT: FAIL` → treci la următoarea iterație cu rapoartele de eșec ca feedback.
3. **Code Reviewer**: apelează `code-reviewer` cu planul și criteriile. Dacă `VERDICT: CHANGES_REQUESTED` → următoarea iterație cu problemele ca feedback.
4. Dacă Tester = PASS **și** Reviewer = APPROVED → ieși din buclă cu succes.

Dacă după 3 iterații nu e rezolvat: **NU face push**. Raportează starea (ce trece, ce nu, problemele rămase) și lasă decizia utilizatorului.

## Pasul 3: push (automat, doar la succes)
**Regulă fermă: nu întreba utilizatorul despre push sau merge.** Push-ul (și merge-ul din Pasul 3b) se fac singure, imediat ce etapa e gata: build OK, Reviewer = APPROVED și, unde se poate rula funcțional, Tester = PASS. La UI (tester-ul nu are browser) ajung build-ul și Reviewer = APPROVED; testul manual al utilizatorului se corectează ulterior, într-o etapă nouă. Raportezi după ce ai făcut, nu ceri permisiunea înainte.
1. Rulează încă o dată build-ul proiectului (comanda din `CLAUDE.md`). Dacă pică, tratează ca eșec.
2. Verifică `git status`: pe branch nu trebuie să rămână fișiere ale muncii tale necomise. Nu comite `.env`, `.docx` sau alte documente personale.
3. `git push -u origin <branch-feat>`. Dacă push-ul eșuează din cauza autentificării (ex. `could not read Username`, 403), nu încerca alte variante și nu pune tokenuri în comenzi: raportează eroarea și lasă omul să rezolve.
4. **Niciodată**: push pe `main`/`master`, `--force`, ștergerea de branch-uri, deploy, comenzi de infrastructură.
5. După push, verifică cu `git ls-remote --heads origin <branch-feat>` că branch-ul e pe GitHub, la același commit ca local.

Pentru munca împărțită în etape, aplică pașii 1-5 la finalul fiecărei etape aprobate, pe branch-ul ei.

## Pasul 3b: merge în main (automat, după push)
Doar dacă Tester = PASS, Reviewer = APPROVED, push-ul de la Pasul 3 a reușit și permisiunile din `.claude/settings.local.json` permit merge-ul. Altfel oprește-te și raportează.
1. `git fetch origin main`. Verifică `git status` (nicio modificare necomisă a muncii tale).
2. `git checkout main`. Dacă `main` local e în urma lui `origin/main`, adu-l la zi; dacă istoriile sunt separate (fără strămoș comun), unește-le întâi cu `git merge --no-ff --allow-unrelated-histories origin/main`, doar dacă nu există fișiere în conflict.
3. `git merge --no-ff <branch-feat>`. La conflict: `git merge --abort`, raportează, nu rezolva singur.
4. Rulează build-ul pe `main` (comanda din `CLAUDE.md`). Dacă pică: nu face push, raportează.
5. `git push origin main` (niciodată `--force`). Verifică cu `git ls-remote --heads origin main` că `origin/main` e la același commit ca `main` local.
6. Revino pe un branch `feat/*` pentru munca următoare; nu lucra pe `main`.
Etapele stivuite se unesc în ordinea dependenței (întâi cea de bază). Nu șterge branch-urile după merge.

## Pasul 4: raport final
Un rezumat scurt:
- Branch-ul și dacă s-a făcut push
- Ce s-a implementat (din raportul developer-ului)
- Iterații folosite și motivul fiecărei reluări
- Verdictul final Tester și Reviewer
- Observații MINOR rămase
- Ce are de făcut omul: review final și deschiderea PR-ului

## Reguli ferme
- Nu sari peste niciun rol și nu înlocui verdictul unui subagent cu părerea ta.
- Nu modifica fișiere în `.claude/`.
- La orice incertitudine privind date personale (HR), oprește-te și întreabă.
