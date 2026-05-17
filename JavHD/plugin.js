(function() {
    const BASE_URL = typeof manifest !== 'undefined' && manifest.baseUrl ? manifest.baseUrl : "https://javhd.icu";
    const HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    };

    async function fetchDoc(url) {
        const res = await http_get(url, HEADERS);
        if (res.status !== 200) throw new Error('HTTP ' + res.status);
        return await parseHtml(res.body);
    }

    function cleanTitle(str) {
        return String(str || '').replace(/^JAV HD\s*/i, '').trim();
    }

    // Tạo MultimediaItem từ 1 element (mô phỏng logic toSearchResponse trong .kt)
    function itemToMedia(el) {
        // Lấy đúng thẻ a trong div.item-img như code gốc
        const content = el.querySelector('div.item-img > a') || el.querySelector('a');
        if (!content) return null;
        const link = content.getAttribute('href');
        if (!link) return null;

        const img = content.querySelector('img') || el.querySelector('img');
        const poster = img?.getAttribute('src') || img?.getAttribute('data-src') || '';

        const title = cleanTitle(
            content.getAttribute('title') ||
            img?.getAttribute('alt') ||
            content.textContent?.trim() ||
            'Untitled'
        );

        return new MultimediaItem({
            title: title,
            url: link,
            posterUrl: poster,
            type: 'nsfw',
            headers: HEADERS
        });
    }

    // Trích xuất danh sách iframe src (bỏ link không hợp lệ)
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

    // === GET HOME với fallback ===
    async function getHome(cb) {
        try {
            const doc = await fetchDoc(`${BASE_URL}/page/1`);
            const homeData = {};

            // --- Cách 1: Selector gốc từ Kotlin ---
            const sectionHeaders = doc.querySelectorAll('div.section-header');
            const titles = Array.from(sectionHeaders).map(h => h.textContent.trim()).filter(t => t);
            const widgets = doc.querySelectorAll('div#video-widget-3016');

            if (widgets.length > 0) {
                widgets.forEach((widget, i) => {
                    const sectionTitle = titles[i] || `Section ${i + 1}`;
                    const items = Array.from(
                        widget.querySelectorAll('div.col-md-3.col-sm-6.col-xs-6.item.responsive-height.post')
                    )
                    .map(el => itemToMedia(el))
                    .filter(Boolean);
                    if (items.length > 0) homeData[sectionTitle] = items;
                });
            }

            // --- Cách 2: Fallback nếu không có widget nào ---
            if (Object.keys(homeData).length === 0) {
                // Tìm tất cả item có class "item" và "post" trong trang
                const fallbackItems = Array.from(
                    doc.querySelectorAll('div.item.responsive-height.post, div.item.post')
                )
                .map(el => itemToMedia(el))
                .filter(Boolean);

                if (fallbackItems.length > 0) {
                    homeData["Main Page"] = fallbackItems;
                }
            }

            // Nếu vẫn rỗng thì báo lỗi
            if (Object.keys(homeData).length === 0) {
                throw new Error('No sections found. Site might have changed structure.');
            }

            cb({ success: true, data: homeData });
        } catch (e) {
            cb({ success: false, errorCode: 'HOME_ERROR', message: e.message });
        }
    }

    // === SEARCH ===
    async function search(query, cb) {
        try {
            const doc = await fetchDoc(`${BASE_URL}/?s=${encodeURIComponent(query)}`);
            const items = Array.from(
                doc.querySelectorAll('div.item.responsive-height.col-md-4.col-sm-6.col-xs-6')
            )
            .map(el => itemToMedia(el))
            .filter(Boolean);
            cb({ success: true, data: items });
        } catch (e) {
            cb({ success: false, errorCode: 'SEARCH_ERROR', message: e.message });
        }
    }

    // === LOAD ===
    async function load(url, cb) {
        try {
            const doc = await fetchDoc(url);

            const posterImg = doc.querySelector('div.video-details div.post-entry img');
            const poster = posterImg?.getAttribute('src') || posterImg?.getAttribute('data-src') || '';

            const captionP = doc.querySelector('p.wp-caption-text');
            const title = cleanTitle(captionP?.textContent?.trim() || doc.querySelector('h1')?.textContent?.trim() || 'No Title');

            const descPs = doc.querySelectorAll('div.video-details div.post-entry p');
            let description = null;
            for (const p of descPs) {
                const t = p.textContent.trim();
                if (t && !t.includes('wp-caption-text')) {
                    description = t;
                    break;
                }
            }

            const dateSpan = doc.querySelector('span.date');
            let year = null;
            if (dateSpan) {
                const nums = dateSpan.textContent.trim().replace(/[^0-9]/g, '');
                if (nums.length >= 4) year = parseInt(nums.slice(-4));
            }

            const tags = [];
            doc.querySelectorAll('span.meta').forEach(meta => {
                const captionEl = meta.querySelector('span.meta-info');
                if (captionEl && /^(category|tag)$/i.test(captionEl.textContent.trim())) {
                    meta.querySelectorAll('a').forEach(a => {
                        const t = a.textContent.trim();
                        if (t) tags.push(t);
                    });
                }
            });

            const recs = Array.from(doc.querySelectorAll('div.latest-wrapper div.item.active > div'))
                .map(el => itemToMedia(el))
                .filter(Boolean);

            // Series hay Movie?
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
                        } catch (e) { /* bỏ qua scene lỗi */ }
                    }
                }
                if (episodes.length > 0) {
                    return cb({ success: true, data: new MultimediaItem({
                        title, url, posterUrl: poster, type: 'series',
                        description, year, tags, recommendations: recs,
                        episodes, headers: HEADERS
                    })});
                }
            }

            const iframes = getIframeSrcs(doc);
            cb({ success: true, data: new MultimediaItem({
                title, url: JSON.stringify(iframes), posterUrl: poster, type: 'movie',
                description, year, tags, recommendations: recs, headers: HEADERS
            })});
        } catch (e) {
            cb({ success: false, errorCode: 'LOAD_ERROR', message: e.message });
        }
    }

    // === LOAD STREAMS ===
    async function loadStreams(dataUrl, cb) {
        try {
            const links = JSON.parse(dataUrl);
            const streams = [];
            for (let link of links) {
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
                        url: link, source: 'JavHD', quality: 1080,
                        headers: { ...HEADERS, Referer: link }
                    }));
                }
            }
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