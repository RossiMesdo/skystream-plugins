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

    // Tạo MultimediaItem từ element HTML
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
        // Selector chính từ Kotlin
        let items = Array.from(doc.querySelectorAll('div.col-md-3.col-sm-6.col-xs-6.item.responsive-height.post'));
        if (items.length === 0) {
            items = Array.from(doc.querySelectorAll('div[class*="item"][class*="post"]'));
        }
        if (items.length === 0) {
            items = Array.from(doc.querySelectorAll('div.item'));
        }
        return items.map(el => itemToMedia(el)).filter(Boolean);
    }

    // Lấy danh sách video URLs từ trang (ưu tiên iframe, script, download)
    function getVideoUrls(doc, rawHtml) {
        const links = [];

        // 1. Iframe src
        doc.querySelectorAll('iframe').forEach(iframe => {
            const src = iframe.getAttribute('src');
            if (src && !src.startsWith('https://a.realsrv.com')) links.push(src);
        });

        // 2. Tìm trong script: file:, source:, video_url, v.v.
        const patterns = [
            /(?:file|source|src|video_url)\s*:\s*"(https?:\/\/[^"]+\.(?:m3u8|mp4|mkv|avi|flv|webm|m3u)[^"]*)"/gi,
            /(?:file|source|src|video_url)\s*=\s*"(https?:\/\/[^"]+\.(?:m3u8|mp4|mkv|avi|flv|webm|m3u)[^"]*)"/gi,
            /"(https?:\/\/[^"]*\.(?:m3u8|mp4|mkv)[^"]*)"/gi,
            /source\s+src\s*=\s*"(https?:\/\/[^"]+)"/gi
        ];
        const text = rawHtml || '';
        patterns.forEach(regex => {
            let match;
            while ((match = regex.exec(text)) !== null) links.push(match[1]);
        });

        // 3. Download link nếu có
        const downloadLink = doc.querySelector('a.download, a[href*="download"], a[href*="dl"]');
        if (downloadLink) {
            const href = downloadLink.getAttribute('href');
            if (href && !links.includes(href)) links.push(href);
        }

        // Lọc và khử trùng
        return [...new Set(links.filter(l => l && l.startsWith('http')))];
    }

    // Lấy danh mục từ menu thực tế của trang
    async function getMenuCategories() {
        try {
            const doc = await fetchDoc(BASE_URL);
            const menuLinks = doc.querySelectorAll(
                'ul.navbar-nav a, div.menu a, nav a, .menu-item a, li.menu-item a, a[href*="/category/"], a[href*="/tag/"]'
            );
            const cats = [];
            for (const a of menuLinks) {
                const href = a.getAttribute('href');
                const text = a.textContent.trim();
                if (href && text && !text.match(/home|login|signup|upload|dmca|contact|about/i) && href.startsWith('/')) {
                    cats.push({ name: text, path: href });
                }
            }
            // Nếu có nhiều, trả về tối đa 8 mục để dashboard gọn
            return cats.slice(0, 8);
        } catch {
            // Fallback: một vài category phổ biến dựa trên cấu trúc thực tế
            return [
                { name: "Japanese", path: "/category/japanese/" },
                { name: "Big Tits", path: "/category/big-tits/" },
                { name: "Anal", path: "/category/anal/" },
                { name: "MILF", path: "/category/milf/" },
                { name: "Lesbian", path: "/category/lesbian/" },
                { name: "Creampie", path: "/category/creampie/" },
                { name: "Blowjob", path: "/category/blowjob/" },
                { name: "Hardcore", path: "/category/hardcore/" }
            ];
        }
    }

    // ========== GET HOME (dashboard) ==========
    async function getHome(cb) {
        try {
            const homeData = {};
            const categories = await getMenuCategories();

            // Lấy từng category song song
            const results = await Promise.allSettled(
                categories.map(async cat => {
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

            // Thêm Main Page (load từ /page/1)
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
            // request.data chứa path từ mainPage config, ví dụ "/page/"
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
        try {
            const doc = await fetchDoc(`${BASE_URL}/?s=${encodeURIComponent(query)}`);
            let items = Array.from(doc.querySelectorAll('div.item.responsive-height.col-md-4.col-sm-6.col-xs-6'));
            if (items.length === 0) {
                items = Array.from(doc.querySelectorAll('div[class*="item"][class*="post"]'));
            }
            const results = items.map(el => itemToMedia(el)).filter(Boolean);
            cb({ success: true, data: results });
        } catch (e) {
            cb({ success: false, errorCode: 'SEARCH_ERROR', message: e.message });
        }
    }

    // ========== LOAD (chi tiết) ==========
    async function load(url, cb) {
        try {
            const rawHtml = await fetchRaw(url);
            const doc = await parseHtml(rawHtml);

            // Poster
            const posterImg = doc.querySelector('div.video-details div.post-entry img');
            const poster = posterImg?.getAttribute('src') || posterImg?.getAttribute('data-src') || '';

            // Title
            const captionP = doc.querySelector('p.wp-caption-text');
            const title = cleanTitle(captionP?.textContent?.trim() || doc.querySelector('h1')?.textContent?.trim() || 'No Title');

            // Description
            let description = null;
            const descPs = doc.querySelectorAll('div.video-details div.post-entry p');
            for (const p of descPs) {
                const t = p.textContent.trim();
                if (t && !t.includes('wp-caption-text')) {
                    description = t;
                    break;
                }
            }

            // Year
            const dateSpan = doc.querySelector('span.date');
            let year = null;
            if (dateSpan) {
                const nums = dateSpan.textContent.trim().replace(/[^0-9]/g, '');
                if (nums.length >= 4) year = parseInt(nums.slice(-4));
            }

            // Tags
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

            // Recommendations
            const recs = Array.from(doc.querySelectorAll('div.latest-wrapper div.item.active > div'))
                .map(el => itemToMedia(el))
                .filter(Boolean);

            // Kiểm tra scene pagination
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

            // Movie (single video)
            const videoUrls = getVideoUrls(doc, rawHtml);
            // Nếu không tìm thấy gì, thử dùng chính url (có thể là embed)
            if (videoUrls.length === 0) {
                // fallback: lấy iframe đầu tiên hoặc bất kỳ link nào
                const firstIframe = doc.querySelector('iframe');
                if (firstIframe) {
                    const src = firstIframe.getAttribute('src');
                    if (src) videoUrls.push(src);
                }
            }
            cb({ success: true, data: new MultimediaItem({
                title,
                url: JSON.stringify(videoUrls),  // gửi cho loadStreams
                posterUrl: poster,
                type: 'movie',
                description,
                year,
                tags,
                recommendations: recs,
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
                // Rewrite domain nếu cần
                if (link.startsWith('https://javhdfree.icu')) {
                    const noProto = link.replace('https://', '');
                    const idx = noProto.indexOf('/') + 1;
                    link = 'https://embedsito.com/' + noProto.substring(idx);
                } else if (link.startsWith('https://viewsb.com')) {
                    link = link.replace('viewsb.com', 'watchsb.com');
                }

                // Nếu có loadExtractor (phiên bản mới), dùng nó
                if (typeof loadExtractor === 'function') {
                    const extracted = await loadExtractor(link);
                    if (Array.isArray(extracted)) {
                        extracted.forEach(s => {
                            s.source = 'JavHD';
                            streams.push(s);
                        });
                    }
                } else {
                    // Không có extractor, trả trực tiếp stream
                    streams.push(new StreamResult({
                        url: link,
                        source: 'JavHD',
                        quality: 1080,
                        headers: { ...HEADERS, Referer: link }
                    }));
                }
            }
            // Loại trùng lặp
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

    // ========== EXPORT ==========
    globalThis.getHome = getHome;
    globalThis.getMainPage = getMainPage;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();