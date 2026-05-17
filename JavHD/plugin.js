(function() {
    const BASE_URL = typeof manifest !== 'undefined' && manifest.baseUrl ? manifest.baseUrl : "https://javhd.icu";
    const HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    };

    // Helper: parseHtml trả về document, hỗ trợ querySelector, querySelectorAll, getAttribute, textContent
    async function fetchDoc(url) {
        const res = await http_get(url, HEADERS);
        if (res.status !== 200) throw new Error('HTTP ' + res.status);
        return await parseHtml(res.body); // parseHtml có thể async
    }

    function cleanTitle(str) {
        return String(str || '').replace(/^JAV HD\s*/i, '').trim();
    }

    // Tạo MultimediaItem từ một element (thẻ <div class="item...">)
    function itemToMedia(el) {
        const a = el.querySelector('a');
        if (!a) return null;
        const href = a.getAttribute('href');
        if (!href) return null;

        const title = cleanTitle(a.getAttribute('title') || el.querySelector('img')?.getAttribute('alt') || a.textContent?.trim() || 'Untitled');
        const poster = el.querySelector('img')?.getAttribute('src') || el.querySelector('img')?.getAttribute('data-src') || '';

        return new MultimediaItem({
            title: title,
            url: href,
            posterUrl: poster,
            type: 'nsfw',
            headers: HEADERS
        });
    }

    // Trích xuất danh sách iframe src từ document (loại bỏ link không hợp lệ)
    function getIframeSrcs(doc) {
        const iframes = doc.querySelectorAll('iframe');
        const links = [];
        for (const iframe of iframes) {
            const src = iframe.getAttribute('src');
            if (src && !src.startsWith('https://a.realsrv.com')) {
                links.push(src);
            }
        }
        return links;
    }

    // === CORE FUNCTIONS ===
    async function getHome(cb) {
        try {
            const doc = await fetchDoc(`${BASE_URL}/page/1`);
            const homeData = {};

            const sectionHeaders = doc.querySelectorAll('div.section-header');
            const titles = Array.from(sectionHeaders).map(h => h.textContent.trim()).filter(t => t);

            const widgets = doc.querySelectorAll('div#video-widget-3016');
            let idx = 0;
            for (const widget of widgets) {
                const sectionTitle = titles[idx] || `Section ${idx + 1}`;
                const items = Array.from(widget.querySelectorAll('div.col-md-3.col-sm-6.col-xs-6.item.responsive-height.post'))
                    .map(el => itemToMedia(el))
                    .filter(Boolean);
                if (items.length > 0) homeData[sectionTitle] = items;
                idx++;
            }

            if (Object.keys(homeData).length === 0) throw new Error('No sections');
            cb({ success: true, data: homeData });
        } catch (e) {
            cb({ success: false, errorCode: 'HOME_ERROR', message: e.message });
        }
    }

    async function search(query, cb) {
        try {
            const doc = await fetchDoc(`${BASE_URL}/?s=${encodeURIComponent(query)}`);
            const items = Array.from(doc.querySelectorAll('div.item.responsive-height.col-md-4.col-sm-6.col-xs-6'))
                .map(el => itemToMedia(el))
                .filter(Boolean);
            cb({ success: true, data: items });
        } catch (e) {
            cb({ success: false, errorCode: 'SEARCH_ERROR', message: e.message });
        }
    }

    async function load(url, cb) {
        try {
            const doc = await fetchDoc(url);

            // Poster
            const posterImg = doc.querySelector('div.video-details div.post-entry img');
            const poster = posterImg?.getAttribute('src') || posterImg?.getAttribute('data-src') || '';

            // Title
            const captionP = doc.querySelector('p.wp-caption-text');
            const rawTitle = captionP ? captionP.textContent.trim() : (doc.querySelector('h1')?.textContent.trim() || 'No Title');
            const title = cleanTitle(rawTitle);

            // Description
            const descPs = doc.querySelectorAll('div.video-details div.post-entry p');
            let description = null;
            for (const p of descPs) {
                const t = p.textContent.trim();
                if (t && !t.includes('wp-caption-text')) {
                    description = t;
                    break;
                }
            }

            // Year
            let year = null;
            const dateSpan = doc.querySelector('span.date');
            if (dateSpan) {
                const dateText = dateSpan.textContent.trim();
                const nums = dateText.replace(/[^0-9]/g, '');
                if (nums.length >= 4) year = parseInt(nums.slice(-4));
            }

            // Tags
            const tags = [];
            const metaSpans = doc.querySelectorAll('span.meta');
            for (const meta of metaSpans) {
                const captionEl = meta.querySelector('span.meta-info');
                if (captionEl && (captionEl.textContent.trim().toLowerCase() === 'category' || captionEl.textContent.trim().toLowerCase() === 'tag')) {
                    const aTags = meta.querySelectorAll('a');
                    for (const a of aTags) {
                        const t = a.textContent.trim();
                        if (t) tags.push(t);
                    }
                }
            }

            // Recommendations
            const recs = [];
            const recDivs = doc.querySelectorAll('div.latest-wrapper div.item.active > div');
            for (const recDiv of recDivs) {
                const recItem = itemToMedia(recDiv);
                if (recItem) recs.push(recItem);
            }

            // Kiểm tra scenes (pagination)
            const sceneLis = doc.querySelectorAll('ul.pagination.post-tape > li');
            if (sceneLis.length > 0) {
                const episodes = [];
                for (let i = 0; i < sceneLis.length; i++) {
                    const li = sceneLis[i];
                    const a = li.querySelector('a');
                    const link = a?.getAttribute('href');
                    const numText = a?.textContent.trim() || '';
                    const num = parseInt(numText) || (i + 1);
                    if (link) {
                        try {
                            const sceneDoc = await fetchDoc(link);
                            const iframes = getIframeSrcs(sceneDoc);
                            episodes.push(new Episode({
                                name: `Scene ${num}`,
                                url: JSON.stringify(iframes),
                                episode: num,
                                posterUrl: poster
                            }));
                        } catch (e) { /* skip broken scenes */ }
                    }
                }
                if (episodes.length > 0) {
                    return cb({
                        success: true,
                        data: new MultimediaItem({
                            title,
                            url,
                            posterUrl: poster,
                            type: 'series',
                            description,
                            year,
                            tags,
                            recommendations: recs,
                            episodes,
                            headers: HEADERS
                        })
                    });
                }
            }

            // Movie
            const iframes = getIframeSrcs(doc);
            cb({
                success: true,
                data: new MultimediaItem({
                    title,
                    url: JSON.stringify(iframes),
                    posterUrl: poster,
                    type: 'movie',
                    description,
                    year,
                    tags,
                    recommendations: recs,
                    headers: HEADERS
                })
            });
        } catch (e) {
            cb({ success: false, errorCode: 'LOAD_ERROR', message: e.message });
        }
    }

    async function loadStreams(dataUrl, cb) {
        try {
            const links = JSON.parse(dataUrl);
            const streams = [];
            for (let link of links) {
                // Rewrite domain
                if (link.startsWith('https://javhdfree.icu')) {
                    const noProto = link.replace('https://', '');
                    const idx = noProto.indexOf('/') + 1;
                    link = 'https://embedsito.com/' + noProto.substring(idx);
                } else if (link.startsWith('https://viewsb.com')) {
                    link = link.replace('viewsb.com', 'watchsb.com');
                }

                if (typeof loadExtractor === 'function') {
                    const extracted = await loadExtractor(link);
                    if (Array.isArray(extracted)) {
                        extracted.forEach(s => {
                            s.source = 'JavHD';
                            streams.push(s);
                        });
                    }
                } else {
                    streams.push(new StreamResult({
                        url: link,
                        source: 'JavHD',
                        quality: 1080,
                        headers: { ...HEADERS, Referer: link }
                    }));
                }
            }
            // Dedup
            const seen = new Set();
            const finalStreams = streams.filter(s => {
                const key = s.url + '|' + s.source;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
            cb({ success: true, data: finalStreams });
        } catch (e) {
            cb({ success: false, errorCode: 'STREAM_ERROR', message: e.message });
        }
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();