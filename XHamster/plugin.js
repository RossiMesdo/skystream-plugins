(function() {
    /**
     * xHamster Plugin for SkyStream
     * Site: https://xhamster.com
     * Ported from: Cs-GizliKeyif CloudStream repo
     * Author: Lord
     */

    const BASE_URL = manifest.baseUrl;
    const HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:137.0) Gecko/20100101 Firefox/137.0",
        "Referer": BASE_URL + "/",
        "Cookie": "video_titles_translation=0"
    };

    const CATEGORIES = [
        { name: "Newest",               url: `${BASE_URL}/newest/` },
        { name: "Weekly Most Viewed",   url: `${BASE_URL}/most-viewed/weekly/` },
        { name: "Monthly Most Viewed",  url: `${BASE_URL}/most-viewed/monthly/` },
        { name: "All Time Most Viewed", url: `${BASE_URL}/most-viewed/` },
        { name: "4K",                   url: `${BASE_URL}/4k/` },
        { name: "1080p",                url: `${BASE_URL}/hd/2?quality=1080p` },
        { name: "Teen",                 url: `${BASE_URL}/categories/teen` },
        { name: "Mom",                  url: `${BASE_URL}/categories/mom` },
        { name: "MILF",                 url: `${BASE_URL}/categories/milf` },
        { name: "Mature",               url: `${BASE_URL}/categories/mature` },
        { name: "Big Ass",              url: `${BASE_URL}/categories/big-ass` },
        { name: "Anal",                 url: `${BASE_URL}/categories/anal` },
        { name: "Hardcore",             url: `${BASE_URL}/categories/hardcore` },
        { name: "Homemade",             url: `${BASE_URL}/categories/homemade` },
        { name: "Amateur",              url: `${BASE_URL}/categories/amateur` },
        { name: "Compilation",          url: `${BASE_URL}/categories/complilation` },
        { name: "Lesbian",              url: `${BASE_URL}/categories/lesbian` },
        { name: "Russian",              url: `${BASE_URL}/categories/russian` },
        { name: "European",             url: `${BASE_URL}/categories/european` },
        { name: "Latina",               url: `${BASE_URL}/categories/latina` },
        { name: "Asian",                url: `${BASE_URL}/categories/asian` },
        { name: "JAV",                  url: `${BASE_URL}/categories/jav` },
    ];

    function fixUrl(u) {
        if (!u) return "";
        if (u.startsWith("//")) return "https:" + u;
        if (u.startsWith("/")) return BASE_URL + u;
        return u;
    }

    // CloudStream: "${request.data}/$page?geo=us"
    // Tức /newest/1?geo=us, /newest/2?geo=us
    function buildPageUrl(base, page) {
        const clean = base.replace(/\/$/, "");
        return `${clean}/${page}?geo=us`;
    }

    // CloudStream: div.thumb-list div.thumb-list__item
    // title + href từ a.video-thumb-info__name
    // poster từ img.thumb-image-container__image[src]
    function parseItems(doc) {
        return Array.from(doc.querySelectorAll("div.thumb-list div.thumb-list__item")).map(el => {
            const link = el.querySelector("a.video-thumb-info__name");
            if (!link) return null;
            const title = link.textContent.trim();
            const url = fixUrl(link.getAttribute("href") || "");
            if (!title || !url) return null;
            const img = el.querySelector("img.thumb-image-container__image");
            const poster = fixUrl(img?.getAttribute("src") || "");
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
            // CloudStream: query.replace(" ", "+"), page=1
            const q = query.replace(/ /g, "+");
            const res = await http_get(
                `${BASE_URL}/search/${encodeURIComponent(q)}/?page=1&x_platform_switch=desktop&geo=us`,
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
            const res = await http_get(`${url}?geo=us`, HEADERS);
            if (!res || res.status !== 200) return cb({ success: false, errorCode: "SITE_OFFLINE" });
            const doc = await parseHtml(res.body);

            // CloudStream: div.with-player-container h1
            const title = doc.querySelector("div.with-player-container h1")?.textContent?.trim() || "";
            if (!title) return cb({ success: false, errorCode: "PARSE_ERROR", message: "No title" });

            // CloudStream: div.xp-preload-image style → substringAfter("https:").substringBefore("');")
            let poster = "";
            const preloadDiv = doc.querySelector("div.xp-preload-image");
            if (preloadDiv) {
                const style = preloadDiv.getAttribute("style") || "";
                const afterHttps = style.split("https:")[1];
                if (afterHttps) poster = "https:" + afterHttps.split("');")[0];
            }

            const description = doc.querySelector("div.controls-info div.ab-info p")
                ?.textContent?.trim()?.replace(/\s+/g, " ") || "";

            // CloudStream: div[data-role='video-tags-list'] a[href*='/categories/'] + a[href*='/tags/']
            const tags = Array.from(
                doc.querySelectorAll("div[data-role='video-tags-list'] a[href*='/categories/'], div[data-role='video-tags-list'] a[href*='/tags/']")
            ).map(a => a.textContent.trim()).filter(Boolean);

            // CloudStream: a.entity-author-container__name → span (name) + img (image)
            const cast = Array.from(doc.querySelectorAll("a.entity-author-container__name")).map(a => {
                const name = a.querySelector("span")?.textContent?.trim() || "";
                const img = a.querySelector("img");
                const image = fixUrl(img?.getAttribute("src") || img?.getAttribute("data-src") || "");
                return name ? new Actor({ name, image: image || undefined }) : null;
            }).filter(Boolean);

            // CloudStream: div[data-role='related-item']
            // title từ a.video-thumb-info__name, link từ a[data-role='thumb-link']
            const recommendations = Array.from(
                doc.querySelectorAll("div[data-role='related-item']")
            ).map(el => {
                const recTitle = el.querySelector("a.video-thumb-info__name")?.textContent?.trim();
                const recUrl = fixUrl(el.querySelector("a[data-role='thumb-link']")?.getAttribute("href") || "");
                if (!recTitle || !recUrl) return null;
                const img = el.querySelector("img");
                const recPoster = fixUrl(img?.getAttribute("src") || img?.getAttribute("data-src") || "");
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
                    tags: tags.length ? tags : undefined,
                    cast: cast.length ? cast : undefined,
                    recommendations: recommendations.length ? recommendations : undefined,
                    episodes: [{
                        name: "Play",
                        url: `${url}?geo=us`,
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

            // CloudStream: chỉ dùng link[rel=preload][as=fetch] chứa .m3u8
            const streams = [];
            doc.querySelectorAll("link[rel='preload'][as='fetch']").forEach(el => {
                const href = el.getAttribute("href") || "";
                if (!href.includes(".m3u8")) return;
                streams.push(new StreamResult({
                    url: fixUrl(href),
                    source: "xHamster",
                    headers: { "Referer": url }
                }));
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
