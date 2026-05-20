(function () {
    /**
     * XVideos Plugin for SkyStream
     * Ported from CloudStream (CXXX repo)
     * Author: Lord
     */

    const MAIN_URL = (typeof manifest !== "undefined" && manifest?.baseUrl) || "https://www.xvideos.com";
    const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
    const HEADERS = {
        "User-Agent": UA,
        "Referer": MAIN_URL,
        "Accept-Language": "en-US,en;q=0.9"
    };

    const CATEGORIES = [
        { name: "🔥 New Videos",   url: `${MAIN_URL}/new` },
        { name: "👁 Most Viewed",   url: `${MAIN_URL}/best` },
        { name: "⭐ Top Rated",    url: `${MAIN_URL}/top` },
        { name: "📅 This Week",    url: `${MAIN_URL}/best/7days` },
        { name: "📅 This Month",   url: `${MAIN_URL}/best/month` },
        { name: "🎬 HD Videos",    url: `${MAIN_URL}/new/hd` },
        { name: "💋 Anal",         url: `${MAIN_URL}/c/anal-sex/1` },
        { name: "🏳️ Asian",        url: `${MAIN_URL}/c/asian-women/5` },
        { name: "🍑 Big Ass",      url: `${MAIN_URL}/c/big-ass/11` },
        { name: "🔵 Big Tits",     url: `${MAIN_URL}/c/big-tits/2` },
        { name: "👄 Blowjob",      url: `${MAIN_URL}/c/blowjob/6` },
        { name: "🤍 Creampie",     url: `${MAIN_URL}/c/creampie/14` },
        { name: "🏠 Homemade",     url: `${MAIN_URL}/c/amateur/17` },
        { name: "🎌 Japanese",     url: `${MAIN_URL}/c/japanese/32` },
        { name: "👩 Lesbian",      url: `${MAIN_URL}/c/lesbian/22` },
        { name: "🌶️ MILF",         url: `${MAIN_URL}/c/milf/44` },
        { name: "📸 POV",          url: `${MAIN_URL}/c/pov/19` },
        { name: "🟣 Threesome",    url: `${MAIN_URL}/c/threesome/45` },
        { name: "🎓 Teen",         url: `${MAIN_URL}/c/teen/3` },
        { name: "📹 Cumshot",      url: `${MAIN_URL}/c/cumshot/62` },
        { name: "🔴 Latina",       url: `${MAIN_URL}/c/latina/23` },
        { name: "🖤 Ebony",        url: `${MAIN_URL}/c/ebony/21` },
        { name: "🇪🇺 European",    url: `${MAIN_URL}/c/european/56` },
        { name: "💆 Massage",      url: `${MAIN_URL}/c/massage/46` },
        { name: "📱 Solo",         url: `${MAIN_URL}/c/solo/38` },
    ];

    // ==================== HELPERS ====================

    function fixUrl(url) {
        if (!url) return null;
        url = url.trim();
        if (url.startsWith("//")) return "https:" + url;
        if (url.startsWith("http")) return url;
        if (url.startsWith("/")) return MAIN_URL + url;
        return null;
    }

    function stripTags(html) {
        return (html || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
    }

    function unescapeUnicode(str) {
        if (!str) return str;
        return str.replace(/\\u([0-9a-fA-F]{4})/g, (_, code) =>
            String.fromCharCode(parseInt(code, 16))
        ).replace(/\\\//g, "/");
    }

    function parseItems(html) {
        const items = [];
        const seen = new Set();

        const blockRegex = /<div[^>]+class="[^"]*thumb-block[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]+class="[^"]*thumb-block|$)/gi;
        let match;
        while ((match = blockRegex.exec(html)) !== null) {
            const block = match[0];

            const titleTagMatch =
                block.match(/<p[^>]+class="[^"]*title[^"]*"[^>]*>[\s\S]*?<a[^>]+title="([^"]+)"[^>]+href="([^"]+)"/i) ||
                block.match(/<p[^>]+class="[^"]*title[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);

            let title, href;
            if (titleTagMatch) {
                if (titleTagMatch[2] && titleTagMatch[2].startsWith("/")) {
                    title = titleTagMatch[1];
                    href = titleTagMatch[2];
                } else {
                    href = titleTagMatch[1];
                    title = stripTags(titleTagMatch[2]);
                }
            }
            if (!href || !title) continue;

            const cleanMatch = href.match(/^(\/video\.[^/]+)\/[^/]+\/[^/]+\/(.+)$/);
            if (cleanMatch) href = `${cleanMatch[1]}/${cleanMatch[2]}`;
            const fullUrl = fixUrl(href);
            if (!fullUrl || seen.has(fullUrl)) continue;
            seen.add(fullUrl);

            const imgMatch = block.match(/<img[^>]+>/i);
            let poster = null;
            if (imgMatch) {
                const imgTag = imgMatch[0];
                const dataSrc = imgTag.match(/data-src="([^"]+)"/i)?.[1];
                const src = imgTag.match(/\bsrc="([^"]+)"/i)?.[1];
                const candidate = dataSrc || src;
                if (candidate && !candidate.includes("lightbox-blank")) {
                    poster = fixUrl(candidate);
                }
            }

            items.push(new MultimediaItem({
                title: title.trim(),
                url: fullUrl,
                posterUrl: poster,
                type: "movie",
                isAdult: true,
                contentRating: "18+"
            }));
        }
        return items;
    }

    // ==================== getHome ====================

    async function getHome(cb) {
        try {
            const homeData = {};
            const results = await Promise.allSettled(
                CATEGORIES.map(async (cat) => {
                    try {
                        const res = await http_get(cat.url, HEADERS);
                        if (!res || !res.body) return { name: cat.name, items: [] };
                        return { name: cat.name, items: parseItems(res.body) };
                    } catch (_) {
                        return { name: cat.name, items: [] };
                    }
                })
            );

            results.forEach(r => {
                if (r.status === "fulfilled" && r.value.items.length > 0)
                    homeData[r.value.name] = r.value.items;
            });

            if (!Object.keys(homeData).length)
                return cb({ success: false, errorCode: "HOME_ERROR", message: "Failed to load home" });

            cb({ success: true, data: homeData });
        } catch (e) {
            cb({ success: false, errorCode: "HOME_ERROR", message: e.message });
        }
    }

    // ==================== search ====================

    async function search(query, cb) {
        try {
            const url = `${MAIN_URL}/?k=${encodeURIComponent(query)}`;
            const res = await http_get(url, HEADERS);
            if (!res || !res.body) return cb({ success: true, data: [] });
            cb({ success: true, data: parseItems(res.body) });
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

            const title =
                stripTags(html.match(/<h2[^>]+class="[^"]*page-title[^"]*"[^>]*>([\s\S]*?)<\/h2>/i)?.[1] || "")
                    .replace(/\s*\d+\s*min\s*$/i, "").trim() ||
                html.match(/property="og:title"\s+content="([^"]+)"/i)?.[1] ||
                "Unknown";

            const poster = fixUrl(
                html.match(/property="og:image"\s+content="([^"]+)"/i)?.[1] ||
                html.match(/content="([^"]+)"\s+property="og:image"/i)?.[1]
            );

            const description =
                html.match(/name="description"\s+content="([^"]+)"/i)?.[1] ||
                html.match(/content="([^"]+)"\s+name="description"/i)?.[1];

            // Tags — từ xv.conf (chuẩn nhất) rồi fallback DOM
            let tags = [];
            const xvConfScript = html.match(/xv\.conf\s*=\s*\{([\s\S]*?)\};/)?.[1];
            if (xvConfScript) {
                const tagsMatch = xvConfScript.match(/"video_tags"\s*:\s*(\[[\s\S]*?\])/);
                if (tagsMatch) {
                    try { tags = JSON.parse(tagsMatch[1]).filter(Boolean); } catch (_) {}
                }
            }
            if (!tags.length) {
                const tagRegex = /<a[^>]+class="[^"]*is-keyword[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
                let tm;
                while ((tm = tagRegex.exec(html)) !== null) {
                    const t = stripTags(tm[1]);
                    if (t && !tags.includes(t)) tags.push(t);
                }
            }

            const uploaderName = html.match(/<li[^>]+class="[^"]*main-uploader[^"]*"[^>]*>[\s\S]*?<span[^>]+class="[^"]*name[^"]*"[^>]*>([\s\S]*?)<\/span>/i)?.[1]?.trim();

            // Recommendations từ var video_related
            const recommendations = [];
            const scriptContent = html.match(/var video_related\s*=\s*\[([\s\S]*?)\];/)?.[1];
            if (scriptContent) {
                const itemRegex = /\{[^}]*"u"\s*:\s*"([^"]+)"[^}]*"i"\s*:\s*"([^"]+)"[^}]*"tf"\s*:\s*"([^"]+)"[^}]*\}/g;
                let rm;
                while ((rm = itemRegex.exec(scriptContent)) !== null) {
                    try {
                        const recHref = fixUrl(unescapeUnicode(rm[1]));
                        const recPoster = fixUrl(unescapeUnicode(rm[2]));
                        const recTitle = unescapeUnicode(rm[3]);
                        if (recTitle && recHref)
                            recommendations.push(new MultimediaItem({
                                title: recTitle, url: recHref, posterUrl: recPoster,
                                type: "movie", isAdult: true, contentRating: "18+"
                            }));
                    } catch (_) {}
                }
            }

            // Duration
            const durationStr = html.match(/<span[^>]+class="[^"]*duration[^"]*"[^>]*>([\s\S]*?)<\/span>/i)?.[1]?.trim();
            let duration = null;
            if (durationStr) {
                const hMatch = durationStr.match(/(\d+)\s*h/i);
                const mMatch = durationStr.match(/(\d+)\s*min/i);
                const sMatch = durationStr.match(/(\d+)\s*sec/i);
                duration = ((hMatch ? parseInt(hMatch[1]) * 60 : 0) + (mMatch ? parseInt(mMatch[1]) : 0)) || (sMatch ? 1 : null);
            }

            // Episode bắt buộc để nút Watch không bị xám
            const episode = new Episode({
                name: title,
                url: url,
                season: 1,
                episode: 1,
                dubStatus: "none",
                runtime: duration || undefined,
                posterUrl: poster || undefined
            });

            cb({
                success: true,
                data: new MultimediaItem({
                    title, url, posterUrl: poster,
                    type: "movie",
                    description: description || undefined,
                    tags: tags.length ? tags : undefined,
                    cast: uploaderName ? [new Actor({ name: uploaderName, role: "Uploader" })] : undefined,
                    duration: duration || undefined,
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

    async function loadStreams(url, cb) {
        try {
            const res = await http_get(url, HEADERS);
            if (!res || !res.body)
                return cb({ success: false, errorCode: "STREAM_ERROR", message: "Failed to fetch page" });

            const html = res.body;
            const streams = [];
            const seen = new Set();

            const urlRegex = /['"](https?:\/\/[^\s'"]+\.(?:mp4|m3u8)[^\s'"]*)['"]/gi;
            let m;
            while ((m = urlRegex.exec(html)) !== null) {
                const streamUrl = m[1];
                if (seen.has(streamUrl)) continue;
                seen.add(streamUrl);
                if (streamUrl.includes("thumb") || streamUrl.includes("preview") || streamUrl.includes("screenshot")) continue;

                let quality = "Auto";
                if (streamUrl.includes("1080")) quality = "1080p";
                else if (streamUrl.includes("720")) quality = "720p";
                else if (streamUrl.includes("480")) quality = "480p";
                else if (streamUrl.includes("360")) quality = "360p";
                else if (streamUrl.includes("m3u8") || streamUrl.includes("hls")) quality = "HLS";

                streams.push(new StreamResult({
                    url: streamUrl,
                    source: `XVideos ${quality}`,
                    quality: quality,
                    headers: { "Referer": MAIN_URL, "User-Agent": UA }
                }));
            }

            if (!streams.length)
                return cb({ success: false, errorCode: "STREAM_ERROR", message: "No streams found" });

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