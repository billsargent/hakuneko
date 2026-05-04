# Changelog

All notable modifications to this fork of HakuNeko are documented in this file.

## [Unreleased]

### Added
- **Page URL Logging** — When downloading chapters, each page URL being fetched is now logged to the terminal with the format `[PAGE] Fetching (N/total): url`. This provides real-time visibility into which pages are being downloaded, especially useful when multiple pages are being fetched concurrently.

- **Configurable Page Concurrency** — Added a "Page Concurrency" dropdown (values 1–20, default 3) to the Import Queue UI that controls how many pages are downloaded simultaneously per chapter. Uses a worker pool pattern where N concurrent workers pull pages from a shared index counter, preserving page order in results. This dramatically speeds up chapters with many pages while respecting server limits. Setting is persisted across sessions and takes effect on the next chapter download.

- **Instant Manga Reconstruction from Metadata** — Instead of re-resolving all URLs over the network on resume (which was extremely slow), manga metadata (connector, ID, title) is now stored alongside each resolved URL. On resume, manga objects are reconstructed instantly in memory using `new Manga(connector, id, title)`.

- **Crash-Safe Queue Persistence** — Queue state (phase, resolved URLs, chapter indices) is now saved after every 5 chapters to `Engine.Storage`. On app restart, saved state is detected and the user can resume from where they left off, using either the instant reconstruction or fallback re-resolve approach.

- **Two-Phase Import Queue with Built-in Download Engine** — Complete redesign of the Import Queue Manager:
  - **Phase 1 (Resolve URLs)**: Parses imported text files containing URLs, resolves each URL to its corresponding manga/connector, and builds an organized list.
  - **Phase 2 (Download Chapters)**: Uses the existing `chapter.getPages()` + `Engine.Storage.saveChapterPages()` pipeline to download chapters as CBZ/PDF/EPUB — no external queue needed.
  - Crash-safe with separate tracking for resolve-paused vs download-paused states.
  - UI shows phase badges, per-URL chapter lists with expandable details, chapter-level status icons (pending/downloading/downloaded/failed), and separate control buttons for each phase.

- **Import URLs Feature** — Ability to import a list of manga/anime URLs from a text file, which are then resolved and queued for batch downloading.

- **Detailed Console Logging** — Extensive `[IMPORT]`-prefixed logging throughout the Import Queue, covering: file picking (path, byte count, URL count, chunk progress), queue controls (Start/Pause/Resume/Reset/Close with parameters), URL resolution (each URL ✓ or ✗ with connector info), chapter fetching (dedup count, progress), and state save/restore events.

- **IPC Terminal Routing** — All Import Queue log messages are routed from the Electron renderer process to the main process terminal via IPC, ensuring visibility when running `npm start`.

- **Chunked Loading for Large Files** — Files with 10,000+ URLs are processed in chunks of 500 with periodic UI yields at every 5,000 items, keeping the interface responsive during import.

- **Immediate Status Feedback** — The Import Queue panel opens immediately when a file is selected, showing "Reading file..." status before processing begins.

### Fixed
- **False 'All Complete' When Downloads Failed** — Critical bug: when all chapters finished processing (whether successful or failed), the code unconditionally declared completion and cleared the queue state. Now it honestly reports partial/all failures and allows retry. If some chapters failed, shows "Resume Downloads" button. If all failed, returns to resolve-done state for URL re-review.

- **Missing Download/Resume Buttons on App Restart** — When the app was closed mid-download without explicit Pause, the saved phase was 'downloading', but no button conditions matched this phase value. Fixed by normalizing active phases on restore (e.g., 'downloading' → 'download-paused', 'resolving' → 'resolve-paused').

- **Live Chapter Count Updates During Download** — Added a `_chaptersVersion` counter that increments after each chapter completes, forcing Polymer to re-evaluate computed bindings so chapter counts (X / Y) update in real-time.

- **notifyPath Bug (Data Not Actually Mutated)** — Critical bug: Polymer's `notifyPath()` notifies the UI of changes but does NOT actually modify the underlying array data. Changed all `notifyPath()` calls to `set()` in `_resolveUrl`, `_processUrls`, and `_processDownloads`, which both mutates data AND notifies Polymer. Was causing "0 OK, 0 failed" results after 30+ minutes of processing.

- **Shadow DOM Cross-Boundary Event** — The "Import URLs" button in mangas.html couldn't find the import-queue element because `document.querySelector()` can't cross shadow DOM boundaries across custom elements. Fixed by dispatching a composed+bubbling `CustomEvent('import-urls')` instead.

- **Dynamic Import Path for Manga Class** — The import path for Manga.mjs was `../../mjs/engine/Manga.mjs` which resolved to `hakuneko://cache/lib/mjs/engine/Manga.mjs` (only 2 levels up from the importqueue.html file). Fixed to `../../../mjs/engine/Manga.mjs` which correctly resolves to `hakuneko://cache/mjs/engine/Manga.mjs` (3 levels up to `src/web/`).

- **Remote Auto-Updates Disabled** — Disabled remote auto-updates to prevent overwriting local modifications.

### Changed
- Sync maintained between `@classic-dark` and `@classic-light` themes — all modifications are applied identically to both themes and verified with `fc` (file compare).

## [Initial Upstream Fork] - 2026-05-02
- Initial commit from upstream HakuNeko repository.
