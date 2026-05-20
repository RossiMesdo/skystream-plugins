(function () {
    /**
     * Vlxx Plugin for SkyStream
     * Converted from CloudStream (Kotlin) by Lord
     * Original author: jacekun
     */

    const BASE_URL = (typeof manifest !== "undefined" && manifest?.baseUrl) || "https://vlxx.moi";
    const HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0",
        "Referer": BASE_URL + "/"
    };

    async function getHome(cb) {
        try {
            const res = await http_get(BASE_URL, HEADERS);
            const doc = await parseHtml(res.body);
            const seen = new Set();
            const items = Array.from(doc.querySelectorAll("div#video-list > div.video-item"))
                .map(el => {
                    const href = el.querySelector("a")?.getAttribute("href");
                    if (!href) return null;
                    const url = href.startsWith("http") ? href : BASE_URL + href;
                    if (seen.has(url)) return null;
                    seen.add(url);
                    const img = el.querySelector("img");
                    const poster = img?.getAttribute("data-original") || img?.getAttribute("src") || null;
                    const title = el.querySelector("div.video-name")?.textContent?.trim() || el.textContent?.trim() || "";
                    if (!title) return null;
                    return new MultimediaItem({ title, url, posterUrl: poster, type: "movie", isAdult: true, contentRating: "18+" });
                }).filter(Boolean);

            if (!items.length) return cb({ success: false, errorCode: "HOME_ERROR", message: "No videos found" });
            cb({ success: true, data: { "Homepage": items } });
        } catch (e) {
            cb({ success: false, errorCode: "HOME_ERROR", message: e.message });
        }
    }

    async function search(query, cb) {
        try {
            const res = await http_get(`${BASE_URL}/search/${encodeURIComponent(query)}/`, HEADERS);
            const doc = await parseHtml(res.body);
            const seen = new Set();
            const items = Array.from(doc.querySelectorAll("#container .box .video-list"))
                .map(el => {
                    const href = el.querySelector("a")?.getAttribute("href");
                    if (!href) return null;
                    const url = href.startsWith("http") ? href : BASE_URL + href;
                    if (seen.has(url)) return null;
                    seen.add(url);
                    const poster = el.querySelector(".video-image")?.getAttribute("src") || null;
                    const title = el.querySelector(".video-name")?.textContent?.trim() || "";
                    if (!title) return null;
                    return new MultimediaItem({ title, url, posterUrl: poster, type: "movie", isAdult: true, contentRating: "18+" });
                }).filter(Boolean);

            cb({ success: true, data: items });
        } catch (e) {
            cb({ success: false, errorCode: "SEARCH_ERROR", message: e.message });
        }
    }

    async function load(url, cb) {
        try {
            const res = await http_get(url, HEADERS);
            const doc = await parseHtml(res.body);
            const container = doc.querySelector("div#container");
            const title = container?.querySelector("h2")?.textContent?.trim() || "No Title";
            const desc = container?.querySelector("div.video-description")?.textContent?.trim() || "";

            cb({
                success: true,
                data: new MultimediaItem({
                    title, url,
                    posterUrl: null,
                    type: "movie",
                    description: desc,
                    isAdult: true,
                    contentRating: "18+",
                    episodes: [new Episode({ name: title, url, season: 1, episode: 1 })]
                })
            });
        } catch (e) {
            cb({ success: false, errorCode: "LOAD_ERROR", message: e.message });
        }
    }

    async function loadStreams(url, cb) {
        try {
            // Kotlin: pathSplits[size - 2] — segment áp cuối khi có trailing slash
            const parts = url.split("/");
            const id = parts[parts.length - 2] || parts[parts.length - 1];
            if (!id) return cb({ success: false, message: "Cannot extract video ID" });

            // POST /ajax.php — thử cả 2 thứ tự tham số như anichi
            const postUrl = `${BASE_URL}/ajax.php`;
            const postBody = `vlxx_server=1&id=${encodeURIComponent(id)}&server=1`;
            const postHeaders = {
                ...HEADERS,
                "Content-Type": "application/x-www-form-urlencoded",
                "X-Requested-With": "XMLHttpRequest"
            };

            let raw = "";
            try {
                const r = await http_post(postUrl, postHeaders, postBody);
                raw = r.body || "";
            } catch (_) {
                const r = await http_post(postUrl, postBody, postHeaders);
                raw = r.body || "";
            }

            if (!raw) return cb({ success: false, message: "Empty response from ajax.php" });

            // Kotlin getParamFromJS:
            // key   = "var opts = {\r\n\t\t\t\t\t\tsources:"  (ký tự thật)
            // keyEnd = "}]"
            // Trong response dạng JSON string thì \r\n\t bị escape thành \\r\\n\\t
            // Nên tìm "sources:" là đủ, còn keyEnd tìm "}]"
            const sourceIdx = raw.indexOf("sources:");
            if (sourceIdx === -1) return cb({ success: false, message: "No sources key found" });

            const after = raw.substring(sourceIdx + "sources:".length);
            const endIdx = after.indexOf("}]");
            if (endIdx === -1) return cb({ success: false, message: "No end marker found" });

            // Cắt ra rồi unescape y chang Kotlin
            let jsonStr = after.substring(0, endIdx + 2).trim();
            jsonStr = jsonStr
                .replace(/\\r/g, "")
                .replace(/\\t/g, "")
                .replace(/\\"/g, '"')
                .replace(/\\\\\//g, "/")
                .replace(/\\n/g, "");

            let sources = [];
            try {
                sources = JSON.parse(jsonStr);
            } catch (_) {
                // fallback regex nếu JSON.parse fail
                const re = /\{[^{}]+\}/g;
                let m;
                while ((m = re.exec(jsonStr)) !== null) {
                    try {
                        const o = JSON.parse(m[0]);
                        if (o.file) sources.push(o);
                    } catch (_2) {}
                }
            }

            const streams = (sources || [])
                .filter(s => s && s.file)
                .map(s => new StreamResult({
                    url: s.file,
                    quality: s.label || "Auto",
                    headers: { "Referer": BASE_URL + "/" }
                }));

            if (!streams.length) return cb({ success: false, message: "No streams found" });
            cb({ success: true, data: streams });
        } catch (e) {
            cb({ success: false, errorCode: "STREAM_ERROR", message: e.message });
        }
    }

    globalThis.getHome    = getHome;
    globalThis.search     = search;
    globalThis.load       = load;
    globalThis.loadStreams = loadStreams;
})();
