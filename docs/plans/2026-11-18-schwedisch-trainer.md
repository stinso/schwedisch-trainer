# Schwedisch-Trainer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A private claude.ai Artifact for daily Swedish practice centred on spoken topic conversations, with listening, spaced review of own mistakes/vocab, placement and progress.

**Architecture:** Multi-file Artifact: `index.html` plus ES modules under `js/`. Pure logic (SRS, prompts and response parsers, levels/streak, store) lives in DOM-free modules unit-tested with `node --test`; capability wrappers take the capability object by injection so they can be faked; views are thin DOM modules verified in the published page.

**Tech Stack:** Vanilla JS (ES modules, no build step, no dependencies), Node 22 `node:test` for tests, Artifact runtime capabilities `sample`, `tts`, `dictation`, `db`, `user` (contract 0.2.96).

**Spec:** `D:\trustswap workspace\schwedisch-trainer\design.md`

## Global Constraints

- Project root: `D:\trustswap workspace\schwedisch-trainer\` (git repo initialised in Task 1). All paths below are relative to it.
- UI language German; practice content Swedish. TTS lines for Swedish pass `language: "sv"`; dictation starts with `start({language: "sv"})`.
- Target: desktop Chrome on claude.ai. Every speaking step has a typed fallback; every spoken text can be shown on screen.
- Capabilities declared on publish: `{sample: {}, tts: {}, dictation: {}, db: {}, user: {}}`. Access only via `await claude.use(name)`; `null` → feature hidden.
- All user data under `data/users/<uid>/` (private). `uid = await user.id()`; null uid → no persistence, show a note.
- `sample` is memoryless: every call carries instructions, level, history and output format. Never call `sample` from a loop/timer; only on user action or a single stable load call. Conversation turns use `cache: false`.
- `dictation.start()` and the first `tts.speak()` must be called synchronously from a click/key handler.
- Feedback model C: conversation runs uninterrupted; ✏️ per user turn reveals correction on click; evaluation at end (button or ~10 min).
- Conversation drafts persist across reload; deleted once evaluation is saved. Full transcripts are not kept.
- GER level changes only via re-placement or manual edit; re-placement suggested after ≥14 days.
- Before writing `index.html`: run Artifact `quickstart` (intent `other`) and load the `artifact-design` skill; follow its page contract (title 2–4 words, colour tokens with dark mode, phone-width safe).

## Review Focus

1. Swedish not served by dictation/TTS (`unavailable`) → mic button hidden, typing works, text visible; never a dead end. (Test in Task 4.)
2. `sample` rejects `not_granted` / `rate_limited` / `upstream_error` → German message, control stays, no automatic retry. (Test in Task 4.)
3. Claude returns JSON with missing/wrong fields → parser normalises or throws `ParseError`; UI offers "Nochmal versuchen". (Tests in Task 3.)
4. Reload mid-conversation → draft restored with history and per-turn corrections. (Test in Task 5.)
5. Same word/mistake arriving from several sessions → upsert by normalised key, no duplicates; first start with empty db → placement shown. (Tests in Task 5 and Task 2.)

---

### Task 1: Repo, test harness, SRS

**Files:**
- Create: `package.json` (`{"type":"module","scripts":{"test":"node --test tests/"}}`), `.gitignore`, `js/srs.js`
- Test: `tests/srs.test.js`

**Interfaces:**
- Produces: `BOX_DAYS = [0, 1, 3, 7, 14, 30]`; `newItem(fields: object, now: Date) -> Item` (`{...fields, box: 0, due: ISOString, seen: 0, correct: 0}`); `review(item: Item, correct: boolean, now: Date) -> Item` (correct → box+1 capped at 5, due = now + BOX_DAYS[box] days; wrong → box 0, due = now); `dueItems(items: Item[], now: Date, limit = 20) -> Item[]` (due ≤ now, lowest box first, then oldest due).

- [ ] **Step 1:** `git init`, create `package.json`, `.gitignore` (`node_modules/`).
- [ ] **Step 2: Write failing tests** `tests/srs.test.js`:
  - `newItem` → box 0, due equals now.
  - `review(correct)` from box 0 → box 1, due = now + 1 day; from box 5 → stays 5, due + 30 days.
  - `review(wrong)` from box 3 → box 0, due = now; `seen`/`correct` counters increment correctly.
  - `dueItems` excludes future items, orders by box then due, respects limit.
- [ ] **Step 3:** Run `npm test` → FAIL (module missing).
- [ ] **Step 4:** Implement `js/srs.js` (pure, returns new objects, no mutation).
- [ ] **Step 5:** Run `npm test` → PASS.
- [ ] **Step 6:** Commit `feat: SRS scheduling`.

### Task 2: Levels, topics, streak

**Files:**
- Create: `js/level.js`
- Test: `tests/level.test.js`

**Interfaces:**
- Produces: `LEVELS = ["A1","A2","B1","B2","C1"]`; `topicsFor(level: string) -> {id: string, de: string, sv: string}[]` (≥6 per level, builder picks topics); `needsPlacement(profile: object|null) -> boolean` (true when profile null or no `level`); `shouldSuggestRetest(placedAtISO: string, now: Date) -> boolean` (≥14 days); `streak(dayKeys: string[], today: string) -> number` (consecutive `YYYY-MM-DD` days ending today or yesterday); `dayKey(date: Date) -> string` (local date).

- [ ] **Step 1: Failing tests:** `topicsFor("B1").length >= 6` and unknown level falls back to A1 list; `needsPlacement(null) === true`, `needsPlacement({level:"A2"}) === false`; retest false at 13 days, true at 14; streak: `["2026-11-16","2026-11-17","2026-11-18"]`, today `2026-11-18` → 3; gap → counts only latest run; last day yesterday → still counts; empty → 0; duplicates ignored.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement `js/level.js`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: levels, topics, streak`.

