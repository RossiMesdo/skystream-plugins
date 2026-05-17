(function() {
    const BASE_URL = typeof manifest !== 'undefined' && manifest.baseUrl ? manifest.baseUrl : "https://javhd.icu";
    const HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    };

    // Helpers sử dụng parse_html(html, selector, attribute) -> [{attr, text}]
    function getFirstAttr(html, selector, attrName) {
        const found = parse_html(html, selector, attrName);
        return found.length > 0 ? found[0].attr : null;
    }

    function getFirstText(html, selector) {
        const found = parse_html(html, selector);
        return found.length > 0 ? found[0].text.trim() : null;
    }

    function getAllAttr(html, selector, attrName) {
        return parse_html(html, selector, attrName).map(el => el.attr).filter(Boolean);
    }

    function cleanTitle(str) {
        return str.replace(/^JAV HD\s*/i, '').trim();
    }

    // Xây MultimediaItem từ block HTML (dùng cho search & home)
    function blockToItem(blockHtml) {
        const link = getFirstAttr(blockHtml, 'a', 'href');
        if (!link) return null;

        // Lấy title: ưu tiên title attr của thẻ a, nếu không thì alt của img
        let title = getFirstAttr(blockHtml, 'a', 'title') || getFirstAttr(blockHtml, 'img', 'alt') || '';
        title = cleanTitle(title);
        if (!title) title = getFirstText(blockHtml, 'a') || 'Untitled';

        const poster = getFirstAttr(blockHtml, 'img', 'src') || getFirstAttr(blockHtml, 'img', 'data-src') || '';

        return new MultimediaItem({
            title: title,
            url: link,
            posterUrl: poster,
            type: 'nsfw',
            headers: HEADERS
        });
    }

    // Lấy tất cả item từ một widget HTML (getHome)
    function extractHomeItems(widgetHtml) {
        const itemBlocks = parse_html(widgetHtml, 'div.col-md-3.col-sm-6.col-xs-6.item.responsive-height.post');
        const items = [];
        for (const block of itemBlocks) {
            const item = blockToItem(block.attr);
            if (item) items.push(item);
        }
        return items;
    }

    // Lấy tất cả item từ trang search
    function extractSearchItems(html) {
        const itemBlocks = parse_html(html, 'div.item.responsive-height.col-md-4.col-sm-6.col-xs-6');
        return itemBlocks.map(block => blockToItem(block.attr)).filter(Boolean);
    }

    // Lấy danh sách iframe src (loại bỏ link không hợp lệ)
    function getIframeSrcs(html) {
        return getAllAttr(html, 'iframe', 'src').filter(link => !link.startsWith('https://a.realsrv.com'));
    }

    // --- Các hàm chính ---
    async function getHome(cb) {
        try {
            const htmlRes = await http_get(`${BASE_URL}/page/1`, HEADERS);
            if (htmlRes.status !== 200) throw new Error('HTTP ' + htmlRes.status);
            const html = htmlRes.body;

            const sectionHeaders = parse_html(html, 'div.section-header');
            const titles = sectionHeaders.map(el => el.text.trim()).filter(t => t);

            const widgetBlocks = parse_html(html, 'div#video-widget-3016');
            const homeData = {};

            for (let i = 0; i < widgetBlocks.length; i++) {
                const widgetHtml = widgetBlocks[i].attr; // innerHTML
                const sectionTitle = titles[i] || `Section ${i+1}`;
                const items = extractHomeItems(widgetHtml);
                if (items.length > 0) homeData[sectionTitle] = items;
            }

            if (Object.keys(homeData).length === 0) throw new Error('No sections found');
            cb({ success: true, data: homeData });
        } catch (e) {
            cb({ success: false, errorCode: 'HOME_ERROR', message: e.message });
        }
    }

    async function search(query, cb) {
        try {
            const htmlRes = await http_get(`${BASE_URL}/?s=${encodeURIComponent(query)}`, HEADERS);
            if (htmlRes.status !== 200) throw new Error('HTTP ' + htmlRes.status);
            const items = extractSearchItems(htmlRes.body);
            cb({ success: true, data: items });
        } catch (e) {
            cb({ success: false, errorCode: 'SEARCH_ERROR', message: e.message });
        }
    }

    async function load(url, cb) {
        try {
            const htmlRes = await http_get(url, HEADERS);
            if (htmlRes.status !== 200) throw new Error('HTTP ' + htmlRes.status);
            const html = htmlRes.body;

            // Poster
            const poster = getFirstAttr(html, 'div.video-details div.post-entry img', 'src') || 
                          getFirstAttr(html, 'img', 'src') || '';

            // Title
            const rawTitle = getFirstText(html, 'p.wp-caption-text') || getFirstText(html, 'h1') || 'No Title';
            const title = cleanTitle(rawTitle);

            // Description
            const descElem = parse_html(html, 'div.video-details div.post-entry p');
            let description = null;
            for (const p of descElem) {
                const t = p.text.trim();
                if (t && !t.toLowerCase().includes('caption')) {
                    description = t;
                    break;
                }
            }

            // Year
            let year = null;
            const dateText = getFirstText(html, 'span.date');
            if (dateText) {
                const nums = dateText.replace(/[^0-9]/g, '');
                if (nums.length >= 4) year = parseInt(nums.slice(-4));
            }

            // Tags
            const tags = [];
            const metaSpans = parse_html(html, 'span.meta');
            for (const metaSpan of metaSpans) {
                const metaHtml = metaSpan.attr;
                const caption = (getFirstText(metaHtml, 'span.meta-info') || '').toLowerCase();
                if (caption === 'category' || caption === 'tag') {
                    const aTexts = parse_html(metaHtml, 'a').map(a => a.text.trim()).filter(t => t);
                    tags.push(...aTexts);
                }
            }

            // Recommendations
            const recs = [];
            const recDivs = parse_html(html, 'div.latest-wrapper div.item.active > div');
            for (const recDiv of recDivs) {
                const recItem = blockToItem(recDiv.attr);
                if (recItem) recs.push(recItem);
            }

            // Kiểm tra scenes (ul.pagination.post-tape)
            const sceneLis = parse_html(html, 'ul.pagination.post-tape > li');
            if (sceneLis.length > 0) {
                const episodes = [];
                for (let i = 0; i < sceneLis.length; i++) {
                    const liHtml = sceneLis[i].attr;
                    const link = getFirstAttr(liHtml, 'a', 'href');
                    const numText = getFirstText(liHtml, 'a') || '';
                    const num = parseInt(numText) || (i + 1);
                    if (link) {
                        try {
                            const sceneHtmlRes = await http_get(link, HEADERS);
                            if (sceneHtmlRes.status === 200) {
                                const iframes = getIframeSrcs(sceneHtmlRes.body);
                                episodes.push(new Episode({
                                    name: `Scene ${num}`,
                                    url: JSON.stringify(iframes),
                                    episode: num,
                                    posterUrl: poster
                                }));
                            }
                        } catch (e) { /* bỏ qua scene lỗi */ }
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
            const iframes = getIframeSrcs(html);
            cb({
                success: true,
                data: new MultimediaItem({
                    title,
                    url: JSON.stringify(iframes), // truyền vào loadStreams
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
                // Rewrite domain theo logic .kt
                if (link.startsWith('https://javhdfree.icu')) {
                    const noProto = link.replace('https://', '');
                    const idx = noProto.indexOf('/') + 1;
                    link = 'https://embedsito.com/' + noProto.substring(idx);
                } else if (link.startsWith('https://viewsb.com')) {
                    link = link.replace('viewsb.com', 'watchsb.com');
                }

                if (typeof loadExtractor === 'function') {
                    const results = await loadExtractor(link);
                    if (Array.isArray(results)) {
                        results.forEach(s => {
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

    // Export
    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();