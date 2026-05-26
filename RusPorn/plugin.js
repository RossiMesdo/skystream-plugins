(function() {
    /**
     * Rusporn Plugin for SkyStream
     * Site: https://en.rusporn.center
     * Ported from: Cs-GizliKeyif CloudStream repo
     * Author: Lord
     */

    const BASE_URL = manifest.baseUrl;
    const HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:137.0) Gecko/20100101 Firefox/137.0",
        "Referer": BASE_URL + "/"
    };

    const CATEGORIES = [
        { name: "Amateur",      url: `${BASE_URL}/domashneye/` },
        { name: "Anal",         url: `${BASE_URL}/anal/` },
        { name: "Asians",       url: `${BASE_URL}/aziatki/` },
        { name: "Big Ass",      url: `${BASE_URL}/bolshiye-popki/` },
        { name: "Big Dick",     url: `${BASE_URL}/bolshiye-chleny/` },
        { name: "Big Tits",     url: `${BASE_URL}/bolshiye-doyki/` },
        { name: "Blondes",      url: `${BASE_URL}/blondinki/` },
        { name: "Lesbians",     url: `${BASE_URL}/lesbiyanki/` },
        { name: "Massage",      url: `${BASE_URL}/massazh/` },
        { name: "Masturbation", url: `${BASE_URL}/masturbatsiya/` },
        { name: "Mature",       url: `${BASE_URL}/zrelye/` },
        { name: "MILF",         url: `${BASE_URL}/mamki/` },
        { name: "Blacked",      url: `${BASE_URL}/negry/` },
        { name: "Teen",         url: `${BASE_URL}/molodyye/` },
    ];

    function fixUrl(u) {
        if (!u) return "";
        if (u.startsWith("//")) return "https:" + u;
        if (u.startsWith("/")) return BASE_URL + u;
        return u;
    }

    // CloudStream: page 1 = URL gốc, page 2+ = URL/page-N/
    function buildPageUrl(base, page) {
        if (page <= 1) return base;
        return base.replace(/\/$/, "") + `/page-${page}/`;
    }

    // CloudStream: div#preview
    // title từ div.preview-name a || div.title a || h1
    // poster từ img[src]
    function parseItems(doc) {
        return Array.from(doc.querySelectorAll("div#preview")).map(el => {
            const title = el.querySelector("div.preview-name a, div.title a")?.textContent?.trim()
                || el.querySelector("h1")?.textContent?.trim();
            if (!title) return null;
            const url = fixUrl(
                el.querySelector("div.preview-images a, div.title a")?.getAttribute("href")
                || el.querySelector("a")?.getAttribute("href") || ""
            );
            if (!url) return null;
            const poster = fixUrl(
                el.querySelector("img")?.getAttribute("src")
                || el.querySelector("div.preview-images img")?.getAttribute("src") || ""
            );
            if (!poster) return null;
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
            // CloudStream: /search/?text={query}
            const res = await http_get(
                `${BASE_URL}/search/?text=${encodeURIComponent(query)}`,
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

            // CloudStream: h1 fallback title tag substringBefore " - HD porn online"
            const title = doc.querySelector("h1")?.textContent?.trim()
                || (doc.querySelector("title")?.textContent?.trim() || "").split(" - HD porn online")[0];
            if (!title) return cb({ success: false, errorCode: "PARSE_ERROR", message: "No title" });

            const poster = fixUrl(
                doc.querySelector("meta[property='og:image']")?.getAttribute("content")
                || doc.querySelector("div.story-description img")?.getAttribute("src")
                || doc.querySelector("div.preview-images img")?.getAttribute("src") || ""
            );

            // CloudStream: description từ div.story-description#ivideo_info fallback meta[name=description]
            const description = doc.querySelector("div.story-description#ivideo_info")?.textContent?.trim()
                || doc.querySelector("meta[name='description']")?.getAttribute("content")?.trim() || "";

            // CloudStream: tags từ div.video-categories a
            const tags = Array.from(doc.querySelectorAll("div.video-categories a"))
                .map(a => a.textContent.trim()).filter(Boolean);

            // CloudStream: recommendations từ div#preview
            const recommendations = Array.from(doc.querySelectorAll("div#preview")).map(el => {
                const recTitle = el.querySelector("div.preview-name a")?.textContent?.trim();
                if (!recTitle) return null;
                const recUrl = fixUrl(el.querySelector("div.preview-images a")?.getAttribute("href") || "");
                if (!recUrl) return null;
                const recPoster = fixUrl(el.querySelector("div.preview-images img")?.getAttribute("src") || "");
                return new MultimediaItem({ title: recTitle, url: recUrl, posterUrl: recPoster, type: "movie" });
            }).filter(Boolean);

            cb({
                success: true,
                data: new MultimediaItem({
                    title, url, posterUrl: poster, type: "movie", description,
                    tags: tags.length ? tags : undefined,
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

            // CloudStream: tìm script chứa "var player"
            // Regex: \[(\d+p)\]\s*([^,\]]+)
            const scriptMatch = res.body.match(/<script[^>]*>([\s\S]*?var player[\s\S]*?)<\/script>/i);
            if (!scriptMatch) return cb({ success: true, data: [] });

            const scriptContent = scriptMatch[1];

            // Parse tất cả quality + url pairs
            const regex = /\[(\d+p)\]\s*([^,\]\s'"]+)/g;
            const streams = [];
            let m;
            while ((m = regex.exec(scriptContent)) !== null) {
                const quality = m[1];
                const streamUrl = m[2].trim();
                if (!streamUrl.startsWith("http")) continue;
                streams.push({ quality, url: streamUrl });
            }

            // CloudStream: sortedByDescending quality
            streams.sort((a, b) => {
                const qa = parseInt(a.quality) || 0;
                const qb = parseInt(b.quality) || 0;
                return qb - qa;
            });

            cb({
                success: true,
                data: streams.map(s => new StreamResult({
                    url: s.url,
                    source: `Rusporn ${s.quality}`,
                    headers: { "Referer": BASE_URL + "/" }
                }))
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
