(function () {
    const BASE_URL = manifest.baseUrl.replace(/\/$/, "");
    const HEADERS = { "User-Agent": "Mozilla/5.0", "Referer": BASE_URL + "/" };
    const CATEGORIES = [
        { name: "Home", path: "" },
        { name: "Ullu", path: "category/ullu" },
        { name: "Atrangii", path: "category/atrangii" },
        { name: "Feel", path: "category/feel" },
        { name: "Uncut", path: "category/uncut" },
        { name: "MoodX", path: "category/moodx" },
        { name: "Hulchul", path: "category/hulchul" },
        { name: "Hitprime", path: "category/hitprime" },
        { name: "Besharams", path: "category/besharams" }
    ];

    function fixUrl(url) {
        if (!url) return "";
        if (/^https?:\/\//i.test(url)) return url;
        if (url.startsWith("//")) return "https:" + url;
        return BASE_URL + (url.startsWith("/") ? "" : "/") + url;
    }

    function parseItems(doc) {
        return Array.from(doc.querySelectorAll("a.video[href], div.videos a[href]")).map(link => {
            const title = (link.getAttribute("title") || "").trim();
            const url = fixUrl(link.getAttribute("href") || "");
            const style = link.getAttribute("style") || "";
            const match = style.match(/background-image\s*:\s*url\(['"]?([^'")]+)['"]?\)/i);
            const poster = fixUrl(link.getAttribute("data-bg") || match?.[1] || link.querySelector("img")?.getAttribute("data-src") || link.querySelector("img")?.getAttribute("src") || "");
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
                    const res = await http_get(`${BASE_URL}${path}`, HEADERS);
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
            const res = await http_get(`${BASE_URL}/?s=${encodeURIComponent(query)}`, HEADERS);
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
            const title = doc.querySelector("meta[property='og:title']")?.getAttribute("content")?.trim() || "";
            const poster = fixUrl(doc.querySelector("meta[property='og:image']")?.getAttribute("content") || "");
            const description = doc.querySelector("meta[property='og:description']")?.getAttribute("content")?.trim() || "";
            if (!title) return cb({ success: false, errorCode: "PARSE_ERROR", message: "Missing title" });
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
            const videoUrl = fixUrl(doc.querySelector("#my-video source")?.getAttribute("src") || "");
            if (!videoUrl) return cb({ success: true, data: [] });
            cb({
                success: true,
                data: [new StreamResult({
                    url: videoUrl,
                    source: "Xmaza",
                    headers: { "Referer": url, "User-Agent": HEADERS["User-Agent"] }
                })]
            });
        } catch (e) {
            cb({ success: false, errorCode: "STREAM_ERROR", message: String(e?.message || e) });
        }
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();