### Task 3: Prompts and response parsers

**Files:**
- Create: `js/prompts.js`
- Test: `tests/prompts.test.js`

**Interfaces:**
- Consumes: `LEVELS` from Task 2.
- Produces (all builders return `string` or `SampleMessage[]`; all parsers take `unknown` and return normalised objects or throw `ParseError`):
  - `class ParseError extends Error`
  - `trimHistory(history: Turn[], maxTurns = 20) -> Turn[]` (keeps last N; `Turn = {role:"user"|"assistant", content:string}`)
  - `conversationInput(level, topic, history: Turn[]) -> SampleMessage[]` — leading user rules turn (German-speaking learner, reply only in Swedish at `level`, 1–3 short sentences, end with a question, stay on `topic`, no corrections), then trimmed history; when history is empty append a user turn asking Claude to open the conversation. Result always ends on a `user` turn.
  - `correctionPrompt(level, prevAssistant: string, userText: string) -> string` → JSON `{ok: boolean, corrected: string, explanation_de: string, natural: string}`
  - `parseCorrection(v) -> {ok, corrected, explanation_de, natural}` (missing `natural` → equals `corrected`; missing `corrected` → ParseError)
  - `evaluationPrompt(level, topic, history: Turn[]) -> string` → JSON `{summary_de, mistakes:[{wrong, right, rule_de}], phrases:[{sv, de}], vocab:[{sv, de}]}` (mistakes max 5)
  - `parseEvaluation(v)` (non-arrays → `[]`, mistakes sliced to 5, entries without `sv`/`wrong` dropped; `summary_de` required)
  - `listeningPrompt(level, topic) -> string` → JSON `{title_sv, lines:[{speaker:"A"|"B", sv, de}], questions:[{q_de, answer_de}]}` (3–4 questions, 6–12 lines)
  - `parseListening(v)` (requires ≥2 lines and ≥1 question; speaker coerced to "A"/"B")
  - `gradePrompt(items: {q_de, answer_de, user}[]) -> string` → JSON `[{correct: boolean, feedback_de}]`; `parseGrades(v, n)` (length must equal n)
  - `placementPrompt(responses: {task, prompt, answer}[]) -> string` → JSON `{level, reason_de}`; `parsePlacement(v)` (level must be in `LEVELS`)
  - `placementItems() -> {task:"listen"|"read"|"speak", level, prompt_sv, question_de}[]` — fixed items, two per level A1–C1 (builder writes them).
  - `reviewCheckPrompt(item: {prompt_de, answer_sv}, userAnswer) -> string` → JSON `{correct, feedback_de}`; `parseReviewCheck(v)`

