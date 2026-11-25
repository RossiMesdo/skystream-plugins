(function () {
    const BASE_URL = manifest.baseUrl;
    const HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/132.0 Safari/537.36",
        "Referer": `${BASE_URL}/en`
    };
    const CATEGORIES = [
        { name: "New", url: `${BASE_URL}/en/new` },
        { name: "Hot", url: `${BASE_URL}/en/hot` },
        { name: "Recent", url: `${BASE_URL}/en/recent` },
        { name: "Weekly", url: `${BASE_URL}/en/all?sort=week` },
        { name: "Uncensored", url: `${BASE_URL}/en/uncensored` },
        { name: "Censored", url: `${BASE_URL}/en/censored` }
    ];

    function fixUrl(url) {
        if (!url) return "";
        if (url.startsWith("//")) return `https:${url}`;
        if (url.startsWith("/")) return BASE_URL + url;
        return url;
    }

    function parseItems(doc) {
        const items = [];
        const seen = new Set();
        doc.querySelectorAll(".card").forEach(card => {
            const link = card.querySelector(".card__title a") || card.querySelector(".card__cover");
            const url = fixUrl(link?.getAttribute("href"));
            const title = (link?.getAttribute("title") || link?.textContent || "").trim();
            if (!url || !title || seen.has(url)) return;
            seen.add(url);
            const img = card.querySelector(".card__img");
            items.push(new MultimediaItem({
                title,
                url,
                posterUrl: fixUrl(img?.getAttribute("data-src") || img?.getAttribute("src")),
                type: "movie",
                isAdult: true,
                contentRating: "18+"
            }));
        });
        return items;
    }

    async function getHome(cb) {
        try {
            const home = {};
            await Promise.all(CATEGORIES.map(async category => {
                try {
                    const res = await http_get(category.url, HEADERS);
                    if (!res?.body) return;
                    const items = parseItems(await parseHtml(res.body));
                    if (items.length) home[category.name] = items;
                } catch (_) {}
            }));
            cb({ success: true, data: home });
        } catch (e) {
            cb({ success: false, errorCode: "HOME_ERROR", message: e.message });
        }
    }

    async function search(query, cb) {
        try {
            const url = `${BASE_URL}/en/search?keyword=${encodeURIComponent(query)}`;
            const res = await http_get(url, HEADERS);
            if (!res?.body) return cb({ success: true, data: [] });
            cb({ success: true, data: parseItems(await parseHtml(res.body)) });
        } catch (e) {
            cb({ success: false, errorCode: "SEARCH_ERROR", message: e.message });
        }
    }

    async function load(url, cb) {
        try {
            const res = await http_get(url, HEADERS);
            if (!res?.body) return cb({ success: false, errorCode: "SITE_OFFLINE" });
            const doc = await parseHtml(res.body);
            const title = doc.querySelector("h1")?.textContent?.trim()
                || doc.querySelector("meta[property='og:title']")?.getAttribute("content")?.trim();
            if (!title) return cb({ success: false, errorCode: "PARSE_ERROR", message: "No video title" });
            const poster = doc.querySelector("meta[property='og:image']")?.getAttribute("content") || "";
            const description = doc.querySelector("meta[property='og:description']")?.getAttribute("content") || "";
            cb({ success: true, data: new MultimediaItem({
                title, url, posterUrl: fixUrl(poster), description, type: "movie", isAdult: true, contentRating: "18+",
                episodes: [new Episode({ name: title, url, season: 1, episode: 1, posterUrl: fixUrl(poster) || undefined })]
            }) });
        } catch (e) {
            cb({ success: false, errorCode: "LOAD_ERROR", message: e.message });
        }
    }

    async function loadStreams(url, cb) {
        try {
            const res = await http_get(url, HEADERS);
            if (!res?.body) return cb({ success: true, data: [] });
            // 123AV stores its playable /e/ embed URLs in a JSON string passed to player().
            const normalized = res.body.replace(/\\u0022/g, '"').replace(/\\+\//g, "/");
            const candidates = normalized.match(/https?:\/\/[^"'<>\s]+\/e\/[A-Za-z0-9]+(?:\?[^"'<>\s]*)?/g) || [];
            const streams = [];
            const seen = new Set();
            for (const candidate of candidates) {
                const embedUrl = candidate.replace(/&amp;/g, "&").replace(/[),;]+$/, "");
                if (seen.has(embedUrl)) continue;
                seen.add(embedUrl);
                if (typeof loadExtractor === "function") {
                    const extracted = await loadExtractor(embedUrl);
                    if (Array.isArray(extracted) && extracted.length) {
                        extracted.forEach(stream => { stream.source = "123AV"; streams.push(stream); });
                        continue;
                    }
                }
                streams.push(new StreamResult({ url: embedUrl, source: "123AV Embed", headers: { ...HEADERS, Referer: url } }));
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
