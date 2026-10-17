# Find Your Future in Wigan (prototype)

An interactive, gamified careers questionnaire for **Wigan Council**. An AI agent running on **Ollama cloud models** writes each question live, reacting to the resident's previous answers. Residents answer by tapping buttons and earn XP, levels and badges, while a live meter shows how well they match the jobs Wigan finds hardest to fill. At the end they get a personal summary and are signposted to real local and national services.

> Prototype only. The sector evidence and links were checked in October 2026; check them again against current labour-market data before any public use. The logo mark is a placeholder, so swap in official council brand assets.

## Quick start

```bash
npm install
cp .env.example .env        # add OLLAMA_API_KEY (https://ollama.com/settings/keys); defaults: kimi-k2.6, falling back to gemma4:31b
npm run dev                 # API on :8787, UI on http://localhost:5173
```

Production build: `npm run build && npm start`, which serves the UI and the API from http://localhost:8787.
Without internet or an API key: `AI_MODE=offline npm run dev` runs the same flow from the built-in question bank.
Vercel: `vercel.json` serves `dist/client` as static files and rewrites `/api/*` to the Express app in `api/index.ts`. Set `OLLAMA_API_KEY` in the project's environment variables. Sessions are held in memory, so a request that lands on a different function instance gets a "session expired" error. Use a shared store before real traffic.

## How it works

```
client/ (React + Vite)  ──►  server/ (Express API)  ──►  ollama.com /api/chat (cloud models)
                                  │
                                  ├─ agent/planner.ts       which topics are still allowed (guarantees coverage)
                                  ├─ agent/questionAgent.ts prompt → JSON → validate → Question (or fallback bank)
                                  └─ agent/resultAgent.ts   matches + signposts + AI-written narrative
shared/  sectors · resources · scoring · signposting · gamification · zod schemas (used by both sides)
```

- **The AI generates the form live.** Each answer triggers a new `/api/chat` call. The agent receives the answers so far, the current sector matches, the profile tags and the topics it may still use, and returns one question as JSON. For every option it also returns sector `signals` (−2..3) and profile `tags`.
- **Guardrails.** Model output is parsed even when it is wrapped in code fences, then checked with zod. Unknown sectors and tags are dropped, weights are clamped, and any question that uses a topic it wasn't allowed, or that doesn't separate sectors, is rejected. A rejected question makes the server try the fallback model next and then the hand-written question bank, so a resident never gets stuck. The planner makes sure the topics needed for signposting (situation, age, learning, support) are always asked.
- **Signposting is deterministic.** `shared/signpost.ts` maps the top sectors and the profile tags to a curated, link-checked catalogue (`shared/resources.ts`). The AI writes only the summary text and cannot add links: narratives that contain URLs are rejected.
- **Any language.** On the start screen a resident can type any language, in English or in its own words ("Polski", "اردو", "Brazilian Portuguese"). `server/i18n/language.ts` turns that into a BCP 47 code, instantly for about 190 known names and otherwise by asking the model, and rejects anything that isn't a real language. The typed text never reaches the question prompts: they only see the language's name as given by `Intl`. The model then writes every question and the results in that language. Fixed text (buttons, sector info, badges and signposts) is machine-translated from the English catalog in `shared/i18n.ts` and cached per language. The first resident to choose a new language waits about 15 seconds; after that it's instant. Translations that drop a `{placeholder}`, add a link or echo the English back are rejected, and that text stays in English. Right-to-left languages flip the layout. The page says the text was translated by AI and that links go to English websites.
- **Privacy.** The app asks for no names, contact details or free text. Sessions are anonymous, held in memory, and expire after 60 minutes of inactivity.

## Focus sectors (Wigan's hardest-to-fill jobs)

Health & Social Care · Construction & Green Trades · Engineering & Manufacturing · Logistics & Transport · Education & Childcare · Digital & Tech · Hospitality & Food. Sources include Wigan Council's [Believe in your Future](https://www.wigan.gov.uk/Resident/Jobs-Careers/Believe-in-your-Future/Construction.aspx) pages (construction vacancies up 40% in two years), the council's Employability & Skills Strategy (Digital, Construction, Engineering and Logistics named as growth sectors), and the Greater Manchester Chamber's Local Skills Improvement Plan (urgent need for nurses, a chronic shortage of care workers, and high demand for teachers, delivery drivers and hospitality staff).

## Tests

```bash
npm test                  # unit + integration (no network needed)
npm run test:unit
npm run test:integration
npm run test:live         # real Ollama cloud calls (needs OLLAMA_API_KEY)
```

| Feature | Unit tests (`tests/unit/…`) | Integration tests (`tests/integration/…`) |
|---|---|---|
| Form generated live by an AI agent (Ollama cloud) | `ai-generation/*`: Ollama client, config, JSON extraction, schemas, planner, question/result agents, fallback bank | `api.test.ts` (one live call per question), `ai-resilience.test.ts` (fenced output, model fallback, outage), `ollama.live.test.ts` |
| Interactive, gamified questionnaire | `gamification/game.test.ts`, `gamification/hud.test.tsx` (XP, levels, badges, match meter, toasts) | `api.test.ts` (XP/badges/live scores), `app-flow.test.tsx` |
| Clickable buttons | `clickable-ui/QuestionCard.test.tsx` (click, multi-select, caps, number keys, Enter), `clickable-ui/api.test.ts` | `app-flow.test.tsx` (full click-through in the React UI against the real API) |
| Signposting to the right sources | `signposting/signpost.test.ts`, `resources.test.ts`, `ResultView.test.tsx` | `api.test.ts` (personalised signposts), `app-flow.test.tsx` |
| Focus on Wigan's under-filled jobs | `underfilled-jobs/sectors.test.ts`, `scoring.test.ts` | `api.test.ts` (sector catalogue, live match updates) |
| Wigan branding | `branding/branding.test.tsx` | `app-flow.test.tsx` |
| Anonymous sessions | `sessions/sessions.test.ts` | `api.test.ts` (validation, double-submit, expiry 404s) |
| Any language | `i18n/language.test.ts` (typed names → codes, RTL, input limits), `i18n/translator.test.ts` (caching, chunking, rejecting bad output), `i18n/catalog.test.tsx` (language picker, RTL, saved choice) | `api.test.ts` (`/api/translations`, prompts and signposts in the session language, translated fallback questions), `app-flow.test.tsx` |

## API

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/translations` | `{ language }` (anything typed) → the recognised language and the translated UI text |
| `POST` | `/api/sessions` | `{ language? }` (a code from `/api/translations`) → start a session and get the first AI question |
| `POST` | `/api/sessions/:id/answers` | `{ questionId, optionIds }` → next question + progress (XP, level, badges, scores) |
| `GET` | `/api/sessions/:id/result` | Top matches, signposts and the narrative (generation starts as soon as the last answer arrives) |
| `GET` | `/api/sectors` · `/api/health` | Sector catalogue · AI configuration |

## Next steps before a pilot

Add rate limiting and a shared session store (for example Redis) if it runs on more than one instance. Review the prompts and signposts with council careers advisers. Run an accessibility audit (WCAG 2.2 AA). Consider anonymous analytics on sector interest to inform local skills planning.
