# Manhwa Flow AI — free starter app

## What works
- Mobile-first website/PWA shell
- Story blueprint generator (rule/template-based, not a cloud LLM)
- Character database with locked appearance notes
- Script chunking into numbered scenes
- Anime/manhwa image prompt builder using saved character descriptions
- Comic panel storyboard preview
- Local project save, JSON backup and restore

## Run locally
Open `index.html` in a modern browser. For service-worker/PWA testing, serve the folder over HTTPS or localhost.

## Install on Android
1. Publish the folder to a free static HTTPS host (GitHub Pages is one option).
2. Open the published URL in Chrome on Android.
3. Open Chrome menu (three dots) and choose **Install app** or **Add to Home screen**.
4. Use the app from your home screen.

## Free hosting with GitHub Pages
1. Create/sign in to a GitHub account.
2. Create a new public repository, for example `manhwa-flow-ai`.
3. Upload `index.html`, `manifest.json`, and `sw.js` to the repository root.
4. In repository Settings → Pages, choose Deploy from a branch, select `main` and `/ (root)`, then Save.
5. Wait for the published HTTPS URL and open it on Android.

## Important limitations
This starter intentionally uses no paid API and no API key. Its story generator is a structured template helper, not a true generative AI model. The scene splitter divides text by length and does not semantically understand scenes. The prompt builder writes image prompts; it does not render images. True AI text/image generation requires compute: either run open-source models on hardware you control or use a provider's free allowance, subject to its limits and terms. Never put secret API keys in browser JavaScript.
