(function () {
    const BASE_URL = manifest.baseUrl.replace(/\/$/, "");
    const HEADERS = { "User-Agent": "Mozilla/5.0", "Referer": BASE_URL + "/" };
    const CATEGORIES = [
        { name: "Home", path: "" },
        { name: "Brazzers", path: "/pmvideo/c/brazzers" },
        { name: "BangBros", path: "/pmvideo/c/bangbros" },
        { name: "NaughtyAmerica", path: "/pmvideo/c/naughtyamerica" },
        { name: "RealityKings", path: "/pmvideo/c/realitykings" }
    ];
    function fixUrl(url) {
        if (!url) return "";
        if (/^https?:\/\//i.test(url)) return url;
        if (url.startsWith("//")) return "https:" + url;
        return BASE_URL + (url.startsWith("/") ? "" : "/") + url;
    }
    function parseItems(doc) {
        return Array.from(doc.querySelectorAll(".videos-list a")).map(link => {
            const title = (link.getAttribute("title") || "").trim();
            const url = fixUrl(link.getAttribute("href") || "");
            const poster = fixUrl(link.querySelector("img")?.getAttribute("src") || link.querySelector("video")?.getAttribute("poster") || "");
            if (!title || !url) return null;
            return new MultimediaItem({ title, url, posterUrl: poster, type: "movie" });
        }).filter(Boolean);
    }
    async function streamFromCleanTubePlayer(iframeUrl) {
        try {
            const encoded = new URL(iframeUrl).searchParams.get("q");
            if (!encoded || typeof atob !== "function") return "";
            const payload = new URLSearchParams(atob(encoded));
            const playerHtml = payload.get("tag") || "";
            const player = await parseHtml(playerHtml);
            const source = player.querySelector("video source[src], video[src]");
            return fixUrl(source?.getAttribute("src") || "");
        } catch (_) {
            return "";
        }
    }
    async function getHome(cb) {
        const home = {};
        try {
            await Promise.all(CATEGORIES.map(async category => {
                try {
                    const categoryUrl = category.path ? `${BASE_URL}${category.path}/` : `${BASE_URL}/`;
                    const res = await http_get(categoryUrl, HEADERS);
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
            for (let page = 1; page <= 5; page++) {
                const res = await http_get(`${BASE_URL}/page/${page}/?s=${encodeURIComponent(query)}`, HEADERS);
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
            const pageRes = await http_get(url, HEADERS);
            if (!pageRes || !pageRes.body) return cb({ success: true, data: [] });
            const page = await parseHtml(pageRes.body);
            const iframeUrl = fixUrl(page.querySelector(".responsive-player iframe")?.getAttribute("src") || "");
            if (!iframeUrl) return cb({ success: true, data: [] });
            const cleanTubeUrl = await streamFromCleanTubePlayer(iframeUrl);
            if (cleanTubeUrl) return cb({ success: true, data: [new StreamResult({
                url: cleanTubeUrl,
                source: "Pornmz",
                headers: { "Referer": iframeUrl, "User-Agent": HEADERS["User-Agent"] }
            })] });
            if (typeof loadExtractor === "function") {
                try {
                    const extracted = await loadExtractor(iframeUrl);
                    if (Array.isArray(extracted) && extracted.length) return cb({ success: true, data: extracted });
                } catch (_) {}
            }
            const embedRes = await http_get(iframeUrl, { ...HEADERS, "Referer": url });
            if (!embedRes || !embedRes.body) return cb({ success: true, data: [] });
            const embed = await parseHtml(embedRes.body);
            const streamUrl = fixUrl(embed.querySelector("video source")?.getAttribute("src") || "");
            if (!streamUrl) return cb({ success: true, data: [] });
            cb({ success: true, data: [new StreamResult({
                url: streamUrl,
                source: "Pornmz",
                headers: { "Referer": iframeUrl, "User-Agent": HEADERS["User-Agent"] }
            })] });
        } catch (e) {
            cb({ success: false, errorCode: "STREAM_ERROR", message: String(e?.message || e) });
        }
    }
    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();
