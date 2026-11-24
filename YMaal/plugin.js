(function () {
    const BASE_URL = manifest.baseUrl.replace(/\/$/, "");
    const HEADERS = { "User-Agent": "Mozilla/5.0", "Referer": BASE_URL + "/" };
    const CATEGORIES = [
        { name: "Latest", path: "" },
        { name: "Ullu", path: "channel/ullu" },
        { name: "Altt", path: "channel/altt" },
        { name: "Feel", path: "channel/feel" },
        { name: "Kooku", path: "channel/kooku" },
        { name: "PrimePlay", path: "channel/primeplay" },
        { name: "HitPrime", path: "channel/hitprime" }
    ];

    function fixUrl(url) {
        if (!url) return "";
        if (/^https?:\/\//i.test(url)) return url;
        if (url.startsWith("//")) return "https:" + url;
        return BASE_URL + (url.startsWith("/") ? "" : "/") + url;
    }

    function parseItems(doc) {
        return Array.from(doc.querySelectorAll("a.video-card")).map(card => {
            const title = card.querySelector("h2.title")?.textContent?.trim() || "";
            const url = fixUrl(card.getAttribute("href") || "");
            const poster = fixUrl(card.querySelector("div.thumbnail-container img")?.getAttribute("src") || "");
            if (!title || !url) return null;
            return new MultimediaItem({ title, url, posterUrl: poster, type: "movie" });
        }).filter(Boolean);
    }

    async function getHome(cb) {
        const home = {};
        try {
            await Promise.all(CATEGORIES.map(async category => {
                try {
                    const path = category.path ? `/${category.path}/` : "/";
                    const res = await http_get(BASE_URL + path, HEADERS);
                    if (!res || res.status < 200 || res.status >= 400) return;
                    const items = parseItems(await parseHtml(res.body));
                    if (items.length) home[category.name] = items;
                } catch (_) {}
            }));
            cb({ success: true, data: home });
        } catch (e) {
            cb({ success: false, errorCode: "HOME_ERROR", message: String(e?.message || e) });
        }
    }

    async function search(query, cb) {
        try {
            const res = await http_get(`${BASE_URL}/page/1/?s=${encodeURIComponent(query)}`, HEADERS);
            if (!res || res.status < 200 || res.status >= 400) return cb({ success: true, data: [] });
            cb({ success: true, data: parseItems(await parseHtml(res.body)) });
        } catch (e) {
            cb({ success: false, errorCode: "SEARCH_ERROR", message: String(e?.message || e) });
        }
    }

    async function load(url, cb) {
        try {
            const res = await http_get(url, HEADERS);
            if (!res || res.status < 200 || res.status >= 400) return cb({ success: false, errorCode: "SITE_OFFLINE" });
            const doc = await parseHtml(res.body);
            const title = doc.querySelector("h1.video-title")?.textContent?.trim() || "YMaal";
            const description = doc.querySelector("div.description")?.textContent?.replace(/^\s*Description\s*/i, "").trim() || "";
            const poster = fixUrl(doc.querySelector("meta[property^='og:image']")?.getAttribute("content") || "");
            cb({
                success: true,
                data: new MultimediaItem({
                    title, url, posterUrl: poster, description, type: "movie",
                    episodes: [{ name: "Play", url, season: 1, episode: 1, posterUrl: poster || undefined }]
                })
            });
        } catch (e) {
            cb({ success: false, errorCode: "PARSE_ERROR", message: String(e?.message || e) });
        }
    }

    async function loadStreams(url, cb) {
        try {
            const res = await http_get(url, HEADERS);
            if (!res || !res.body) return cb({ success: true, data: [] });
            const doc = await parseHtml(res.body);
            const streams = Array.from(doc.querySelectorAll("video source")).map(node => {
                const streamUrl = fixUrl(node.getAttribute("src") || "");
                return streamUrl ? new StreamResult({
                    url: streamUrl,
                    source: "YMaal",
                    headers: { "Referer": url, "User-Agent": HEADERS["User-Agent"] }
                }) : null;
            }).filter(Boolean);
            cb({ success: true, data: streams });
        } catch (e) {
            cb({ success: false, errorCode: "STREAM_ERROR", message: String(e?.message || e) });
        }
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();
