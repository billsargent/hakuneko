/**
 * System
 * A special connector that allows to use manga links from the clipboard.
 * This connector does not implement the connector base class, because it operates different.
 */
export default class ClipboardConnector {

    /**
     *
     */
    constructor() {
        this.id = 'clipboard';
        this.label = ' 【Clipboard】';
        this.icon = '/img/connectors/' + this.id;
        this.tags = [];
        this.url = undefined;

        this.clipboard = require('electron').clipboard;
        this.mangaCache = [];
    }

    /**
     *
     */
    updateMangas(callback) {
        if(!this.isUpdating) {
            this.isUpdating = true;
            this._getMangaList((_, mangas) => {
                this.mangaCache = mangas;
                this.isUpdating = false;
                this.getMangas(callback);
            });
        }
    }

    /**
     *
     */
    getMangas(callback) {
        callback(null, this.mangaCache);
    }

    /**
     *
     */
    async _getMangaList(callback) {
        try {
            let text = this.clipboard.readText();
            if (!text) {
                callback(null, []);
                return;
            }
            let lines = text.split(/\r?\n/);
            let mangas = [];
            const batchSize = 50;
            for (let i = 0; i < lines.length; i += batchSize) {
                console.log(`Processing clipboard batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(lines.length / batchSize)}`);
                let batch = lines.slice(i, i + batchSize);
                let promises = batch.map(async line => {
                    try {
                        let uri = new URL(line);
                        let connectors = Engine.Connectors.filter(connector => connector.canHandleURI && connector.canHandleURI(uri));
                        if(!connectors.length) {
                            connectors = Engine.Connectors.filter(connector => connector.url && connector.url.includes(uri.hostname));
                        }
                        if(connectors.length > 1) {
                            connectors = connectors.filter(connector => uri.pathname.startsWith(new URL(connector.url).pathname));
                        }
                        if(!connectors.length) {
                            throw new Error('No matching connector found for URL ' + uri.href);
                        }
                        if(connectors.length > 1) {
                            throw new Error('To many matching connectors found for URL ' + uri.href);
                        }
                        return await connectors[0].getMangaFromURI(uri);
                    } catch(error) {
                        console.warn('CLIPBOARD:', line, error);
                        return null;
                    }
                });
                let batchMangas = await Promise.all(promises);
                mangas.push(...batchMangas.filter(Boolean));
            }
            callback(null, mangas);
        } catch (error) {
            callback(error, []);
        }
    }
}