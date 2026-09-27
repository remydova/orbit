# Orbit

A personal meditation PWA for relaxation and positive visualization: calm, confidence, health, wealth, love and freedom.

- **Daily Orbit**: one journey through all six themes
- **Journeys**: one theme per session
- **Length**: 3, 5, 10 or 20 minutes
- **Session flow**: Arrive (breathing) → Visualize → Affirm → Return
- **Sound**: a generative cosmic drone and singing-bowl chimes, synthesized live
- **Offline**: installable and works without a connection

Plain HTML/CSS/JS with no build step.

## Run locally

```
python -m http.server 8765
```

Then open http://localhost:8765.

## Editing

- The words are all in `content.js`.
- After changing any file, bump `CACHE` in `sw.js` (for example `orbit-v2`) so installed copies refresh.

## Shortcuts (desktop)

Space pauses or resumes. Esc ends the session.
