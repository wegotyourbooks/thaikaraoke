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

---

# v2 UPGRADE: cross-device sync, time tracking, sentence frames, micro-lessons

## v2.1 Schema v2 + migration
- [ ] js/state.js rewritten to schema v2 (append-only logs + keyed LWW)
- [ ] js/migrate.js: pure migrateV1toV2, writes thaikaraoke-v1-backup first
- [ ] Settings > Advanced "Restore v1 backup" button
- [ ] all screens read derived stats (js/derive.js), never stored counters
- [ ] js/rollup.js: reviews older than 180 days folded into reviewsDaily

## v2.2 Gist sync
- [ ] js/merge.js pure merge (LWW keyed + union logs, commutative, idempotent)
- [ ] scripts/test-merge.mjs all cases pass
- [ ] js/gist.js REST wrapper (create/get/patch, 401 -> TokenExpired)
- [ ] js/sync.js 6-step algorithm, updated_at retry max 3, pendingPush offline queue
- [ ] triggers: load, session end, manual, visibilitychange hidden (2s debounce); never mid-session
- [ ] js/qr.js self-written QR encoder + pairing via #sync= fragment
- [ ] Settings > Sync: status, last sync, Sync now, disconnect and wipe token
- [ ] two-context Playwright sync test (fake gist) passes

## v2.3 Active time tracking
- [ ] js/timer.js: pause on hidden/blur/45s idle
- [ ] session records with activeMs appended on end AND on exit
- [ ] Tone Gym logs mode:"tonegym" sessions
- [ ] stale activeSession closed safely on load

## v2.4 Dashboard
- [ ] Home: total hours primary, hours this week, streak, coverage
- [ ] 30-day minutes bar chart
- [ ] milestone ladder 10/25/50/100/200/500 h
- [ ] numbers never rounded up

## v2.5 Functional 150 + phrasebook
- [ ] tier:"functional150" on exactly 150 phrases (data/phrases-09.js added as needed)
- [ ] queue interleaves 2 phrases per 10 new words
- [ ] Browse > Phrasebook view

## v2.6 Sentence frames
- [ ] data/pools.js typed word pools
- [ ] data/frames.js 80 frames
- [ ] js/frames.js engine: only fillers whose card state != "new"
- [ ] modes frame_fill / frame_sub (2x weight) / frame_prod
- [ ] results log mode:"frame", update frameProgress, no own FSRS cards

## v2.7 Micro-lessons
- [ ] data/microlessons.js 40 lessons
- [ ] selection: weak tone <75% with >=20 samples, not shown in 14 days, else rotation
- [ ] skip button + "Don't show these" setting
- [ ] Lessons view; showings logged to microLessonsShown

## v2.8 Validation and QA
- [ ] scripts/validate-data.mjs extended (frames, pools, lessons, tier count)
- [ ] sw.js cache bumped to v2 with all new assets
- [ ] CLAUDE.md documents schema v2 + derive-never-store rule
- [ ] full acceptance checklist re-run in headless Chromium
