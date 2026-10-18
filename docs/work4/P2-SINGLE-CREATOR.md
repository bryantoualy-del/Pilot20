# Work4 P2 — single adaptive character creation route

Replaces the public entry point for Quick/Guided/Expert with one decision surface, using the existing progression and character compiler. Race/subrace, class/level, background, scores and conditional progression/spell choices keep stable IDs. The list of decisions is rebuilt from the actual report; automatic features do not become forms. Previous/Continue, direct review navigation and draft saves preserve decisions.

Old modes and their selections remain readable. The presentation migrates to `single` while retaining the previous mode/step as metadata. Changing class or reducing level does not delete obsolete selections; the summary offers explicit retention for review. Character saves include the P1 spellbook and preserve the character/draft transaction.

The existing Work3 original racial artwork is used as small icons beside text labels. No new artwork or changes to the approved direction. Sources and descriptions are available on request; the creator does not expose rules contracts or an automation dashboard.

## Acceptance and scope

- `tests/single-path.test.js`: legacy migration, conditional decisions, fighter1, wizard10, invalid selections and retained level-reduction choices.
- `e2e/work4-creator.mjs`: real fighter1 UI path, backtracking, save/reopen, legacy Bard10/Secrets, responsive measurements at375/390/1180/820 widths, offline reload after cache readiness. Chromium only; no physical Safari claim.
- Local Node24 targeted regression:210 tests pass,0 fail. Browser results must be checked in CI before marking this PR ready.
- Old E2E scripts target the retired three-mode interface and remain as `test:e2e:legacy` for historical reference. The CI entry point now uses the new acceptance suite; it does not claim that the old UI suite passes against a different UI.

This lot exposes installed rules. It does not claim complete content for the 55 observed races, all backgrounds, Artificer or Xanathar/Tasha. Complete equipment alternatives, editable HP rolls and validated high-level acquisition chronology remain content/Grimoire work. Choosing an uninstalled race is still a manual draft choice with explicit limits, not a mechanically complete race.

No major merge or public deployment is authorized by this PR. It is stacked on P1 and should be reviewed as that incremental functional change.
