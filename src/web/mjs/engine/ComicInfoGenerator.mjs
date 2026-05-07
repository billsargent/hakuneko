export default class ComicInfoGenerator {
    createComicInfoXML(series, title, pagesCount, metadata = {}) {
        series = this.escapeXML(series);
        title = this.escapeXML(title);

        let xml = `<?xml version="1.0" encoding="utf-8"?>
<ComicInfo xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <Title>${title}</Title>
    <Series>${series}</Series>
    <PageCount>${pagesCount}</PageCount>`;

        if (metadata.number) {
            xml += `\n    <Number>${this.escapeXML(String(metadata.number))}</Number>`;
        }

        if (metadata.summary) {
            xml += `\n    <Summary>${this.escapeXML(metadata.summary)}</Summary>`;
        }

        if (metadata.year) {
            xml += `\n    <Year>${this.escapeXML(String(metadata.year))}</Year>`;
        }

        if (metadata.month) {
            xml += `\n    <Month>${this.escapeXML(String(metadata.month))}</Month>`;
        }

        if (metadata.day) {
            xml += `\n    <Day>${this.escapeXML(String(metadata.day))}</Day>`;
        }

        if (metadata.author) {
            xml += `\n    <Writer>${this.escapeXML(metadata.author)}</Writer>`;
        }

        if (metadata.artist) {
            xml += `\n    <Penciller>${this.escapeXML(metadata.artist)}</Penciller>`;
        }

        if (metadata.coverArtist) {
            xml += `\n    <CoverArtist>${this.escapeXML(metadata.coverArtist)}</CoverArtist>`;
        }

        if (metadata.editor) {
            xml += `\n    <Editor>${this.escapeXML(metadata.editor)}</Editor>`;
        }

        if (metadata.translator) {
            xml += `\n    <Translator>${this.escapeXML(metadata.translator)}</Translator>`;
        }

        if (metadata.letterer) {
            xml += `\n    <Letterer>${this.escapeXML(metadata.letterer)}</Letterer>`;
        }

        if (metadata.colorist) {
            xml += `\n    <Colorist>${this.escapeXML(metadata.colorist)}</Colorist>`;
        }

        if (metadata.inker) {
            xml += `\n    <Inker>${this.escapeXML(metadata.inker)}</Inker>`;
        }

        if (metadata.genre) {
            xml += `\n    <Tags>${this.escapeXML(metadata.genre)}</Tags>`;
        }

        if (metadata.url) {
            xml += `\n    <Web>${this.escapeXML(metadata.url)}</Web>`;
        }

        if (metadata.isbn) {
            xml += `\n    <GTIN>${this.escapeXML(metadata.isbn)}</GTIN>`;
        }

        xml += '\n</ComicInfo>';
        return xml;
    }

    escapeXML(str) {
        const amp = '&';
        return str
            .replace(/&/g, amp + 'amp;')
            .replace(/</g, amp + 'lt;')
            .replace(/>/g, amp + 'gt;')
            .replace(/'/g, amp + 'apos;')
            .replace(/"/g, amp + 'quot;');
    }
}
