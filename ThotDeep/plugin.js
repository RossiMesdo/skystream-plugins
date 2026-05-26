(function() {
    /**
     * ThotDeep Plugin for SkyStream
     * Site: https://thotdeep.com
     * Ported from: Cs-GizliKeyif CloudStream repo
     * Author: Lord
     */

    const BASE_URL = manifest.baseUrl;
    const HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:137.0) Gecko/20100101 Firefox/137.0",
        "Referer": BASE_URL + "/"
    };

    const CATEGORIES = [
        { name: "Main Page",        url: `${BASE_URL}/` },
        { name: "Popular",          url: `${BASE_URL}/popular` },
        { name: "Actress",          url: `${BASE_URL}/tags/actress` },
        { name: "Tv Personalities", url: `${BASE_URL}/categories/tv-personalities` },
        { name: "Celebrities",      url: `${BASE_URL}/celebrities` },
    ];

    function fixUrl(u) {
        if (!u) return "";
        if (u.startsWith("//")) return "https:" + u;
        if (u.startsWith("/")) return BASE_URL + u;
        return u;
    }

    // CloudStream: div.post, div.model-card
    // title từ h3 a, h3.model-card-name
    // poster từ img[loading=lazy][src]
    function parseItems(doc) {
        return Array.from(doc.querySelectorAll("div.post, div.model-card")).map(el => {
            const titleEl = el.querySelector("h3 a, h3.model-card-name");
            const title = titleEl?.textContent?.trim();
            if (!title) return null;
            const url = fixUrl(el.querySelector("a")?.getAttribute("href") || "");
            if (!url) return null;
            const poster = fixUrl(el.querySelector("img[loading='lazy']")?.getAttribute("src") || "");
            return new MultimediaItem({ title, url, posterUrl: poster, type: "movie" });
        }).filter(Boolean);
    }

    async function getHome(cb) {
        try {
            const home = {};
            await Promise.all(CATEGORIES.map(async (cat) => {
                try {
                    const res = await http_get(`${cat.url}?page=1`, HEADERS);
                    if (!res || res.status !== 200) return;
                    const doc = await parseHtml(res.body);
                    const items = parseItems(doc);
                    if (items.length > 0) home[cat.name] = items;
                } catch (e) {}
            }));
            cb({ success: true, data: home });
        } catch (e) {
            cb({ success: false, errorCode: "SITE_OFFLINE", message: e.message });
        }
    }

    async function search(query, cb) {
        try {
            // CloudStream: /search?type=title&s={query}&page=1
            const res = await http_get(
                `${BASE_URL}/search?type=title&s=${encodeURIComponent(query)}&page=1`,
                HEADERS
            );
            if (!res || res.status !== 200) return cb({ success: true, data: [] });
            const doc = await parseHtml(res.body);
            cb({ success: true, data: parseItems(doc) });
        } catch (e) {
            cb({ success: false, errorCode: "SEARCH_ERROR", message: e.message });
        }
    }

    async function load(url, cb) {
        try {
            const res = await http_get(url, HEADERS);
            if (!res || res.status !== 200) return cb({ success: false, errorCode: "SITE_OFFLINE" });
            const doc = await parseHtml(res.body);

            const title = doc.querySelector("h1")?.textContent?.trim();
            if (!title) return cb({ success: false, errorCode: "PARSE_ERROR", message: "No title" });

            // CloudStream: poster từ div#player-wrap img[src*=http] hoặc div.model-avatar img
            const poster = fixUrl(
                doc.querySelector("div#player-wrap img[src*='http']")?.getAttribute("src")
                || doc.querySelector("div.model-avatar img")?.getAttribute("src") || ""
            );

            const description = doc.querySelector("meta[property='og:description']")?.getAttribute("content")?.trim() || "";

            // CloudStream: tags từ span:contains(cate) ~ a
            const tags = [];
            doc.querySelectorAll("span").forEach(span => {
                if (span.textContent.toLowerCase().includes("cate")) {
                    let next = span.nextElementSibling;
                    while (next && next.tagName === "A") {
                        tags.push(next.textContent.trim());
                        next = next.nextElementSibling;
                    }
                }
            });

            // CloudStream: actors từ span:contains(celeb) ~ a
            const cast = [];
            doc.querySelectorAll("span").forEach(span => {
                if (span.textContent.toLowerCase().includes("celeb")) {
                    let next = span.nextElementSibling;
                    while (next && next.tagName === "A") {
                        const name = next.textContent.trim();
                        if (name) cast.push(new Actor({ name }));
                        next = next.nextElementSibling;
                    }
                }
            });

            const recommendations = parseItems(doc);

            // CloudStream: nếu URL chứa "celebrities" → TvSeries với episodes từ div.post
            const isCeleb = url.includes("celebrities");
            const episodes = [];

            if (isCeleb) {
                // CloudStream: episodes từ div.post — mỗi post là 1 video
                doc.querySelectorAll("div.post").forEach((el, idx) => {
                    const epTitle = el.querySelector("a")?.textContent?.trim();
                    const epUrl = fixUrl(el.querySelector("a")?.getAttribute("href") || "");
                    if (!epTitle || !epUrl) return;
                    const epPoster = fixUrl(el.querySelector("img[loading='lazy']")?.getAttribute("src") || "");
                    episodes.push({
                        name: epTitle,
                        url: epUrl,
                        season: 1,
                        episode: idx + 1,
                        posterUrl: epPoster || undefined
                    });
                });
            }

            // Nếu không phải celeb hoặc không có episodes → dùng chính URL
            if (episodes.length === 0) {
                episodes.push({
                    name: "Play",
                    url,
                    season: 1,
                    episode: 1,
                    posterUrl: poster || undefined
                });
            }

            cb({
                success: true,
                data: new MultimediaItem({
                    title,
                    url,
                    posterUrl: poster,
                    type: isCeleb && episodes.length > 1 ? "series" : "movie",
                    description,
                    tags: tags.length ? tags : undefined,
                    cast: cast.length ? cast : undefined,
                    recommendations: recommendations.length ? recommendations : undefined,
                    episodes
                })
            });
        } catch (e) {
            cb({ success: false, errorCode: "PARSE_ERROR", message: e.message });
        }
    }

    async function loadStreams(url, cb) {
        try {
            const res = await http_get(url, HEADERS);
            if (!res || !res.body) return cb({ success: true, data: [] });
            const doc = await parseHtml(res.body);

            // CloudStream: div#player-wrap[data-source]
            // decode: drop(16) → reversed() → drop(16) → base64Decode
            const dataSource = doc.querySelector("div#player-wrap")?.getAttribute("data-source") || "";
            if (!dataSource) return cb({ success: true, data: [] });

            const step1 = dataSource.slice(16);
            const step2 = step1.split("").reverse().join("");
            const step3 = step2.slice(16);
            const decoded = atob(step3).trim();

            if (!decoded || !decoded.startsWith("http")) return cb({ success: true, data: [] });

            cb({
                success: true,
                data: [new StreamResult({
                    url: decoded,
                    source: "ThotDeep",
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
