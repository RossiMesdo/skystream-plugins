(function() {
    /**
     * 18EU Plugin for SkyStream
     * Site: https://18eu.net
     * Ported from: Cs-GizliKeyif CloudStream repo
     * Author: Lord
     */

    const BASE_URL = manifest.baseUrl;
    const HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:137.0) Gecko/20100101 Firefox/137.0",
        "Referer": BASE_URL + "/"
    };

    const CATEGORIES = [
        { name: "All Movies", url: `${BASE_URL}/movies/` },
        { name: "TV Series",  url: `${BASE_URL}/tv-series/` },
    ];

    function fixUrl(u) {
        if (!u) return "";
        if (u.startsWith("//")) return "https:" + u;
        if (u.startsWith("/")) return BASE_URL + u;
        return u;
    }

    function buildPageUrl(base, page) {
        if (page <= 1) return base;
        return base.replace(/\/$/, "") + `/page/${page}/`;
    }

    function parseItems(doc) {
        return Array.from(doc.querySelectorAll("article.thumb")).map(el => {
            const title = el.querySelector("h2.entry-title")?.textContent?.trim()
                || el.querySelector("a.halim-thumb")?.getAttribute("title")?.trim();
            if (!title) return null;
            const url = fixUrl(el.querySelector("a.halim-thumb")?.getAttribute("href") || "");
            if (!url) return null;
            const img = el.querySelector("img");
            const poster = fixUrl(img?.getAttribute("data-src") || img?.getAttribute("src") || "");
            return new MultimediaItem({ title, url, posterUrl: poster, type: "movie" });
        }).filter(Boolean);
    }

    async function getHome(cb) {
        try {
            const home = {};
            await Promise.all(CATEGORIES.map(async (cat) => {
                try {
                    const res = await http_get(buildPageUrl(cat.url, 1), HEADERS);
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
            const res = await http_get(`${BASE_URL}/search/${encodeURIComponent(query)}`, HEADERS);
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

            const title = doc.querySelector("h1.entry-title")?.textContent?.trim() || "";
            if (!title) return cb({ success: false, errorCode: "PARSE_ERROR", message: "No title" });

            const poster = fixUrl(doc.querySelector("img.movie-thumb")?.getAttribute("src") || "");
            const description = doc.querySelector("article.item-content p")?.textContent?.trim() || "";
            const year = parseInt(doc.querySelector("span.released a")?.textContent?.trim()) || undefined;

            const cast = Array.from(doc.querySelectorAll("p.actors a")).map(a => {
                const name = a.textContent.trim();
                return name ? new Actor({ name }) : null;
            }).filter(Boolean);

            const recommendations = Array.from(
                doc.querySelectorAll("div#halim-ajax-popular-post div.item")
            ).map(el => {
                const recTitle = el.querySelector("h3.title")?.textContent?.trim();
                const recUrl = fixUrl(el.querySelector("a")?.getAttribute("href") || "");
                if (!recTitle || !recUrl) return null;
                const img = el.querySelector("img");
                const recPoster = fixUrl(img?.getAttribute("data-src") || img?.getAttribute("src") || "");
                return new MultimediaItem({ title: recTitle, url: recUrl, posterUrl: recPoster, type: "movie" });
            }).filter(Boolean);

            // ── Episodes — dùng plain object như bollyflix ──
            const episodes = [];

            // Tầng 1: ul.halim-list-eps li.halim-episode-item
            doc.querySelectorAll("ul.halim-list-eps li.halim-episode-item").forEach((el, idx) => {
                const epUrl = fixUrl(
                    el.querySelector("a")?.getAttribute("href") || el.getAttribute("data-href") || ""
                );
                if (!epUrl) return;
                const epName = el.querySelector("span")?.textContent?.trim()
                    || el.querySelector("a")?.getAttribute("title")?.trim()
                    || `Episode ${idx + 1}`;
                // CloudStream: epname.filter { it.isDigit() }.toIntOrNull()
                const epNum = parseInt(epName.replace(/\D/g, "")) || idx + 1;
                episodes.push({
                    name: epName,
                    url: epUrl,
                    season: 1,
                    episode: epNum,
                    posterUrl: poster || undefined
                });
            });

            // Tầng 2: var jsonEpisodes trong script
            if (episodes.length === 0) {
                const jsonScript = Array.from(doc.querySelectorAll("script"))
                    .find(s => s.textContent.includes("var jsonEpisodes"));
                if (jsonScript) {
                    const regex = /"postUrl":"(.*?)".*?"episodeName":"(.*?)"/g;
                    let m;
                    let idx = 0;
                    while ((m = regex.exec(jsonScript.textContent)) !== null) {
                        const epUrl = fixUrl(m[1].replace(/\\\//g, "/"));
                        const epName = m[2];
                        const epNum = parseInt(epName.replace(/\D/g, "")) || idx + 1;
                        episodes.push({
                            name: epName,
                            url: epUrl,
                            season: 1,
                            episode: epNum,
                            posterUrl: poster || undefined
                        });
                        idx++;
                    }
                }
            }

            // Tầng 3: movie đơn
            if (episodes.length === 0) {
                const watchUrl = fixUrl(doc.querySelector("a.watch-movie")?.getAttribute("href") || "") || url;
                episodes.push({
                    name: "Play",
                    url: watchUrl,
                    season: 1,
                    episode: 1,
                    posterUrl: poster || undefined
                });
            }

            // CloudStream: episodes.size > 1 → TvSeries, không thì Movie
            const isSeries = episodes.length > 1;

            cb({
                success: true,
                data: new MultimediaItem({
                    title,
                    url,
                    posterUrl: poster,
                    type: isSeries ? "series" : "movie",
                    description,
                    year,
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

            const body = res.body;

            const nonce    = body.match(/data-nonce="([^"]+)"/)?.[1];
            const postId   = body.match(/post_id":(\d+)/)?.[1];
            const serverId = body.match(/server":"(\d+)"/)?.[1] || "1";

            if (!nonce || !postId) return cb({ success: true, data: [] });

            let episodeSlug = url.replace(/\/$/, "").split("/").pop()?.replace(".html", "") || "";
            if (episodeSlug.includes("-sv")) {
                episodeSlug = episodeSlug.split("-sv")[0];
            }

            const playerUrl = `${BASE_URL}/wp-content/themes/halimmovies/player.php`
                + `?episode_slug=${encodeURIComponent(episodeSlug)}`
                + `&server_id=${serverId}`
                + `&subsv_id=`
                + `&post_id=${postId}`
                + `&nonce=${nonce}`
                + `&custom_var=`;

            const playerRes = await http_get(playerUrl, {
                ...HEADERS,
                "Referer": url,
                "X-Requested-With": "XMLHttpRequest"
            });

            if (!playerRes || !playerRes.body) return cb({ success: true, data: [] });

            const m3u8 = playerRes.body.match(/"file"\s*:\s*"([^"]+)"/i)?.[1]?.replace(/\\\//g, "/");
            if (!m3u8) return cb({ success: true, data: [] });

            cb({
                success: true,
                data: [new StreamResult({
                    url: m3u8,
                    source: "18EU",
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