- [ ] **Step 1: Failing tests:** `conversationInput` starts and ends with role `user`, includes level and topic text in the first turn, trims to 20 history turns; each parser: happy path, missing-field normalisation (Review Focus 3) and ParseError on missing required field; `parseEvaluation` caps mistakes at 5; `parsePlacement({level:"X1"})` throws; `parseGrades([..], 3)` with 2 entries throws.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement `js/prompts.js`. Each prompt ends with an explicit one-line JSON example.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: prompts and parsers`.

### Task 4: Capability wrappers (AI, speech, mic)

**Files:**
- Create: `js/ai.js`, `js/speech.js`
- Test: `tests/ai.test.js`, `tests/speech.test.js`

**Interfaces:**
- Consumes: builders/parsers from Task 3.
- Produces:
  - `createAI(sample | null) -> AI` with `available: boolean`, `reply(level, topic, history, {onText, signal}) -> Promise<string>` (`modelTier:"quick"`, `cache:false`), `correct(level, prev, userText)`, `evaluate(level, topic, history)`, `listening(level, topic)` (`cache:false`), `grade(items)`, `place(responses)`, `checkReview(item, answer)` (json calls; `"quick"` for correct/grade/checkReview, `"default"` for evaluate/listening/place).
  - `aiErrorMessage(err) -> string` German copy: `not_granted`/`sampling_disabled` → "Claude ist für diese Seite nicht freigegeben."; `rate_limited` → "Gerade zu viele Anfragen – bitte kurz warten."; `invalid_json`/`ParseError` → "Antwort war unvollständig – nochmal versuchen."; default → "Verbindungsproblem – nochmal versuchen."; `cancelled` → `""`.
  - `createSpeech(tts | null) -> {available, say(textOrLines, {rate}) -> Promise<void>, stop(), onState(fn)}`; Swedish lines get `language:"sv"`; A/B speakers map to voices `"airy"`/`"rounded"`; on `not_granted`/`unavailable` sets `available=false` and calls registered `onUnavailable` listeners.
  - `createMic(dictation | null) -> {available, start({onPartial, onFinal}) -> Promise<void>, stop() -> Promise<void>, onState(fn), onUnavailable(fn)}`; `start` calls `dictation.start({language:"sv"})` synchronously (no await before it); rejection `unavailable`/`not_granted` → `available=false`, notify listeners.

- [ ] **Step 1: Failing tests** with fake capability objects:
  - `createAI(null).available === false`.
  - `reply` passes `cache:false` and `modelTier:"quick"`; `correct` returns parsed object from fake `sample.json`.
  - Review Focus 2: fake rejecting `{code:"rate_limited"}` → `aiErrorMessage` gives the rate-limit copy; the wrapper calls the fake exactly once (no retry).
  - Review Focus 1: fake dictation whose `start` rejects `{code:"unavailable"}` → `mic.available === false` and `onUnavailable` listener fired; `createMic(null).available === false`; same for TTS rejecting `not_granted`.
  - `say` with lines passes `language:"sv"` and speaker voices.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement `js/ai.js`, `js/speech.js`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: capability wrappers with fallbacks`.

### Task 5: Store

**Files:**
- Create: `js/store.js`, `tests/fakeDb.js` (in-memory implementation of the `db` surface used: `doc(path).get/set/update/delete`, `collection(path).doc(id)`, `.get()`, `.where().orderBy().limit().get()`)
- Test: `tests/store.test.js`

