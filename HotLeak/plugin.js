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

    // CloudStream: 2 category — Creators và Hot
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

    // CloudStream: div.item → a href, div.movie-name > h3, img.post-thumbnail
    // Skip nếu href chứa "energizeio.com"
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
            // CloudStream: /search?search={query}&page=1
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

            // CloudStream: div.actor-name > h1
            const title = doc.querySelector("div.actor-name > h1")?.textContent?.trim();
            if (!title) return cb({ success: false, errorCode: "PARSE_ERROR", message: "No title" });

            const poster = fixUrl(doc.querySelector("img.model-thumbnail")?.getAttribute("src") || "");

            // CloudStream: div.actor-movie > span
            const description = doc.querySelector("div.actor-movie > span")?.textContent?.trim() || "";

            // CloudStream: actor = creator name
            const cast = [new Actor({ name: title })];

            // Recommendations từ div.srelacionados article + ul.movies-comming li.movie-item
            const recommendations = [];
            const recSeen = new Set();
            doc.querySelectorAll("div.srelacionados article, ul.movies-comming li.movie-item").forEach(el => {
                const a = el.querySelector("a");
                if (!a) return;
                const recUrl = fixUrl(a.getAttribute("href") || "");
                if (!recUrl || recSeen.has(recUrl)) return;
                const recTitle = el.querySelector("span.name")?.textContent?.trim();
                if (!recTitle) return;
                const img = el.querySelector("img.post-thumbnail");
                const recPoster = fixUrl(img?.getAttribute("src") || "");
                recSeen.add(recUrl);
                recommendations.push(new MultimediaItem({ title: recTitle, url: recUrl, posterUrl: recPoster, type: "movie" }));
            });

            // CloudStream: userSlug = url.substringAfterLast("/")
            const userSlug = url.replace(/\/$/, "").split("/").pop();

            // Fetch video list qua API JSON — CloudStream fetch đến page 50 hoặc đến khi response rỗng
            const apiHeaders = {
                ...HEADERS,
                "x-requested-with": "XMLHttpRequest",
                "referer": `${BASE_URL}/${userSlug}/video`
            };
            const apiCookies = "qzqz0=1";

            const episodes = [];
            for (let page = 1; page <= 50; page++) {
                try {
                    const apiRes = await http_get(
                        `${BASE_URL}/${userSlug}?page=${page}&type=videos&order=0`,
                        { ...apiHeaders, "Cookie": apiCookies }
                    );
                    if (!apiRes || !apiRes.body) break;

                    let videos;
                    try { videos = JSON.parse(apiRes.body); } catch (e) { break; }
                    if (!Array.isArray(videos) || videos.length === 0) break;

                    videos.forEach(video => {
                        const id          = video["id"]?.toString();
                        const streamUrl   = video["stream_url_play"]?.toString();
                        const thumb       = video["thumbnail"]?.toString() || "";
                        const desc        = video["description"]?.toString() || "";
                        const pubDate     = video["published_date"]?.toString() || "";
                        if (!id || !streamUrl) return;

                        episodes.push(new Episode({
                            name: `ID: ${id}`,
                            // CloudStream: url = "{userSlug}|{streamUrl}"
                            url: `${userSlug}|${streamUrl}`,
                            season: 1,
                            episode: episodes.length + 1,
                            posterUrl: thumb || undefined,
                            description: pubDate ? `Published: ${pubDate}\n${desc}` : desc
                        }));
                    });
                } catch (e) { break; }
            }

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
            // CloudStream: split "|" → [userSlug, originUrl]
            const pipeIdx = data.indexOf("|");
            if (pipeIdx === -1) return cb({ success: true, data: [] });

            const userSlug = data.substring(0, pipeIdx);
            const originUrl = data.substring(pipeIdx + 1);

            // CloudStream decode:
            // 1. drop 16 ký tự đầu
            // 2. drop 16 ký tự cuối
            // 3. reverse
            // 4. base64 decode
            const stripped = originUrl.slice(16, -16);
            const reversed = stripped.split("").reverse().join("");
            const decoded  = atob(reversed);

            const username = userSlug.split("/").pop();

            cb({
                success: true,
                data: [new StreamResult({
                    url: decoded,
                    source: `HotLeak - ${username}`,
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
