(function () {
    /**
     * XVideos Plugin for SkyStream
     * Ported from CloudStream cs3xxx (jacekun)
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
        { name: "Main Page",  url: MAIN_URL },
        { name: "New",        url: `${MAIN_URL}/new/` },
        { name: "Best",       url: `${MAIN_URL}/best/` },
        { name: "Top",        url: `${MAIN_URL}/top/` },
        { name: "HD",         url: `${MAIN_URL}/new/hd/` },
        { name: "This Week",  url: `${MAIN_URL}/best/7days/` },
        { name: "This Month", url: `${MAIN_URL}/best/month/` },
        { name: "Anal",       url: `${MAIN_URL}/c/anal-sex/1/` },
        { name: "Asian",      url: `${MAIN_URL}/c/asian-women/5/` },
        { name: "Big Ass",    url: `${MAIN_URL}/c/big-ass/11/` },
        { name: "Big Tits",   url: `${MAIN_URL}/c/big-tits/2/` },
        { name: "Blowjob",    url: `${MAIN_URL}/c/blowjob/6/` },
        { name: "Creampie",   url: `${MAIN_URL}/c/creampie/14/` },
        { name: "Homemade",   url: `${MAIN_URL}/c/amateur/17/` },
        { name: "Japanese",   url: `${MAIN_URL}/c/japanese/32/` },
        { name: "Lesbian",    url: `${MAIN_URL}/c/lesbian/22/` },
        { name: "MILF",       url: `${MAIN_URL}/c/milf/44/` },
        { name: "POV",        url: `${MAIN_URL}/c/pov/19/` },
        { name: "Teen",       url: `${MAIN_URL}/c/teen/3/` },
        { name: "Threesome",  url: `${MAIN_URL}/c/threesome/45/` },
        { name: "Cumshot",    url: `${MAIN_URL}/c/cumshot/62/` },
        { name: "Latina",     url: `${MAIN_URL}/c/latina/23/` },
        { name: "Ebony",      url: `${MAIN_URL}/c/ebony/21/` },
        { name: "European",   url: `${MAIN_URL}/c/european/56/` },
        { name: "Massage",    url: `${MAIN_URL}/c/massage/46/` },
        { name: "Solo",       url: `${MAIN_URL}/c/solo/38/` },
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

    // Parse div.thumb-block — selector đúng theo cs3xxx
    function parseThumbBlocks(html) {
        const items = [];
        const seen = new Set();

        const parts = html.split(/<div[^>]+class="[^"]*thumb-block[^"]*"[^>]*>/i);
        for (let i = 1; i < parts.length; i++) {
            const block = parts[i];

            // title: p.title a — text()
            const titleMatch = block.match(/<p[^>]+class="[^"]*title[^"]*"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i);
            const title = titleMatch ? titleMatch[1].trim() : null;

            // href: div.thumb a — attr("href")
            const hrefMatch = block.match(/<div[^>]+class="[^"]*\bthumb\b[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"/i);
            const href = hrefMatch ? fixUrl(hrefMatch[1]) : null;

            if (!href || !title || seen.has(href)) continue;
            seen.add(href);

            // poster: div.thumb a img — attr("data-src")
            const imgMatch = block.match(/<div[^>]+class="[^"]*\bthumb\b[^"]*"[^>]*>[\s\S]*?<img[^>]+data-src="([^"]+)"/i);
            const poster = imgMatch ? fixUrl(imgMatch[1]) : null;

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

    // Extract stream links từ script — đúng theo cs3xxx
    function extractFromScript(scriptText) {
        const links = [];

        const hlsMatch = scriptText.match(/html5player\.setVideoHLS\('([^']+)'\)/i)
            || scriptText.match(/\.setVideoHLS\('([^']+)'\)/i);
        if (hlsMatch?.[1]) links.push({ url: hlsMatch[1].trim(), quality: "HLS" });

        const highMatch = scriptText.match(/html5player\.setVideoUrlHigh\('([^']+)'\)/i)
            || scriptText.match(/\.setVideoUrlHigh\('([^']+)'\)/i);
        if (highMatch?.[1]) links.push({ url: highMatch[1].trim(), quality: "High" });

        const lowMatch = scriptText.match(/html5player\.setVideoUrlLow\('([^']+)'\)/i)
            || scriptText.match(/\.setVideoUrlLow\('([^']+)'\)/i);
        if (lowMatch?.[1]) links.push({ url: lowMatch[1].trim(), quality: "Low" });

        const contentUrlMatch = scriptText.match(/"contentUrl"\s*:\s*"([^"]+)"/i);
        if (contentUrlMatch?.[1]) {
            const u = contentUrlMatch[1].replace(/\\\//g, "/");
            links.push({ url: u, quality: "Auto" });
        }

        return links;
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
                        return { name: cat.name, items: parseThumbBlocks(res.body) };
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
                return cb({ success: false, errorCode: "HOME_ERROR", message: "No data found" });

            cb({ success: true, data: homeData });
        } catch (e) {
            cb({ success: false, errorCode: "HOME_ERROR", message: e.message });
        }
    }

    // ==================== search ====================

    async function search(query, cb) {
        try {
            const url = `${MAIN_URL}?k=${encodeURIComponent(query)}`;
            const res = await http_get(url, HEADERS);
            if (!res || !res.body) return cb({ success: true, data: [] });
            cb({ success: true, data: parseThumbBlocks(res.body) });
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
            const isChannel = url.includes("/channels") || url.includes("/pornstars");

            // Title
            let title;
            if (isChannel) {
                title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
            } else {
                title = html.match(/<[^>]+class="[^"]*page-title[^"]*"[^>]*>([^<]+)</i)?.[1]?.trim();
            }
            title = title || "Unknown";

            // Poster
            let poster;
            if (isChannel) {
                poster = fixUrl(html.match(/<img[^>]+class="[^"]*profile-pic[^"]*"[^>]+data-src="([^"]+)"/i)?.[1]);
            } else {
                poster = fixUrl(
                    html.match(/property="og:image"\s+content="([^"]+)"/i)?.[1] ||
                    html.match(/content="([^"]+)"\s+property="og:image"/i)?.[1]
                );
            }

            // Tags — cs3xxx: .video-tags-list li a
            const tags = [];
            const tagsSection = html.match(/<ul[^>]+class="[^"]*video-tags-list[^"]*"[^>]*>([\s\S]*?)<\/ul>/i)?.[1] || "";
            const tagLinkRegex = /<a[^>]*>([^<]+)<\/a>/gi;
            let tm;
            while ((tm = tagLinkRegex.exec(tagsSection)) !== null) {
                const t = tm[1].trim().replace(/,\s*$/, "");
                if (t && !tags.includes(t)) tags.push(t);
            }

            // Episode bắt buộc để nút Watch không bị xám
            const episode = new Episode({
                name: title,
                url: url,
                season: 1,
                episode: 1,
                dubStatus: "none",
                posterUrl: poster || undefined
            });

            cb({
                success: true,
                data: new MultimediaItem({
                    title,
                    url,
                    posterUrl: poster,
                    type: "movie",
                    tags: tags.length ? tags : undefined,
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
    // Đúng theo cs3xxx: tìm script chứa "HTML5Player", extract setVideoHLS / setVideoUrlHigh / setVideoUrlLow

    async function loadStreams(url, cb) {
        try {
            const res = await http_get(url, HEADERS);
            if (!res || !res.body)
                return cb({ success: false, errorCode: "STREAM_ERROR", message: "Failed to fetch page" });

            const html = res.body;
            const streams = [];

            const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
            let sm;
            while ((sm = scriptRegex.exec(html)) !== null) {
                const scriptText = sm[1];
                if (!scriptText.includes("HTML5Player") && !scriptText.includes("html5player")) continue;

                for (const link of extractFromScript(scriptText)) {
                    if (!link.url?.startsWith("http")) continue;
                    streams.push(new StreamResult({
                        url: link.url,
                        source: `XVideos ${link.quality}`,
                        quality: link.quality,
                        headers: { "Referer": MAIN_URL, "User-Agent": UA }
                    }));
                }
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