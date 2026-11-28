# Phase 2.8.1 — Manual browser QA checklist

Automated Playwright tests cover the main desktop browser flows, but they do not replace checks on the actual release devices. Complete this checklist before merging to `main` or publishing the release.

## Test setup

- Test the development branch: https://github.com/rachitstha1223455-hue/mangaflow-ai/tree/phase-2-hybrid-ai
- Use a fresh test project and disposable media files. Do not use private stories or personal media.
- Record browser name/version, operating system, device model, screen size and date.
- Keep one copy of the portable ZIP bundle outside the browser before testing storage recovery.
- Do not clear browser data until the backup has been verified on another browser/device.

## Desktop browser checks

Run the following in current stable Google Chrome and Microsoft Edge on Windows 10/11. Repeat in Firefox where available.

### 1. Save, close and reopen a project

- [ ] Create a test story and give the project a unique name.
- [ ] Save the project and confirm it appears in Projects.
- [ ] Close the tab, reopen the app and open the project.
- [ ] Confirm the story, Story Bible, scenes, comic pages, audio queue, subtitles and video timeline remain intact.
- [ ] Confirm there are no uncaught errors in the browser console.

Expected: project metadata is restored from browser storage without losing existing fields.

### 2. Import an older JSON backup

- [ ] Import a legacy backup that contains only story/project fields.
- [ ] Confirm the project and story text appear.
- [ ] Confirm missing comic, audio and video fields receive safe empty defaults.
- [ ] Try an invalid JSON file and confirm the existing project list remains unchanged.

Expected: old backups remain compatible; invalid backups do not overwrite current data.

### 3. Offline startup

- [ ] Open the app once while online and wait for the service worker to finish installing.
- [ ] Reload once while online.
- [ ] Disconnect the network or use DevTools Network > Offline.
- [ ] Reload the app and navigate between the locally cached pages.
- [ ] Reconnect and reload.

Expected: the cached app shell opens offline. Online AI, remote TTS and image generation are expected to require a network connection.

### 4. Artwork and audio persistence

- [ ] Upload a representative image and audio file smaller than the 50 MB per-file limit.
- [ ] Save the project, close the tab, reopen the app and verify the media still resolves.
- [ ] Export a portable ZIP bundle.
- [ ] Import that ZIP in a separate browser profile or another device.
- [ ] Verify the project references and media playback/rendering are restored.

Expected: IndexedDB media persists in the same browser profile; the portable ZIP moves metadata and media together. A JSON-only backup does not contain media blobs.

### 5. Short video export

- [ ] Create a 5–10 second timeline with at least two clips.
- [ ] Add one subtitle and one short audio track.
- [ ] Preview from the beginning, seek to the middle and verify audio follows the playhead.
- [ ] Export using the MP4 / WebM action.
- [ ] Play the downloaded file in a separate media player.
- [ ] Confirm video, audio, subtitle burn-in and file extension/container are correct.

Expected: a non-empty playable file is downloaded. MP4 depends on native browser recording support or successful optional FFmpeg WebAssembly conversion; WebM is the fallback.

### 6. Mobile browser and storage

- [ ] Open the deployed/test app on a real Android phone using Chrome.
- [ ] Check navigation, forms, comic panel controls, audio playback and video preview at portrait and landscape sizes.
- [ ] Upload a small image and audio file, reload, and verify they persist.
- [ ] Export a short video and a portable ZIP if the browser supports the required APIs.
- [ ] Repeat the layout and basic persistence checks in iOS Safari if an iPhone/iPad is available.
- [ ] Check that controls remain usable with touch and that the page has no unintended horizontal overflow.

Expected: the app remains usable at the tested viewport. Browser storage quotas and media codec support vary by device; do not assume desktop results guarantee mobile support.

## Results log

| Field | Result |
|---|---|
| Date/time | |
| Browser and version | |
| OS / device | |
| Tests passed | |
| Tests failed | |
| Console errors | |
| Video format exported | |
| ZIP import verified | |
| Notes / evidence links | |

## Release gate

- [ ] All desktop checks pass in Chrome and Edge.
- [ ] Legacy JSON import and portable ZIP round-trip pass.
- [ ] Offline app-shell reopening passes after initial installation.
- [ ] Short video export produces a playable file with expected audio.
- [ ] At least one real Android browser check is complete.
- [ ] Any failures are fixed and the CI workflow passes on the final commit.

Do not merge to `main`, publish the release or begin APK packaging until the release gate is complete. If a physical device is unavailable, record that check as **not tested**, not as passed.
