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
- [x] js/state.js rewritten to schema v2 (append-only logs + keyed LWW)
- [x] js/migrate.js: pure migrateV1toV2, writes thaikaraoke-v1-backup first
- [x] Settings > Advanced "Restore v1 backup" button
- [x] all screens read derived stats (js/derive.js), never stored counters
- [x] js/rollup.js: reviews older than 180 days folded into reviewsDaily

## v2.2 Gist sync
- [x] js/merge.js pure merge (LWW keyed + union logs, commutative, idempotent)
- [x] scripts/test-merge.mjs all cases pass
- [x] js/gist.js REST wrapper (create/get/patch, 401 -> TokenExpired)
- [x] js/sync.js 6-step algorithm, updated_at retry max 3, pendingPush offline queue
- [x] triggers: load, session end, manual, visibilitychange hidden (2s debounce); never mid-session
- [x] js/qr.js self-written QR encoder + pairing via #sync= fragment
- [x] Settings > Sync: status, last sync, Sync now, disconnect and wipe token
- [x] two-context Playwright sync test (fake gist) passes

## v2.3 Active time tracking
- [x] js/timer.js: pause on hidden/blur/45s idle
- [x] session records with activeMs appended on end AND on exit
- [x] Tone Gym logs mode:"tonegym" sessions
- [x] stale activeSession closed safely on load

## v2.4 Dashboard
- [x] Home: total hours primary, hours this week, streak, coverage
- [x] 30-day minutes bar chart
- [x] milestone ladder 10/25/50/100/200/500 h
- [x] numbers never rounded up

## v2.5 Functional 150 + phrasebook
- [x] tier:"functional150" on exactly 150 phrases (data/phrases-09.js added as needed)
- [x] queue interleaves 2 phrases per 10 new words
- [x] Browse > Phrasebook view

## v2.6 Sentence frames
- [x] data/pools.js typed word pools
- [x] data/frames.js 80 frames
- [x] js/frames.js engine: only fillers whose card state != "new"
- [x] modes frame_fill / frame_sub (2x weight) / frame_prod
- [x] results log mode:"frame", update frameProgress, no own FSRS cards

## v2.7 Micro-lessons
- [x] data/microlessons.js 40 lessons
- [x] selection: weak tone <75% with >=20 samples, not shown in 14 days, else rotation
- [x] skip button + "Don't show these" setting
- [x] Lessons view; showings logged to microLessonsShown

## v2.8 Validation and QA
- [x] scripts/validate-data.mjs extended (frames, pools, lessons, tier count)
- [x] sw.js cache bumped to v2 with all new assets
- [x] CLAUDE.md documents schema v2 + derive-never-store rule
- [x] full acceptance checklist re-run in headless Chromium

## v2 Status: COMPLETE

Node checks: `test-fsrs.mjs`, `test-merge.mjs` (36 assertions covering merge
commutativity/idempotence, rollup, migration and derivations) and
`validate-data.mjs` (1200 words, 420 phrases incl. exactly 150 functional150,
60 minimal-pair sets, 80 frames, 11 pools, 40 micro-lessons) all pass.

Browser checks in headless Chromium, zero console errors:
- migration from a seeded v1 blob: every card and its FSRS fields intact,
  backup written before anything is touched, restore works, re-migration clean
- two contexts against a fake gist: disjoint offline work merges with nothing
  lost, summed time, newer card edit wins while both reviews survive, rejected
  write retried, offline queues a push, sync refused mid-session, 401 surfaces
  as an expired token, disconnect wipes the token from storage
- pairing link round-trips and the token is scrubbed from the address bar
- QR encoder round-trips through an independent decoder at versions 1, 4, 9
  and 10 (including the multi-block interleave and 16-bit length path)
- timer: accrues while interacting, stops at the idle cutoff, adds nothing
  while hidden, resumes on return, and a crashed session is closed at its last
  activity rather than at the time of discovery
- frames never surface a word whose card is still new; all three frame modes
  render, grade the word's card, log mode "frame" and own no cards themselves
- full session end to end, mid-session resume, hard-refresh persistence,
  export/reset/import (import merges instead of clobbering), lesson rotation
  and its off switch, weak-tone lesson targeting, phrasebook view, valid
  manifest, service worker registered, app loads and renders offline

Fixed along the way: the service worker never registered (it waited on a
`load` event that had already fired, because the data modules use top-level
await), and builder mode threw on completion so a session could hang there.
