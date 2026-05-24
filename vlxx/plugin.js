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

    // CloudStream: div#video-list > div.video-item
    // poster từ img[data-original], title từ div.video-name, href từ a
    function parseItems(doc) {
        const items = [];
        const seen = new Set();
        doc.querySelectorAll("div#video-list > div.video-item").forEach(el => {
            const a = el.querySelector("a");
            if (!a) return;
            const url = fixUrl(a.getAttribute("href") || "");
            if (!url || seen.has(url)) return;
            seen.add(url);
            const title = el.querySelector("div.video-name")?.textContent?.trim() || el.textContent.trim();
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
            // CloudStream: /search/{query}/
            const res = await http_get(`${BASE_URL}/search/${encodeURIComponent(query)}/`, HEADERS);
            if (!res || res.status !== 200) return cb({ success: true, data: [] });
            const doc = await parseHtml(res.body);

            // CloudStream: #container .box .video-list
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

            // CloudStream: div#container h2
            const container = doc.querySelector("div#container");
            const title = container?.querySelector("h2")?.textContent?.trim() || "VLXX Video";
            const description = container?.querySelector("div.video-description")?.textContent?.trim() || "";

            // CloudStream: No image on load page — dùng og:image fallback
            const poster = fixUrl(doc.querySelector("meta[property='og:image']")?.getAttribute("content") || "");

            // Lấy video ID từ URL: /video/slug/id/
            const id = url.replace(/\/$/, "").split("/").pop();

            cb({
                success: true,
                data: new MultimediaItem({
                    title,
                    url,
                    posterUrl: poster,
                    type: "movie",
                    description,
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
            // CloudStream: lấy ID từ path cuối URL
            // /video/slug/3140/ → id = "3140"
            const pathParts = url.replace(/\/$/, "").split("/");
            const id = pathParts[pathParts.length - 1];

            if (!id || isNaN(parseInt(id))) return cb({ success: true, data: [] });

            // CloudStream: POST /ajax.php với {vlxx_server:1, id, server:1}
            const res = await http_post(`${BASE_URL}/ajax.php`, {
                ...HEADERS,
                "Content-Type": "application/x-www-form-urlencoded",
                "X-Requested-With": "XMLHttpRequest"
            }, `vlxx_server=1&id=${id}&server=1`);

            if (!res || !res.body) return cb({ success: true, data: [] });

            const body = res.body;

            // CloudStream: getParamFromJS(res, "var opts = {\r\n\t\t\t\t\t\tsources:", "}]")
            // rồi clean escape chars và parse JSON
            const key = "sources:";
            const keyEnd = "}]";
            const startIdx = body.indexOf(key);
            if (startIdx === -1) return cb({ success: true, data: [] });

            const temp = body.substring(startIdx + key.length);
            const endIdx = temp.indexOf(keyEnd);
            if (endIdx === -1) return cb({ success: true, data: [] });

            let jsonStr = temp.substring(0, endIdx + keyEnd.length);

            // CloudStream: clean escape chars
            jsonStr = jsonStr
                .replace(/\\r/g, "")
                .replace(/\\t/g, "")
                .replace(/\\"/g, '"')
                .replace(/\\\\\//g, "/")
                .replace(/\\n/g, "")
                .trim();

            // Wrap thành array nếu chưa có
            if (!jsonStr.startsWith("[")) jsonStr = "[" + jsonStr;

            let sources;
            try { sources = JSON.parse(jsonStr); } catch (e) { return cb({ success: true, data: [] }); }
            if (!Array.isArray(sources)) return cb({ success: true, data: [] });

            const streams = sources
                .filter(s => s.file)
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
