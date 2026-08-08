# Civics Course — MVP Prototype

Self-paced U.S. naturalization civics test preparation. Mobile-first, static,
built for GitHub Pages. Companion to Storyboard v5.3.

## Stack
Vite + Svelte + Tailwind CSS. Content as JSON (`src/lib/content/`). Progress
saved to `localStorage` only — no server, no accounts, no third-party
requests at runtime (G-11/G-12).

## Run locally
```
npm install
npm run dev
```

## Build
```
npm run build   # outputs to dist/
```

## Deploy
Push to `main`. `.github/workflows/deploy.yml` builds and publishes to
GitHub Pages automatically. Enable Pages in repo Settings → Pages → Source:
GitHub Actions (one-time setup).

## Architecture notes for whoever picks this up next

**`src/lib/storage.js` is the only file that touches `localStorage`.**
Every other module goes through it. This is deliberate: the project's
second build target (a cmi5/xAPI package for LMS import) needs the same
events — screen completed, question answered, unit finished — reported to
a real backend instead. Because everything funnels through this one file,
that conversion means rewriting this file's internals, not touching every
component that tracks progress.

**Content is data, not code.** `src/lib/content/*.json` defines every
screen's text, images, and interaction type. `Lesson.svelte` is a generic
renderer that interprets that JSON. Adding or editing a screen's copy is a
JSON edit; adding a new *type* of screen is a code change in `Lesson.svelte`.

**Day-one scope.** Only Unit 0 and Unit 1 have full content (per storyboard
v3.1 §14's day-one prototype scope). Units 2–7 render as visible, honestly
locked cards on Home — never fake "coming soon" content. Adding a unit is:
write `unitN.json` and `questions-uN.json`, import both, add the id to
Home's `builtUnits` array.

**Known gaps, all flagged in-app or in the storyboard, none blocking:**
- Companion character: placeholder box (Midjourney prompts already written,
  see `Image_Asset_Plan_and_Prompts.md`)
- Flag and voting photos: rejected/on hold pending re-sourcing
  (see `ASSET_EXPORT_SPEC.md` — the sourced flag had 48 stars, not 50)
- Burmese: language preference is stored and honoured in the UI chrome,
  but lesson content stays English until native-reviewed translation lands
- Completion-evidence method (G-05b) undecided — screen not yet built
- `speechSynthesis` "Listen" button: cut from MVP entirely per explicit
  decision, may return post-MVP as an accessibility feature

## Testing note

`svelte-check` passes clean (0 errors) with `checkJs` disabled in
`jsconfig.json` — this project is plain JS by design (see tech stack
decision), so TypeScript's implicit-any inference was pure noise on an
unannotated codebase and has been turned off rather than chased.

No headless-browser visual verification was possible in the build
sandbox (its screenshot tool predates the `fetch` API and cannot execute
either ES module or SystemJS-bundled JavaScript). The build was verified
via successful compilation and a clean `svelte-check` pass; it has **not**
been click-tested in a real browser. Do that before treating this as
verified — `npm run dev` and walk through Unit 0 and Unit 1 end to end.
