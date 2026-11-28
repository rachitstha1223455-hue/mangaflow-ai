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


## Phase 2.1 foundation (development branch)

This branch adds the first hybrid-AI and storage foundations while keeping the original starter workflow intact.

- AI settings for **Online proxy**, **Local AI**, and **Hybrid** modes.
- OpenAI-compatible chat-completions requests with timeout handling and readable provider errors.
- Hybrid mode tries the configured online proxy first, then the configured local endpoint.
- The existing built-in story blueprint remains the fallback when no provider is configured or a request fails.
- Provider settings are stored locally, but API secrets are deliberately not collected or stored in browser JavaScript.
- An IndexedDB asset-store helper is available for future large media assets; existing project and character records continue using the original LocalStorage key for compatibility.
- Story generation already offers Hindi and English as task-level language choices. The settings page also saves a preferred language value; complete interface translation is not implemented yet. The saved preference selects the initial Hindi or English value in the Story Generator; individual stories can still choose either language.

### Configure AI providers

1. Open **AI Settings** in the app.
2. Choose **Local AI** and enter an OpenAI-compatible local chat-completions endpoint and model name. The default endpoint is an Ollama-compatible URL at `http://localhost:11434/v1/chat/completions`.
3. For **Online proxy**, enter an HTTPS endpoint you control and the model name configured by that server.
4. For **Hybrid**, configure both providers. The app tries the online proxy first and then the local provider.
5. Use the test buttons before generating a story.

**Security:** GitHub Pages is static hosting. Never paste an OpenAI, Gemini, or other private provider API key into this app or commit one to this repository. An online provider must be accessed through a backend you control, with its secret stored server-side as an environment variable. Browser requests may also require the local endpoint to allow CORS.

### Current Phase 2.1 boundaries

- The local IndexedDB helper is a foundation for future artwork/audio/video assets; existing project data has not yet been migrated out of LocalStorage.
- Provider connectivity depends on a running compatible endpoint, network access, model availability, and CORS policy.
- The interface remains primarily English; story generation can be requested in Hindi or English.
- Image generation, voice synthesis, audio queues, video editing, and MP4 export are not part of this foundation stage.


## Phase 2.2 — Story intelligence

The Story Generator now includes a chapter and episode planner.

- Generate a plan for 5, 10, 15, 20, or 30 chapters.
- Choose how many chapters are grouped into each episode.
- Use the configured Online/Local/Hybrid provider to request a structured chapter plan.
- Validate and normalize the AI response before displaying it.
- If AI is unavailable or returns malformed/incomplete JSON, use a deterministic offline outline template instead.
- Each chapter includes a title, summary, story goal, conflict, turning point, and cliffhanger.
- Export the plan as JSON and save it inside the existing project record. Older saved projects without a chapter plan remain supported.
- Automated Node.js tests cover offline plan generation, episode grouping, AI response validation, and chapter-count limits.

### Story planner limitations

The offline fallback is a reusable structural outline, not a language model and not a substitute for creative AI writing. AI plan quality depends on the connected provider and model. The planner does not yet provide a full chapter editor, automatic character/location/prop extraction, or semantic scene analysis; those belong to later phases.
