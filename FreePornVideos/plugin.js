(function () {
    const BASE_URL = manifest.baseUrl.replace(/\/$/, "");
    const HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Referer": BASE_URL + "/"
    };
    const CATEGORIES = [
        { name: "Most Popular", path: "most-popular/week" },
        { name: "Brazzers", path: "networks/brazzers-com" },
        { name: "MYLF", path: "networks/mylf-com" },
        { name: "BangBros", path: "networks/bangbros" },
        { name: "Adult Time", path: "networks/adult-time" },
        { name: "Reality Kings", path: "networks/rk-com" },
        { name: "JAV", path: "categories/jav-uncensored" },
        { name: "MILF", path: "networks/mom-lover" }
    ];

    function fixUrl(url) {
        if (!url) return "";
        if (/^https?:\/\//i.test(url)) return url;
        if (url.startsWith("//")) return "https:" + url;
        return BASE_URL + (url.startsWith("/") ? "" : "/") + url;
    }

    function text(el, selector) {
        return el?.querySelector(selector)?.textContent?.trim() || "";
    }

    function imageUrl(el) {
        if (!el) return "";
        const raw = el.getAttribute("data-src") || el.getAttribute("data-lazy-src") ||
            el.getAttribute("srcset")?.split(",")[0]?.trim()?.split(/\s+/)[0] ||
            el.getAttribute("src") || "";
        return fixUrl(raw);
    }

    function parseItems(doc, selector) {
        return Array.from(doc.querySelectorAll(selector)).map(card => {
            const link = card.querySelector("a");
            const title = text(card, "strong.title") || link?.getAttribute("title")?.trim() || "";
            const url = fixUrl(link?.getAttribute("href") || "");
            if (!title || !url) return null;
            return new MultimediaItem({
                title,
                url,
                posterUrl: imageUrl(card.querySelector("a img")),
                type: "movie"
            });
        }).filter(Boolean);
    }

    function pageItems(doc) {
        return parseItems(doc, "#list_videos_common_videos_list_items > div.item, #custom_list_videos_videos_list_search_result_items > div.item");
    }

    function directText(el) {
        return Array.from(el.childNodes || [])
            .filter(node => node.nodeType === 3)
            .map(node => node.textContent || "")
            .join(" ")
            .trim();
    }

    function labeledDiv(doc, label) {
        const pattern = new RegExp("^\\s*" + label + ":", "i");
        return Array.from(doc.querySelectorAll("div")).find(el => pattern.test(directText(el)));
    }

    function descriptionValue(doc) {
        const meta = doc.querySelector("meta[property='og:description']")?.getAttribute("content")?.trim();
        if (meta) return meta;
        return labeledDiv(doc, "Description")?.querySelector("em")?.textContent?.trim() || "";
    }

    function linkValuesFromLabel(doc, label) {
        const block = labeledDiv(doc, label);
        return block ? Array.from(block.querySelectorAll("a"))
            .map(a => a.textContent.trim()).filter(Boolean) : [];
    }

    async function getHome(cb) {
        const home = {};
        try {
            await Promise.all(CATEGORIES.map(async category => {
                try {
                    const res = await http_get(`${BASE_URL}/${category.path}/1/`, HEADERS);
                    if (!res || res.status < 200 || res.status >= 400) return;
                    const items = pageItems(await parseHtml(res.body));
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
            const slug = String(query || "")
                .normalize("NFKD")
                .replace(/[^\p{L}\p{N}\s]/gu, "")
                .trim()
                .replace(/\s+/g, "-")
                .toLowerCase();
            const results = [];
            for (let page = 1; page <= 5; page++) {
                const res = await http_get(`${BASE_URL}/search/${encodeURIComponent(slug)}/${page}`, HEADERS);
                if (!res || res.status < 200 || res.status >= 400) break;
                const items = pageItems(await parseHtml(res.body));
                if (!items.length) break;
                results.push(...items);
            }
            cb({ success: true, data: results });
        } catch (e) {
            cb({ success: false, errorCode: "SEARCH_ERROR", message: String(e?.message || e) });
        }
    }

    async function load(url, cb) {
        try {
            const res = await http_get(url, HEADERS);
            if (!res || res.status < 200 || res.status >= 400) {
                return cb({ success: false, errorCode: "SITE_OFFLINE" });
            }
            const doc = await parseHtml(res.body);
            const fullTitle = text(doc, "div.headline > h1") ||
                doc.querySelector("meta[property='og:title']")?.getAttribute("content")?.trim() || "";
            if (!fullTitle) return cb({ success: false, errorCode: "PARSE_ERROR", message: "Missing title" });

            const titleWithoutYear = fullTitle.replace(/\s+-\s+\d{4}\s*$/, "");
            const title = titleWithoutYear.replace(/^\s*-\s*/, "").replace(/\s*-\s*$/, "").trim();
            const yearMatch = fullTitle.match(/\b(19|20)\d{2}\s*$/);
            const poster = fixUrl(doc.querySelector("meta[property='og:image']")?.getAttribute("content") || "");
            const tags = linkValuesFromLabel(doc, "Categories");
            const cast = linkValuesFromLabel(doc, "Models").map(name => new Actor({ name }));
            const recommendations = parseItems(doc, "div#list_videos_related_videos_items div.item");
            const ratingText = text(doc, "div.rating span").replace("%", "").trim();
            const score = Number.parseFloat(ratingText);
            const durationText = Array.from(doc.querySelectorAll("span"))
                .find(el => /Duration/i.test(el.textContent || ""))?.textContent?.trim() || "";
            const durationParts = (durationText.match(/\d+/g) || []).map(Number);
            let duration;
            if (durationParts.length === 3) duration = durationParts[0] * 60 + durationParts[1];
            else if (durationParts.length === 2) duration = durationParts[0];
            else if (durationParts.length === 1) duration = durationParts[0];

            cb({
                success: true,
                data: new MultimediaItem({
                    title,
                    url,
                    posterUrl: poster,
                    type: "movie",
                    description: descriptionValue(doc),
                    year: yearMatch ? Number(yearMatch[0]) : undefined,
                    tags: tags.length ? tags : undefined,
                    cast: cast.length ? cast : undefined,
                    recommendations: recommendations.length ? recommendations : undefined,
                    score: Number.isFinite(score) ? score / 10 : undefined,
                    duration,
                    episodes: [{ name: "Play", url, season: 1, episode: 1, posterUrl: poster || undefined }]
                })
            });
        } catch (e) {
            cb({ success: false, errorCode: "PARSE_ERROR", message: String(e?.message || e) });
        }
    }

    async function loadStreams(url, cb) {
        try {
            const res = await http_get(url, HEADERS);
            if (!res || !res.body) return cb({ success: true, data: [] });
            const doc = await parseHtml(res.body);
            const streams = Array.from(doc.querySelectorAll("video source"))
                .map(source => {
                    const streamUrl = fixUrl(source.getAttribute("src") || "");
                    if (!streamUrl) return null;
                    const label = source.getAttribute("label") || source.getAttribute("res") || "Auto";
                    return new StreamResult({
                        url: streamUrl,
                        source: `Free Porn Videos ${label}`,
                        headers: { "Referer": url, "User-Agent": HEADERS["User-Agent"] }
                    });
                }).filter(Boolean);
            cb({ success: true, data: streams });
        } catch (e) {
            cb({ success: false, errorCode: "STREAM_ERROR", message: String(e?.message || e) });
        }
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();

