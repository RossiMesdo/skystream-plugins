(function () {
    const BASE_URL = manifest.baseUrl.replace(/\/$/, "");
    const HEADERS = { "User-Agent": "Mozilla/5.0", "Referer": BASE_URL + "/" };
    const CATEGORIES = [
        { name: "Home", path: "" },
        { name: "Most Recent", path: "most-recent/" },
        { name: "Most Viewed (Day)", path: "most-viewed/day/" },
        { name: "OnlyFans", path: "tag/onlyfans/" },
        { name: "Most Viewed (Week)", path: "most-viewed/week/" },
        { name: "Most Viewed (Month)", path: "most-viewed/month/" },
        { name: "Most Viewed (All Time)", path: "most-viewed/" },
        { name: "Random", path: "random/" }
    ];

    function fixUrl(url) {
        if (!url) return "";
        if (/^https?:\/\//i.test(url)) return url;
        if (url.startsWith("//")) return "https:" + url;
        return BASE_URL + (url.startsWith("/") ? "" : "/") + url;
    }

    function parseItems(doc) {
        return Array.from(doc.querySelectorAll("#wrapper > div.container > div:nth-child(4) > div div.well-sm")).map(card => {
            const link = card.querySelector("a");
            const title = link?.getAttribute("title")?.trim() || "";
            const url = fixUrl(link?.getAttribute("href") || "");
            const poster = fixUrl(card.querySelector("img")?.getAttribute("data-original") || "");
            if (!title || !url) return null;
            return new MultimediaItem({ title, url, posterUrl: poster, type: "movie" });
        }).filter(Boolean);
    }

    async function getHome(cb) {
        const home = {};
        try {
            await Promise.all(CATEGORIES.map(async category => {
                try {
                    const path = category.path ? `/${category.path}` : "/";
                    const res = await http_get(`${BASE_URL}${path}page1.html`, HEADERS);
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
            const res = await http_get(`${BASE_URL}/search/${encodeURIComponent(query)}/page1.html`, HEADERS);
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
            if (!title) return cb({ success: false, errorCode: "PARSE_ERROR", message: "Missing title" });
            cb({
                success: true,
                data: new MultimediaItem({
                    title, url, posterUrl: poster, type: "movie",
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
            const streams = Array.from(doc.querySelectorAll("source[src]"))
                .map(node => fixUrl(node.getAttribute("src") || ""))
                .filter(Boolean)
                .map(streamUrl => new StreamResult({
                    url: streamUrl,
                    source: "TrendyPorn",
                    headers: { "Referer": url, "User-Agent": HEADERS["User-Agent"] }
                }));
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
