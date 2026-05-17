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

    async function fetchRaw(url) {
        const res = await http_get(url, HEADERS);
        if (res.status !== 200) throw new Error('HTTP ' + res.status);
        return res.body;
    }

    function cleanTitle(str) {
        return String(str || '').replace(/^JAV HD\s*/i, '').trim();
    }

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

    function extractItems(doc) {
        let items = Array.from(doc.querySelectorAll('div.col-md-3.col-sm-6.col-xs-6.item.responsive-height.post'));
        if (items.length === 0) {
            items = Array.from(doc.querySelectorAll('div[class*="item"][class*="post"]'));
        }
        if (items.length === 0) {
            items = Array.from(doc.querySelectorAll('div.item'));
        }
        return items.map(el => itemToMedia(el)).filter(Boolean);
    }

    function getVideoUrls(doc, rawHtml) {
        const links = new Set();

        // 1. All iframes
        doc.querySelectorAll('iframe').forEach(iframe => {
            const src = iframe.getAttribute('src');
            if (src && !src.startsWith('https://a.realsrv.com')) links.add(src);
        });

        // 2. Video / source tags
        doc.querySelectorAll('video source, video').forEach(el => {
            const src = el.getAttribute('src');
            if (src) links.add(src);
        });

        // 3. Script patterns
        const text = rawHtml || '';
        const patterns = [
            /(?:file|source|src|video_url|url)\s*:\s*"(https?:\/\/[^"]+\.(?:m3u8|mp4|mkv|avi|flv|webm|m3u)[^"]*)"/gi,
            /(?:file|source|src|video_url|url)\s*=\s*"(https?:\/\/[^"]+\.(?:m3u8|mp4|mkv|avi|flv|webm|m3u)[^"]*)"/gi,
            /"(https?:\/\/[^"]*\.(?:m3u8|mp4|mkv)[^"]*)"/gi,
            /source\s+src\s*=\s*"(https?:\/\/[^"]+)"/gi
        ];
        patterns.forEach(regex => {
            let match;
            while ((match = regex.exec(text)) !== null) links.add(match[1]);
        });

        // 4. Download links
        doc.querySelectorAll('a[href*="download"], a[href*="dl"], a.btn-primary').forEach(a => {
            const href = a.getAttribute('href');
            if (href && href.startsWith('http')) links.add(href);
        });

        return Array.from(links).filter(l => l && l.startsWith('http'));
    }

    async function getMenuCategories() {
        try {
            const doc = await fetchDoc(BASE_URL);
            const menuLinks = doc.querySelectorAll(
                'ul.navbar-nav a, div.menu a, nav a, .menu-item a, li a[href*="/category/"], a[href*="/tag/"]'
            );
            const cats = [];
            for (const a of menuLinks) {
                const href = a.getAttribute('href');
                const text = a.textContent.trim();
                if (href && text && !text.match(/home|login|signup|upload|dmca|contact|about/i) && href.startsWith('/')) {
                    cats.push({ name: text, path: href });
                }
            }
            if (cats.length > 0) return cats.slice(0, 10);
        } catch (e) {}

        return [
            { name: "Japanese", path: "/category/japanese/" },
            { name: "Big Tits", path: "/category/big-tits/" },
            { name: "Anal", path: "/category/anal/" },
            { name: "MILF", path: "/category/milf/" },
            { name: "Lesbian", path: "/category/lesbian/" },
            { name: "Creampie", path: "/category/creampie/" },
            { name: "Blowjob", path: "/category/blowjob/" },
            { name: "Hardcore", path: "/category/hardcore/" },
            { name: "Squirting", path: "/category/squirting/" },
            { name: "Russian", path: "/category/russian/" }
        ];
    }

    // ========== GET HOME ==========
    async function getHome(cb) {
        try {
            const homeData = {};
            const categories = await getMenuCategories();

            const results = await Promise.allSettled(
                categories.map(async cat => {
                    const url = BASE_URL + cat.path;
                    const doc = await fetchDoc(url);
                    const items = extractItems(doc);
                    return { name: cat.name, items: items.slice(0, 60) };
                })
            );

            results.forEach(res => {
                if (res.status === 'fulfilled' && res.value.items.length) {
                    homeData[res.value.name] = res.value.items;
                }
            });

            const mainDoc = await fetchDoc(BASE_URL + '/page/1');
            const mainItems = extractItems(mainDoc);
            if (mainItems.length) homeData["Main Page"] = mainItems;

            if (Object.keys(homeData).length === 0) throw new Error('No sections');
            cb({ success: true, data: homeData });
        } catch (e) {
            cb({ success: false, errorCode: 'HOME_ERROR', message: e.message });
        }
    }

    // ========== MAIN PAGE (phân trang) ==========
    async function getMainPage(page, request, cb) {
        try {
            const basePath = request.data || "/page/";
            const url = page <= 1 ? BASE_URL : `${BASE_URL}${basePath}${page}`;
            const doc = await fetchDoc(url);
            const items = extractItems(doc);
            cb({
                success: true,
                data: {
                    items: [{
                        name: "Main Page",
                        list: items,
                        isHorizontalImages: true
                    }],
                    hasNext: items.length >= 24
                }
            });
        } catch (e) {
            cb({ success: false, errorCode: 'MAINPAGE_ERROR', message: e.message });
        }
    }

    // ========== SEARCH ==========
    async function search(query, cb) {
        const endpoints = [
            `/?s=${encodeURIComponent(query)}`,
            `/search/${encodeURIComponent(query)}`,
            `/page/1/?s=${encodeURIComponent(query)}`
        ];
        let items = [];
        for (const ep of endpoints) {
            try {
                const doc = await fetchDoc(BASE_URL + ep);
                items = extractItems(doc);
                if (items.length > 0) break;
            } catch (e) {}
        }
        cb({ success: true, data: items });
    }

    // ========== LOAD ==========
    async function load(url, cb) {
        try {
            const rawHtml = await fetchRaw(url);
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

            // Kiểm tra scene pagination → series
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
                            const sceneHtml = await fetchRaw(link);
                            const sceneDoc = await parseHtml(sceneHtml);
                            const videoUrls = getVideoUrls(sceneDoc, sceneHtml);
                            episodes.push(new Episode({
                                name: `Scene ${num}`,
                                url: JSON.stringify(videoUrls),
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

            // Movie: tạo một Episode duy nhất để hiển thị nút Play
            let videoUrls = getVideoUrls(doc, rawHtml);
            if (videoUrls.length === 0) {
                // Fallback: quét tất cả link có dạng embed
                doc.querySelectorAll('a[href*="embed"], a[href*="player"]').forEach(a => {
                    const href = a.getAttribute('href');
                    if (href && !videoUrls.includes(href)) videoUrls.push(href);
                });
            }
            const episode = new Episode({
                name: "Full Video",
                url: JSON.stringify(videoUrls),
                posterUrl: poster,
                description: description
            });

            cb({ success: true, data: new MultimediaItem({
                title,
                url,
                posterUrl: poster,
                type: 'movie',
                description,
                year,
                tags,
                recommendations: recs,
                episodes: [episode],   // ← đảm bảo nút Play không bị xám
                headers: HEADERS
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
                        url: link,
                        source: 'JavHD',
                        quality: 1080,
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
    globalThis.getMainPage = getMainPage;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();