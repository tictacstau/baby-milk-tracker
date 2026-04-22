# TeamBaby — Handoff Notes

## What it is
A React PWA (Progressive Web App) for parents to track their baby's feeds, sleep, diapers, pumping, weight, and medicine. Partners sync in real time via Firebase Firestore using a shared invite code.

- **Live URL**: https://babies.fit (also https://teambaby.live)
- **Repo**: https://github.com/tictacstau/baby-milk-tracker
- **Deploy**: Vercel, auto-deploys from `main` branch
- **Stack**: React (CRA), Firebase Firestore, Lucide icons, inline styles throughout, no CSS files

---

## Current state (as of April 2026)
The app is live and functional. Core features are complete.

### What's built
- **Home tab**: next feed countdown, quick log strip (3×2 grid), wake window tracker
- **Summary tab**: Feeds, Sleep, Diapers, Pumping, Weight, Medicine sections (collapsible), Previous Days history
- **Settings tab**: Baby name/age, Units (ml/oz), Appearance (light/dark/system), Invite Code, Install App
- **Onboarding screen**: "New family" (create) / "Join your partner" (enter invite code)
- **Splash screen**: purple animated screen on launch (~2s)
- **PWA**: service worker (`public/sw.js`), offline banner, localStorage cache fallback
- **Retrospective logging**: time picker on all log modals
- **Install nudge**: appears after first feed logged — "Install" (Android) or "Show me" → Settings (iOS)

### Log types
Feed · Diaper · Sleep (wake window toggle) · Pump · Weight · Medicine

---

## Architecture notes

### Single-file app
All UI and logic lives in `src/App.js` (~1720 lines). No separate component files.

### Firebase sync
- Firestore document: `rooms/{roomCode}`
- `onSnapshot` listener keeps state live across partners
- `settingsLoaded` ref guards against writing empty settings before Firestore data arrives (fixes baby name reset bug)
- localStorage key `teambaby_cache` stores last snapshot for offline use

### Key state patterns
- `roomCode` (localStorage) — determines if user is onboarded
- `isDark` boolean — drives all color constants (defined inside App component)
- `settingsLoaded` ref — prevents settings sync race condition
- `isStandalone` — detects PWA installed mode
- `deferredInstallPrompt` ref — holds Android install prompt event

### Color constants (all inside App)
```
ACCENT #5856D6 · BG · CARD · TEXT · TEXT2 · BORDER
GREEN #34C759 · RED #FF3B30 · AMBER #FF9500
WEIGHT_COLOR #30B0C7 · MED_COLOR #FF2D55
```

### Service worker (`public/sw.js`)
- Network-first for HTML, cache-first for static assets
- Skips all Firebase hostnames
- `vercel.json` sets no-cache on `index.html` and `sw.js`

---

## Known issues / things to revisit

1. **"Room" still appears in one place** — the home tab header shows `Room: XXXXXX` (copy invite code button). Should be renamed to "Invite Code" or removed for cleaner UI.

2. **Install nudge only dismisses permanently** — once dismissed via localStorage it never shows again, even if the user didn't actually install. Could add a "remind me later" path.

3. **Previous Days doesn't include Weight/Medicine history** — the per-day breakdown only shows feeds, sleep, diapers, and pumping. Weight and medicine are summary-only (today's view).

4. **No delete/edit for logged entries** — users can't fix a mistake after logging.

5. **No data export** — parents may want to share a report with a paediatrician.

6. **App Store listing** — not on App Store. Path would be a WKWebView Swift wrapper around babies.fit.

---

## Next session — suggested starting points
- Pick up any item from "Known issues" above
- Or start with UX polish based on user feedback

## File map
```
src/
  App.js          — entire app (~1720 lines)
  firebase.js     — Firebase init
public/
  sw.js           — service worker
  site.webmanifest
  index.html      — SW registration, OG tags
  favicon.svg     — app icon (used in splash screen too)
  og-image.png    — social share image
vercel.json       — cache-control headers
```
