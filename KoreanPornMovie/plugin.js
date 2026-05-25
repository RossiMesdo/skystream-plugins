(function() {
    /**
     * KoreanPornMovie Plugin for SkyStream
     * Site: https://koreanpornmovie.com
     * Ported from: Cs-GizliKeyif CloudStream repo
     * Author: Lord
     */

    const BASE_URL = manifest.baseUrl;
    const HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:137.0) Gecko/20100101 Firefox/137.0",
        "Referer": BASE_URL + "/"
    };

    const CATEGORIES = [
        { name: "Latest",   url: `${BASE_URL}/?filter=latest` },
        { name: "Longest",  url: `${BASE_URL}/?filter=longest` },
        { name: "Random",   url: `${BASE_URL}/?filter=random` },
    ];

    function fixUrl(u) {
        if (!u) return "";
        if (u.startsWith("//")) return "https:" + u;
        if (u.startsWith("/")) return BASE_URL + u;
        return u;
    }

    // CloudStream: page 1 = /?filter=X, page 2+ = /page/N/?filter=X
    function buildPageUrl(base, page) {
        if (page <= 1) return base;
        const [path, query] = base.split("?");
        return `${path.replace(/\/$/, "")}/page/${page}/?${query}`;
    }

    // CloudStream: div.videos-list article
    // title từ header.entry-header span
    // poster từ article[data-main-thumb] fallback img[src]
    function parseItems(doc) {
        return Array.from(doc.querySelectorAll("div.videos-list article")).map(el => {
            const title = el.querySelector("header.entry-header span")?.textContent?.trim();
            if (!title) return null;
            const url = fixUrl(el.querySelector("a")?.getAttribute("href") || "");
            if (!url) return null;
            const dataSrc = el.getAttribute("data-main-thumb") || "";
            const img = el.querySelector("img");
            const poster = fixUrl(dataSrc || img?.getAttribute("src") || "");
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
            // CloudStream: page 1 = /?s=query, page 2+ = /page/N/?s=query
            const res = await http_get(`${BASE_URL}/?s=${encodeURIComponent(query)}`, HEADERS);
            if (!res || res.status !== 200) return cb({ success: true, data: [] });
            const doc = await parseHtml(res.body);
            const items = Array.from(doc.querySelectorAll("div article")).map(el => {
                const title = el.querySelector("header.entry-header span")?.textContent?.trim();
                if (!title) return null;
                const url = fixUrl(el.querySelector("a")?.getAttribute("href") || "");
                if (!url) return null;
                const dataSrc = el.getAttribute("data-main-thumb") || "";
                const img = el.querySelector("img");
                const poster = fixUrl(dataSrc || img?.getAttribute("src") || "");
                return new MultimediaItem({ title, url, posterUrl: poster, type: "movie" });
            }).filter(Boolean);
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

            // CloudStream: header.entry-header h1, header.entry-header span
            const title = doc.querySelector("header.entry-header h1")?.textContent?.trim()
                || doc.querySelector("header.entry-header span")?.textContent?.trim();
            if (!title) return cb({ success: false, errorCode: "PARSE_ERROR", message: "No title" });

            // CloudStream: poster từ iframe → video[poster]
            let poster = "";
            const iframeSrc = fixUrl(doc.querySelector("div.responsive-player iframe")?.getAttribute("src") || "");
            if (iframeSrc) {
                try {
                    const iframeRes = await http_get(iframeSrc, HEADERS);
                    if (iframeRes && iframeRes.body) {
                        const iframeDoc = await parseHtml(iframeRes.body);
                        poster = fixUrl(iframeDoc.querySelector("video")?.getAttribute("poster") || "");
                    }
                } catch (e) {}
            }

            // CloudStream: description từ div.desc p → split "synopsis"
            const descParts = Array.from(doc.querySelectorAll("div.desc p"))
                .map(p => p.textContent.trim()).join(" ");
            const synopsisIdx = descParts.toLowerCase().indexOf("synopsis");
            const description = synopsisIdx !== -1
                ? descParts.substring(synopsisIdx + "synopsis".length).replace(/^[\s:]+/, "").trim()
                : descParts;

            // CloudStream: year từ div#video-date regex \d{4}
            const dateText = doc.querySelector("div#video-date")?.textContent || "";
            const yearMatch = dateText.match(/\d{4}/);
            const year = yearMatch ? parseInt(yearMatch[0]) : undefined;

            // CloudStream: tags từ a[rel=category], a[rel=tag]
            const tags = Array.from(doc.querySelectorAll("a[rel='category'], a[rel='tag']"))
                .map(a => a.textContent.trim()).filter(Boolean);

            // CloudStream: actors từ div#video-actors a
            const cast = Array.from(doc.querySelectorAll("div#video-actors a")).map(a => {
                const name = a.textContent.trim();
                return name ? new Actor({ name }) : null;
            }).filter(Boolean);

            // CloudStream: recommendations từ div.under-video-block div article
            const recommendations = Array.from(
                doc.querySelectorAll("div.under-video-block div article")
            ).map(el => {
                const recTitle = el.querySelector("header.entry-header span")?.textContent?.trim();
                if (!recTitle) return null;
                const recUrl = fixUrl(el.querySelector("a")?.getAttribute("href") || "");
                if (!recUrl) return null;
                const recPoster = fixUrl(el.getAttribute("data-main-thumb") || el.querySelector("img")?.getAttribute("src") || "");
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
            const doc = await parseHtml(res.body);

            const streams = [];

            // CloudStream tầng 1: iframe → loadExtractor
            const iframes = Array.from(doc.querySelectorAll("iframe"))
                .map(el => fixUrl(el.getAttribute("src") || ""))
                .filter(Boolean);

            for (const iframeSrc of iframes) {
                try {
                    const iframeRes = await http_get(iframeSrc, {
                        ...HEADERS,
                        "Referer": url
                    });
                    if (!iframeRes || !iframeRes.body) continue;
                    const iframeDoc = await parseHtml(iframeRes.body);

                    // Tìm video source trong iframe
                    iframeDoc.querySelectorAll("video source, source").forEach(s => {
                        const src = fixUrl(s.getAttribute("src") || "");
                        if (src) streams.push(new StreamResult({
                            url: src,
                            source: "KoreanPornMovie",
                            headers: { "Referer": iframeSrc }
                        }));
                    });

                    // Tìm file: trong script
                    const scriptMatch = iframeRes.body.match(/["']?file["']?\s*:\s*["']([^"']+)["']/i);
                    if (scriptMatch) {
                        const src = fixUrl(scriptMatch[1]);
                        if (src && !streams.find(s => s.url === src)) {
                            streams.push(new StreamResult({
                                url: src,
                                source: "KoreanPornMovie",
                                headers: { "Referer": iframeSrc }
                            }));
                        }
                    }
                } catch (e) {}
            }

            // CloudStream tầng 2: direct MP4 từ title
            // "https://koreanporn.stream/{title}.mp4"
            const titleEl = doc.querySelector("header.entry-header h1")
                || doc.querySelector("header.entry-header span");
            const title = titleEl?.textContent?.trim();
            if (title) {
                const directUrl = `https://koreanporn.stream/${encodeURIComponent(title)}.mp4`;
                streams.push(new StreamResult({
                    url: directUrl,
                    source: "KoreanPornMovie Direct",
                    headers: { "Referer": BASE_URL + "/" }
                }));
            }

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
