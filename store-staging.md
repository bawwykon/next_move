# Store submission staging (DEFERRED — ED-27 resolved as point release)

Holding area for the App Store / Google Play package materials. **ED-27 is
closed: this round ships as a point release (in-house / sideload distribution);
store submission is deferred** — nothing has been uploaded and the
DO-NOT-SUBMIT marker stands until a future owner decision reopens it.

## App identity (current app.json)

- name: next_move → store name "Next Move" — version 1.0.0, no explicit
  versionCode/build (app.json), so Android build 1 by default
- icons: `assets/images/icon.png`, splash `assets/images/splash-icon.png`
  (imageWidth 76, #208AEF), adaptive/foreground/monochrome android icons — all
  point at real assets, ready for an EAS build.
- Known gaps to close before any submission:
  1. **Android `package`** — app.json has no `android.package`;
     `expo prebuild`/EAS will not generate a store-ready package id as-is.
     Candidate: `com.nextmove.app` (verify with owner before locking).
  2. **iOS icon** — `ios.icon` points at `./assets/expo.icon`; the project is
     Android-first (tracked Android-only per D-3). Decide at ED-27 whether to
     keep iOS out of this round.
  3. **Privacy policy URL** — no URL is wired (EXPO_PUBLIC or app.json).
     Play requires a privacy policy URL on the store listing; placeholder below.

## Screenshot copy lines (draft, 10–12) — Play Console / App Store

Title: **Next Move — small quests, real progress.**

1. Home: "Today's Recommended Quest" — one clear next step per day.
2. Quest board "Choose Your Adventure" — pick a move, press Start, follow along.
3. Workout screen — timed segments + rest cues, no equipment needed.
4. Quest complete — XP, level-ups, and streak payouts.
5. Skills — Strength · Endurance · Mobility · Discipline — each quest feeds two.
6. Achievements — unlock titles, frames, portraits, backgrounds.
7. Loadout — dress your Adventurer; chapter scenes as you climb.
8. Journey — 7 chapters, 10 → 365 quests, progress that never resets.
9. Daily streak — "2 days strong / 1 day to a 3-day bonus".
10. Friendlier default: profile header with equipped cosmetic set.

## Permission notes (Android 13+)

App declares no runtime permissions (step-count and workouts are manual/on-screen);
privacy policy must state: accounts, progress stored server-side; no analytics SDK
in the store build (NFR-9 logger is local-only, data never leaves the device).

## checklist

- [x] owner decides release shape (ED-27) — **point release, store deferred**
- [ ] android.package chosen + EAS/production build (future store round)
- [ ] privacy policy URL published + wired (future store round)
- [ ] screenshots re-shot from production build on a real device (future store round)
