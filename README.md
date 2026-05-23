# Pool Balance — PWA install guide

A bromine pool chemistry calculator built as a Progressive Web App. Installs to your home screen like a native app, works offline, no app store needed.

## What's in the bundle

```
pool-pwa/
├── index.html              Main HTML
├── styles.css              Refined aquatic-modern styling
├── app.js                  Chemistry logic + UI
├── sw.js                   Service worker (offline support)
├── manifest.json           PWA install metadata
└── icons/
    ├── icon-192.png        Home screen icon
    ├── icon-512.png        Splash screen icon
    ├── icon-maskable-512.png   For Android adaptive icons
    └── icon-180.png        iOS touch icon
```

## How to host it

A PWA needs to be served over **HTTPS** (or `localhost`) for the service worker and "Add to home screen" prompt to work. Three good options, easiest first:

### Option 1: GitHub Pages (free, 5 minutes)

1. Create a free GitHub account if you don't have one.
2. Create a new repository called something like `pool-balance`.
3. Upload all the files from the `pool-pwa` folder (drag and drop in the browser works fine).
4. In the repo's **Settings → Pages**, set the source to "Deploy from branch: main, folder: / (root)" and save.
5. After a minute, the URL `https://your-username.github.io/pool-balance/` will work.

### Option 2: Netlify Drop (free, 60 seconds)

1. Go to <https://app.netlify.com/drop>
2. Drag the entire `pool-pwa` folder onto the page.
3. You get a URL like `https://random-name.netlify.app/` immediately. Free HTTPS included.

### Option 3: Local test (no installation, just to try it)

```bash
cd pool-pwa
python3 -m http.server 8000
```

Then visit `http://localhost:8000` in Chrome on the same machine. The PWA install banner won't appear over HTTP from another device, but the calculator itself works fine.

## How to install on your phone

Once you have the URL:

### iPhone / iPad (Safari)

1. Open the URL in Safari (must be Safari — not Chrome).
2. Tap the **Share** button (square with up-arrow).
3. Scroll down and tap **Add to Home Screen**.
4. Tap **Add**. The icon appears on your home screen.

### Android (Chrome)

1. Open the URL in Chrome.
2. Either tap the install banner that pops up at the bottom, **or**
3. Tap the **⋮** menu → **Install app** (or **Add to Home Screen**).
4. Confirm. The icon appears with all your other apps.

## What it does

- **Inputs**: pH, total bromine, total alkalinity, total hardness, temperature in °C. Optional free bromine for shock detection.
- **Outputs**: A status card for each reading (in range / low / high / out of range), then a prioritised action plan with specific gram doses of sodium bicarbonate, dry acid, soda ash, calcium chloride, or bromine tablets — calibrated to a 12,000 gallon pool.
- **Shock decision**: If you enter free bromine, it calculates combined bromine (total − free) and recommends MPS shock if above 0.5 ppm. Without it, falls back to a heuristic for warm indoor pools.
- **Langelier saturation index**: Combines all four core readings into a single corrosive/balanced/scaling indicator.
- **History**: Saves your test results locally (in the phone's browser storage). Tap the clock icon in the header to see past readings and trends.
- **Offline**: The service worker caches the app on first visit, so it works without internet after that.

## Customising for a different pool

The pool volume is set in two places. To change from 12,000 gallons:

1. In `app.js`, near the top: `const POOL_VOLUME_GAL = 12000;`
2. In `index.html`, the header subtitle: `<p class="sub">12,000 gal · indoor · bromine</p>`

All dose calculations scale automatically from the gallon figure.

## Notes on the chemistry

Doses use standard pool-industry rules of thumb. Always add **half** the calculated amount, run the pump for 4–6 hours, then retest before adding more. The app warns you about this on every results page. Never mix chemicals together — always add each separately to the pool water.
