(function () {
    const BASE_URL = manifest.baseUrl;
    const HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/132.0 Safari/537.36",
        "Referer": `${BASE_URL}/`
    };
    const CATEGORIES = [
        { name: "Latest", url: `${BASE_URL}/` },
        { name: "Vietnam", url: `${BASE_URL}/categories/viet-nam` },
        { name: "Vietsub", url: `${BASE_URL}/categories/vietsub` },
        { name: "Chinese", url: `${BASE_URL}/categories/trung-quoc` },
        { name: "Western", url: `${BASE_URL}/categories/au-my` },
        { name: "Uncensored", url: `${BASE_URL}/categories/khong-che` },
        { name: "JAV", url: `${BASE_URL}/categories/jav-hd` },
        { name: "Amateur", url: `${BASE_URL}/categories/nghiep-du` }
    ];

    function fixUrl(url) {
        if (!url) return "";
        if (url.startsWith("//")) return `https:${url}`;
        if (url.startsWith("/")) return BASE_URL + url;
        return url;
    }

    function parseItems(doc) {
        const items = [];
        const seen = new Set();
        doc.querySelectorAll(".video-box").forEach(box => {
            const link = box.querySelector("a.video-box__thumbnail__link");
            const url = fixUrl(link?.getAttribute("href"));
            const title = link?.getAttribute("title")?.trim() || box.querySelector("h3")?.textContent?.trim() || "";
            if (!url || !title || seen.has(url)) return;
            seen.add(url);
            const img = box.querySelector("img");
            items.push(new MultimediaItem({
                title, url,
                posterUrl: fixUrl(img?.getAttribute("data-src") || img?.getAttribute("src")),
                type: "movie", isAdult: true, contentRating: "18+"
            }));
        });
        return items;
    }

    async function getHome(cb) {
        try {
            const home = {};
            await Promise.all(CATEGORIES.map(async category => {
                try {
                    const res = await http_get(category.url, HEADERS);
                    if (!res?.body) return;
                    const items = parseItems(await parseHtml(res.body));
                    if (items.length) home[category.name] = items;
                } catch (_) {}
            }));
            cb({ success: true, data: home });
        } catch (e) {
            cb({ success: false, errorCode: "HOME_ERROR", message: e.message });
        }
    }

    async function search(query, cb) {
        try {
            const res = await http_get(`${BASE_URL}/search?q=${encodeURIComponent(query)}`, HEADERS);
            if (!res?.body) return cb({ success: true, data: [] });
            cb({ success: true, data: parseItems(await parseHtml(res.body)) });
        } catch (e) {
            cb({ success: false, errorCode: "SEARCH_ERROR", message: e.message });
        }
    }

    async function load(url, cb) {
        try {
            const res = await http_get(url, HEADERS);
            if (!res?.body) return cb({ success: false, errorCode: "SITE_OFFLINE" });
            const doc = await parseHtml(res.body);
            const title = doc.querySelector("h1")?.textContent?.trim();
            if (!title) return cb({ success: false, errorCode: "PARSE_ERROR", message: "No video title" });
            const poster = doc.querySelector("meta[property='og:image']")?.getAttribute("content") || "";
            const description = doc.querySelector("meta[name='description']")?.getAttribute("content") || "";
            cb({ success: true, data: new MultimediaItem({
                title, url, posterUrl: fixUrl(poster), description, type: "movie", isAdult: true, contentRating: "18+",
                episodes: [new Episode({ name: title, url, season: 1, episode: 1, posterUrl: fixUrl(poster) || undefined })]
            }) });
        } catch (e) {
            cb({ success: false, errorCode: "LOAD_ERROR", message: e.message });
        }
    }

    async function loadStreams(url, cb) {
        try {
            const res = await http_get(url, HEADERS);
            if (!res?.body) return cb({ success: true, data: [] });
            const sources = [];
            const regex = /class=["'][^"']*set-player-source[^"']*["'][^>]*data-source=["']([^"']+)["']/gi;
            let match;
            while ((match = regex.exec(res.body)) !== null) {
                const sourceUrl = match[1].replace(/&amp;/g, "&");
                if (!sources.includes(sourceUrl)) sources.push(sourceUrl);
            }
            const streams = [];
            for (const sourceUrl of sources) {
                if (typeof loadExtractor === "function") {
                    const extracted = await loadExtractor(sourceUrl);
                    if (Array.isArray(extracted) && extracted.length) {
                        extracted.forEach(stream => { stream.source = "HeoVL"; streams.push(stream); });
                        continue;
                    }
                }
                streams.push(new StreamResult({ url: sourceUrl, source: "HeoVL Embed", headers: { ...HEADERS, Referer: url } }));
            }
            cb({ success: true, data: streams });
        } catch (e) {
            cb({ success: false, errorCode: "STREAM_ERROR", message: e.message });
        }
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();
