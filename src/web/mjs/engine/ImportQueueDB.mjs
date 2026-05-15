"use strict";

/**
 * IndexedDB-backed storage for the import queue.
 * Provides record-level operations for URL resolution data and chapter downloads.
 * Replaces the JSON file-based saveConfig/loadConfig approach for the import queue.
 */
class ImportQueueDB {

    static get DATABASE_NAME() { return 'hakuneko-import-queue'; }
    static get DATABASE_VERSION() { return 1; }

    constructor() {
        this._db = null;
    }

    /**
     * Open (or create) the IndexedDB database.
     * Creates stores if they don't exist on first open.
     */
    async open() {
        if (this._db) return this;
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(ImportQueueDB.DATABASE_NAME, ImportQueueDB.DATABASE_VERSION);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('urls')) {
                    const store = db.createObjectStore('urls', { keyPath: 'url' });
                    store.createIndex('resolveStatus', 'resolveStatus', { unique: false });
                    store.createIndex('lastUpdated', 'lastUpdated', { unique: false });
                }
                if (!db.objectStoreNames.contains('meta')) {
                    db.createObjectStore('meta', { keyPath: 'key' });
                }
            };
            request.onsuccess = (event) => {
                this._db = event.target.result;
                resolve(this);
            };
            request.onerror = (event) => {
                reject(new Error('ImportQueueDB open failed: ' + (event.target.error || 'unknown')));
            };
        });
    }

    /**
     * Ensure database is open.
     */
    async _getDB() {
        if (this._db) return this._db;
        await this.open();
        return this._db;
    }

    // ───────── URL Record Operations ─────────

    /**
     * Upsert a URL record.
     * record = { url, resolveStatus, resolveError?, mangaMeta?, chapters?, lastUpdated }
     */
    async putUrl(record) {
        const db = await this._getDB();
        record.lastUpdated = Date.now();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('urls', 'readwrite');
            const store = tx.objectStore('urls');
            const request = store.put(record);
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error || new Error('putUrl failed'));
        });
    }

    /**
     * Get a single URL record by its URL string.
     */
    async getUrl(url) {
        const db = await this._getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('urls', 'readonly');
            const store = tx.objectStore('urls');
            const request = store.get(url);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = (e) => reject(e.target.error || new Error('getUrl failed'));
        });
    }

    /**
     * Get ALL URL records from the store.
     */
    async getAllUrls() {
        const db = await this._getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('urls', 'readonly');
            const store = tx.objectStore('urls');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = (e) => reject(e.target.error || new Error('getAllUrls failed'));
        });
    }

    /**
     * Get URL records filtered by their resolve status.
     */
    async getUrlsByResolveStatus(status) {
        const db = await this._getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('urls', 'readonly');
            const store = tx.objectStore('urls');
            const index = store.index('resolveStatus');
            const request = index.getAll(status);
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = (e) => reject(e.target.error || new Error('getUrlsByResolveStatus failed'));
        });
    }

    /**
     * Batch-put multiple URL records in a single transaction.
     */
    async putUrls(records) {
        if (!records || records.length === 0) return;
        const db = await this._getDB();
        const now = Date.now();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('urls', 'readwrite');
            const store = tx.objectStore('urls');
            let completed = 0;
            for (const record of records) {
                record.lastUpdated = now;
                const request = store.put(record);
                request.onsuccess = () => {
                    completed++;
                    if (completed >= records.length) resolve();
                };
                request.onerror = (e) => reject(e.target.error || new Error('putUrls batch failed'));
            }
        });
    }

    /**
     * Update just the resolveStatus and optional error for a URL.
     */
    async updateResolveStatus(url, status, error) {
        const db = await this._getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('urls', 'readwrite');
            const store = tx.objectStore('urls');
            const getReq = store.get(url);
            getReq.onsuccess = () => {
                const record = getReq.result;
                if (record) {
                    record.resolveStatus = status;
                    if (error !== undefined) record.resolveError = error;
                    record.lastUpdated = Date.now();
                    store.put(record).onsuccess = () => resolve();
                } else {
                    resolve();
                }
            };
            getReq.onerror = (e) => reject(e.target.error || new Error('updateResolveStatus failed'));
        });
    }

    /**
     * Update the chapters array for a URL record (after pre-fetching page URLs).
     */
    async updateChapters(url, chapters) {
        const db = await this._getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('urls', 'readwrite');
            const store = tx.objectStore('urls');
            const getReq = store.get(url);
            getReq.onsuccess = () => {
                const record = getReq.result;
                if (record) {
                    record.chapters = chapters;
                    record.lastUpdated = Date.now();
                    store.put(record).onsuccess = () => resolve();
                } else {
                    resolve();
                }
            };
            getReq.onerror = (e) => reject(e.target.error || new Error('updateChapters failed'));
        });
    }

    /**
     * Update a single chapter's download status within a URL record.
     */
    async updateChapterDownloadStatus(url, chapterIndex, status, error) {
        const db = await this._getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('urls', 'readwrite');
            const store = tx.objectStore('urls');
            const getReq = store.get(url);
            getReq.onsuccess = () => {
                const record = getReq.result;
                if (record && record.chapters && record.chapters[chapterIndex]) {
                    record.chapters[chapterIndex].downloadStatus = status;
                    record.chapters[chapterIndex].downloadError = error || null;
                    record.lastUpdated = Date.now();
                    store.put(record).onsuccess = () => resolve();
                } else {
                    resolve();
                }
            };
            getReq.onerror = (e) => reject(e.target.error || new Error('updateChapterDownloadStatus failed'));
        });
    }

    // Delete all URL records (reset queue)
    async deleteAllUrls() {
        const db = await this._getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('urls', 'readwrite');
            const store = tx.objectStore('urls');
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error || new Error('deleteAllUrls failed'));
        });
    }

    /**
     * Delete a single URL record.
     */
    async deleteUrl(url) {
        const db = await this._getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('urls', 'readwrite');
            const store = tx.objectStore('urls');
            const request = store.delete(url);
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error || new Error('deleteUrl failed'));
        });
    }

    /**
     * Count URLs matching a resolve status.
     */
    async countByResolveStatus(status) {
        const db = await this._getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('urls', 'readonly');
            const store = tx.objectStore('urls');
            const index = store.index('resolveStatus');
            const request = index.count(status);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error || new Error('countByResolveStatus failed'));
        });
    }

    /**
     * Total count of all URL records.
     */
    async countAll() {
        const db = await this._getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('urls', 'readonly');
            const store = tx.objectStore('urls');
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error || new Error('countAll failed'));
        });
    }

    // ───────── Meta Store Operations ─────────

    async getMeta(key) {
        const db = await this._getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('meta', 'readonly');
            const store = tx.objectStore('meta');
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result ? request.result.value : null);
            request.onerror = (e) => reject(e.target.error || new Error('getMeta failed'));
        });
    }

    async putMeta(key, value) {
        const db = await this._getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('meta', 'readwrite');
            const store = tx.objectStore('meta');
            const request = store.put({ key, value });
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error || new Error('putMeta failed'));
        });
    }

    async deleteMeta(key) {
        const db = await this._getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('meta', 'readwrite');
            const store = tx.objectStore('meta');
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error || new Error('deleteMeta failed'));
        });
    }

    async deleteAllMeta() {
        const db = await this._getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('meta', 'readwrite');
            const store = tx.objectStore('meta');
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error || new Error('deleteAllMeta failed'));
        });
    }

    /**
     * Complete reset: delete all URLs and meta.
     */
    async reset() {
        await this.deleteAllUrls();
        await this.deleteAllMeta();
    }

    /**
     * Close the database connection.
     */
    close() {
        if (this._db) {
            this._db.close();
            this._db = null;
        }
    }
}

export default ImportQueueDB;
