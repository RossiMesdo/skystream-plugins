(function() {
    /**
     * AdultTvChannels Plugin for SkyStream
     * Site: https://adult-tv-channels.com
     * Type: Live Adult TV Channels (M3U8)
     * Ported from: Cs-GizliKeyif CloudStream repo
     * Author: Lord
     */

    const BASE_URL = manifest.baseUrl;
    const HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:137.0) Gecko/20100101 Firefox/137.0"
    };

    // CloudStream dùng 7 page tĩnh
    const PAGES = [1, 2, 3, 4, 5, 6, 7];

    function fixUrl(u) {
        if (!u) return "";
        if (u.startsWith("//")) return "https:" + u;
        if (u.startsWith("/")) return BASE_URL + u;
        return u;
    }

    function parseChannels(doc) {
        return Array.from(doc.querySelectorAll("div.col-lg-4")).map(el => {
            const a = el.querySelector("h2.entry-title a");
            if (!a) return null;
            const title = a.textContent.trim();
            const url = fixUrl(a.getAttribute("href"));
            const img = el.querySelector("img");
            const posterUrl = img ? fixUrl(img.getAttribute("src")) : "";
            if (!title || !url) return null;
            return new MultimediaItem({ title, url, posterUrl, type: "movie" });
        }).filter(Boolean);
    }

    async function getHome(cb) {
        try {
            const home = {};
            await Promise.all(PAGES.map(async (p) => {
                try {
                    const res = await http_get(`${BASE_URL}/page/${p}/`, HEADERS);
                    if (!res || res.status !== 200) return;
                    const doc = await parseHtml(res.body);
                    const items = parseChannels(doc);
                    if (items.length > 0) home[`Page ${p}`] = items;
                } catch (e) {}
            }));
            cb({ success: true, data: home });
        } catch (e) {
            cb({ success: false, errorCode: "SITE_OFFLINE", message: e.message });
        }
    }

    async function search(query, cb) {
        try {
            // CloudStream: search từng page với ?s=query rồi gộp lại
            const results = await Promise.all(PAGES.map(async (p) => {
                try {
                    const res = await http_get(`${BASE_URL}/page/${p}/?s=${encodeURIComponent(query)}`, HEADERS);
                    if (!res || res.status !== 200) return [];
                    const doc = await parseHtml(res.body);
                    return parseChannels(doc);
                } catch (e) { return []; }
            }));

            const seen = new Set();
            const items = results.flat().filter(i => {
                if (seen.has(i.url)) return false;
                seen.add(i.url);
                return true;
            }).sort((a, b) => a.title.localeCompare(b.title));

            cb({ success: true, data: items });
        } catch (e) {
            cb({ success: false, errorCode: "SEARCH_ERROR", message: e.message });
        }
    }

    async function load(url, cb) {
        try {
            const res = await http_get(url, HEADERS);
            if (!res || res.status !== 200) return cb({ success: false, errorCode: "SITE_OFFLINE" });
            const doc = await parseHtml(res.body);

            const title = (doc.querySelector("h1")?.textContent || "").trim() || "Live Channel";
            const posterEl = doc.querySelector("figure.entry-thumb img");
            const posterUrl = posterEl ? fixUrl(posterEl.getAttribute("src")) : "";

            // Lấy iframe src — đây là player URL chứa M3U8
            const iframeSrc = fixUrl(doc.querySelector("iframe")?.getAttribute("src") || "");

            cb({
                success: true,
                data: new MultimediaItem({
                    title,
                    url,
                    posterUrl,
                    type: "movie",
                    description: `18+ Adult TV Channel — ${title}`,
                    episodes: [
                        new Episode({
                            name: title,
                            url: iframeSrc || url,
                            season: 1,
                            episode: 1,
                            posterUrl: posterUrl || undefined
                        })
                    ]
                })
            });
        } catch (e) {
            cb({ success: false, errorCode: "PARSE_ERROR", message: e.message });
        }
    }

    async function loadStreams(iframeUrl, cb) {
        try {
            const res = await http_get(iframeUrl, {
                ...HEADERS,
                "Referer": BASE_URL + "/"
            });
            if (!res || !res.body) return cb({ success: true, data: [] });

            // CloudStream: tìm signedUrl = "..." hoặc file: "..."
            const match = res.body.match(/(?:signedUrl\s*=|file\s*:)\s*"([^"]+)"/i);
            if (!match) return cb({ success: true, data: [] });

            // CloudStream: fix http → https
            let streamUrl = match[1];
            if (!streamUrl.startsWith("https")) {
                streamUrl = streamUrl.replace(/^http:/, "https:");
            }

            cb({
                success: true,
                data: [new StreamResult({
                    url: streamUrl,
                    source: "AdultTvChannels",
                    headers: { "Referer": BASE_URL + "/" }
                })]
            });
        } catch (e) {
            cb({ success: false, errorCode: "STREAM_ERROR", message: e.message });
        }
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();
