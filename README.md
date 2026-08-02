# Next Move

Fitness quest app built with Expo (TypeScript + expo-router).

## Run

```bash
npm install
npm start
```

Press `a` for Android (emulator or Expo Go), or `w` for web.

## Scripts

- `npm start` — dev server
- `npm run android` — dev server + Android
- `npm run test` — Jest unit tests
- `npm run lint` — ESLint (zero-warning policy)
- `npm run format` — Prettier write
- `npm run typecheck` — `tsc --noEmit`

## Structure

Follows Ref 01 layout: `src/app/` (routes), `src/features/` (screens),
`src/domain/` (pure logic — see per-folder READMEs for spec sources),
`src/data/` (repositories), `src/state/`, `src/components/ui/`,
`src/lib/` (theme, fonts, helpers), `src/types/`, `tests/`.
