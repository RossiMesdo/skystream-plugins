(function() {
    /**
     * EPorner Plugin for SkyStream
     * Site: https://www.eporner.com
     * Ported from: Cs-GizliKeyif CloudStream repo
     * Author: Lord
     */

    const BASE_URL = manifest.baseUrl;
    const HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": BASE_URL + "/"
    };

    const CATEGORIES = [
        { name: "Most Recent",  url: `${BASE_URL}/` },
        { name: "Most Viewed",  url: `${BASE_URL}/most-viewed/` },
        { name: "Top Rated",    url: `${BASE_URL}/top-rated/` },
        { name: "Longest",      url: `${BASE_URL}/longest/` },
        { name: "Cowgirl",      url: `${BASE_URL}/tag/cowgirl/` },
        { name: "Riding",       url: `${BASE_URL}/tag/riding/` },
        { name: "Turkish",      url: `${BASE_URL}/tag/turkish/` },
        { name: "Housewives",   url: `${BASE_URL}/cat/housewives/` },
    ];

    function fixUrl(u) {
        if (!u) return "";
        if (u.startsWith("//")) return "https:" + u;
        if (u.startsWith("/")) return BASE_URL + u;
        return u;
    }

    // CloudStream: page 1 = URL gốc, page 2+ = URL/N/
    function buildPageUrl(base, page) {
        if (page <= 1) return base;
        return base.replace(/\/$/, "") + `/${page}/`;
    }

    // CloudStream: div#vidresults div.mb
    // title từ p.mbtit a, poster từ div.mbimg img[data-src] fallback src (skip data: URI)
    function parseItems(doc) {
        return Array.from(doc.querySelectorAll("div#vidresults div.mb")).map(el => {
            const link = el.querySelector("p.mbtit a");
            if (!link) return null;
            const title = link.textContent.trim();
            const url = fixUrl(link.getAttribute("href") || "");
            if (!title || !url) return null;
            const img = el.querySelector("div.mbimg img");
            const dataSrc = img?.getAttribute("data-src") || "";
            const src = img?.getAttribute("src") || "";
            const poster = fixUrl(
                (dataSrc && !dataSrc.startsWith("data:")) ? dataSrc : src
            );
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
            // CloudStream: query.replace(" ", "-"), page 1 = /search/query/, page 2+ = /search/query/N/
            const q = query.replace(/ /g, "-");
            const res = await http_get(`${BASE_URL}/search/${encodeURIComponent(q)}/`, HEADERS);
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

            // CloudStream: h1
            const title = doc.querySelector("h1")?.textContent?.trim();
            if (!title) return cb({ success: false, errorCode: "PARSE_ERROR", message: "No title" });

            // CloudStream: meta[property=og:image] fallback video#EPvideo[poster]
            const poster = fixUrl(
                doc.querySelector("meta[property='og:image']")?.getAttribute("content") ||
                doc.querySelector("video#EPvideo")?.getAttribute("poster") || ""
            );

            const description = doc.querySelector("meta[property='og:description']")?.getAttribute("content")?.trim() || "";
            const year = parseInt(doc.querySelector("span.C a")?.textContent?.trim()) || undefined;

            // CloudStream: div#video-info-tags ul li.vit-category a
            const tags = Array.from(
                doc.querySelectorAll("div#video-info-tags ul li.vit-category a")
            ).map(a => a.textContent.trim()).filter(Boolean);

            // CloudStream: span.valor a
            const cast = Array.from(doc.querySelectorAll("span.valor a")).map(a => {
                const name = a.textContent.trim();
                return name ? new Actor({ name }) : null;
            }).filter(Boolean);

            // CloudStream: div#relateddiv div.mb
            const recommendations = Array.from(
                doc.querySelectorAll("div#relateddiv div.mb")
            ).map(el => {
                const link = el.querySelector("p.mbtit a");
                if (!link) return null;
                const recTitle = link.textContent.trim();
                const recUrl = fixUrl(link.getAttribute("href") || "");
                if (!recTitle || !recUrl) return null;
                const img = el.querySelector("div.mbimg img");
                const recPoster = fixUrl(img?.getAttribute("data-src") || img?.getAttribute("src") || "");
                return new MultimediaItem({ title: recTitle, url: recUrl, posterUrl: recPoster, type: "movie" });
            }).filter(Boolean);

            cb({
                success: true,
                data: new MultimediaItem({
                    title,
                    url,
                    posterUrl: poster,
                    type: "movie",
                    description,
                    year,
                    tags: tags.length ? tags : undefined,
                    cast: cast.length ? cast : undefined,
                    recommendations: recommendations.length ? recommendations : undefined,
                    episodes: [{
                        name: "Play",
                        url,
                        season: 1,
                        episode: 1,
                        posterUrl: poster || undefined
                    }]
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

            // CloudStream dùng WebViewResolver để intercept /xhr/video/{hash}
            // Ta tìm video hash trực tiếp từ page source rồi gọi API thẳng
            // Pattern: /xhr/video/{hash} xuất hiện trong script hoặc data attribute
            const xhrMatch = body.match(/\/xhr\/video\/([a-zA-Z0-9]+)\//);
            if (!xhrMatch) return cb({ success: true, data: [] });

            const hash = xhrMatch[1];
            const apiUrl = `${BASE_URL}/xhr/video/${hash}/?m=mp4`;

            const apiRes = await http_get(apiUrl, {
                ...HEADERS,
                "X-Requested-With": "XMLHttpRequest"
            });
            if (!apiRes || !apiRes.body) return cb({ success: true, data: [] });

            // CloudStream regex: "(\d{3,4}p)[^"]*"\s*:\s*\{\s*"labelShort"\s*:\s*"[^"]*"\s*,\s*"src"\s*:\s*"([^"]+)"
            const streams = [];
            const regex = /"(\d{3,4}p)[^"]*"\s*:\s*\{\s*"labelShort"\s*:\s*"[^"]*"\s*,\s*"src"\s*:\s*"([^"]+)"/g;
            let m;
            while ((m = regex.exec(apiRes.body)) !== null) {
                const quality = m[1];
                const videoUrl = m[2].replace(/\\/g, "");
                // CloudStream: skip /dload/ URLs
                if (videoUrl.includes("/dload/")) continue;
                streams.push(new StreamResult({
                    url: videoUrl,
                    source: `EPorner ${quality}`,
                    headers: { "Referer": BASE_URL + "/" }
                }));
            }

            // Sort chất lượng cao nhất lên đầu
            streams.sort((a, b) => {
                const qa = parseInt(a.source.match(/\d+/)?.[0] || "0");
                const qb = parseInt(b.source.match(/\d+/)?.[0] || "0");
                return qb - qa;
            });

            cb({ success: true, data: streams });
        } catch (e) {
            cb({ success: false, errorCode: "STREAM_ERROR", message: e.message });
        }
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();
