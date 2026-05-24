(function() {
    /**
     * VLXX Plugin for SkyStream
     * Site: https://vlxx.moi
     * Ported from: CXXX + cs3xxx CloudStream repos
     * Author: Lord
     */

    const BASE_URL = manifest.baseUrl;
    const HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:137.0) Gecko/20100101 Firefox/137.0",
        "Referer": BASE_URL + "/"
    };

    function fixUrl(u) {
        if (!u) return "";
        if (u.startsWith("//")) return "https:" + u;
        if (u.startsWith("/")) return BASE_URL + u;
        return u;
    }

    function parseItems(doc) {
        const items = [];
        const seen = new Set();
        doc.querySelectorAll("div#video-list > div.video-item").forEach(el => {
            const a = el.querySelector("a");
            if (!a) return;
            const url = fixUrl(a.getAttribute("href") || "");
            if (!url || seen.has(url)) return;
            seen.add(url);
            const title = el.querySelector("div.video-name")?.textContent?.trim() || "";
            if (!title) return;
            const img = el.querySelector("img");
            const poster = fixUrl(img?.getAttribute("data-original") || img?.getAttribute("src") || "");
            items.push(new MultimediaItem({ title, url, posterUrl: poster, type: "movie" }));
        });
        return items;
    }

    async function getHome(cb) {
        try {
            const res = await http_get(BASE_URL, HEADERS);
            if (!res || res.status !== 200) return cb({ success: false, errorCode: "SITE_OFFLINE" });
            const doc = await parseHtml(res.body);
            const items = parseItems(doc);
            cb({ success: true, data: { "🏠 Trang Chủ": items } });
        } catch (e) {
            cb({ success: false, errorCode: "SITE_OFFLINE", message: e.message });
        }
    }

    async function search(query, cb) {
        try {
            const res = await http_get(`${BASE_URL}/search/${encodeURIComponent(query)}/`, HEADERS);
            if (!res || res.status !== 200) return cb({ success: true, data: [] });
            const doc = await parseHtml(res.body);
            const items = [];
            const seen = new Set();
            doc.querySelectorAll("#container .box .video-list").forEach(el => {
                const url = fixUrl(el.querySelector("a")?.getAttribute("href") || "");
                if (!url || seen.has(url)) return;
                seen.add(url);
                const title = el.querySelector(".video-name")?.textContent?.trim() || "";
                if (!title) return;
                const poster = fixUrl(el.querySelector(".video-image")?.getAttribute("src") || "");
                items.push(new MultimediaItem({ title, url, posterUrl: poster, type: "movie" }));
            });
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
            const container = doc.querySelector("div#container");
            const title = container?.querySelector("h2")?.textContent?.trim() || "VLXX Video";
            const description = container?.querySelector("div.video-description")?.textContent?.trim() || "";
            const poster = fixUrl(doc.querySelector("meta[property='og:image']")?.getAttribute("content") || "");
            cb({
                success: true,
                data: new MultimediaItem({
                    title, url, posterUrl: poster, type: "movie", description,
                    episodes: [{ name: "Play", url, season: 1, episode: 1, posterUrl: poster || undefined }]
                })
            });
        } catch (e) {
            cb({ success: false, errorCode: "PARSE_ERROR", message: e.message });
        }
    }

    // CloudStream getParamFromJS: tìm key trong string, lấy đến keyEnd rồi clean
    function getParamFromJS(str, key, keyEnd) {
        try {
            const firstIndex = str.indexOf(key) + key.length;
            if (firstIndex < key.length) return null;
            const temp = str.substring(firstIndex);
            const lastIndex = temp.indexOf(keyEnd) + keyEnd.length;
            if (lastIndex < keyEnd.length) return null;
            const jsonConfig = temp.substring(0, lastIndex);
            return jsonConfig
                .replace(/\\r/g, "")
                .replace(/\\t/g, "")
                .replace(/\\"/g, '"')
                .replace(/\\\\\//g, "/")
                .replace(/\\n/g, "");
        } catch (e) {
            return null;
        }
    }

    async function loadStreams(url, cb) {
        try {
            // CloudStream: pathSplits[size - 2]
            // /video/slug/3140/ → ["", "video", "slug", "3140", ""] → index 3 = "3140"
            const pathParts = url.split("/");
            const id = pathParts[pathParts.length - 2];
            if (!id || isNaN(parseInt(id))) return cb({ success: true, data: [] });

            const postHeaders = {
                ...HEADERS,
                "Content-Type": "application/x-www-form-urlencoded",
                "X-Requested-With": "XMLHttpRequest"
            };
            const postBody = `vlxx_server=1&id=${id}&server=1`;

            let res;
            try {
                res = await http_post(`${BASE_URL}/ajax.php`, postHeaders, postBody);
            } catch (e) {
                res = await http_post(`${BASE_URL}/ajax.php`, postBody, postHeaders);
            }

            if (!res || !res.body) return cb({ success: true, data: [] });

            const text = res.body;

            // CloudStream key chính xác: "var opts = {\r\n\t\t\t\t\t\tsources:"
            // Dùng ký tự thật \r \n \t
            const KEY = "var opts = {\r\n\t\t\t\t\t\tsources:";
            const KEY_END = "}]";

            let jsonStr = getParamFromJS(text, KEY, KEY_END);

            // Fallback: thử key đơn giản hơn nếu format khác
            if (!jsonStr) {
                jsonStr = getParamFromJS(text, "sources:", KEY_END);
            }

            if (!jsonStr) return cb({ success: true, data: [] });

            jsonStr = jsonStr.trim();
            if (!jsonStr.startsWith("[")) jsonStr = "[" + jsonStr;

            let sources;
            try { sources = JSON.parse(jsonStr); } catch (e) { return cb({ success: true, data: [] }); }
            if (!Array.isArray(sources)) return cb({ success: true, data: [] });

            const streams = sources
                .filter(s => s && s.file)
                .map(s => new StreamResult({
                    url: fixUrl(s.file),
                    source: s.label ? `VLXX ${s.label}` : "VLXX",
                    headers: { "Referer": BASE_URL + "/" }
                }));

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
