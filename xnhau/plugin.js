(function () {
    /**
     * xNhau Plugin for SkyStream
     * Converted from CloudStream (Kotlin)
     * Original author: recloudstream
     * Language: Vietnamese | Type: NSFW
     */

    const BASE_URL = (typeof manifest !== "undefined" && manifest?.baseUrl) || "https://xnhau.bet";
    const STORAGE_URL = "https://xnhaustorage.com";
    const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0";
    const HEADERS = { "User-Agent": UA, "Referer": BASE_URL };

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

    // Parse danh sách phim từ HTML — tương đương toSearchResponse() trong Kotlin
    function parseItems(html, selector) {
        const items = [];
        const seen = new Set();

        // Tìm tất cả .item block
        const itemRegex = /<div[^>]+class="[^"]*\bitem\b[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
        let block;
        while ((block = itemRegex.exec(html)) !== null) {
            const inner = block[0];

            // Lấy href từ thẻ <a>
            const aMatch = inner.match(/<a[^>]+href="([^"]+)"/i);
            const href = aMatch ? fixUrl(aMatch[1]) : null;
            if (!href || seen.has(href)) continue;
            seen.add(href);

            // Title từ <strong class="title"> hoặc attr title
            const titleMatch = inner.match(/<strong[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/strong>/i)
                || inner.match(/title="([^"]+)"/i);
            const title = titleMatch ? stripTags(titleMatch[1]) : "Unknown";
            if (!title || title === "Unknown" && !href) continue;

            // Poster: ưu tiên data-webp → data-original → src
            const webpMatch = inner.match(/data-webp="([^"]+)"/i);
            const origMatch = inner.match(/data-original="([^"]+)"/i);
            const srcMatch = inner.match(/<img[^>]+src="([^"]+)"/i);
            const poster = fixUrl(webpMatch?.[1] || origMatch?.[1] || srcMatch?.[1]);

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

    // Lấy nội dung của JS var: var NAME = { ... }
    function findJsVarContent(html, varName) {
        const marker = `var ${varName} = {`;
        const start = html.indexOf(marker);
        if (start === -1) return null;
        const contentStart = start + marker.length;
        // Tìm dấu }; hoặc } gần nhất
        const end1 = html.indexOf("};", contentStart);
        const end2 = html.indexOf("}", contentStart);
        const end = Math.min(
            end1 !== -1 ? end1 : Infinity,
            end2 !== -1 ? end2 : Infinity
        );
        if (!isFinite(end)) return null;
        return html.substring(contentStart, end).trim();
    }

    // Lấy giá trị key từ JS object string
    function extractJsVar(jsStr, key) {
        if (!jsStr) return null;
        const m = jsStr.match(new RegExp(`['"]?${key}['"]?\\s*:\\s*['"]?([^'"\\s,}]+)['"]?`));
        return m ? m[1].trim() : null;
    }

    // Lấy group từ URL poster — /videos_screenshots/GROUP/
    function extractGroupFromPoster(posterUrl) {
        if (!posterUrl) return null;
        const m = posterUrl.match(/\/videos_screenshots\/(\d+)\//);
        return m ? m[1] : null;
    }

    // ==================== getHome ====================

    async function getHome(cb) {
        try {
            const sections = [
                { name: "Đang Xem",  url: `${BASE_URL}/` },
                { name: "Mới Nhất", url: `${BASE_URL}/clip-sex-moi/` },
                { name: "Hay Nhất", url: `${BASE_URL}/clip-sex-hay/` },
                { name: "Hot Nhất", url: `${BASE_URL}/clip-sex-hot/` },
            ];

            const selectors = {
                "/":              "#list_videos_videos_watched_right_now_items .item",
                "/clip-sex-moi/": ".main-container .list-videos .item",
                "/clip-sex-hay/": "#list_videos_common_videos_list_items .item",
                "/clip-sex-hot/": "#list_videos_common_videos_list_items .item",
            };

            const homeData = {};

            // Fetch song song
            const results = await Promise.allSettled(
                sections.map(async (sec) => {
                    const res = await http_get(sec.url, HEADERS);
                    if (!res || !res.body) return { name: sec.name, items: [] };
                    const items = parseItems(res.body);
                    return { name: sec.name, items };
                })
            );

            results.forEach(r => {
                if (r.status === "fulfilled" && r.value.items.length)
                    homeData[r.value.name] = r.value.items;
            });

            if (!Object.keys(homeData).length)
                return cb({ success: false, errorCode: "HOME_ERROR", message: "Không tải được trang chủ" });

            cb({ success: true, data: homeData });
        } catch (e) {
            cb({ success: false, errorCode: "HOME_ERROR", message: e.message });
        }
    }

    // ==================== search ====================

    async function search(query, cb) {
        try {
            const url = `${BASE_URL}/search/${encodeURIComponent(query)}/`;
            const res = await http_get(url, HEADERS);
            if (!res || !res.body) return cb({ success: true, data: [] });
            const items = parseItems(res.body);
            cb({ success: true, data: items });
        } catch (e) {
            cb({ success: false, errorCode: "SEARCH_ERROR", message: e.message });
        }
    }

    // ==================== load ====================

    async function load(url, cb) {
        try {
            const res = await http_get(url, HEADERS);
            if (!res || !res.body)
                return cb({ success: false, errorCode: "LOAD_ERROR", message: "Empty response" });

            const html = res.body;

            // Lấy flashvars để parse title
            const flashvarsStr = findJsVarContent(html, "flashvars");

            // Title
            let title = extractJsVar(flashvarsStr, "video_title")
                || stripTags(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "")
                    .replace(/\s*-\s*xNhau.*$/i, "").trim()
                || "Unknown";

            // Poster
            const posterUrl = fixUrl(
                html.match(/property="og:image"\s+content="([^"]+)"/i)?.[1]
                || html.match(/content="([^"]+)"\s+property="og:image"/i)?.[1]
                || extractJsVar(flashvarsStr, "preview_url2")
                || extractJsVar(flashvarsStr, "preview_url1")
                || extractJsVar(flashvarsStr, "preview_url")
            );

            // Description
            const descMatch = html.match(/name="description"\s+content="([^"]+)"/i)
                || html.match(/content="([^"]+)"\s+name="description"/i);
            const description = descMatch ? descMatch[1].trim() : undefined;

            // Tags — từ /tags/ và /the-loai/
            const tags = [];
            const tagRegex = /href="[^"]*\/(?:tags|the-loai)\/[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
            let tm;
            while ((tm = tagRegex.exec(html)) !== null) {
                const t = stripTags(tm[1]);
                if (t && !tags.includes(t)) tags.push(t);
            }

            // Recommendations
            const recommendations = parseItems(
                html.match(/#list_videos_related_videos_items([\s\S]*?)(?=<div id=|$)/i)?.[0] || html
            );

            // Episode — url = URL trang phim → loadStreams fetch lại và build stream URL
            const episode = new Episode({
                name: title,
                url: url,
                season: 1,
                episode: 1,
                dubStatus: "none",
                posterUrl: posterUrl || undefined
            });

            cb({
                success: true,
                data: new MultimediaItem({
                    title, url, posterUrl,
                    type: "movie",
                    description,
                    tags: tags.length ? tags : undefined,
                    recommendations: recommendations.length ? recommendations : undefined,
                    episodes: [episode],
                    isAdult: true,
                    contentRating: "18+"
                })
            });
        } catch (e) {
            cb({ success: false, errorCode: "LOAD_ERROR", message: e.message });
        }
    }

    // ==================== loadStreams ====================
    // Logic gốc: build URL từ storageUrl/group/videoId/videoId[_quality].mp4
    // Không cần extractor ngoài — stream trực tiếp MP4

    async function loadStreams(url, cb) {
        try {
            const res = await http_get(url, HEADERS);
            if (!res || !res.body)
                return cb({ success: false, errorCode: "STREAM_ERROR", message: "Failed to fetch page" });

            const html = res.body;

            // 1. Lấy videoId từ pageContext hoặc URL
            const pageContextStr = findJsVarContent(html, "pageContext");
            let videoId = extractJsVar(pageContextStr, "videoId");
            if (!videoId) {
                // Fallback: lấy từ URL dạng /video/VIDEOID/
                const urlMatch = url.match(/\/video\/(\d+)\//);
                videoId = urlMatch ? urlMatch[1] : null;
            }

            // 2. Lấy group từ og:image poster URL
            const posterUrl = html.match(/property="og:image"\s+content="([^"]+)"/i)?.[1]
                || html.match(/content="([^"]+)"\s+property="og:image"/i)?.[1];
            const group = extractGroupFromPoster(posterUrl);

            if (!videoId || !group) {
                return cb({ success: false, errorCode: "STREAM_ERROR", message: `Không lấy được videoId(${videoId}) hoặc group(${group})` });
            }

            // 3. Build stream URLs — theo đúng logic Kotlin:
            // 1080p: storageUrl/group/videoId/videoId_1080p.mp4
            // 720p:  storageUrl/group/videoId/videoId_720p.mp4
            // 480p:  storageUrl/group/videoId/videoId.mp4  (không có suffix)
            const qualities = [
                { label: "1080p", suffix: "_1080p", quality: 1080 },
                { label: "720p",  suffix: "_720p",  quality: 720  },
                { label: "480p",  suffix: "",       quality: 480  },
            ];

            const streams = qualities.map(q => new StreamResult({
                url: `${STORAGE_URL}/${group}/${videoId}/${videoId}${q.suffix}.mp4`,
                source: `xNhau ${q.label}`,
                quality: q.quality,
                headers: { "Referer": BASE_URL, "User-Agent": UA }
            }));

            // Trả về tất cả, SkyStream player sẽ tự fallback nếu link nào không tồn tại
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