**Interfaces:**
- Consumes: `newItem`, `review` from Task 1.
- Produces: `normKey(s: string) -> string` (trim, lowercase, collapse whitespace, strip trailing punctuation, safe for db segment: replace disallowed chars with `_`, max 150 bytes); `createStore(db, uid) -> Store`:
  - Paths: profile `data/users/<uid>/profile`; vocab `…/profile/vocab/<key>`; mistakes `…/profile/mistakes/<key>`; sessions `…/profile/sessions/<id>`; draft `data/users/<uid>/draft`.
  - `getProfile() -> Promise<Profile|null>`; `saveProfile(p)` (`{level, placedAt, rate, createdAt}`).
  - `addVocab({sv, de, source}, now)` → upsert by `normKey(sv)`: existing keeps its SRS state, new uses `newItem`; `addMistake({wrong, right, rule_de, source}, now)` → upsert by `normKey(wrong)`, increments `count`.
  - `listReviewItems() -> Promise<Item[]>` (vocab + mistakes, each tagged `kind:"vocab"|"mistake"`); `saveReview(item, correct, now)`.
  - `addSession({date, minutes, kind, topic, summary_de})`; `listSessions(limit=200)`.
  - `getDraft()`, `saveDraft(draft)`, `clearDraft()`. Draft = `{topic, history: Turn[], corrections: {[turnIndex]: Correction}, startedAt}`.
  - `store.persistent: boolean` — `createStore` returns a no-op store (`persistent:false`, reads resolve `null`/`[]`) when `db` or `uid` is null.

