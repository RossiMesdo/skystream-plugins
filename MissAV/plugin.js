(function() {
    const BASE_URL = typeof manifest !== 'undefined' && manifest.baseUrl ? manifest.baseUrl : "https://missav.live";
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

    function resolveUrl(href, base) {
        if (!href) return '';
        if (href.startsWith('http')) return href;
        if (href.startsWith('//')) return 'https:' + href;
        if (href.startsWith('/')) return base + href;
        return base + '/' + href;
    }

    function cleanText(el) {
        return el ? el.textContent.trim() : '';
    }

    // ========== ITEM PARSING (đã thêm chống trùng) ==========
    function parseMainPageItem(el, base) {
        const linkEl = el.querySelector('a[href*="/en/"], a[href*="/dm"]');
        if (!linkEl) return null;
        const rawHref = linkEl.getAttribute('href');
        const url = resolveUrl(rawHref, base);
        if (!url) return null;

        const titleEl = el.querySelector('div.my-2 a, div.title a, a.text-secondary');
        let baseTitle = titleEl ? cleanText(titleEl) : cleanText(linkEl);
        if (!baseTitle) return null;

        const blacklist = /^(Recent update|Contact|Support|DMCA|Home)$/i;
        if (blacklist.test(baseTitle)) return null;

        const combined = (linkEl.getAttribute('alt') || '') + (rawHref || '') + (el.outerHTML || '');
        const isUncensored = /uncensored[-_ ]?leak/i.test(combined);
        const title = (isUncensored && !baseTitle.startsWith('Uncensored - ', true))
            ? 'Uncensored - ' + baseTitle
            : baseTitle;

        const img = el.querySelector('img');
        const poster = img?.getAttribute('data-src') || img?.getAttribute('src') || '';
        const posterUrl = resolveUrl(poster, base);
        if (!posterUrl) return null;

        return { title, url, posterUrl }; // trả về object thô để dễ deduplicate
    }

    function parseListItems(doc, base) {
        const items = doc.querySelectorAll('div.grid.grid-cols-2 > div, div.thumbnail.group');
        const seenUrls = new Set();
        const result = [];
        for (const el of items) {
            const item = parseMainPageItem(el, base);
            if (item && !seenUrls.has(item.url)) {
                seenUrls.add(item.url);
                result.push(new MultimediaItem({
                    title: item.title,
                    url: item.url,
                    posterUrl: item.posterUrl,
                    type: 'nsfw',
                    headers: HEADERS
                }));
            }
        }
        return result;
    }

    // ========== GET HOME (bỏ trống để nhường mainPage) ==========
    async function getHome(cb) {
        // Tất cả danh mục đã do mainPage đảm nhiệm, trả về rỗng để tránh trùng lặp.
        cb({ success: true, data: {} });
    }

    // ========== GET MAIN PAGE (xử lý tất cả danh mục) ==========
    async function getMainPage(page, request, cb) {
        try {
            const basePath = request.data;  // vd: "/dm169/en/weekly-hot?sort=weekly_views&page="
            const url = BASE_URL + basePath + page;
            const doc = await fetchDoc(url);
            const items = parseListItems(doc, BASE_URL);
            cb({
                success: true,
                data: {
                    items: [{
                        name: request.name,
                        list: items,
                        isHorizontalImages: true
                    }],
                    hasNext: items.length > 0   // tiếp tục nếu còn ít nhất 1 phim
                }
            });
        } catch (e) {
            cb({ success: false, errorCode: 'MAINPAGE_ERROR', message: e.message });
        }
    }

    // ========== SEARCH (giữ nguyên) ==========
    async function search(query, cb) {
        try {
            const url = BASE_URL + '/en/search/' + encodeURIComponent(query);
            const doc = await fetchDoc(url);
            const items = parseListItems(doc, BASE_URL);
            cb({ success: true, data: items });
        } catch (e) {
            cb({ success: false, errorCode: 'SEARCH_ERROR', message: e.message });
        }
    }

    // ========== LOAD (mô tả đầy đủ, ép kiểu Episode) ==========
    async function load(url, cb) {
        try {
            const doc = await fetchDoc(url);
            const titleEl = doc.querySelector('h1.text-base');
            if (!titleEl) throw new Error('Title not found');
            const title = titleEl.textContent.trim();

            // Poster
            const posterMeta = doc.querySelector('meta[property="og:image"]');
            const posterUrl = posterMeta ? resolveUrl(posterMeta.getAttribute('content'), BASE_URL) : '';

            // Year
            const timeEl = doc.querySelector('time');
            let year = null;
            if (timeEl) {
                const parts = timeEl.textContent.split('-');
                year = parseInt(parts[0]);
                if (isNaN(year)) year = null;
            }

            // Tags
            const tags = [];
            doc.querySelectorAll('div.text-secondary:contains(genre) a').forEach(a => tags.push(a.textContent.trim()));

            // Actresses
            const actors = [];
            doc.querySelectorAll('div.text-secondary:contains(actress) a').forEach(a => {
                actors.push(new Actor({ name: a.textContent.trim() }));
            });

            // Description – lấy toàn bộ từ div chuyên dụng, tránh cắt cụt
            let description = '';
            const descDiv = doc.querySelector('div.movie-desc, div.description, div.entry-content');
            if (descDiv) {
                description = descDiv.textContent.trim();
            }
            if (!description) {
                const descMeta = doc.querySelector('meta[name="description"]');
                if (descMeta) description = descMeta.getAttribute('content') || '';
            }

            // Tạo Episode
            const episode = new Episode({
                name: title,
                url: url,
                posterUrl: posterUrl,
                description: description
            });

            cb({ success: true, data: new MultimediaItem({
                title: title,
                url: url,
                posterUrl: posterUrl,
                type: 'movie',
                year: year,
                tags: tags,
                cast: actors,
                description: description,
                episodes: [episode],
                headers: HEADERS
            })});
        } catch (e) {
            cb({ success: false, errorCode: 'LOAD_ERROR', message: e.message });
        }
    }

    // ========== LOAD STREAMS (tích hợp bộ unpacker dự phòng) ==========
    // Bộ giải mã P.A.C.K.E.R. đơn giản (fallback)
    function unpackJS(packed) {
        // Tìm pattern: eval(function(p,a,c,k,e,d){...})
        const match = packed.match(/\}\('([^']*)',(\d+),(\d+),'([^']*)'\.split\('\|'\)\)/);
        if (!match) return packed;
        const data = match[1];
        const radix = parseInt(match[2]);
        const count = parseInt(match[3]);
        const words = match[4].split('|');
        // Thay thế các từ khóa
        let unpacked = data.replace(/\b\w+\b/g, function(word) {
            const index = parseInt(word, radix);
            return words[index] || word;
        });
        return unpacked;
    }

    async function loadStreams(dataUrl, cb) {
        try {
            const html = await fetchRaw(dataUrl);
            let unpacked = html;

            // Dùng getAndUnpack nếu có
            if (typeof getAndUnpack === 'function') {
                try {
                    unpacked = getAndUnpack(html);
                } catch (e) {
                    // fallback sang unpack thủ công
                    unpacked = unpackJS(html);
                }
            } else {
                unpacked = unpackJS(html);
            }

            // Tìm playlist ID
            let playlistId = null;
            const match = unpacked.match(/\/([a-f0-9\-]{36})\//);
            if (match) {
                playlistId = match[1];
            } else {
                const match2 = html.match(/surrit\.com\/([a-f0-9\-]{36})\/playlist\.m3u8/);
                if (match2) playlistId = match2[1];
            }

            if (!playlistId) throw new Error('Playlist ID not found');

            const streamUrl = `https://surrit.com/${playlistId}/playlist.m3u8`;

            cb({ success: true, data: [
                new StreamResult({
                    url: streamUrl,
                    source: 'MissAV',
                    quality: 1080,
                    headers: { 'Referer': BASE_URL + '/' }
                })
            ]});
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