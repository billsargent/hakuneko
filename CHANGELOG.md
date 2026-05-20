# Changelog

All notable modifications to this fork of HakuNeko are documented in this file.

## [Unreleased]

### Added
- **Date/Time Stamp on Terminal Log Messages** — Every `[IMPORT]` log message in the terminal now includes a `[YYYY-MM-DD HH:MM:SS AM/PM]` prefix (e.g., `[2026-05-17 7:45:02 PM]`), added in the `_log()` method of both theme files. The timestamp uses the user's local timezone and 12-hour format.
- **Configurable URL Timeout** — Added a "Timeout" dropdown (values 1m/2m/5m/10m/20m, default 2m) to the Import Queue UI that controls how long `_resolveAndPrefetch()` will wait per URL before timing out. Essential for manga with ~100 chapters where the default 120s was too short. Setting is persisted across sessions in IndexedDB meta via `_saveMeta()`/`_checkSavedState()`.

### Fixed
- **Pause Doesn't Stop In-Flight Network Requests (Download Phase)** — When pausing during chapter downloads, active `fetch()` calls continued until completion. Fixed by passing an `AbortController.signal` to all download `fetch()` calls in the worker pool, and calling `controller.abort()` on all tracked controllers when Pause is triggered. The current chapter is marked as failed and can be retried.
- **Network Activity Continues After Pause During Resolve Phase** — Added phase-check bails after `getMangaFromURI()`, after `getChapters()`, and after each `getPages()` in `_resolveAndPrefetch()`. If the phase changes from 'resolving' to anything else, the function immediately throws an error and stops processing remaining chapters.
- **UI Goes White After Hundreds of URLs Resolved** — Two root causes fixed:
  - **Unbounded memory growth**: The `_pageUrlCache` Map could grow to millions of entries. Added `_trimPageUrlCache()` which caps the cache at 5000 entries (oldest evicted), called after each batch save in `_processUrls()`. Also evicts each chapter's page URLs immediately after download completes/fails in `_processDownloads()`.
  - **Polymer re-render storms**: `_refreshDisplayUrls()` was called on every chapter iteration, creating massive Polymer diff computations. Throttled both calls in `_processDownloads()` to max once per 500ms using `_lastRefreshTime`.
- **"Cannot call remote channel" IPC Errors on Shutdown** — Changed `this._logger.warn(error)` to `this._logger.debug(error)` in `ElectronBootstrap.js` catch blocks for `_setupBeforeSendHeaders()` and `_setupHeadersReceived()`, eliminating noise from orphaned IPC calls when the window is closing.

### Changed
- Sync maintained between `@classic-dark` and `@classic-light` themes — all modifications (UI white-screen fixes, throttled refresh, cache eviction, phase-check bails, configurable timeout) are applied identically to both themes.

## [2026-05-16]

### Fixed
- **Maximum IPC Message Size Exceeded** — Loading saved queue state from IndexedDB via `getAll()` failed for large queues because the single-call transfer exceeded Electron's IPC message size limit. Replaced with cursor-based `getAllUrlsCursor()` that yields records one-by-one, stripping `pageUrls` and caching them in `_pageUrlCache` before each record enters Polymer's observable scope.

## [2026-05-15]

### Added
- **IndexedDB Import Queue** — Complete redesign using a custom IndexedDB database (`ImportQueueDB.mjs`) instead of in-memory-only state:
  - **Phase 1 (Resolve URLs)**: Resolves each URL to its manga/connector, fetches all chapters, and pre-fetches all page URLs. Chapter page URLs are stored in a non-observable `_pageUrlCache` Map (outside Polymer's IPC serialization scope) and saved to IndexedDB.
  - **Phase 2 (Download Chapters)**: Downloads page images directly from cached URLs using the existing `Engine.Storage.saveChapterPages()` pipeline — no external queue needed.
  - **Deduplication on Reimport**: Detects already-resolved manga in IndexedDB and skips them. Partially-resolved or failed records are retried.
  - **Batch Saves**: Saves each resolved batch of URLs to IndexedDB immediately (instead of per-URL) to reduce IPC congestion with `onBeforeSendHeaders`.
  - **Crash Recovery**: On app restart, detects saved queue state, normalizes active phases (e.g., 'downloading' → 'download-paused'), and allows the user to resume.
  - **Non-Observable Page URL Cache**: `pageUrls` arrays are moved to a JavaScript `Map` (`_pageUrlCache`) keyed by `url::chapterId` and nulled on chapter records, keeping them out of Polymer's observable data bindings and preventing IPC serialization bloat.

- **Per-URL Timeout** — Each URL in a batch now has an individual 120s timeout using `Promise.race()` with `setTimeout()`. Timeouts are logged separately per-URL and don't block other URLs in the same batch. The timeout value is tracked via `_urlTimeout` property (default 120000ms).

### Fixed
- **Unicode Characters in Import Queue Logs** — Messages with Unicode characters (e.g., accented letters in manga titles) were garbled. Fixed by ensuring proper string encoding in IPC log routing.
- **Invalid `_urlRecords` Assignment in Edge Cases** — The code sometimes referenced `_urlRecords` entries that had been shifted by array mutation. Fixed by tracking `_processedIndex` directly and using `resolveStatus` checks instead of index offsets.

## [2026-05-13]

### Added
- **Periodic Save-State During URL Resolution** — Added periodic `_saveState()` calls at every 20th resolved URL during Phase 1, so progress isn't lost if the app crashes mid-resolution.
- **Project-Relative Storage Directory** — All configuration, cache, and temporary files moved from `%APPDATA%/hakuneko/` to a project-relative `storage/` directory. This makes the application portable and ensures all user data stays within the project folder.

### Fixed
- **Queue State Lost on Mid-Resolution Crash** — If the app crashed during URL resolution (Phase 1), all progress was lost because saves only happened at the end. Periodic save-state now persists progress every 20 URLs.

## [2026-05-07]

### Added
- **Komga-Compatible ComicInfo.xml Metadata** — Added a metadata pipeline that generates ComicInfo.xml files compliant with Komga and other comic server software. Each CBZ now includes standard metadata (series, volume, chapter number, title, etc.) in the proper XML format.
- **CBZ Download Caching** — Added caching to `_saveChapterPagesCBZ()` to prevent sending repeated requests to the same server when downloading multiple chapters of the same manga. Cached results are keyed by chapter ID to ensure fresh data for different chapters.

## [2026-05-04]

### Added
- **CHANGELOG.md and Updated README** — Added this changelog file and updated the README with documentation of all local modifications from the upstream fork.

## [2026-05-03]

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
