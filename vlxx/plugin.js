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

    // ==================== getHome ====================
    // Kotlin: document.select("div#video-list > div.video-item")
    // 1 section duy nhất: "Homepage"

    async function getHome(cb) {
        try {
            const res = await http_get(BASE_URL, HEADERS);
            const doc = await parseHtml(res.body);

            const items = Array.from(doc.querySelectorAll("div#video-list > div.video-item")).map(el => {
                const a       = el.querySelector("a");
                const href    = a?.getAttribute("href");
                if (!href) return null;

                const img     = el.querySelector("img");
                const poster  = img?.getAttribute("data-original") || img?.getAttribute("src");
                const title   = el.querySelector("div.video-name")?.textContent?.trim() || el.textContent?.trim();
                if (!title) return null;

                const url = href.startsWith("http") ? href : BASE_URL + href;
                return new MultimediaItem({
                    title,
                    url,
                    posterUrl: poster,
                    type:      "movie",
                    isAdult:   true,
                    contentRating: "18+"
                });
            }).filter(Boolean);

            // distinctBy url
            const seen = new Set();
            const unique = items.filter(i => {
                if (seen.has(i.url)) return false;
                seen.add(i.url);
                return true;
            });

            if (!unique.length) return cb({ success: false, errorCode: "HOME_ERROR", message: "No videos found" });
            cb({ success: true, data: { "Homepage": unique } });
        } catch (e) {
            cb({ success: false, errorCode: "HOME_ERROR", message: e.message });
        }
    }

    // ==================== search ====================
    // Kotlin: GET /search/{query}/, selector "#container .box .video-list"
    // img: .video-image attr src | name: .video-name text

    async function search(query, cb) {
        try {
            const res = await http_get(`${BASE_URL}/search/${encodeURIComponent(query)}/`, HEADERS);
            const doc = await parseHtml(res.body);

            const items = Array.from(doc.querySelectorAll("#container .box .video-list")).map(el => {
                const a    = el.querySelector("a");
                const href = a?.getAttribute("href");
                if (!href) return null;

                const poster = el.querySelector(".video-image")?.getAttribute("src");
                const title  = el.querySelector(".video-name")?.textContent?.trim() || "";
                if (!title) return null;

                const url = href.startsWith("http") ? href : BASE_URL + href;
                return new MultimediaItem({
                    title,
                    url,
                    posterUrl: poster,
                    type:      "movie",
                    isAdult:   true,
                    contentRating: "18+"
                });
            }).filter(Boolean);

            const seen = new Set();
            const unique = items.filter(i => {
                if (seen.has(i.url)) return false;
                seen.add(i.url);
                return true;
            });

            cb({ success: true, data: unique });
        } catch (e) {
            cb({ success: false, errorCode: "SEARCH_ERROR", message: e.message });
        }
    }

    // ==================== load ====================
    // Kotlin: doc.selectFirst("div#container") -> h2 (title), div.video-description (plot)
    // poster = null (comment gốc: No image on load page)
    // Phải có episodes[] để nút Watch active

    async function load(url, cb) {
        try {
            const res       = await http_get(url, HEADERS);
            const doc       = await parseHtml(res.body);

            const container = doc.querySelector("div#container");
            const title     = container?.querySelector("h2")?.textContent?.trim() || "No Title";
            const description = container?.querySelector("div.video-description")?.textContent?.trim() || "";

            const episode = new Episode({
                name:    title,
                url:     url,
                season:  1,
                episode: 1
            });

            cb({
                success: true,
                data: new MultimediaItem({
                    title,
                    url,
                    posterUrl:   null, // No image on load page (theo Kotlin)
                    type:        "movie",
                    description,
                    episodes:    [episode],
                    isAdult:     true,
                    contentRating: "18+"
                })
            });
        } catch (e) {
            cb({ success: false, errorCode: "LOAD_ERROR", message: e.message });
        }
    }

    // ==================== loadStreams ====================
    // Kotlin: id = pathSplits[size - 2]  (URL trailing slash → segment áp cuối)
    // POST /ajax.php với vlxx_server=1, id, server=1
    // Parse response bằng getParamFromJS: key="sources:", keyEnd="}]"
    // Unescape: \r \t \" \\/ \n

    function extractId(url) {
        // pathSplits[size - 2]: split by "/" → lấy phần tử áp cuối
        const parts = url.split("/");
        // trailing slash → last part = "" → áp cuối là [length-2]
        return parts[parts.length - 2] || parts[parts.length - 1] || "";
    }

    function getParamFromJS(str) {
        try {
            const key    = "sources:";
            const keyEnd = "}]";

            const start = str.indexOf(key);
            if (start === -1) return null;

            const after     = str.substring(start + key.length);
            const endIndex  = after.indexOf(keyEnd);
            if (endIndex === -1) return null;

            const raw = after.substring(0, endIndex + keyEnd.length);
            return raw
                .replace(/\\r/g,  "")
                .replace(/\\t/g,  "")
                .replace(/\\"/g,  '"')
                .replace(/\\\\\//g, "/")
                .replace(/\\n/g,  "");
        } catch (e) {
            return null;
        }
    }

    async function loadStreams(url, cb) {
        try {
            const id = extractId(url);
            if (!id) return cb({ success: false, message: "Cannot extract video ID" });

            const res = await http_post(
                `${BASE_URL}/ajax.php`,
                `vlxx_server=1&id=${encodeURIComponent(id)}&server=1`,
                {
                    ...HEADERS,
                    "Content-Type":     "application/x-www-form-urlencoded",
                    "X-Requested-With": "XMLHttpRequest"
                }
            );

            const json = getParamFromJS(res.body || "");
            if (!json) return cb({ success: false, message: "No stream data found" });

            let sources = [];
            try {
                sources = JSON.parse(json);
            } catch (_) {}

            const streams = (sources || [])
                .filter(s => s && s.file)
                .map(s => new StreamResult({
                    url:     s.file,
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
