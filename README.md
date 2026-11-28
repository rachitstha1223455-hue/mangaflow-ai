# Manhwa Flow AI — free starter app

## What works
- Mobile-first website/PWA shell
- Story blueprint generator (rule/template-based, not a cloud LLM)
- Character database with locked appearance notes
- Script chunking into numbered scenes
- Anime/manhwa image prompt builder using saved character descriptions
- Editable comic pages with image assets, panel resizing/reordering and print export
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


## Phase 2.3 — Character, location and prop story bible

The Character Studio now contains three reusable databases and an AI-assisted story extraction action.

- Extract story-supported characters, locations and important props from the generated blueprint, chapter plan, idea, or pasted script.
- Character records include role, appearance/personality description, permanent visual locks, motivation and relationships.
- Location records include type, environment description, landmarks, lighting and palette.
- Prop records include type, description, owner and permanent visual details.
- New records receive stable IDs using `CHAR-###`, `LOC-###`, and `PROP-###` formats.
- Duplicate names within an extraction are removed, and names already in the relevant database are skipped.
- AI output is parsed and validated before anything is added. If extraction fails, no partial records are imported.
- Manual record creation and deletion remain available.
- Export the full story bible as JSON.
- Project saves and restores include characters, locations and props. Older projects and older JSON backups without the new arrays remain supported.
- Unit tests cover normalization, duplicate handling, stable IDs, malformed responses and extraction limits.

### Story bible limitations

Extraction quality depends on the selected AI model and the detail in the source story. The extractor is instructed not to invent unknown facts, but every extracted record still needs human review. Manual editing of existing records and automatic scene-to-entity linking are not implemented yet. Those are planned for later continuity and scene-production work.


## Phase 2.4 — Intelligent scene planning and artwork prompts

Scene Breakdown now supports an AI-assisted scene planner that uses the Story Bible.

- Analyze a chapter/script into ordered, visually distinct scene beats.
- Assign stable scene IDs (`SCENE-001`, `SCENE-002`, ...).
- Link only recognized Story Bible character, location and prop IDs.
- Suggest each scene's purpose, camera framing, visual direction, continuity notes and transition.
- Validate AI JSON and discard unknown entity IDs before rendering.
- Fall back to an offline paragraph/length splitter when AI is unavailable. The fallback links registered entity names only when those names appear in the text; it does not understand story meaning.
- Select a scene to create a continuity-aware, copy-ready artwork prompt using its linked character, location and prop records.
- Save and restore the structured scene plan inside existing projects and export it separately as JSON.
- Automated tests cover fallback splitting, entity linking, AI response validation, prompt continuity and scene limits.

### Scene and artwork limitations

The scene planner prepares structured scene data and prompts; it does not generate finished images. Actual image generation requires a connected image-generation provider or a separately hosted model. AI-generated scene links and visual details must be reviewed before production. Manual editing of individual scene records and full visual asset generation are not included in this stage.


## Phase 2.5 — Comic storyboard studio

The Comic Creator has been upgraded from a static panel preview to an editable multi-page storyboard editor.

- Create multiple pages and organize them by chapter/episode.
- Choose page layouts: single cinematic panel, two-column grid, wide top panel, three-panel or four-panel grid.
- Build pages automatically from the current scene plan (four scenes per page), or add scenes individually.
- Link each panel to a known scene and edit its visual description and camera framing.
- Add speaker names, dialogue bubbles, narration boxes and sound-effect text.
- Reorder panels and remove panels/pages.
- Preview the current page with its layout, dialogue, narration and effects.
- Export a readable storyboard text file or structured comic storyboard JSON.
- Save and restore comic pages inside project saves. Older project records without comic pages remain supported.
- Automated tests cover page creation, scene linking, field normalization and text export.

### Comic artwork, layout and print production

