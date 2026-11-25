(function () {
    const BASE_URL = manifest.baseUrl.replace(/\/$/, "");
    const HEADERS = { "User-Agent": "Mozilla/5.0", "Referer": BASE_URL + "/" };
    const CATEGORIES = [
        { name: "Home", path: "" },
        { name: "Small Tits", path: "xnxx/small-tits" },
        { name: "Teen", path: "xnxx/teen" },
        { name: "Threesome", path: "xnxx/threesome" }
    ];
    function absolute(url, parent) {
        if (!url) return "";
        if (/^https?:\/\//i.test(url)) return url;
        if (url.startsWith("//")) return "https:" + url;
        const origin = (parent || BASE_URL).match(/^https?:\/\/[^/]+/i)?.[0] || BASE_URL;
        if (url.startsWith("/")) return origin + url;
        const path = (parent || BASE_URL).split("?")[0];
        return path.slice(0, path.lastIndexOf("/") + 1) + url;
    }
    function parseItems(doc) {
        return Array.from(doc.querySelectorAll("div.post-preview-styling")).map(card => {
            const link = card.querySelector("a");
            const title = link?.getAttribute("title")?.trim() || "";
            const url = absolute(link?.getAttribute("href") || "", BASE_URL);
            const img = card.querySelector("a > img");
            const poster = absolute(img?.getAttribute("data-src") || img?.getAttribute("src") || "", BASE_URL);
            if (!title || !url) return null;
            return new MultimediaItem({ title, url, posterUrl: poster, type: "movie" });
        }).filter(Boolean);
    }
    async function getHome(cb) {
        const home = {};
        try {
            await Promise.all(CATEGORIES.map(async category => {
                try {
                    const path = category.path ? `/${category.path}` : "";
                    const res = await http_get(`${BASE_URL}${path}/page/1/`, HEADERS);
                    if (!res || res.status < 200 || res.status >= 400) return;
                    const items = parseItems(await parseHtml(res.body));
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
            const results = [];
            for (let page = 1; page <= 5; page++) {
                const res = await http_get(`${BASE_URL}/page/${page}/?s=${encodeURIComponent(query)}`, HEADERS);
                if (!res || res.status < 200 || res.status >= 400) break;
                const items = parseItems(await parseHtml(res.body));
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
            if (!res || res.status < 200 || res.status >= 400) return cb({ success: false, errorCode: "SITE_OFFLINE" });
            const doc = await parseHtml(res.body);
            const title = doc.querySelector("meta[property='og:title']")?.getAttribute("content")?.trim() || "";
            const poster = absolute(doc.querySelector("meta[property='og:image']")?.getAttribute("content") || "", url);
            if (!title) return cb({ success: false, errorCode: "PARSE_ERROR", message: "Missing title" });
            cb({ success: true, data: new MultimediaItem({ title, url, posterUrl: poster, type: "movie",
                episodes: [{ name: "Play", url, season: 1, episode: 1, posterUrl: poster || undefined }] }) });
        } catch (e) {
            cb({ success: false, errorCode: "PARSE_ERROR", message: String(e?.message || e) });
        }
    }
    async function resolveEmbed(url, referer, depth, visited) {
        if (!url || depth > 4 || visited.has(url)) return [];
        if (/\.(?:m3u8|mp4)(?:[?#]|$)/i.test(url)) return [url];
        visited.add(url);
        const res = await http_get(url, { ...HEADERS, "Referer": referer || BASE_URL + "/" });
        if (!res || !res.body) return [];
        const doc = await parseHtml(res.body);
        const direct = [];
        for (const node of Array.from(doc.querySelectorAll("video source[src], video[src], video a[href]"))) {
            const value = node.getAttribute("src") || node.getAttribute("href") || "";
            if (value) direct.push(absolute(value, url));
        }
        const pattern = /(?:file|src|hls|url)\s*[:=]\s*["'](https?:\\?\/\\?\/[^"']+?\.(?:m3u8|mp4)(?:\?[^"']*)?)["']/gi;
        let match;
        while ((match = pattern.exec(res.body)) !== null) direct.push(match[1].replace(/\\\//g, "/"));
        const streams = Array.from(new Set(direct.filter(value => /\.(?:m3u8|mp4)(?:[?#]|$)/i.test(value))));
        if (streams.length) return streams;
        for (const frame of Array.from(doc.querySelectorAll("iframe[src], iframe[data-src], iframe[data-litespeed-src]"))) {
            const next = frame.getAttribute("data-litespeed-src") || frame.getAttribute("data-src") || frame.getAttribute("src") || "";
            const nested = await resolveEmbed(absolute(next, url), url, depth + 1, visited);
            if (nested.length) return nested;
        }
        return [];
    }
    async function loadStreams(url, cb) {
        try {
            const pageRes = await http_get(url, HEADERS);
            if (!pageRes || !pageRes.body) return cb({ success: true, data: [] });
            const page = await parseHtml(pageRes.body);
            const iframe = page.querySelector("#post > div.wp-video > div > iframe");
            const embed = iframe?.getAttribute("data-litespeed-src") || iframe?.getAttribute("src") || "";
            if (!embed) return cb({ success: true, data: [] });
            const embedUrl = absolute(embed, url);
            const streams = [];
            if (typeof loadExtractor === "function") {
                try {
                    const extracted = await loadExtractor(embedUrl, url);
                    if (Array.isArray(extracted)) streams.push(...extracted);
                } catch (_) {}
            }
            const urls = await resolveEmbed(embedUrl, url, 0, new Set());
            urls.forEach(streamUrl => streams.push(new StreamResult({
                url: streamUrl, source: "YesPornPlease", headers: { "Referer": embedUrl, "User-Agent": HEADERS["User-Agent"] }
            })));
            const unique = [];
            const seen = new Set();
            streams.forEach(stream => {
                if (!stream?.url || seen.has(stream.url)) return;
                seen.add(stream.url);
                unique.push(stream);
            });
            cb({ success: true, data: unique });
        } catch (e) {
            cb({ success: false, errorCode: "STREAM_ERROR", message: String(e?.message || e) });
        }
    }
    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();
