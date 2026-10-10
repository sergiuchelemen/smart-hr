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

## Pasul 2: bucla de calitate (maxim 3 iterații)
Pentru `iterația = 1..3`:
1. **Developer**: apelează `developer` cu planul (și, de la iterația 2, cu feedback-ul complet de la Tester/Reviewer).
2. **Tester**: apelează `tester` cu criteriile de acceptare. Dacă `VERDICT: FAIL` → treci la următoarea iterație cu rapoartele de eșec ca feedback.
3. **Code Reviewer**: apelează `code-reviewer` cu planul și criteriile. Dacă `VERDICT: CHANGES_REQUESTED` → următoarea iterație cu problemele ca feedback.
4. Dacă Tester = PASS **și** Reviewer = APPROVED → ieși din buclă cu succes.

Dacă după 3 iterații nu e rezolvat: **NU face push**. Raportează starea (ce trece, ce nu, problemele rămase) și lasă decizia utilizatorului.

## Pasul 3: push (doar la succes)
1. Rulează încă o dată build-ul proiectului (comanda din `CLAUDE.md`). Dacă pică, tratează ca eșec.
2. `git push -u origin <branch-feat>`. Dacă nu există remote `origin`, spune-o și nu încerca alte variante.
3. **Niciodată**: push pe `main`/`master`, `--force`, deploy, comenzi de infrastructură.

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
