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

    // Các category từ nav menu của vlxx
    const CATEGORIES = [
        { name: "Việt Nam",     url: `${BASE_URL}/category/viet-nam/` },
        { name: "Châu Á",       url: `${BASE_URL}/category/chau-a/` },
        { name: "Âu Mỹ",        url: `${BASE_URL}/category/au-my/` },
        { name: "Loạn Luân",    url: `${BASE_URL}/category/loan-luan/` },
        { name: "Hentai",       url: `${BASE_URL}/category/hoat-hinh/` },
        { name: "Học Sinh",     url: `${BASE_URL}/category/hoc-sinh/` },
        { name: "Đồng Tính",    url: `${BASE_URL}/category/dong-tinh/` },
        { name: "BDSM",         url: `${BASE_URL}/category/bdsm/` },
        { name: "Ngoại Tình",   url: `${BASE_URL}/category/ngoai-tinh/` },
        { name: "Massage",      url: `${BASE_URL}/category/massage/` },
        { name: "3Some",        url: `${BASE_URL}/category/3some/` },
        { name: "Phim Dài",     url: `${BASE_URL}/category/phim-dai/` },
    ];

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

    // Parse danh sách video từ HTML — selector: div.video-item
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
            const srcMatch  = inner.match(/<img[^>]+src="([^"]+)"/i);
            const poster    = fixUrl(origMatch?.[1] || srcMatch?.[1]);

            // Title từ div.video-name
            const nameMatch = inner.match(/<div[^>]+class="[^"]*\bvideo-name\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
            const title     = nameMatch ? stripTags(nameMatch[1]) : "Unknown";
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

    // Đúng logic Kotlin: pathSplits[size - 2] — segment áp cuối
    // Ví dụ: https://vlxx.moi/xem-phim/ten-phim-12345/ -> "ten-phim-12345"
    function extractIdFromUrl(url) {
        const clean = url.replace(/\/$/, "");
        const parts = clean.split("/");
        return parts[parts.length - 1] || parts[parts.length - 2] || "";
    }

    // Parse sources từ JS response của ajax.php
    // var opts = {\r\n\t\t\t\t\t\tsources: [{file:"...", label:"..."}]}
    function parseSourcesFromJs(text) {
        const streams = [];
        try {
            const marker   = "sources:";
            const start    = text.indexOf(marker);
            if (start === -1) return streams;

            const arrStart = text.indexOf("[", start);
            if (arrStart === -1) return streams;
            const arrEnd   = text.indexOf("]", arrStart);
            if (arrEnd === -1) return streams;

            let raw = text.substring(arrStart, arrEnd + 1)
                .replace(/\\r/g, "")
                .replace(/\\t/g, "")
                .replace(/\\n/g, "")
                .replace(/\\"/g, '"')
                .replace(/\\\\\//g, "/")
                .replace(/\\\//g, "/");

            const objRegex = /\{([^}]+)\}/g;
            let obj;
            while ((obj = objRegex.exec(raw)) !== null) {
                const inner     = obj[1];
                const fileMatch = inner.match(/['"']?file['"']?\s*:\s*['"]([^'"]+)['"]/);
                const labelMatch= inner.match(/['"']?label['"']?\s*:\s*['"]([^'"]+)['"]/);
                if (fileMatch) {
                    const fileUrl = fileMatch[1].trim();
                    const label   = labelMatch ? labelMatch[1].trim() : "Auto";
                    if (fileUrl) streams.push({ url: fileUrl, label });
                }
            }
        } catch (e) {}
        return streams;
    }

    // Fetch 1 trang category, trả về items[]
    async function fetchCategoryPage(pageUrl) {
        try {
            const res  = await http_get(pageUrl, HEADERS);
            const html = res.body || "";
            return parseVideoItems(html);
        } catch (e) {
            return [];
        }
    }

    // ==================== CORE FUNCTIONS ====================

    async function getHome(cb) {
        try {
            const data = {};

            // Fetch trang chủ → section "Trending"
            const homeRes  = await http_get(BASE_URL, HEADERS);
            const homeHtml = homeRes.body || "";
            const trending = parseVideoItems(homeHtml);
            if (trending.length) data["Trending"] = trending;

            // Fetch song song tất cả categories
            const results = await Promise.allSettled(
                CATEGORIES.map(cat => fetchCategoryPage(cat.url))
            );

            results.forEach((res, i) => {
                if (res.status === "fulfilled" && res.value.length) {
                    data[CATEGORIES[i].name] = res.value;
                }
            });

            if (!Object.keys(data).length) {
                return cb({ success: false, errorCode: "HOME_ERROR", message: "No videos found" });
            }

            cb({ success: true, data });
        } catch (e) {
            cb({ success: false, errorCode: "HOME_ERROR", message: e.message });
        }
    }

    async function search(query, cb) {
        try {
            const url = `${BASE_URL}/search/${encodeURIComponent(query)}/`;
            const res  = await http_get(url, HEADERS);
            const html = res.body || "";

            const items = [];
            const seen  = new Set();

            // Selector: #container .box .video-list
            const containerMatch = html.match(/<div[^>]+id="container"[^>]*>([\s\S]*)/i);
            const containerHtml  = containerMatch ? containerMatch[0] : html;

            const blockRegex = /<div[^>]+class="[^"]*\bvideo-list\b[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
            let block;
            while ((block = blockRegex.exec(containerHtml)) !== null) {
                const inner = block[0];

                const aMatch = inner.match(/<a[^>]+href="([^"]+)"/i);
                const href   = aMatch ? fixUrl(aMatch[1]) : null;
                if (!href || seen.has(href)) continue;
                seen.add(href);

                const imgMatch = inner.match(/class="[^"]*\bvideo-image\b[^"]*"[^>]+src="([^"]+)"/i)
                    || inner.match(/<img[^>]+src="([^"]+)"/i);
                const poster = imgMatch ? fixUrl(imgMatch[1]) : null;

                const nameMatch = inner.match(/<div[^>]+class="[^"]*\bvideo-name\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
                const title  = nameMatch ? stripTags(nameMatch[1]) : "Unknown";

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
            const res  = await http_get(url, HEADERS);
            const html = res.body || "";

            // #container -> h2 (title) + div.video-description (plot)
            const containerMatch = html.match(/<div[^>]+id="container"[^>]*>([\s\S]*)/i);
            const containerHtml  = containerMatch ? containerMatch[0] : html;

            const h2Match    = containerHtml.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
            const title      = h2Match ? stripTags(h2Match[1]) : "No Title";

            const descMatch  = containerHtml.match(/<div[^>]+class="[^"]*\bvideo-description\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
            const description= descMatch ? stripTags(descMatch[1]) : "";

            // Poster từ og:image nếu có
            const ogMatch    = html.match(/property="og:image"\s+content="([^"]+)"/i)
                || html.match(/content="([^"]+)"\s+property="og:image"/i);
            const posterUrl  = ogMatch ? fixUrl(ogMatch[1]) : null;

            // Episode bắt buộc để nút Watch active
            const episode = new Episode({
                name:   title,
                url:    url,
                season: 1,
                episode:1
            });

            const item = new MultimediaItem({
                title,
                url,
                posterUrl,
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

    async function loadStreams(url, cb) {
        try {
            // Đúng logic Kotlin: pathSplits[size - 2] — segment áp cuối URL
            const id = extractIdFromUrl(url);
            if (!id) return cb({ success: false, message: "Cannot extract video ID from URL" });

            const postHeaders = {
                ...HEADERS,
                "Content-Type":     "application/x-www-form-urlencoded",
                "X-Requested-With": "XMLHttpRequest"
            };

            const body = `vlxx_server=1&id=${encodeURIComponent(id)}&server=1`;
            const res  = await http_post(`${BASE_URL}/ajax.php`, body, postHeaders);
            const text = res.body || "";

            const sources = parseSourcesFromJs(text);
            if (!sources.length) {
                return cb({ success: false, message: "No stream sources found" });
            }

            const streams = sources.map(s => new StreamResult({
                url:     s.url,
                quality: s.label || "Auto",
                headers: { "Referer": BASE_URL + "/" }
            }));

            cb({ success: true, data: streams });
        } catch (e) {
            cb({ success: false, errorCode: "STREAM_ERROR", message: e.message });
        }
    }

    globalThis.getHome     = getHome;
    globalThis.search      = search;
    globalThis.load        = load;
    globalThis.loadStreams  = loadStreams;
})();
