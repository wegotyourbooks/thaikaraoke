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
- [ ] js/state.js: load/save (autosave), schemaVersion, export JSON, import JSON, reset
- [ ] mid-session resume state persisted

## 6. Session engine + quiz modes
- [ ] js/session.js queue building (due reviews FSRS-order, then new in curriculum order; limits from settings)
- [ ] new-word introduction screen
- [ ] mode: recall (karaoke -> EN, self-grade)
- [ ] mode: production (EN -> karaoke, self-grade, weighted highest)
- [ ] mode: audio (TTS -> 4-choice meaning)
- [ ] mode: cloze (blanked word, tile choices)
- [ ] mode: sentence builder (arrange tiles)
- [ ] mode: tone ID (5 tone buttons w/ contour icons)
- [ ] mode: minimal pairs (hear one, pick which)
- [ ] no same mode twice in a row per card; wrong answers requeue +10
- [ ] feedback panel after every answer (answer, audio replay, tone)
- [ ] session end screen (done, accuracy, streak, coverage, 3 weakest)

## 7. Tone Gym
- [ ] unlimited drills, hardest tones first, per-tone accuracy 5 bars

## 8. Screens
- [ ] Home (streak, coverage big, due count, start button, quick stats)
- [ ] Browse (search, tag/status filters, detail + audio)
- [ ] Stats (coverage over time, per-tone accuracy, heatmap, review forecast)
- [ ] Settings (new/day, reviews/day, rate, script toggle, politeness, export/import/reset)

## 9. Audio layer
- [ ] js/audio.js th-TH voice detect, rate 0.5-1x, tap-to-hear everywhere
- [ ] no-Thai-voice one-time banner w/ iOS instructions

## 10. PWA polish
- [ ] manifest valid, icons render
- [ ] offline works after first load (verified)
- [ ] installable

## 11. Final QA (acceptance checklist)
- [ ] python3 -m http.server: app loads, session runs end to end
- [ ] close mid-session, reopen -> resumes at same card
- [ ] answer 5 cards, hard refresh -> state persisted
- [ ] export JSON, reset, import -> restored
- [ ] validate-data.mjs and test-fsrs.mjs both pass
- [ ] every quiz mode reachable and functional
- [ ] tone diacritics render on all karaoke
- [ ] offline after first load
- [ ] installable PWA
- [ ] PROGRESS.md marked complete
