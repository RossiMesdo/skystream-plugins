(function () {
    const BASE_URL = manifest.baseUrl;
    const HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/132.0 Safari/537.36",
        "Referer": `${BASE_URL}/`
    };
    const CATEGORIES = [
        { name: "Today's selection", path: "/todays-selection/1" },
        { name: "Best", path: "/best/1" },
        { name: "Popular", path: "/search/sex/1" },
        { name: "Vietnamese", path: "/search/phim+sex+viet+nam/1" },
        { name: "Japanese", path: "/search/japanese/1" }
    ];

    function fixUrl(value) {
        if (!value) return "";
        if (value.startsWith("//")) return `https:${value}`;
        return new URL(value, BASE_URL).href;
    }

    function parseItems(doc) {
        const items = [];
        const seen = new Set();
        doc.querySelectorAll(".thumb-block:not(.thumb-cat)").forEach(card => {
            const link = card.querySelector('.thumb-under a[href^="/video-"], a[href^="/video-"]');
            const url = fixUrl(link?.getAttribute("href"));
            const title = (link?.getAttribute("title") || link?.textContent || "").trim();
            if (!url || !title || seen.has(url)) return;
            seen.add(url);
            const image = card.querySelector("img");
            items.push(new MultimediaItem({
                title,
                url,
                posterUrl: fixUrl(image?.getAttribute("data-src") || image?.getAttribute("data-sfwthumb") || image?.getAttribute("src")),
                type: "movie",
                isAdult: true,
                contentRating: "18+"
            }));
        });
        return items;
    }

    async function getHome(cb) {
        try {
            const home = {};
            await Promise.all(CATEGORIES.map(async category => {
                try {
                    const res = await http_get(fixUrl(category.path), HEADERS);
                    if (!res?.body) return;
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
            const term = encodeURIComponent(String(query || "").trim()).replace(/%20/g, "+");
            const res = await http_get(`${BASE_URL}/search/${term}/1`, HEADERS);
            if (!res?.body) return cb({ success: true, data: [] });
            cb({ success: true, data: parseItems(await parseHtml(res.body)) });
        } catch (e) {
            cb({ success: false, errorCode: "SEARCH_ERROR", message: String(e?.message || e) });
        }
    }

    async function load(url, cb) {
        try {
            const res = await http_get(url, HEADERS);
            if (!res?.body) return cb({ success: false, errorCode: "SITE_OFFLINE" });
            const doc = await parseHtml(res.body);
            const title = doc.querySelector("meta[property='og:title']")?.getAttribute("content")?.trim()
                || doc.querySelector("h1")?.textContent?.trim();
            if (!title) return cb({ success: false, errorCode: "PARSE_ERROR", message: "No video title" });
            const poster = doc.querySelector("meta[property='og:image']")?.getAttribute("content") || "";
            const description = doc.querySelector("meta[name='description']")?.getAttribute("content") || "";
            cb({ success: true, data: new MultimediaItem({
                title, url, posterUrl: fixUrl(poster), description,
                type: "movie", isAdult: true, contentRating: "18+",
                episodes: [new Episode({ name: title, url, season: 1, episode: 1, posterUrl: fixUrl(poster) || undefined })]
            }) });
        } catch (e) {
            cb({ success: false, errorCode: "LOAD_ERROR", message: String(e?.message || e) });
        }
    }

    async function loadStreams(url, cb) {
        try {
            const res = await http_get(url, { ...HEADERS, Referer: url });
            if (!res?.body) return cb({ success: true, data: [] });
            const html = res.body.replace(/\\\//g, "/").replace(/&amp;/g, "&");
            const hls = html.match(/html5player\.setVideoHLS\s*\(\s*['"]([^'"]+)['"]/i)?.[1];
            if (hls) {
                return cb({ success: true, data: [new StreamResult({
                    url: hls,
                    source: "XNXX HLS",
                    quality: "Auto",
                    headers: { ...HEADERS, Referer: url }
                })] });
            }
            const mp4 = html.match(/html5player\.setVideoUrlHigh\s*\(\s*['"]([^'"]+)['"]/i)?.[1]
                || html.match(/html5player\.setVideoUrlLow\s*\(\s*['"]([^'"]+)['"]/i)?.[1];
            cb({ success: true, data: mp4 ? [new StreamResult({
                url: mp4,
                source: "XNXX MP4",
                headers: { ...HEADERS, Referer: url }
            })] : [] });
        } catch (e) {
            cb({ success: false, errorCode: "STREAM_ERROR", message: String(e?.message || e) });
        }
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();