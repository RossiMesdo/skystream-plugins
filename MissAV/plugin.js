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

    // ========== ITEM PARSING ==========
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

        return { title, url, posterUrl };
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

    // ========== DANH MỤC ==========
    const CATEGORIES = [
        { name: "Weekly Hot", path: "/dm169/en/weekly-hot?sort=weekly_views" },
        { name: "Monthly Hot", path: "/dm263/en/monthly-hot?sort=views" },
        { name: "Newly Added", path: "/en/new?sort=published_at" },
        { name: "English Subtitles", path: "/en/english-subtitle" },
        { name: "Uncensored Leak", path: "/dm628/en/uncensored-leak" },
        { name: "FC2", path: "/dm150/en/fc2" },
        { name: "Madou", path: "/dm35/en/madou" },
        { name: "K-Live", path: "/en/klive" },
        { name: "C-Live", path: "/en/clive" },
        { name: "Tokyo Hot", path: "/dm29/en/tokyohot" },
        { name: "HEYZO", path: "/dm1198483/en/heyzo" },
        { name: "1pondo", path: "/dm2469695/en/1pondo" },
        { name: "Caribbeancom", path: "/dm3959622/en/caribbeancom" },
        { name: "Caribbeancom Premium", path: "/dm48032/en/caribbeancompr" },
        { name: "10musume", path: "/dm3710098/en/10musume" },
        { name: "Pacopacomama", path: "/dm1342558/en/pacopacomama" },
        { name: "Gachinco", path: "/dm136/en/gachinco" },
        { name: "XXX-AV", path: "/dm29/en/xxxav" },
        { name: "Married Slash", path: "/dm24/en/marriedslash" },
        { name: "Naughty 4610", path: "/dm20/en/naughty4610" },
        { name: "Naughty 0930", path: "/dm22/en/naughty0930" }
    ];

    // ========== LẤY NHIỀU TRANG ĐỂ CÓ 200 VIDEO ==========
    async function fetchCategoryVideos(cat) {
        const separator = cat.path.includes('?') ? '&' : '?';
        const pages = [1,2,3,4,5,6,7]; // 7 trang ~ 210 video
        const pagePromises = pages.map(page => {
            const url = BASE_URL + cat.path + separator + 'page=' + page;
            return fetchDoc(url).catch(() => null);
        });
        const docs = await Promise.all(pagePromises);
        const allItems = [];
        const seenUrls = new Set();
        for (const doc of docs) {
            if (!doc) continue;
            const items = parseListItems(doc, BASE_URL);
            for (const item of items) {
                if (!seenUrls.has(item.url)) {
                    seenUrls.add(item.url);
                    allItems.push(item);
                    if (allItems.length >= 200) break;
                }
            }
            if (allItems.length >= 200) break;
        }
        return allItems;
    }

    // ========== GET HOME ==========
    async function getHome(cb) {
        try {
            const homeData = {};
            const results = await Promise.allSettled(
                CATEGORIES.map(async cat => {
                    const items = await fetchCategoryVideos(cat);
                    return { name: cat.name, items };
                })
            );

            results.forEach(res => {
                if (res.status === 'fulfilled' && res.value.items.length) {
                    homeData[res.value.name] = res.value.items;
                }
            });

            if (Object.keys(homeData).length === 0) throw new Error('No categories loaded');
            cb({ success: true, data: homeData });
        } catch (e) {
            cb({ success: false, errorCode: 'HOME_ERROR', message: e.message });
        }
    }

    // ========== SEARCH ==========
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

    // ========== LOAD ==========
    async function load(url, cb) {
        try {
            const doc = await fetchDoc(url);
            const titleEl = doc.querySelector('h1.text-base');
            if (!titleEl) throw new Error('Title not found');
            const title = titleEl.textContent.trim();

            const posterMeta = doc.querySelector('meta[property="og:image"]');
            const posterUrl = posterMeta ? resolveUrl(posterMeta.getAttribute('content'), BASE_URL) : '';

            const timeEl = doc.querySelector('time');
            let year = null;
            if (timeEl) {
                const parts = timeEl.textContent.split('-');
                year = parseInt(parts[0]);
                if (isNaN(year)) year = null;
            }

            const tags = [];
            doc.querySelectorAll('div.text-secondary:contains(genre) a').forEach(a => tags.push(a.textContent.trim()));

            const actors = [];
            doc.querySelectorAll('div.text-secondary:contains(actress) a').forEach(a => {
                actors.push(new Actor({ name: a.textContent.trim() }));
            });

            let description = '';
            const descDiv = doc.querySelector('div.movie-desc, div.description, div.entry-content');
            if (descDiv) {
                description = descDiv.textContent.trim();
            }
            if (!description) {
                const descMeta = doc.querySelector('meta[name="description"]');
                if (descMeta) description = descMeta.getAttribute('content') || '';
            }

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

    // ========== LOAD STREAMS (cải tiến mạnh mẽ) ==========
    // Hàm unpacker dự phòng hỗ trợ nhiều định dạng P.A.C.K.E.R
    function unpackAnyJS(js) {
        // Mẫu 1: eval(function(p,a,c,k,e,d){...})
        let match = js.match(/\}\('([^']*)',(\d+),(\d+),'([^']*)'\.split\('\|'\)\)/);
        if (match) {
            const data = match[1];
            const radix = parseInt(match[2]);
            const words = match[4].split('|');
            return data.replace(/\b\w+\b/g, w => {
                const idx = parseInt(w, radix);
                return words[idx] || w;
            });
        }
        // Mẫu 2: dạng đơn giản khác
        match = js.match(/function\s*\(p,a,c,k,e,d\)\s*\{.*\}\('([^']*)',(\d+),(\d+),'([^']*)'\.split\('\|'\)\)/);
        if (match) {
            const data = match[1];
            const radix = parseInt(match[2]);
            const words = match[4].split('|');
            return data.replace(/\b\w+\b/g, w => {
                const idx = parseInt(w, radix);
                return words[idx] || w;
            });
        }
        // Không unpack được, trả về gốc
        return js;
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
                    unpacked = unpackAnyJS(html);
                }
            } else {
                unpacked = unpackAnyJS(html);
            }

            // Tìm UUID bằng regex mạnh: UUID chuẩn hoặc dạng hex 32-36 ký tự trong đường dẫn
            let playlistId = null;
            const patterns = [
                /\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\//i,   // UUID chuẩn
                /surrit\.com\/([a-f0-9\-]{36})\/playlist\.m3u8/i,
                /playlist\/([a-f0-9\-]{36})/i,
                /([a-f0-9]{32})/i,                                                      // 32 hex
                /\/([a-f0-9\-]{36})\//i                                                  // dạng cũ
            ];

            for (const regex of patterns) {
                const m1 = unpacked.match(regex);
                if (m1) { playlistId = m1[1]; break; }
                const m2 = html.match(regex);
                if (m2) { playlistId = m2[1]; break; }
            }

            // Thử tìm trực tiếp link m3u8 trong HTML
            if (!playlistId) {
                const m3u8Match = html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i);
                if (m3u8Match) {
                    return cb({ success: true, data: [
                        new StreamResult({
                            url: m3u8Match[1],
                            source: 'MissAV',
                            quality: 1080,
                            headers: { 'Referer': BASE_URL + '/' }
                        })
                    ]});
                }
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
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();