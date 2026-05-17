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

        return new MultimediaItem({
            title: title,
            url: url,
            posterUrl: posterUrl,
            type: 'nsfw',
            headers: HEADERS
        });
    }

    function parseListItems(doc, base) {
        const items = doc.querySelectorAll('div.grid.grid-cols-2 > div, div.thumbnail.group');
        return Array.from(items)
            .map(el => parseMainPageItem(el, base))
            .filter(Boolean);
    }

    // ========== GET HOME ==========
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

    async function getHome(cb) {
        try {
            const homeData = {};

            const results = await Promise.allSettled(
                CATEGORIES.map(async cat => {
                    const separator = cat.path.includes('?') ? '&' : '?';
                    const url = BASE_URL + cat.path + separator + 'page=1';
                    const doc = await fetchDoc(url);
                    const items = parseListItems(doc, BASE_URL);
                    return { name: cat.name, items: items.slice(0, 30) };
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

    // ========== GET MAIN PAGE (phân trang Newly Added) ==========
    async function getMainPage(page, request, cb) {
        try {
            const basePath = request.data;
            const url = BASE_URL + basePath + page;
            const doc = await fetchDoc(url);
            const items = parseListItems(doc, BASE_URL);
            cb({
                success: true,
                data: {
                    items: [{
                        name: "Newly Added",
                        list: items,
                        isHorizontalImages: true
                    }],
                    hasNext: items.length > 0   // luôn load tiếp nếu có ít nhất 1 item
                }
            });
        } catch (e) {
            cb({ success: false, errorCode: 'MAINPAGE_ERROR', message: e.message });
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

    // ========== LOAD (chi tiết) ==========
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

            // Description: meta description hoặc nội dung bài viết
            let description = '';
            const descMeta = doc.querySelector('meta[name="description"]');
            if (descMeta) {
                description = descMeta.getAttribute('content') || '';
            }
            if (!description) {
                const descDiv = doc.querySelector('div.entry-content, div.description, div.movie-desc');
                if (descDiv) description = descDiv.textContent.trim();
            }

            // Tạo Episode để hiển thị nút Play
            const episode = new Episode({
                name: title,
                url: url,                     // truyền thẳng URL phim cho loadStreams
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

    // ========== LOAD STREAMS ==========
    async function loadStreams(dataUrl, cb) {
        try {
            const html = await fetchRaw(dataUrl);
            let unpacked = html;
            // Thử dùng getAndUnpack (native), nếu có lỗi hoặc không hoạt động thì tự unpack thủ công
            if (typeof getAndUnpack === 'function') {
                try {
                    unpacked = getAndUnpack(html);
                } catch (e) {
                    // fallback: tìm trực tiếp trong html
                }
            }

            // Tìm playlist ID
            let playlistId = null;
            const match = unpacked.match(/\/([a-f0-9\-]{36})\//);
            if (match) {
                playlistId = match[1];
            } else {
                // Thử mẫu khác: surrit.com/.../playlist.m3u8
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