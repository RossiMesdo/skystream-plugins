(function () {
    const MAIN_URL = (typeof manifest !== "undefined" && manifest.baseUrl) || "https://missav.live";
    const HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Referer": MAIN_URL
    };

    const CATEGORIES = [
        { name: "Weekly Hot",            url: `${MAIN_URL}/dm169/en/weekly-hot?sort=weekly_views` },
        { name: "Monthly Hot",           url: `${MAIN_URL}/dm263/en/monthly-hot?sort=views` },
        { name: "Newly Added",           url: `${MAIN_URL}/en/new?sort=published_at` },
        { name: "English Subtitles",     url: `${MAIN_URL}/en/english-subtitle` },
        { name: "Uncensored Leak",       url: `${MAIN_URL}/dm628/en/uncensored-leak` },
        { name: "FC2",                   url: `${MAIN_URL}/dm150/en/fc2` },
        { name: "Madou",                 url: `${MAIN_URL}/dm35/en/madou` },
        { name: "K-Live",                url: `${MAIN_URL}/en/klive` },
        { name: "C-Live",                url: `${MAIN_URL}/en/clive` },
        { name: "Tokyo Hot",             url: `${MAIN_URL}/dm29/en/tokyohot` },
        { name: "HEYZO",                 url: `${MAIN_URL}/dm1198483/en/heyzo` },
        { name: "1pondo",                url: `${MAIN_URL}/dm2469695/en/1pondo` },
        { name: "Caribbeancom",          url: `${MAIN_URL}/dm3959622/en/caribbeancom` },
        { name: "Caribbeancom Premium",  url: `${MAIN_URL}/dm48032/en/caribbeancompr` },
        { name: "10musume",              url: `${MAIN_URL}/dm3710098/en/10musume` },
        { name: "Pacopacomama",          url: `${MAIN_URL}/dm1342558/en/pacopacomama` },
        { name: "Gachinco",              url: `${MAIN_URL}/dm136/en/gachinco` },
        { name: "XXX-AV",               url: `${MAIN_URL}/dm29/en/xxxav` },
        { name: "Married Slash",         url: `${MAIN_URL}/dm24/en/marriedslash` },
        { name: "Naughty 4610",          url: `${MAIN_URL}/dm20/en/naughty4610` },
        { name: "Naughty 0930",          url: `${MAIN_URL}/dm22/en/naughty0930` }
    ];

    const BLACKLIST = ["Recent update", "Contact", "Support", "DMCA", "Home"];

    function buildPageUrl(baseUrl, page) {
        if (page <= 1) return baseUrl;
        const sep = baseUrl.includes("?") ? "&" : "?";
        return `${baseUrl}${sep}page=${page}`;
    }

    function parseItems(doc) {
        const items = [];
        const seen = new Set();
        doc.querySelectorAll("div.grid.grid-cols-2 > div, div.thumbnail.group").forEach(el => {
            const link = el.querySelector("a[href*='/en/'], a[href*='/dm']");
            if (!link) return;
            let href = link.getAttribute("href") || "";
            if (!href) return;
            if (!href.startsWith("http")) href = MAIN_URL + href;

            const titleEl = el.querySelector("div.my-2 a, div.title a, a.text-secondary");
            let title = (titleEl?.textContent || link.textContent || "").trim();
            if (!title || BLACKLIST.some(b => title.toLowerCase() === b.toLowerCase())) return;

            // Mark uncensored
            const isUncensored = /uncensored[-_ ]?leak/i.test(link.getAttribute("alt") + link.getAttribute("href") + el.innerHTML);
            if (isUncensored && !title.toLowerCase().startsWith("uncensored - ")) {
                title = `Uncensored - ${title}`;
            }

            const img = el.querySelector("img");
            let poster = "";
            if (img) poster = img.getAttribute("data-src") || img.getAttribute("src") || "";
            if (!poster) return; // skip items without poster (nav/footer links)

            if (seen.has(href)) return;
            seen.add(href);

            items.push(new MultimediaItem({ title, url: href, posterUrl: poster, type: "movie" }));
        });
        return items;
    }

    async function fetchCategory(catUrl, pages) {
        const results = await Promise.all(
            Array.from({ length: pages }, (_, i) => i + 1).map(async p => {
                try {
                    const res = await http_get(buildPageUrl(catUrl, p), HEADERS);
                    if (!res || !res.body) return [];
                    const doc = await parseHtml(res.body);
                    return parseItems(doc);
                } catch (e) {
                    return [];
                }
            })
        );
        const seen = new Set();
        return results.flat().filter(i => { if (seen.has(i.url)) return false; seen.add(i.url); return true; });
    }

    async function getHome(cb) {
        try {
            const data = {};
            await Promise.all(CATEGORIES.map(async cat => {
                try {
                    const items = await fetchCategory(cat.url, 3);
                    if (items.length > 0) data[cat.name] = items;
                } catch (e) {
                    console.error(`MissAV getHome [${cat.name}]: ${e.message}`);
                }
            }));
            cb({ success: true, data });
        } catch (e) {
            cb({ success: false, errorCode: "HOME_ERROR", message: e.message });
        }
    }

    async function search(query, cb) {
        try {
            const pages = await Promise.all([1, 2, 3].map(async p => {
                const url = p === 1
                    ? `${MAIN_URL}/en/search/${encodeURIComponent(query)}`
                    : `${MAIN_URL}/en/search/${encodeURIComponent(query)}?page=${p}`;
                try {
                    const res = await http_get(url, HEADERS);
                    if (!res || !res.body) return [];
                    const doc = await parseHtml(res.body);
                    return parseItems(doc);
                } catch (e) { return []; }
            }));
            const seen = new Set();
            const items = pages.flat().filter(i => { if (seen.has(i.url)) return false; seen.add(i.url); return true; });
            cb({ success: true, data: items });
        } catch (e) {
            cb({ success: false, errorCode: "SEARCH_ERROR", message: e.message });
        }
    }

    async function load(url, cb) {
        try {
            const res = await http_get(url, HEADERS);
            if (!res || !res.body) return cb({ success: false, errorCode: "LOAD_ERROR", message: "Empty response" });
            const doc = await parseHtml(res.body);

            const title = doc.querySelector("h1.text-base")?.textContent?.trim();
            if (!title) return cb({ success: false, errorCode: "LOAD_ERROR", message: "No title" });

            let poster = doc.querySelector("meta[property='og:image']")?.getAttribute("content") || "";
            if (poster && !poster.startsWith("http")) poster = MAIN_URL + poster;

            const yearText = doc.querySelector("time")?.textContent?.trim() || "";
            const year = parseInt(yearText.split("-")[0]) || undefined;

            const tags = [];
            doc.querySelectorAll("div.text-secondary a").forEach(a => {
                const parent = a.closest("div.text-secondary");
                if (parent && parent.textContent.toLowerCase().includes("genre")) {
                    const t = a.textContent.trim();
                    if (t) tags.push(t);
                }
            });

            const cast = [];
            doc.querySelectorAll("div.text-secondary a").forEach(a => {
                const parent = a.closest("div.text-secondary");
                if (parent && parent.textContent.toLowerCase().includes("actress")) {
                    const n = a.textContent.trim();
                    if (n) cast.push(new Actor({ name: n }));
                }
            });

            cb({
                success: true,
                data: new MultimediaItem({
                    title,
                    url,
                    posterUrl: poster,
                    type: "movie",
                    year,
                    tags,
                    cast,
                    episodes: [
                        new Episode({
                            name: "Play",
                            url,
                            season: 1,
                            episode: 1,
                            posterUrl: poster
                        })
                    ]
                })
            });
        } catch (e) {
            cb({ success: false, errorCode: "LOAD_ERROR", message: e.message });
        }
    }

    async function loadStreams(url, cb) {
        try {
            const res = await http_get(url, HEADERS);
            const body = res?.body || "";

            // Use getAndUnpack (P.A.C.K.E.R. unpacker) — available as global in SkyStream
            let unpacked = "";
            if (typeof getAndUnpack === "function") {
                try { unpacked = getAndUnpack(body) || ""; } catch (e) {}
            }

            // Extract playlist UUID from unpacked script
            const uuidMatch = /\/([a-f0-9\-]{36})\//.exec(unpacked);
            if (uuidMatch) {
                const playlistId = uuidMatch[1];
                return cb({
                    success: true,
                    data: [
                        new StreamResult({
                            url: `https://surrit.com/${playlistId}/playlist.m3u8`,
                            source: "MissAV",
                            headers: { "Referer": `${MAIN_URL}/` }
                        })
                    ]
                });
            }

            // Fallback: try raw body
            const uuidMatch2 = /\/([a-f0-9\-]{36})\//.exec(body);
            if (uuidMatch2) {
                return cb({
                    success: true,
                    data: [
                        new StreamResult({
                            url: `https://surrit.com/${uuidMatch2[1]}/playlist.m3u8`,
                            source: "MissAV",
                            headers: { "Referer": `${MAIN_URL}/` }
                        })
                    ]
                });
            }

            cb({ success: true, data: [] });
        } catch (e) {
            cb({ success: false, errorCode: "STREAM_ERROR", message: e.message });
        }
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();
