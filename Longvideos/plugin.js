(function () {
    const BASE_URL = manifest.baseUrl.replace(/\/$/, "");
    const HEADERS = { "User-Agent": "Mozilla/5.0", "Referer": BASE_URL + "/" };
    const CATEGORIES = [
        { name: "Latest", path: "latest-updates" },
        { name: "Brazzers", path: "networks/brazzers-com/latest-updates" },
        { name: "Tushy", path: "networks/tushy-com/latest-updates" },
        { name: "Blacked", path: "networks/blacked/latest-updates" },
        { name: "Dorcel", path: "sites/dorcel-club/latest-updates" }
    ];
    function fixUrl(url) {
        if (!url) return "";
        if (/^https?:\/\//i.test(url)) return url;
        if (url.startsWith("//")) return "https:" + url;
        return BASE_URL + (url.startsWith("/") ? "" : "/") + url;
    }
    function parseItems(doc) {
        return Array.from(doc.querySelectorAll("div.list-videos div.item")).map(card => {
            const link = card.querySelector("a");
            const title = link?.getAttribute("title")?.trim() || "";
            const url = fixUrl(link?.getAttribute("href") || "");
            const img = card.querySelector("img");
            let rawPoster = img?.getAttribute("src") || "";
            if (rawPoster.startsWith("data:image")) rawPoster = img?.getAttribute("data-src") || "";
            const poster = fixUrl(rawPoster);
            if (!title || !url) return null;
            return new MultimediaItem({ title, url, posterUrl: poster, type: "movie" });
        }).filter(Boolean);
    }
    async function getHome(cb) {
        const home = {};
        try {
            await Promise.all(CATEGORIES.map(async category => {
                try {
                    const res = await http_get(`${BASE_URL}/${category.path}/1/`, HEADERS);
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
            const results = [];
            for (let page = 1; page <= 7; page++) {
                const res = await http_get(`${BASE_URL}/search/${page}/?q=${encodeURIComponent(query)}`, HEADERS);
                if (!res || res.status < 200 || res.status >= 400) break;
                const items = parseItems(await parseHtml(res.body));
                if (!items.length) break;
                results.push(...items);
            }
            cb({ success: true, data: results });
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
            cb({ success: true, data: new MultimediaItem({
                title, url, posterUrl: poster, description, type: "movie",
                episodes: [{ name: "Play", url, season: 1, episode: 1, posterUrl: poster || undefined }]
            }) });
        } catch (e) {
            cb({ success: false, errorCode: "PARSE_ERROR", message: String(e?.message || e) });
        }
    }
    async function loadStreams(url, cb) {
        try {
            const res = await http_get(url, HEADERS);
            if (!res || !res.body) return cb({ success: true, data: [] });
            const doc = await parseHtml(res.body);
            const streams = Array.from(doc.querySelectorAll("video.video-js > source")).map(node => {
                const streamUrl = fixUrl(node.getAttribute("src") || "");
                if (!streamUrl) return null;
                const label = node.getAttribute("label") || "";
                const quality = Number.parseInt(label.replace(/\D/g, ""), 10);
                return new StreamResult({
                    url: streamUrl,
                    source: "Longvideos",
                    quality: Number.isFinite(quality) ? quality : undefined,
                    headers: { "Referer": url, "User-Agent": HEADERS["User-Agent"] }
                });
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
