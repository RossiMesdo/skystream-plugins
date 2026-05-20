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

    // ==================== HELPERS ====================

    function fixUrl(url) {
        if (!url) return null;
        url = url.trim();
        if (url.startsWith("//")) return "https:" + url;
        if (url.startsWith("http")) return url;
        if (url.startsWith("/")) return BASE_URL + url;
        return null;
    }

    function stripTags(html) {
        return (html || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
    }

    // Đúng theo Kotlin: pathSplits[size - 2]
    // URL dạng /xem-phim/ten-video/ → split("/") → ["","xem-phim","ten-video",""] → size-2 = "ten-video"
    function extractIdFromUrl(url) {
        const parts = url.split("/");
        return parts[parts.length - 2] || "";
    }

    // Đúng theo getParamFromJS trong Kotlin:
    // key = "var opts = {\r\n\t\t\t\t\t\tsources:"  keyEnd = "}]"
    function getParamFromJS(str) {
        try {
            const key    = "sources:";
            const keyEnd = "}]";

            const firstIndex = str.indexOf(key);
            if (firstIndex === -1) return null;

            const temp      = str.substring(firstIndex + key.length);
            const lastIndex = temp.indexOf(keyEnd);
            if (lastIndex === -1) return null;

            const raw = temp.substring(0, lastIndex + keyEnd.length);

            // Unescape y chang Kotlin
            return raw
                .replace(/\\r/g, "")
                .replace(/\\t/g, "")
                .replace(/\\"/g, '"')
                .replace(/\\\\\//g, "/")
                .replace(/\\n/g, "");
        } catch (e) {
            return null;
        }
    }

    // Parse video items: selector "div#video-list > div.video-item"
    function parseVideoItems(html) {
        const items = [];
        const seen  = new Set();

        // Match từng div.video-item
        const re = /<div[^>]+class="[^"]*\bvideo-item\b[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
        let m;
        while ((m = re.exec(html)) !== null) {
            const block = m[0];

            // firstA href
            const aMatch = block.match(/<a[^>]+href="([^"]+)"/i);
            const href   = aMatch ? fixUrl(aMatch[1]) : null;
            if (!href || seen.has(href)) continue;
            seen.add(href);

            // img data-original (đúng theo Kotlin: it.selectFirst("img")?.attr("data-original"))
            const imgMatch = block.match(/<img[^>]+data-original="([^"]+)"/i)
                || block.match(/<img[^>]+src="([^"]+)"/i);
            const poster = imgMatch ? fixUrl(imgMatch[1]) : null;

            // div.video-name text
            const nameMatch = block.match(/<div[^>]+class="[^"]*\bvideo-name\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
            const title = nameMatch ? stripTags(nameMatch[1]) : stripTags(block);
            if (!title) continue;

            items.push(new MultimediaItem({
                title,
                url:     href,
                posterUrl: poster,
                type:    "movie",
                isAdult: true,
                contentRating: "18+"
            }));
        }
        return items;
    }

    // ==================== CORE FUNCTIONS ====================

    // getMainPage: selector "div#video-list > div.video-item", 1 section "Homepage"
    async function getHome(cb) {
        try {
            const res  = await http_get(BASE_URL, HEADERS);
            const html = res.body || "";

            const items = parseVideoItems(html);

            if (!items.length) {
                return cb({ success: false, errorCode: "HOME_ERROR", message: "No videos found" });
            }

            cb({ success: true, data: { "Homepage": items } });
        } catch (e) {
            cb({ success: false, errorCode: "HOME_ERROR", message: e.message });
        }
    }

    // search: GET /search/{query}/, selector "#container .box .video-list"
    async function search(query, cb) {
        try {
            const url  = `${BASE_URL}/search/${encodeURIComponent(query)}/`;
            const res  = await http_get(url, HEADERS);
            const html = res.body || "";

            const items = [];
            const seen  = new Set();

            // "#container .box .video-list"
            // Tìm từng div.video-list bên trong #container
            const containerM = html.match(/<div[^>]+id="container"[^>]*>([\s\S]*)/i);
            const scope = containerM ? containerM[0] : html;

            const re = /<div[^>]+class="[^"]*\bvideo-list\b[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
            let m;
            while ((m = re.exec(scope)) !== null) {
                const block = m[0];

                // a href
                const aMatch = block.match(/<a[^>]+href="([^"]+)"/i);
                const href   = aMatch ? fixUrl(aMatch[1]) : null;
                if (!href || seen.has(href)) continue;
                seen.add(href);

                // .video-image src (đúng theo Kotlin: it.select(".video-image").attr("src"))
                const imgMatch = block.match(/class="[^"]*\bvideo-image\b[^"]*"[^>]*src="([^"]+)"/i)
                    || block.match(/src="([^"]+)"[^>]*class="[^"]*\bvideo-image\b[^"]*"/i);
                const poster = imgMatch ? fixUrl(imgMatch[1]) : null;

                // .video-name text
                const nameMatch = block.match(/<[^>]+class="[^"]*\bvideo-name\b[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/i);
                const title = nameMatch ? stripTags(nameMatch[1]) : "";
                if (!title) continue;

                items.push(new MultimediaItem({
                    title,
                    url:     href,
                    posterUrl: poster,
                    type:    "movie",
                    isAdult: true,
                    contentRating: "18+"
                }));
            }

            cb({ success: true, data: items });
        } catch (e) {
            cb({ success: false, errorCode: "SEARCH_ERROR", message: e.message });
        }
    }

    // load: "div#container" -> h2 (title) + div.video-description (plot)
    // poster = null (đúng theo Kotlin: val poster = null //No image on load page)
    async function load(url, cb) {
        try {
            const res  = await http_get(url, HEADERS);
            const html = res.body || "";

            const containerM = html.match(/<div[^>]+id="container"[^>]*>([\s\S]*)/i);
            const scope = containerM ? containerM[0] : html;

            const h2M   = scope.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
            const title = h2M ? stripTags(h2M[1]) : "No Title";

            const descM = scope.match(/<div[^>]+class="[^"]*\bvideo-description\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
            const description = descM ? stripTags(descM[1]) : "";

            // Episode bắt buộc để nút Watch active
            const episode = new Episode({
                name:    title,
                url:     url,
                season:  1,
                episode: 1
            });

            const item = new MultimediaItem({
                title,
                url,
                posterUrl:   null, // No image on load page
                type:        "movie",
                description,
                episodes:    [episode],
                isAdult:     true,
                contentRating: "18+"
            });

            cb({ success: true, data: item });
        } catch (e) {
            cb({ success: false, errorCode: "LOAD_ERROR", message: e.message });
        }
    }

    // loadStreams: POST /ajax.php với id = pathSplits[size-2]
    // parse response bằng getParamFromJS giống Kotlin
    async function loadStreams(url, cb) {
        try {
            const id = extractIdFromUrl(url);
            if (!id) return cb({ success: false, message: "Cannot extract ID from URL" });

            const res = await http_post(
                `${BASE_URL}/ajax.php`,
                `vlxx_server=1&id=${encodeURIComponent(id)}&server=1`,
                {
                    ...HEADERS,
                    "Content-Type":     "application/x-www-form-urlencoded",
                    "X-Requested-With": "XMLHttpRequest"
                }
            );
            const text = res.body || "";

            const json = getParamFromJS(text);
            if (!json) return cb({ success: false, message: "No stream data in response" });

            // Parse JSON array [{file, type, label}]
            let sources = [];
            try {
                // json là dạng "[{file:\"...\",label:\"...\"}]"
                sources = JSON.parse(json);
            } catch (e) {
                // fallback: parse thủ công
                const re = /\{[^}]+\}/g;
                let m;
                while ((m = re.exec(json)) !== null) {
                    try {
                        const o = JSON.parse(m[0]);
                        if (o.file) sources.push(o);
                    } catch (_) {}
                }
            }

            if (!sources.length) {
                return cb({ success: false, message: "No sources found" });
            }

            const streams = sources
                .filter(s => s.file)
                .map(s => new StreamResult({
                    url:     s.file,
                    quality: s.label || "Auto",
                    headers: { "Referer": BASE_URL + "/" }
                }));

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