- Attach finished panel illustrations from image files. Images are stored in IndexedDB on the current browser/device and referenced by saved comic pages.
- Generate panel artwork through an OpenAI-compatible image-generation proxy endpoint. Configure its HTTPS URL and model in AI Settings; the endpoint must return `data[0].b64_json` or `data[0].url`. The app never stores provider API secrets.
- Drag panels to reorder them and drag the lower-right grip to resize their column span. Page layout presets apply sensible initial spans.
- Preview real attached/generated images alongside dialogue bubbles, narration boxes and sound-effect text.
- Export the selected page as a 2480 × 3508 PNG (A4 at 300 DPI).
- Export all pages through the browser print dialog; choose **Save as PDF** to create a multi-page A4 PDF.
- Artwork files remain local in IndexedDB and are not embedded in the lightweight JSON project backup. Use **Export portable bundle (ZIP + media)** to package all project metadata and local artwork/audio blobs together, then **Import portable bundle** on another device. The ZIP uses an uncompressed internal format to avoid a third-party runtime dependency and has a 500 MB total limit.

Image generation requires a separately hosted compatible provider or proxy, network access and its own compute/billing/free quota. Without one, upload artwork files directly. Print exports are rasterized page images; professional bleed, CMYK colour management and printer crop marks are not implemented.


## Phase 2.6 — Voice and Audio Studio

The Audio Studio adds an ordered dialogue and sound queue that can be saved with each project.

- Add character dialogue, narration, sound-effect and background-music tracks.
- Import dialogue and narration text directly from comic pages.
- Assign a speaker, Hindi/English language and provider voice ID to each text item.
- Generate downloadable speech audio through a separately configured OpenAI-compatible `/audio/speech` endpoint. The provider must return MP3/WAV audio bytes or JSON containing base64 audio.
- Upload existing audio files for music, sound effects or voice recordings.
- Play audio assets in sequence, reorder and remove queue items, and download generated/uploaded clips individually.
- Use browser speech synthesis as an optional preview fallback when no audio file exists. Browser speech preview is not a downloadable recording.
- Save the structured audio queue with project saves and restore it from older/newer project records; export queue metadata as TXT or JSON.
- Automated tests cover queue creation, normalization limits, audio asset references and queue export.

### Audio Studio limitations

Actual downloadable voice generation requires a configured TTS service or private proxy and may incur provider compute costs. No API secret is stored in the browser. Browser speech synthesis depends on voices installed by the user's operating system/browser and is only a playback fallback. The current version queues and plays clips sequentially; it does not yet mix, trim, fade, synchronize or master a multitrack soundtrack, and audio blobs remain local in IndexedDB rather than embedded in JSON backups.


## Phase 2.7 — Video Production Studio

The Video Studio connects scene planning, comic artwork and generated/uploaded audio into a browser-based timeline.

- Add all planned scenes or comic panels to an ordered video timeline.
- Set clip start times and durations, reorder clips, and choose zoom/pan motion plus cut/fade transitions.
- Reuse panel artwork references stored in IndexedDB. Clips without attached art render as title/description cards.
- Preview the timeline on a canvas with timed Hindi/English subtitle overlays.
- Add subtitles manually or import dialogue and narration from comic panels; edit subtitle text and timing.
- Export subtitles as SRT or WebVTT.
- Import generated/uploaded audio queue assets, set start times, durations, volume and mute state.
- Export a browser-recorded WebM video with supported audio tracks using Canvas capture, MediaRecorder and Web Audio APIs.
- Save and restore the normalized video timeline as part of project records. Older projects without a video timeline load with an empty timeline.
- Export timeline metadata as JSON. Artwork and audio blobs remain in local IndexedDB and are not embedded in JSON backups.

### Video Studio export, audio and editing improvements

