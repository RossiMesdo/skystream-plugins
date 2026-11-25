(function () {
    const BASE_URL = manifest.baseUrl.replace(/\/$/, "");
    const HEADERS = {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Referer": BASE_URL + "/"
    };
    const CATEGORIES = [
        { name: "Latest", path: "/onlyfans-videos/{page}/" },
        { name: "Most Viewed (Week)", path: "/onlyfans-videos/{page}/?p=video_viewed&post_date_from=7" },
        { name: "Roleplay", path: "/categories/roleplay-fantasy/{page}/" },
        { name: "Pornstars", path: "/categories/pornstar/{page}/" },
        { name: "Most Viewed (Month)", path: "/onlyfans-videos/{page}/?p=video_viewed&post_date_from=30" },
        { name: "Most Viewed (All Time)", path: "/onlyfans-videos/{page}/?p=video_viewed" }
    ];
    function fixUrl(url) {
        if (!url) return "";
        if (/^https?:\/\//i.test(url)) return url;
        if (url.startsWith("//")) return "https:" + url;
        return BASE_URL + (url.startsWith("/") ? "" : "/") + url;
    }
    function parseItems(doc) {
        return Array.from(doc.querySelectorAll("div.item")).map(card => {
            const link = card.querySelector("a");
            const title = link?.getAttribute("title")?.trim() || "";
            const url = fixUrl(link?.getAttribute("href") || "");
            const poster = fixUrl(card.querySelector("img")?.getAttribute("data-webp") || card.querySelector("img")?.getAttribute("src") || "");
            if (!title || !url) return null;
            return new MultimediaItem({ title, url, posterUrl: poster, type: "movie" });
        }).filter(Boolean);
    }
    async function getHome(cb) {
        const home = {};
        try {
            await Promise.all(CATEGORIES.map(async category => {
                try {
                    const path = category.path.replace("{page}", "1");
                    const res = await http_get(BASE_URL + path, HEADERS);
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
            const q = encodeURIComponent(query);
            const url = `${BASE_URL}/search/${q}/?mode=async&function=get_block&block_id=custom_list_videos_videos_list_search_result&q=${q}&category_ids&sort_by&from_videos=1&from_albums=1`;
            const res = await http_get(url, HEADERS);
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
            const jsonText = doc.querySelector("script[type='application/ld+json']")?.textContent?.trim();
            if (!jsonText) return cb({ success: false, errorCode: "PARSE_ERROR", message: "Missing JSON-LD" });
            let data = JSON.parse(jsonText);
            if (Array.isArray(data)) data = data.find(item => item && (item.contentUrl || item.name)) || data[0];
            const title = data?.name || "";
            const poster = fixUrl(data?.thumbnailUrl || "");
            const streamUrl = fixUrl(data?.contentUrl || "");
            if (!title || !streamUrl) return cb({ success: false, errorCode: "PARSE_ERROR", message: "Missing title or contentUrl" });
            cb({ success: true, data: new MultimediaItem({
                title, url, posterUrl: poster, description: data.description || "", type: "movie",
                episodes: [{ name: "Play", url: streamUrl, season: 1, episode: 1, posterUrl: poster || undefined }]
            }) });
        } catch (e) {
            cb({ success: false, errorCode: "PARSE_ERROR", message: String(e?.message || e) });
        }
    }
    async function loadStreams(url, cb) {
        try {
            const streamUrl = fixUrl(url);
            if (!streamUrl) return cb({ success: true, data: [] });
            if (typeof loadExtractor === "function") {
                try {
                    const extracted = await loadExtractor(streamUrl);
                    if (Array.isArray(extracted) && extracted.length) return cb({ success: true, data: extracted });
                } catch (_) {}
            }
            cb({ success: true, data: [new StreamResult({ url: streamUrl, source: "Porn4fans", headers: HEADERS })] });
        } catch (e) {
            cb({ success: false, errorCode: "STREAM_ERROR", message: String(e?.message || e) });
        }
    }
    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();
