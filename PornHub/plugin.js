(function() {
    /**
     * PornHub Plugin for SkyStream
     * Site: https://www.pornhub.com
     * Ported from: Cs-GizliKeyif CloudStream repo
     * Author: Lord
     */

    const BASE_URL = manifest.baseUrl;
    const HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0",
        "Referer": BASE_URL + "/",
        "Cookie": "hasVisited=1; accessAgeDisclaimerPH=1"
    };

    // CloudStream: chỉ enable các category đã bỏ comment
    const CATEGORIES = [
        { name: "Featured",    url: `${BASE_URL}/video` },
        { name: "18-25",       url: `${BASE_URL}/categories/teen` },
        { name: "60FPS",       url: `${BASE_URL}/video?c=105` },
        { name: "Amateur",     url: `${BASE_URL}/video?c=3` },
        { name: "Anal",        url: `${BASE_URL}/video?c=35` },
        { name: "Arab",        url: `${BASE_URL}/video?c=98` },
        { name: "Asian",       url: `${BASE_URL}/video?c=1` },
        { name: "Babe",        url: `${BASE_URL}/categories/babe` },
        { name: "Big Ass",     url: `${BASE_URL}/video?c=4` },
        { name: "Blonde",      url: `${BASE_URL}/video?c=9` },
        { name: "Brunette",    url: `${BASE_URL}/video?c=11` },
        { name: "Bukkake",     url: `${BASE_URL}/video?c=14` },
        { name: "Cosplay",     url: `${BASE_URL}/video?c=241` },
        { name: "Ebony",       url: `${BASE_URL}/video?c=17` },
        { name: "HD Porn",     url: `${BASE_URL}/hd` },
        { name: "Mature",      url: `${BASE_URL}/video?c=28` },
        { name: "MILF",        url: `${BASE_URL}/video?c=29` },
    ];

    function fixUrl(u) {
        if (!u) return "";
        if (u.startsWith("//")) return "https:" + u;
        if (u.startsWith("/")) return BASE_URL + u;
        return u;
    }

    // CloudStream: dùng img alt làm title, img src làm poster
    function parseItems(doc) {
        return Array.from(doc.querySelectorAll("div.gridWrapper li.pcVideoListItem")).map(el => {
            const img = el.querySelector("img");
            const title = img?.getAttribute("alt") || "";
            const a = el.querySelector("a");
            const url = fixUrl(a?.getAttribute("href") || "");
            // Poster: thử data-mediumthumb trước (lazy load), fallback src
            const poster = img?.getAttribute("data-mediumthumb") || img?.getAttribute("src") || "";
            if (!title || !url) return null;
            return new MultimediaItem({ title, url, posterUrl: poster, type: "movie" });
        }).filter(Boolean);
    }

    // CloudStream: nếu URL có "?" thì thêm &page=N, không thì ?page=N
    function buildPageUrl(base, page) {
        if (page <= 1) return base;
        return base.includes("?") ? `${base}&page=${page}` : `${base}?page=${page}`;
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
            const res = await http_get(`${BASE_URL}/video/search?search=${encodeURIComponent(query)}`, HEADERS);
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

            const title = (doc.querySelector("h1")?.textContent || "").trim();
            if (!title) return cb({ success: false, errorCode: "PARSE_ERROR" });

            // CloudStream: poster từ noscript img.videoElementPoster trước, fallback trực tiếp
            const noscript = doc.querySelector("noscript");
            let poster = "";
            if (noscript) {
                const m = noscript.innerHTML.match(/src="([^"]+)"/);
                if (m) poster = m[1];
            }
            if (!poster) {
                poster = doc.querySelector("img.videoElementPoster")?.getAttribute("src") || "";
            }

            const description = doc.querySelector("meta[property='og:description']")?.getAttribute("content") || "";

            // Tags
            const tags = Array.from(doc.querySelectorAll("div.tagsWrapper a")).map(a => a.textContent.trim()).filter(Boolean);

            // Actors — CloudStream: a.pstar-list-btn
            const cast = Array.from(doc.querySelectorAll("a.pstar-list-btn")).map(a => {
                return new Actor({ name: a.textContent.trim() });
            }).filter(a => a.name);

            // Recommendations — CloudStream: li.pcVideoListItem
            const recommendations = Array.from(doc.querySelectorAll("li.pcVideoListItem")).map(el => {
                const link = el.querySelector("a.thumbnailTitle") || el.querySelector("a[href*='view_video.php']");
                const href = link?.getAttribute("href");
                if (!href) return null;
                const img = el.querySelector("img");
                const recTitle = (link.getAttribute("data-title") || img?.getAttribute("alt") || "").trim();
                if (!recTitle || recTitle.match(/^\d+:\d+$/)) return null;
                const recPoster = img?.getAttribute("data-mediumthumb") || img?.getAttribute("src") || "";
                if (!recPoster || recPoster.includes("data:image")) return null;
                return new MultimediaItem({ title: recTitle, url: fixUrl(href), posterUrl: recPoster, type: "movie" });
            }).filter(Boolean);

            cb({
                success: true,
                data: new MultimediaItem({
                    title,
                    url,
                    posterUrl: poster,
                    type: "movie",
                    description,
                    tags: tags.length ? tags : undefined,
                    cast: cast.length ? cast : undefined,
                    recommendations: recommendations.length ? recommendations : undefined,
                    episodes: [
                        new Episode({ name: title, url, season: 1, episode: 1, posterUrl: poster || undefined })
                    ]
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

            // CloudStream: tìm script chứa "var flashvars", parse JSON sau " = " và trước ";"
            const scriptMatch = res.body.match(/var flashvars_\d+\s*=\s*(\{[\s\S]*?\});\s*\n/);
            if (!scriptMatch) return cb({ success: true, data: [] });

            let flashvars;
            try {
                flashvars = JSON.parse(scriptMatch[1]);
            } catch (e) {
                return cb({ success: true, data: [] });
            }

            const mediaDefinitions = flashvars.mediaDefinitions;
            if (!Array.isArray(mediaDefinitions)) return cb({ success: true, data: [] });

            const streams = mediaDefinitions
                .filter(m => m.videoUrl && m.videoUrl.trim() !== "")
                .map(m => {
                    const quality = String(m.quality || "");
                    const format = m.format || "";
                    return new StreamResult({
                        url: m.videoUrl,
                        source: quality ? `PornHub ${quality}p` : "PornHub",
                        headers: { "Referer": BASE_URL + "/" }
                    });
                });

            // Sort: chất lượng cao nhất lên đầu
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