- The exporter checks the browser's native MediaRecorder codecs and writes **MP4 when video/mp4 recording is supported**. Otherwise it records WebM and attempts a local MP4 conversion using optional FFmpeg WebAssembly loaded on first use (roughly 30 MB from a public CDN). If the CDN, browser memory or codec build prevents conversion, it downloads the original WebM and reports why; it never falsely renames WebM as MP4. Native MP4 recording works without the FFmpeg download.
- Removed the old 10-minute export guard. The app permits timelines up to the model's 60-minute maximum, but long renders can still exhaust browser memory or hit operating-system/browser limits. Render long projects in shorter parts on low-memory devices.
- Preview schedules local audio tracks against the video playhead, including seeking, source trim points, per-track volume, fade-in/fade-out and master volume. The same controls are applied during export.
- Audio tracks show a decoded waveform overview and offer source trim-in/trim-out, timeline start, duration, volume, mute and fade controls.
- Clip, subtitle and audio timeline positions/durations plus audio source trim points snap to the selected frame rate when edited, giving frame-aligned timing rather than arbitrary sub-frame values.
- Audio preview and export use the Web Audio API. If a browser cannot decode an uploaded audio format, that track is skipped and the status reports the issue.
- Export uses MediaRecorder timeslices to collect media chunks. Actual encoding speed, maximum practical duration and memory use still depend on browser, available codecs, RAM, resolution and frame rate.
- This remains a lightweight browser editor, not a professional nonlinear editor or DAW. It does not provide multi-channel audio routing, parametric EQ, compression/limiting, color grading, motion tracking or professional mastering.


## Phase 2.8 — Stability, backups and offline support

The stabilization stage adds regression checks and safer browser persistence across the project.

- Normalize saved project records when opening or importing them. Older project backups without comic, audio or video fields are migrated to safe empty defaults while preserving their story content.
- Validate imported JSON backups before replacing current data. Invalid files and backups above 25 MB are rejected without changing the current project state.
- Export backups with a version and timestamp. The backup retains the existing top-level project and Story Bible arrays for compatibility.
- Handle browser LocalStorage quota errors and show a storage status message instead of allowing a save exception to break the interface.
- Validate IndexedDB binary assets, reject empty files and files larger than 50 MB, and close database connections cleanly when a schema change is requested.
- Limit audio queue imports to the supported 300 items and guard against an upload finishing after its queue item has changed.
- Precache the app HTML, JavaScript modules, icons and manifest in the service worker. Network-first navigation and cache-first static assets improve offline reopening after the first successful installation.
- Expand automated checks for provider fallback, backup migration, asset validation, duplicate HTML IDs, script references, module load order and service-worker precache coverage.

### Stability and browser QA

The application remains a browser-only PWA. LocalStorage and IndexedDB data are device/browser-specific; portable ZIP bundles are the recommended way to move projects with their local media. Browser storage quotas vary by device and browser, and the 50 MB per-file limit does not guarantee that a device has enough remaining storage. Offline mode can use the precached application shell and modules, but online AI, image generation and remote TTS still require a network connection.

GitHub Actions runs Playwright end-to-end checks in bundled Chromium, Google Chrome, Microsoft Edge, Firefox and WebKit. Project save/reopen, JSON backup, portable media bundles, large IndexedDB blobs and offline reopening are exercised on Chromium/Chrome/Edge/Firefox; startup and responsive layout are also checked in WebKit. A short video render is tested in bundled Chromium. This is automated desktop browser coverage plus a mobile-sized viewport, not a substitute for hands-on testing on physical Android/iOS devices or Windows-specific hardware. A successful CI run does not claim those physical-device checks were performed.


## Phase 2.8.1 — Final QA and media portability

- Native MP4 is exported where the browser advertises an MP4 MediaRecorder codec; WebM is used otherwise.
- Removed the former 10-minute export cap and aligned the app's maximum render window with its 60-minute timeline model.
- Synchronized audio preview and export; added decoded waveform overview, source trim in/out, frame-aligned timeline timing, per-track volume, fades and master volume.
- Added portable ZIP bundles that include all IndexedDB media assets as well as project metadata. The existing lightweight JSON backup remains available and compatible.
- Added Playwright end-to-end regression tests across Chromium, Google Chrome, Microsoft Edge, Firefox and WebKit, including project save/reopen, JSON backup round-trip, large IndexedDB media persistence, portable bundle restoration, offline reopening, mobile viewport layout and a short Chromium video render.
- CI cannot physically test every browser/device combination. Manual verification on Windows Edge and real Android/iOS devices remains a release checklist item.
