# Web Build Deployment

The V1 web app was published as static files from the repository's `stable` branch root. The public project-site path is case-sensitive: `https://handofhate.github.io/GemSprout/`.

Build the V2 website for that GitHub Pages path with the production Firebase project:

```powershell
$env:VITE_GEMSPROUT_DATA_SOURCE = 'firestore'
$env:VITE_GEMSPROUT_FIREBASE_TARGET = 'production'
$env:VITE_GEMSPROUT_WEB_BASE = '/GemSprout/'
npm run build:v2:web
```

Publish the contents of `v2/dist-app` to the root of `stable`; keep `privacy.html` in place. The `manifest.json` makes the site installable as a home-screen web app. This is a browser build, not the native TestFlight IPA.
