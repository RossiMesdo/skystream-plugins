(function() {
    /**
     * HotLeak Plugin for SkyStream
     * Site: https://hotleak.vip
     * Ported from: Cs-GizliKeyif CloudStream repo
     * Author: Lord
     */

    const BASE_URL = manifest.baseUrl;
    const HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:137.0) Gecko/20100101 Firefox/137.0",
        "Referer": BASE_URL + "/"
    };

    const CATEGORIES = [
        { name: "All Creators", url: `${BASE_URL}/creators` },
        { name: "Hot",          url: `${BASE_URL}/hot` },
    ];

    function fixUrl(u) {
        if (!u) return "";
        if (u.startsWith("//")) return "https:" + u;
        if (u.startsWith("/")) return BASE_URL + u;
        return u;
    }

    function parseItems(doc) {
        return Array.from(doc.querySelectorAll("div.item")).map(el => {
            const a = el.querySelector("a");
            if (!a) return null;
            const url = fixUrl(a.getAttribute("href") || "");
            if (!url || url.includes("energizeio.com")) return null;
            const title = el.querySelector("div.movie-name > h3")?.textContent?.trim();
            if (!title) return null;
            const img = el.querySelector("img.post-thumbnail");
            const poster = fixUrl(img?.getAttribute("src") || "");
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
            const res = await http_get(`${BASE_URL}/search?search=${encodeURIComponent(query)}&page=1`, HEADERS);
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

            const title = doc.querySelector("div.actor-name > h1")?.textContent?.trim();
            if (!title) return cb({ success: false, errorCode: "PARSE_ERROR", message: "No title" });

            const poster = fixUrl(doc.querySelector("img.model-thumbnail")?.getAttribute("src") || "");
            const description = doc.querySelector("div.actor-movie > span")?.textContent?.trim() || "";
            const cast = [new Actor({ name: title })];

            const recommendations = [];
            const recSeen = new Set();
            doc.querySelectorAll("div.srelacionados article, ul.movies-comming li.movie-item").forEach(el => {
                const a = el.querySelector("a");
                if (!a) return;
                const recUrl = fixUrl(a.getAttribute("href") || "");
                if (!recUrl || recSeen.has(recUrl)) return;
                const recTitle = el.querySelector("span.name")?.textContent?.trim();
                if (!recTitle) return;
                const recPoster = fixUrl(el.querySelector("img.post-thumbnail")?.getAttribute("src") || "");
                recSeen.add(recUrl);
                recommendations.push(new MultimediaItem({ title: recTitle, url: recUrl, posterUrl: recPoster, type: "movie" }));
            });

            const userSlug = url.replace(/\/$/, "").split("/").pop();
            const apiHeaders = {
                ...HEADERS,
                "x-requested-with": "XMLHttpRequest",
                "referer": `${BASE_URL}/${userSlug}/video`,
                "Cookie": "qzqz0=1"
            };

            // Fetch tất cả 50 page song song thay vì tuần tự
            const pageResults = await Promise.allSettled(
                Array.from({ length: 50 }, (_, i) => i + 1).map(async (page) => {
                    const apiRes = await http_get(
                        `${BASE_URL}/${userSlug}?page=${page}&type=videos&order=0`,
                        apiHeaders
                    );
                    if (!apiRes || !apiRes.body) return [];
                    try {
                        const videos = JSON.parse(apiRes.body);
                        if (!Array.isArray(videos) || videos.length === 0) return [];
                        return videos;
                    } catch (e) { return []; }
                })
            );

            // Gộp kết quả theo đúng thứ tự page
            const episodes = [];
            pageResults.forEach((r, pageIdx) => {
                const videos = r.status === "fulfilled" ? r.value : [];
                videos.forEach((video, vidIdx) => {
                    const id        = video["id"]?.toString();
                    const streamUrl = video["stream_url_play"]?.toString();
                    const thumb     = video["thumbnail"]?.toString() || "";
                    const desc      = video["description"]?.toString() || "";
                    const pubDate   = video["published_date"]?.toString() || "";
                    if (!id || !streamUrl) return;

                    episodes.push(new Episode({
                        name: pubDate ? `${pubDate} — ID: ${id}` : `ID: ${id}`,
                        url: `${userSlug}|${streamUrl}`,
                        season: 1,
                        episode: pageIdx * 12 + vidIdx + 1,
                        posterUrl: thumb || undefined,
                        description: desc || undefined
                    }));
                });
            });

            cb({
                success: true,
                data: new MultimediaItem({
                    title,
                    url,
                    posterUrl: poster,
                    type: "movie",
                    description,
                    cast,
                    recommendations: recommendations.length ? recommendations : undefined,
                    episodes
                })
            });
        } catch (e) {
            cb({ success: false, errorCode: "PARSE_ERROR", message: e.message });
        }
    }

    async function loadStreams(data, cb) {
        try {
            const pipeIdx = data.indexOf("|");
            if (pipeIdx === -1) return cb({ success: true, data: [] });

            const userSlug = data.substring(0, pipeIdx);
            const originUrl = data.substring(pipeIdx + 1);

            // CloudStream decode: drop 16 đầu + 16 cuối → reverse → base64 decode
            const stripped = originUrl.slice(16, -16);
            const reversed = stripped.split("").reverse().join("");
            const decoded  = atob(reversed);

            const username = userSlug.split("/").pop();

            cb({
                success: true,
                data: [new StreamResult({
                    url: decoded,
                    source: `HotLeak — ${username}`,
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
