# clarity — project guide

Global rules (`~/.claude/CLAUDE.md` + `~/.claude/rules/`) apply. This file only adds
clarity-specific facts and where clarity differs from the defaults.

## What it is

**clarity** is an embeddable, web-first, framework-agnostic **mind-mapping library** — a
better-UX open-source alternative to SimpleMind. It is a **library, not an app**: no auth, no
database, no hosting/deploy. The differentiator is **user experience** (keyboard-first editing,
zero-jank animated layout, inline editing, effortless restructuring).

## Structure (npm-workspaces monorepo)

- `packages/core` — **headless, framework-agnostic TypeScript** (no DOM). The data model,
  tidy-tree layout engine, undo/redo history, and Markdown/JSON import-export. Published as
  `clarity-mind` (bare `clarity` is taken on npm).
- `packages/react` — React binding (DOM nodes + SVG connectors, keyboard model, pan/zoom,
  animations). _Not built yet — next milestone._
- `demo/` — a Vite web app that doubles as the live demo + docs. _Not built yet — next milestone._

Keep `core` **DOM-free** (tsconfig `lib` excludes DOM on purpose) so it stays embeddable
anywhere. Rendering concerns live only in bindings.

## Run

Package manager: **npm** (workspaces) — chosen for max open-source contributor reach.

- `npm install` — install workspace deps.
- `npm test` / `npm run test:watch` — **Vitest**.
- `npm run typecheck` — `tsc --noEmit` over all package sources.
- `npm run lint` — ESLint (flat config). `npm run format` — Prettier check.
- `npm run build` — per-package `tsc` build to `dist/`.

## Where it differs from the global baseline

- **No ops CLI with deploy/migrate verbs, no `ship.yml`, no DB/RLS probes** — this is a library,
  not a hosted app. The npm scripts above are the whole "CLI". Ship = `npm publish` (later).
- **Design north star = UX.** Every change is judged on whether the map feels fast and alive.
  Prefer animated, stable layout transitions over instant teleports.

## Deeper state

Prior art studied but not forked: `mind-elixir`, `simple-mind-map` (wanglin2), `jsmind`. The
DOM-nodes + SVG-connectors rendering approach is deliberate (crisp export + accessibility over a
pure-canvas engine).
