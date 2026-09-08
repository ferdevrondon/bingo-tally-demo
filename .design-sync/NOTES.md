# design-sync notes for next-appyy

## Repo shape

This repo is a Next.js **app**, not a published component-library package — `components/ui/` (shadcn/ui, Base UI-backed, `base-maia` style) has no `dist/`, no `package.json` `main`/`module`/`exports`, and no `node_modules/next-appyy` entry pointing back at itself. Per the user's explicit scoping choice, only `components/ui/` is synced (`cfg.srcDir`) — the app's page-specific components (`components/*.tsx` outside `ui/`) are intentionally excluded.

## Build setup (non-standard — re-sync must redo this)

- **Self-reference symlink**: `.ds-sync/nm/` is a scratch node_modules built by mirroring every top-level entry of the real `node_modules/` as a symlink, PLUS `.ds-sync/nm/next-appyy -> <repo root>`. This is what lets the converter's `--node-modules`/`PKG` resolution (`join(NODE_MODULES, PKG)`) land on the repo root as `PKG_DIR`, since this app isn't actually installed as a dependency of itself. `.ds-sync/nm/` must be gitignored and regenerated on every fresh clone / re-sync:
  ```bash
  mkdir -p .ds-sync/nm
  for entry in node_modules/*; do ln -sfn "$(pwd)/$entry" ".ds-sync/nm/$(basename "$entry")"; done
  ln -sfn "$(pwd)" ".ds-sync/nm/next-appyy"
  ```
  Build command: `node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules .ds-sync/nm --out ./ds-bundle` (no `--entry` — synth-entry mode from `cfg.srcDir`).
- **Tailwind v4 CSS must be compiled, not copied.** `app/globals.css` starts with `@import "tailwindcss";`, which is a build-time directive Tailwind's own compiler resolves (v4 has no static "tailwindcss.css" file to copy) — pointing `cfg.cssEntry` straight at `app/globals.css` fails validate with `[CSS_IMPORT_MISSING]`. Fix: run `node .design-sync/compile-tailwind.mjs` (committed — uses the repo's own `postcss` + `@tailwindcss/postcss` devDeps to expand `app/globals.css`, JIT-scanning real utility-class usage across the project) before every build, and `cfg.cssEntry` points at its output, `.ds-sync/compiled-tailwind.css` (gitignored, regenerated each time). **Must be run only after `.ds-sync/` and `ds-bundle/` are gitignored** — Tailwind v4's auto content-scan respects `.gitignore`, and running it before those entries exist lets it scan the huge `.ds-sync/node_modules` (esbuild/ts-morph) tree for stray class-like strings and bloat the output (observed 321 KB of noise vs. 140 KB clean). Re-run whenever `app/globals.css` or any `className` usage changes.

## Known render warns (checked, non-blocking)

- `[TOKENS_MISSING]`: `--header-height`, `--drawer-swipe-progress`, `--nested-drawers`, `--drawer-swipe-strength`, `--drawer-swipe-movement-y`, `--drawer-swipe-movement-x`, `--tw` — all set at runtime via inline styles by Base UI's drawer/sidebar internals, never defined statically. Expected absence, not a real gap.
- `[FONT_MISSING]`: "Inter", "JetBrains Mono". Inter is loaded via `next/font/google` in `app/layout.tsx` (Next.js self-hosts it at build time — no static file to copy). JetBrains Mono is only a leftover `--font-mono` token value in `app/globals.css`; nothing in the app actually loads it. **User's explicit call (2026-09-07): accept system-font substitutes** — do not chase real woff2 files unless asked again.
- `components: 139 (22 src-matched)`: only the 24 top-level exports whose name kebab-cases to their file (`Button`→`button.tsx`, `Card`→`card.tsx`, etc.) get JSDoc/group enrichment. The ~117 sibling sub-exports (e.g. `CardHeader`, `CardTitle`, `DialogContent`, all of `sidebar.tsx`'s ~20 exports) land in the `general` group with a synthesized (not JSDoc-derived) prompt — the heuristic matches one primary name per file, not every named export in it. Not fixed this pass (all 12 of the user's chosen "core" authored-preview components — Button, Card, Badge, Input, Label, Field, Select, Dialog, Table, Tabs, Checkbox, Breadcrumb — happen to be exactly the src-matched top-level names, so their previews/docs are unaffected). A future pass could improve subcomponent grouping via `cfg.componentSrcMap` entries pinning each subcomponent to its parent file.

## Re-sync risks

- The `.ds-sync/nm/next-appyy` self-symlink and `.ds-sync/compiled-tailwind.css` are both build artifacts that must be regenerated before every build/re-sync — neither survives a fresh clone or is committed.
- `.ds-sync/compiled-tailwind.css` is JIT-scanned Tailwind output — it silently goes stale if `app/globals.css` tokens change or new utility classes are introduced anywhere in the project without re-running `compile-tailwind.mjs` first.
- No Storybook and no `dist/` — the component list comes entirely from a `ts-morph` scan of `components/ui/*.tsx` (synth-entry mode). Adding a real build step to this repo (even just a `tsup`/`esbuild` bundle of `components/ui/index.ts`) would give stronger `.d.ts` extraction and is the recommended long-term fix, per the design-sync skill's own guidance.