- [ ] **Step 1: Failing tests** (against `fakeDb`):
  - Review Focus 5: `addVocab({sv:"Hus"})` then `addVocab({sv:" hus "})` → one doc, SRS state of first preserved; `addMistake` twice → `count === 2`.
  - Review Focus 5: empty db → `getProfile()` resolves `null` (and with Task 2 `needsPlacement(null)` true).
  - Review Focus 4: `saveDraft` then new `createStore` on same fakeDb → `getDraft()` deep-equals saved draft incl. corrections; `clearDraft()` → `null`.
  - `listReviewItems` returns both kinds tagged; `saveReview` persists new box.
  - `createStore(null, null).persistent === false` and its methods resolve without throwing.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement `js/store.js`; await each write before the next to the same doc.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: per-user store`.

### Task 6: Page shell, app bootstrap, Today and Progress views

**Files:**
- Create: `index.html`, `js/app.js`, `js/ui.js`, `js/views/today.js`, `js/views/progress.js`

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: `js/ui.js`: `h(tag, attrs, ...children) -> Element`, `toast(msg)`, `micButton(mic, {onFinal, onPartial}) -> Element` (hidden when `!mic.available`, toggles start/stop, calls `mic.start` synchronously in the click handler), `speakButton(speech, getText) -> Element`, `textToggle(el)`.
  `js/app.js`: `ctx = {ai, speech, mic, store, profile, go(viewName, params)}`; resolves capabilities with `claude.use` (missing `window.claude` → all null), routes between views `today | placement | conversation | listening | review | progress`; on load: profile null → `placement`, else `today`; draft present → Today shows "Gespräch fortsetzen".
  Each view module exports `render(root: Element, ctx, params) -> void | (() => void)` (optional cleanup).

- [ ] **Step 1:** Artifact `quickstart` (intent `other`) and load `artifact-design`; write `index.html` (title "Schwedisch-Trainer", tokens + dark mode, nav: Heute · Gespräch · Hören · Wiederholen · Fortschritt, `<script type="module" src="js/app.js">`).
- [ ] **Step 2:** Implement `ui.js`, `app.js`, `today.js` (level, streak, due count, today's plan: Wiederholung if due > 0 → Gespräch → optional Hören; retest hint via `shouldSuggestRetest`; note when `store.persistent` false), `progress.js` (level + manual change select, days, minutes, word count, top 5 mistakes by `count`, "Neu einstufen").
- [ ] **Step 3:** `npm test` still PASS; open `index.html` locally in Chrome to check layout renders without `window.claude` (all features show their unavailable state, no console errors).
- [ ] **Step 4:** Commit `feat: shell, today and progress views`.

### Task 7: Placement view

**Files:** Create `js/views/placement.js`

**Interfaces:** Consumes `placementItems`, `ai.place`, `speech`, `mic`, `store.saveProfile`.

- [ ] **Step 1:** Implement: intro → items in order A1→C1; listen items play via `speakButton` (text revealable), speak items use `micButton` + textarea; "Weiß ich nicht" skips; after two consecutive skips/empty answers stop early. Submit → `ai.place` → show level + `reason_de`, allow manual override via select → `saveProfile({level, placedAt: now})` → `go("today")`. Errors via `aiErrorMessage` with retry button.
- [ ] **Step 2:** Commit `feat: placement`.

### Task 8: Conversation view (core)

**Files:** Create `js/views/conversation.js`

**Interfaces:** Consumes `topicsFor`, `ai.reply/correct/evaluate`, `speech`, `mic`, `store` draft/vocab/mistake/session methods.

- [ ] **Step 1:** Implement:
  - Topic picker: `topicsFor(level)` chips + free text field.
  - Start: `ai.reply` with empty history (streamed via `onText` into the bubble), then `speech.say(text, {rate})` on completion. "Text ausblenden" toggle (Hörmodus), 🔊 replay per Claude bubble, rate select 0.8 / 1.0.
  - User turn: `micButton` fills textarea (partials shown provisional), user can edit, "Senden" (Enter). Append to history, `saveDraft`, call `ai.reply`.
  - ✏️ on each user bubble: on click `ai.correct(level, prevAssistant, userText)`, render corrected / explanation / natural; cache into `draft.corrections[index]`, `saveDraft`.
  - Stop button for streaming (`AbortController` per call); timer shows elapsed; at 10:00 a banner "Zeit für die Auswertung?" (no forced end).
  - "Beenden & auswerten": `ai.evaluate` → render summary, mistakes, phrases, vocab; `addMistake` per mistake, `addVocab` per vocab+phrase, `addSession({kind:"conversation", minutes, topic, summary_de})`, then `clearDraft()`.
  - Restore: when `params.resume`, load draft and re-render history and corrections.
- [ ] **Step 2:** Commit `feat: topic conversation with on-demand corrections`.

### Task 9: Listening and Review views

**Files:** Create `js/views/listening.js`, `js/views/review.js`

**Interfaces:** Consumes `ai.listening/grade/checkReview`, `speech`, `mic`, `store.listReviewItems/saveReview/addVocab/addSession`, `dueItems`.

- [ ] **Step 1:** Listening: topic pick → `ai.listening` → play all lines (`speech.say(lines)`), rate 0.8/1.0, transcript hidden behind "Text zeigen"; in transcript, click a line → "Wörter merken" adds its words via a small picker to `addVocab`; questions with text answers → `ai.grade` → per-question feedback; `addSession({kind:"listening"})`.
- [ ] **Step 2:** Review: `dueItems(listReviewItems(), now)`; per item one exercise: vocab DE→SV (type or mic), vocab SV-audio→DE (🔊 then type), mistake as Lückensatz/correction prompt ("Wie sagt man richtig: …?"). Exact string match after `normKey` counts as correct immediately; otherwise `ai.checkReview`. `saveReview`; end screen with count; `addSession({kind:"review"})`. Empty → "Heute nichts fällig 🎉".
- [ ] **Step 3:** Commit `feat: listening and review`.

### Task 10: Publish and verify

- [ ] **Step 1:** `npm test` → all PASS.
- [ ] **Step 2:** Publish with Artifact tool: `file_path: index.html`, `files` = every `js/**` module, `capabilities: {sample:{}, tts:{}, dictation:{}, db:{}, user:{}}`, `icon: "language"`.
- [ ] **Step 3:** In Chrome (claude-in-chrome), open the artifact: confirm placement shows on first load, no console errors, and check whether TTS (`tts.languages()` includes `sv`) and Swedish dictation are served — report the result to the user.
- [ ] **Step 4:** After the user completes a first placement and a short conversation: `ArtifactData list` on the profile/vocab/mistakes/sessions collections to confirm writes land under `data/users/<uid>/`.
- [ ] **Step 5:** Commit `chore: published v1` and give the user the link.
