(function () {
    const BASE_URL = manifest.baseUrl.replace(/\/$/, "");
    const HEADERS = { "User-Agent": "Mozilla/5.0", "Referer": BASE_URL + "/" };
    const CATEGORIES = [
        { name: "OnlyFans", path: "category/onlyfans" },
        { name: "Femdom", path: "category/femdom" },
        { name: "ASMR", path: "category/asmr" },
        { name: "Patreon", path: "category/patreon" },
        { name: "ManyVids", path: "category/manyvids" },
        { name: "TikTok", path: "category/tiktok" },
        { name: "Webcam", path: "category/webcam" },
        { name: "Snapchat", path: "category/snapchat" }
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
        return Array.from(doc.querySelectorAll("article")).map(card => {
            const link = card.querySelector("header > h2 > a");
            const title = link?.textContent?.trim() || "";
            const url = absolute(link?.getAttribute("href") || "", BASE_URL);
            const poster = absolute(card.querySelector("header > a > img")?.getAttribute("data-src") || "", BASE_URL);
            if (!title || !url) return null;
            return new MultimediaItem({ title, url, posterUrl: poster, type: "movie" });
        }).filter(Boolean);
    }
    async function getHome(cb) {
        const home = {};
        try {
            await Promise.all(CATEGORIES.map(async category => {
                try {
                    const res = await http_get(`${BASE_URL}/${category.path}/page/1/`, HEADERS);
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
            const res = await http_get(`${BASE_URL}/page/1/?s=${encodeURIComponent(query)}&id=5036`, HEADERS);
            if (!res || res.status < 200 || res.status >= 400) return cb({ success: true, data: [] });
            cb({ success: true, data: parseItems(await parseHtml(res.body)) });
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
            const description = doc.querySelector("meta[property='og:description']")?.getAttribute("content")?.trim() || "";
            if (!title) return cb({ success: false, errorCode: "PARSE_ERROR", message: "Missing title" });
            cb({ success: true, data: new MultimediaItem({ title, url, posterUrl: poster, description, type: "movie",
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
        const candidates = [];
        for (const node of Array.from(doc.querySelectorAll("video source[src], video[src], video a[href]"))) {
            const value = node.getAttribute("src") || node.getAttribute("href") || "";
            if (value) candidates.push(absolute(value, url));
        }
        const pattern = /(?:file|src|hls|url)\s*[:=]\s*["'](https?:\\?\/\\?\/[^"']+?\.(?:m3u8|mp4)(?:\?[^"']*)?)["']/gi;
        let match;
        while ((match = pattern.exec(res.body)) !== null) candidates.push(match[1].replace(/\\\//g, "/"));
        const direct = Array.from(new Set(candidates.filter(value => /\.(?:m3u8|mp4)(?:[?#]|$)/i.test(value))));
        if (direct.length) return direct;
        for (const frame of Array.from(doc.querySelectorAll("iframe[src], iframe[data-src], iframe[data-litespeed-src]"))) {
            const next = frame.getAttribute("data-litespeed-src") || frame.getAttribute("data-src") || frame.getAttribute("src") || "";
            const nested = await resolveEmbed(absolute(next, url), url, depth + 1, visited);
            if (nested.length) return nested;
        }
        return [];
    }
    async function loadStreams(url, cb) {
        try {
            const res = await http_get(url, HEADERS);
            if (!res || !res.body) return cb({ success: true, data: [] });
            const doc = await parseHtml(res.body);
            const embeds = [];
            for (const button of Array.from(doc.querySelectorAll("article > div > div > button"))) {
                const onclick = button.getAttribute("onclick") || "";
                const match = onclick.match(/playEmbed\(['"]([^'"]+)['"]\)/);
                if (match) embeds.push(absolute(match[1], url));
            }
            const streams = [];
            const seen = new Set();
            for (const embed of Array.from(new Set(embeds))) {
                let found = [];
                if (typeof loadExtractor === "function") {
                    try {
                        const extracted = await loadExtractor(embed, url);
                        if (Array.isArray(extracted)) streams.push(...extracted);
                    } catch (_) {}
                }
                found = await resolveEmbed(embed, url, 0, new Set());
                for (const streamUrl of found) {
                    if (seen.has(streamUrl)) continue;
                    seen.add(streamUrl);
                    streams.push(new StreamResult({ url: streamUrl, source: "InternetChicks",
                        headers: { "Referer": embed, "User-Agent": HEADERS["User-Agent"] } }));
                }
            }
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
