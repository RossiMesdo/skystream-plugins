(function() {
    const BASE_URL = typeof manifest !== 'undefined' && manifest.baseUrl ? manifest.baseUrl : "https://javhd.icu";
    const HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    };

    // ========== HELPERS ==========
    async function fetchDoc(url) {
        const res = await http_get(url, HEADERS);
        if (res.status !== 200) throw new Error('HTTP ' + res.status);
        return await parseHtml(res.body);
    }

    async function fetchHtml(url) {
        const res = await http_get(url, HEADERS);
        if (res.status !== 200) throw new Error('HTTP ' + res.status);
        return res.body;
    }

    function cleanTitle(str) {
        return String(str || '').replace(/^JAV HD\s*/i, '').trim();
    }

    // Tạo MultimediaItem từ element HTML (dùng cho getHome, search, category)
    function itemToMedia(el) {
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

    // Lấy tất cả items từ document
    function extractItems(doc) {
        // Selector gốc từ Kotlin
        let items = Array.from(doc.querySelectorAll('div.col-md-3.col-sm-6.col-xs-6.item.responsive-height.post'));
        if (items.length === 0) {
            items = Array.from(doc.querySelectorAll('div[class*="item"][class*="post"]'));
        }
        if (items.length === 0) {
            items = Array.from(doc.querySelectorAll('div.item'));
        }
        return items.map(el => itemToMedia(el)).filter(Boolean);
    }

    // Lấy video links từ iframe hoặc script
    function getVideoSrcs(doc, rawHtml) {
        const iframes = doc.querySelectorAll('iframe');
        const links = [];
        for (const iframe of iframes) {
            const src = iframe.getAttribute('src');
            if (src && !src.startsWith('https://a.realsrv.com')) links.push(src);
        }
        if (links.length > 0) return links;

        const text = rawHtml || '';
        const regex = /(?:file|source|src|video_url)\s*:\s*"(https?:\/\/[^"]+\.(?:m3u8|mp4|mkv|avi|flv|webm|m3u)[^"]*)"/gi;
        let match;
        while ((match = regex.exec(text)) !== null) links.push(match[1]);
        return links;
    }

    // ========== DANH MỤC THỂ LOẠI ==========
    // Lấy các category từ menu trên trang chủ (nếu có)
    async function getCategoriesFromMenu() {
        try {
            const doc = await fetchDoc(BASE_URL);
            // Tìm các thẻ a trong menu (vd: ul.navbar-nav a, div.menu a)
            const menuLinks = doc.querySelectorAll('ul.navbar-nav a, div.menu a, nav a');
            const categories = [];
            for (const a of menuLinks) {
                const href = a.getAttribute('href');
                const text = a.textContent.trim();
                if (href && text && !text.match(/home|login|signup|upload|dmca|contact/i) && href.startsWith('/')) {
                    categories.push({ name: text, path: href });
                }
            }
            // Nếu không có menu, dùng danh sách cứng phổ biến
            if (categories.length === 0) {
                const slugs = [
                    "Japanese", "Anal", "Big Tits", "Big Ass", "MILF", "Lesbian", "POV",
                    "Creampie", "Blowjob", "Hardcore", "Squirting", "Russian", "Asian Girl",
                    "Compilation", "3some", "Deepthroat", "Latina", "Babe", "Cumshot", "Gangbang",
                    "Cosplay", "Masturbation", "Cuckold", "Lingerie", "Indian", "Natural Tits",
                    "Redhead", "Solo", "Female Orgasm", "DP", "Schoolgirl", "BBC", "Homemade",
                    "Classic", "Blonde", "BDSM", "Skinny", "Cowgirl", "Taboo", "Public",
                    "Interracial", "Orgy", "Mature Woman", "Old Young"
                ];
                slugs.forEach(slug => {
                    categories.push({ name: slug, path: `/tag/${slug.toLowerCase().replace(/\s+/g, '-')}/` });
                });
            }
            return categories;
        } catch {
            return []; // fallback rỗng
        }
    }

    // ========== GET HOME (nhiều mục) ==========
    async function getHome(cb) {
        try {
            const homeData = {};
            const categories = await getCategoriesFromMenu();

            // Lấy tối đa 10 category đầu để không quá tải
            const selectedCategories = categories.slice(0, 10);
            const results = await Promise.allSettled(
                selectedCategories.map(async cat => {
                    const url = BASE_URL + cat.path;
                    const doc = await fetchDoc(url);
                    const items = extractItems(doc);
                    return { name: cat.name, items: items.slice(0, 48) };
                })
            );

            results.forEach(res => {
                if (res.status === 'fulfilled' && res.value.items.length) {
                    homeData[res.value.name] = res.value.items;
                }
            });

            // Thêm Main Page như một mục riêng (lấy từ /page/1)
            try {
                const mainDoc = await fetchDoc(BASE_URL + '/page/1');
                const mainItems = extractItems(mainDoc);
                if (mainItems.length) homeData["Main Page"] = mainItems;
            } catch (e) {}

            if (Object.keys(homeData).length === 0) throw new Error('No sections');
            cb({ success: true, data: homeData });
        } catch (e) {
            cb({ success: false, errorCode: 'HOME_ERROR', message: e.message });
        }
    }

    // ========== SEARCH ==========
    async function search(query, cb) {
        try {
            const doc = await fetchDoc(`${BASE_URL}/?s=${encodeURIComponent(query)}`);
            let items = Array.from(doc.querySelectorAll('div.item.responsive-height.col-md-4.col-sm-6.col-xs-6'));
            if (items.length === 0) items = Array.from(doc.querySelectorAll('div[class*="item"][class*="post"]'));
            const results = items.map(el => itemToMedia(el)).filter(Boolean);
            cb({ success: true, data: results });
        } catch (e) {
            cb({ success: false, errorCode: 'SEARCH_ERROR', message: e.message });
        }
    }

    // ========== LOAD (chi tiết video / series) ==========
    async function load(url, cb) {
        try {
            const rawHtml = await fetchHtml(url);
            const doc = await parseHtml(rawHtml);

            const posterImg = doc.querySelector('div.video-details div.post-entry img');
            const poster = posterImg?.getAttribute('src') || posterImg?.getAttribute('data-src') || '';

            const captionP = doc.querySelector('p.wp-caption-text');
            const title = cleanTitle(captionP?.textContent?.trim() || doc.querySelector('h1')?.textContent?.trim() || 'No Title');

            let description = null;
            const descPs = doc.querySelectorAll('div.video-details div.post-entry p');
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

            // Kiểm tra scenes
            const sceneLis = doc.querySelectorAll('ul.pagination.post-tape > li');
            if (sceneLis.length > 0) {
                const episodes = [];
                for (const li of sceneLis) {
                    const a = li.querySelector('a');
                    const link = a?.getAttribute('href');
                    const numText = a?.textContent.trim() || '';
                    const num = parseInt(numText) || (episodes.length + 1);
                    if (link) {
                        try {
                            const sceneHtml = await fetchHtml(link);
                            const sceneDoc = await parseHtml(sceneHtml);
                            const iframes = getVideoSrcs(sceneDoc, sceneHtml);
                            episodes.push(new Episode({
                                name: `Scene ${num}`,
                                url: JSON.stringify(iframes),
                                episode: num,
                                posterUrl: poster
                            }));
                        } catch (e) {}
                    }
                }
                if (episodes.length) {
                    return cb({ success: true, data: new MultimediaItem({
                        title, url, posterUrl: poster, type: 'series',
                        description, year, tags, recommendations: recs,
                        episodes, headers: HEADERS
                    })});
                }
            }

            // Movie
            const iframes = getVideoSrcs(doc, rawHtml);
            cb({ success: true, data: new MultimediaItem({
                title, url: JSON.stringify(iframes), posterUrl: poster, type: 'movie',
                description, year, tags, recommendations: recs, headers: HEADERS
            })});
        } catch (e) {
            cb({ success: false, errorCode: 'LOAD_ERROR', message: e.message });
        }
    }

    // ========== LOAD STREAMS ==========
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

    // Export
    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();