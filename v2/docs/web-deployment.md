# Web Build Deployment

The V1 web app was published as static files from the repository's `stable` branch root. The public project-site path is case-sensitive: `https://handofhate.github.io/GemSprout/`.

## Current Deployment

- The current Pages deployment is `stable` commit `df36acf`, built from app source commit `bc8cbf9` and targeting production Firestore.
- The latest `main` commit, `6c23f2f`, changes only the native App Store Connect workflow, so it does not require another Pages deployment.
- The loading screen uses generic `Loading...` copy for startup, initial data loading, and subscription checks; purchase restoration remains `Restoring...`.

Build the V2 website for that GitHub Pages path with the production Firebase project:

```powershell
$env:VITE_GEMSPROUT_DATA_SOURCE = 'firestore'
$env:VITE_GEMSPROUT_FIREBASE_TARGET = 'production'
$env:VITE_GEMSPROUT_WEB_BASE = '/GemSprout/'
npm run build:v2:web
```

Publish the contents of `v2/dist-app` to the root of `stable`; keep `privacy.html` in place. The `manifest.json` makes the site installable as a home-screen web app. This is a browser build, not the native TestFlight IPA.
