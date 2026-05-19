(function () {
    /**
     * Vlxx Plugin for SkyStream
     * Converted from CloudStream (Kotlin) by Lord
     * Original author: jacekun
     * Language: Vietnamese | Type: NSFW
     */

    const BASE_URL = (typeof manifest !== "undefined" && manifest?.baseUrl) || "https://vlxx.moi";
    const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0";
    const HEADERS = {
        "User-Agent": UA,
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

    // Parse danh sách video từ HTML block div.video-item
    function parseVideoItems(html) {
        const items = [];
        const seen = new Set();

        const blockRegex = /<div[^>]+class="[^"]*\bvideo-item\b[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
        let block;
        while ((block = blockRegex.exec(html)) !== null) {
            const inner = block[0];

            const aMatch = inner.match(/<a[^>]+href="([^"]+)"/i);
            const href = aMatch ? fixUrl(aMatch[1]) : null;
            if (!href || seen.has(href)) continue;
            seen.add(href);

            // Poster: ưu tiên data-original → src
            const origMatch = inner.match(/data-original="([^"]+)"/i);
            const srcMatch = inner.match(/<img[^>]+src="([^"]+)"/i);
            const poster = fixUrl(origMatch?.[1] || srcMatch?.[1]);

            // Title từ div.video-name
            const nameMatch = inner.match(/<div[^>]+class="[^"]*\bvideo-name\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
            const title = nameMatch ? stripTags(nameMatch[1]) : "Unknown";
            if (!title || !href) continue;

            items.push(new MultimediaItem({
                title,
                url: href,
                posterUrl: poster,
                type: "movie",
                isAdult: true,
                contentRating: "18+"
            }));
        }
        return items;
    }

    // Extract video ID từ URL path (phần cuối trước dấu /)
    // Ví dụ: https://vlxx.sex/video/abc-123/ -> "123" (phần số cuối)
    function extractIdFromUrl(url) {
        // Lấy segment cuối có chứa số
        const clean = url.replace(/\/$/, "");
        const parts = clean.split("/");
        const last = parts[parts.length - 1] || parts[parts.length - 2];
        // Thử lấy số cuối từ slug
        const numMatch = last.match(/(\d+)$/);
        if (numMatch) return numMatch[1];
        return last;
    }

    // Parse sources từ JS response của ajax.php
    // Format gốc: var opts = {\r\n\t\t\t\t\t\tsources: [{file:"...", label:"..."}]}
    function parseSourcesFromJs(text) {
        const streams = [];
        try {
            // Tìm mảng sources
            const marker = "sources:";
            const start = text.indexOf(marker);
            if (start === -1) return streams;

            const arrStart = text.indexOf("[", start);
            if (arrStart === -1) return streams;
            const arrEnd = text.indexOf("]", arrStart);
            if (arrEnd === -1) return streams;

            let raw = text.substring(arrStart, arrEnd + 1);

            // Unescape
            raw = raw
                .replace(/\\r/g, "")
                .replace(/\\t/g, "")
                .replace(/\\n/g, "")
                .replace(/\\"/g, '"')
                .replace(/\\\\\//g, "/")
                .replace(/\\\//g, "/");

            // Parse từng object trong mảng thủ công (tránh lỗi JSON do single quote)
            const objRegex = /\{([^}]+)\}/g;
            let obj;
            while ((obj = objRegex.exec(raw)) !== null) {
                const inner = obj[1];
                const fileMatch = inner.match(/['"']?file['"']?\s*:\s*['"]([^'"]+)['"]/);
                const labelMatch = inner.match(/['"']?label['"']?\s*:\s*['"]([^'"]+)['"]/);
                if (fileMatch) {
                    const fileUrl = fileMatch[1].trim();
                    const label = labelMatch ? labelMatch[1].trim() : "";
                    if (fileUrl) {
                        streams.push({ url: fileUrl, label });
                    }
                }
            }
        } catch (e) {
            // ignore parse errors
        }
        return streams;
    }

    // ==================== CORE FUNCTIONS ====================

    async function getHome(cb) {
        try {
            const res = await http_get(BASE_URL, HEADERS);
            const html = res.body || "";

            // Lấy section #video-list
            const listMatch = html.match(/<div[^>]+id="video-list"[^>]*>([\s\S]*?)<\/div>\s*<\/section>/i)
                || html.match(/<div[^>]+id="video-list"[^>]*>([\s\S]*)/i);
            const listHtml = listMatch ? listMatch[0] : html;

            const items = parseVideoItems(listHtml);

            if (!items.length) {
                return cb({ success: false, errorCode: "HOME_ERROR", message: "No videos found" });
            }

            cb({ success: true, data: { "Trending": items } });
        } catch (e) {
            cb({ success: false, errorCode: "HOME_ERROR", message: e.message });
        }
    }

    async function search(query, cb) {
        try {
            const url = `${BASE_URL}/search/${encodeURIComponent(query)}/`;
            const res = await http_get(url, HEADERS);
            const html = res.body || "";

            const items = [];
            const seen = new Set();

            // Selector: #container .box .video-list -> lấy từng item
            const containerMatch = html.match(/<div[^>]+id="container"[^>]*>([\s\S]*)/i);
            const containerHtml = containerMatch ? containerMatch[0] : html;

            // Parse từng .video-list block
            const blockRegex = /<div[^>]+class="[^"]*\bvideo-list\b[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
            let block;
            while ((block = blockRegex.exec(containerHtml)) !== null) {
                const inner = block[0];

                const aMatch = inner.match(/<a[^>]+href="([^"]+)"/i);
                const href = aMatch ? fixUrl(aMatch[1]) : null;
                if (!href || seen.has(href)) continue;
                seen.add(href);

                const imgMatch = inner.match(/class="[^"]*\bvideo-image\b[^"]*"[^>]*src="([^"]+)"/i)
                    || inner.match(/<img[^>]+src="([^"]+)"/i);
                const poster = imgMatch ? fixUrl(imgMatch[1]) : null;

                const nameMatch = inner.match(/<div[^>]+class="[^"]*\bvideo-name\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
                const title = nameMatch ? stripTags(nameMatch[1]) : "Unknown";

                items.push(new MultimediaItem({
                    title,
                    url: href,
                    posterUrl: poster,
                    type: "movie",
                    isAdult: true,
                    contentRating: "18+"
                }));
            }

            cb({ success: true, data: items });
        } catch (e) {
            cb({ success: false, errorCode: "SEARCH_ERROR", message: e.message });
        }
    }

    async function load(url, cb) {
        try {
            const res = await http_get(url, HEADERS);
            const html = res.body || "";

            // Title từ #container h2
            const containerMatch = html.match(/<div[^>]+id="container"[^>]*>([\s\S]*)/i);
            const containerHtml = containerMatch ? containerMatch[0] : html;

            const h2Match = containerHtml.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
            const title = h2Match ? stripTags(h2Match[1]) : "No Title";

            // Description từ div.video-description
            const descMatch = containerHtml.match(/<div[^>]+class="[^"]*\bvideo-description\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
            const description = descMatch ? stripTags(descMatch[1]) : "";

            const item = new MultimediaItem({
                title,
                url,
                posterUrl: null,
                type: "movie",
                description,
                isAdult: true,
                contentRating: "18+"
            });

            cb({ success: true, data: item });
        } catch (e) {
            cb({ success: false, errorCode: "LOAD_ERROR", message: e.message });
        }
    }

    async function loadStreams(url, cb) {
        try {
            const id = extractIdFromUrl(url);
            if (!id) return cb({ success: false, message: "Cannot extract video ID from URL" });

            const postHeaders = {
                ...HEADERS,
                "Content-Type": "application/x-www-form-urlencoded",
                "X-Requested-With": "XMLHttpRequest"
            };

            const body = `vlxx_server=1&id=${encodeURIComponent(id)}&server=1`;
            const res = await http_post(`${BASE_URL}/ajax.php`, body, postHeaders);
            const text = res.body || "";

            const sources = parseSourcesFromJs(text);

            if (!sources.length) {
                return cb({ success: false, message: "No stream sources found" });
            }

            const streams = sources.map(s => new StreamResult({
                url: s.url,
                quality: s.label || "Auto",
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
