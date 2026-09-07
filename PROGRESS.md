# ThaiKaraoke Build Progress

Resume rule: continue at the first unchecked item. After data edits run
`node scripts/link-data.mjs && node scripts/validate-data.mjs`.

## 1. Docs
- [x] CLAUDE.md
- [x] PROGRESS.md

## 2. Scaffold
- [x] index.html (all screens as sections, nav tabs)
- [x] css/style.css (dark default, tone colors, mobile-first)
- [x] manifest.json (SVG data-URI icons, standalone)
- [x] sw.js (cache-first, all assets listed)
- [x] js/app.js router + boot

## 3. FSRS engine
- [x] js/fsrs.js (v4.5 formulas, default params, retention 0.90, learning steps 1m/10m)
- [x] scripts/test-fsrs.mjs written
- [x] scripts/test-fsrs.mjs passes

## 4. Dataset
- [x] data/words-01.js (survival 1-100)
- [x] data/words-02.js (survival 101-150 + core 151-200)
- [x] data/words-03.js
- [x] data/words-04.js
- [x] data/words-05.js
- [x] data/words-06.js
- [x] data/words-07.js
- [x] data/words-08.js
- [x] data/words-09.js
- [x] data/words-10.js
- [x] data/words-11.js
- [x] data/words-12.js
- [x] data/phrases-01.js
- [x] data/phrases-02.js
- [x] data/phrases-03.js
- [x] data/phrases-04.js
- [x] data/phrases-05.js
- [x] data/phrases-06.js
- [x] data/phrases-07.js
- [x] data/phrases-08.js
- [x] data/minimal-pairs.js (60 sets)
- [x] scripts/link-data.mjs (auto wordIds + exampleIds from word-spaced thai)
- [x] scripts/validate-data.mjs written
- [x] validate-data.mjs passes clean (1200/400/60, ids unique, refs resolve, every word covered, tone/diacritic consistency)

## 5. State manager
- [x] js/state.js: load/save (autosave), schemaVersion, export JSON, import JSON, reset
- [x] mid-session resume state persisted

## 6. Session engine + quiz modes
- [x] js/session.js queue building (due reviews FSRS-order, then new in curriculum order; limits from settings)
- [x] new-word introduction screen
- [x] mode: recall (karaoke -> EN, self-grade)
- [x] mode: production (EN -> karaoke, self-grade, weighted highest)
- [x] mode: audio (TTS -> 4-choice meaning)
- [x] mode: cloze (blanked word, tile choices)
- [x] mode: sentence builder (arrange tiles)
- [x] mode: tone ID (5 tone buttons w/ contour icons)
- [x] mode: minimal pairs (hear one, pick which)
- [x] no same mode twice in a row per card; wrong answers requeue +10
- [x] feedback panel after every answer (answer, audio replay, tone)
- [x] session end screen (done, accuracy, streak, coverage, 3 weakest)

## 7. Tone Gym
- [x] unlimited drills, hardest tones first, per-tone accuracy 5 bars

## 8. Screens
- [x] Home (streak, coverage big, due count, start button, quick stats)
- [x] Browse (search, tag/status filters, detail + audio)
- [x] Stats (coverage over time, per-tone accuracy, heatmap, review forecast)
- [x] Settings (new/day, reviews/day, rate, script toggle, politeness, export/import/reset)

## 9. Audio layer
- [x] js/audio.js th-TH voice detect, rate 0.5-1x, tap-to-hear everywhere
- [x] no-Thai-voice one-time banner w/ iOS instructions

## 10. PWA polish
- [x] manifest valid, icons render
- [x] offline works after first load (verified)
- [x] installable

## 11. Final QA (acceptance checklist)
- [x] python3 -m http.server: app loads, session runs end to end
- [x] close mid-session, reopen -> resumes at same card
- [x] answer 5 cards, hard refresh -> state persisted
- [x] export JSON, reset, import -> restored
- [x] validate-data.mjs and test-fsrs.mjs both pass
- [x] every quiz mode reachable and functional
- [x] tone diacritics render on all karaoke
- [x] offline after first load
- [x] installable PWA
- [x] PROGRESS.md marked complete

## Status: BUILD COMPLETE
All steps done and verified in headless Chromium (full session flow, mid-session
resume, hard-refresh persistence, export/reset/import, offline reload, every
quiz mode, tone diacritics rendering, valid manifest, zero console errors).
Node checks: test-fsrs.mjs and validate-data.mjs both pass.
