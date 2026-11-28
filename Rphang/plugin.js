(function () {
    const BASE_URL = manifest.baseUrl;
    const HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/132.0 Safari/537.36",
        "Referer": `${BASE_URL}/`
    };

    function fixUrl(url) {
        if (!url) return "";
        if (url.startsWith("//")) return `https:${url}`;
        return new URL(url, BASE_URL).href;
    }

    function parseThreads(doc) {
        const items = [];
        const seen = new Set();
        doc.querySelectorAll('a[href*="/t/"]').forEach(link => {
            const url = fixUrl(link.getAttribute("href"));
            const title = link.textContent?.trim();
            if (!url || !title || seen.has(url) || title.length < 3) return;
            seen.add(url);
            const row = link.closest(".structItem, .block-row, .contentRow, article") || link.parentElement;
            const img = row?.querySelector("img");
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
            const res = await http_get(BASE_URL, HEADERS);
            if (!res?.body) return cb({ success: false, errorCode: "SITE_OFFLINE" });
            cb({ success: true, data: { "Latest threads": parseThreads(await parseHtml(res.body)) } });
        } catch (e) {
            cb({ success: false, errorCode: "HOME_ERROR", message: e.message });
        }
    }

    async function search(query, cb) {
        try {
            const res = await http_get(`${BASE_URL}/search/?q=${encodeURIComponent(query)}`, HEADERS);
            if (!res?.body) return cb({ success: true, data: [] });
            cb({ success: true, data: parseThreads(await parseHtml(res.body)) });
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
                || doc.querySelector("title")?.textContent?.trim();
            if (!title) return cb({ success: false, errorCode: "PARSE_ERROR" });
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
            const doc = await parseHtml(res.body);
            const streams = [];
            const direct = new Set();
            const postBodies = doc.querySelectorAll(".message-body .bbWrapper, .message-content .bbWrapper");
            postBodies.forEach(body => {
                body.querySelectorAll("video source[src], video[src]").forEach(node => {
                    const src = fixUrl(node.getAttribute("src"));
                    if (!src || direct.has(src)) return;
                    direct.add(src);
                    streams.push(new StreamResult({ url: src, source: "Rphang Video", headers: { ...HEADERS, Referer: url } }));
                });
            });
            for (const body of Array.from(postBodies)) {
                for (const node of Array.from(body.querySelectorAll("iframe[src]"))) {
                    const src = fixUrl(node.getAttribute("src"));
                    if (!src || direct.has(src)) continue;
                    direct.add(src);
                    if (typeof loadExtractor === "function") {
                        const extracted = await loadExtractor(src);
                        if (Array.isArray(extracted)) extracted.forEach(stream => {
                            stream.source = "Rphang";
                            streams.push(stream);
                        });
                    }
                }
                body.querySelectorAll("a[href]").forEach(link => {
                    const href = link.getAttribute("href") || "";
                    if (!/\/(?:attachments|data\/attachments|data\/attachment-files)\//i.test(href)
                        || !/\.(?:mp4|m3u8|webm|m4v|mov)(?:[./?#]|$)/i.test(href)) return;
                    const src = fixUrl(href);
                    if (!src || direct.has(src)) return;
                    direct.add(src);
                    streams.push(new StreamResult({ url: src, source: "Rphang MP4", headers: { ...HEADERS, Referer: url } }));
                });
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
