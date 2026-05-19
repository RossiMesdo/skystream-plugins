(function () {
    /**
     * @type {import('@skystream/sdk').Manifest}
     * XXXParodyHD Plugin for SkyStream
     * Converted from CloudStream (Kotlin) by Claude
     * Original author: @Kraptor123 for @Cs-GizliKeyif
     */

    const BASE_URL = manifest?.baseUrl || "https://xxxparodyhd.net";

    const CATEGORIES = [
        { name: "Movies",          url: `${BASE_URL}/movies/` },
        { name: "18+ Teens",       url: `${BASE_URL}/genre/free-18-teens/` },
        { name: "All Girl",        url: `${BASE_URL}/genre/free-all-girl/` },
        { name: "All Sex",         url: `${BASE_URL}/genre/free-all-sex/` },
        { name: "Amateurs",        url: `${BASE_URL}/genre/free-amateurs/` },
        { name: "Anal",            url: `${BASE_URL}/genre/free-anal/` },
        { name: "Anal Creampie",   url: `${BASE_URL}/genre/free-anal-creampie/` },
        { name: "Animation",       url: `${BASE_URL}/genre/free-animation/` },
        { name: "Asian",           url: `${BASE_URL}/genre/free-asian/` },
        { name: "Ass to Mouth",    url: `${BASE_URL}/genre/free-ass-to-mouth/` },
        { name: "Babysitter",      url: `${BASE_URL}/genre/free-babysitter/` },
        { name: "BDSM",            url: `${BASE_URL}/genre/free-bdsm/` },
        { name: "Beach",           url: `${BASE_URL}/genre/free-beach/` },
        { name: "Big Boobs",       url: `${BASE_URL}/genre/free-big-boobs/` },
        { name: "Big Butt",        url: `${BASE_URL}/genre/free-big-butt/` },
        { name: "Big Cocks",       url: `${BASE_URL}/genre/free-big-cocks/` },
        { name: "Blondes",         url: `${BASE_URL}/genre/free-blondes/` },
        { name: "Blowjobs",        url: `${BASE_URL}/genre/free-blowjobs/` },
        { name: "Brazilian",       url: `${BASE_URL}/genre/free-brazilian/` },
        { name: "Cheerleaders",    url: `${BASE_URL}/genre/free-cheerleaders/` },
        { name: "College",         url: `${BASE_URL}/genre/free-college/` },
        { name: "Cougars",         url: `${BASE_URL}/genre/free-cougars/` },
        { name: "Couples",         url: `${BASE_URL}/genre/free-couples/` },
        { name: "Creampie",        url: `${BASE_URL}/genre/free-creampie/` },
        { name: "Cumshots",        url: `${BASE_URL}/genre/free-cumshots/` },
        { name: "Czech",           url: `${BASE_URL}/genre/free-czech/` },
        { name: "Deep Throat",     url: `${BASE_URL}/genre/free-deep-throat/` },
        { name: "Erotica",         url: `${BASE_URL}/genre/free-erotica/` },
        { name: "European",        url: `${BASE_URL}/genre/free-european/` },
        { name: "Facesitting",     url: `${BASE_URL}/genre/free-facesitting/` },
        { name: "Facials",         url: `${BASE_URL}/genre/free-facials/` },
        { name: "Family Roleplay", url: `${BASE_URL}/genre/free-family-roleplay/` },
        { name: "Fantasy",         url: `${BASE_URL}/genre/free-fantasy/` },
        { name: "Feature",         url: `${BASE_URL}/genre/free-feature/` },
        { name: "Fetish",          url: `${BASE_URL}/genre/free-fetish/` },
        { name: "Fingering",       url: `${BASE_URL}/genre/free-fingering/` },
        { name: "Gangbang",        url: `${BASE_URL}/genre/free-gangbang/` },
        { name: "German",          url: `${BASE_URL}/genre/free-german/` },
        { name: "Hairy",           url: `${BASE_URL}/genre/free-hairy/` },
        { name: "Handjobs",        url: `${BASE_URL}/genre/free-handjobs/` },
        { name: "Hardcore",        url: `${BASE_URL}/genre/free-hardcore/` },
        { name: "Hentai",          url: `${BASE_URL}/genre/free-hentai/` },
        { name: "Italian",         url: `${BASE_URL}/genre/free-italian/` },
        { name: "Japanese",        url: `${BASE_URL}/genre/free-japanese/` },
        { name: "Latin",           url: `${BASE_URL}/genre/free-latin/` },
        { name: "Lesbian",         url: `${BASE_URL}/genre/free-lesbian/` },
        { name: "Lingerie",        url: `${BASE_URL}/genre/free-lingerie/` },
        { name: "Massage",         url: `${BASE_URL}/genre/free-massage/` },
        { name: "Masturbation",    url: `${BASE_URL}/genre/free-masturbation/` },
        { name: "Mature",          url: `${BASE_URL}/genre/free-mature/` },
        { name: "MILF",            url: `${BASE_URL}/genre/free-milf/` },
        { name: "Mystery",         url: `${BASE_URL}/genre/free-mystery/` },
        { name: "Oiled",           url: `${BASE_URL}/genre/free-oiled/` },
        { name: "Outdoors",        url: `${BASE_URL}/genre/free-outdoors/` },
        { name: "Parody",          url: `${BASE_URL}/genre/free-parody/` },
        { name: "POV",             url: `${BASE_URL}/genre/free-pov/` },
        { name: "Public Sex",      url: `${BASE_URL}/genre/free-public-sex/` },
        { name: "Small Tits",      url: `${BASE_URL}/genre/free-small-tits/` },
        { name: "Squirting",       url: `${BASE_URL}/genre/free-squirting/` },
        { name: "Stockings",       url: `${BASE_URL}/genre/free-stockings/` },
        { name: "Tattoos",         url: `${BASE_URL}/genre/free-tattoos/` },
        { name: "Threesomes",      url: `${BASE_URL}/genre/free-threesomes/` },
        { name: "Virgin",          url: `${BASE_URL}/genre/free-virgin/` },
    ];

    // --- Helpers ---

    function fixUrl(url) {
        if (!url) return null;
        if (url.startsWith("//")) return "https:" + url;
        if (url.startsWith("http")) return url;
        return BASE_URL + (url.startsWith("/") ? url : "/" + url);
    }

    function parseItems(html) {
        const items = [];
        // Match each ml-item block
        const itemRegex = /<div[^>]+class="[^"]*ml-item[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g;
        let match;
        while ((match = itemRegex.exec(html)) !== null) {
            const block = match[0];

            const titleMatch = block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
            const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, "").trim() : null;
            if (!title) continue;

            const hrefMatch = block.match(/<a[^>]+href="([^"]+)"/i);
            const href = hrefMatch ? fixUrl(hrefMatch[1]) : null;
            if (!href) continue;

            const imgMatch = block.match(/<img[^>]+src="([^"]+)"/i);
            const posterUrl = imgMatch ? fixUrl(imgMatch[1]) : null;

            items.push(new MultimediaItem({
                title: title,
                url: href,
                posterUrl: posterUrl,
                type: "movie",
                isAdult: true,
                contentRating: "18+"
            }));
        }
        return items;
    }

    // --- Core Functions ---

    // Fetch one category page, supports pagination via page param
    async function fetchCategoryPage(baseUrl, page) {
        const url = page && page > 1 ? `${baseUrl}page/${page}/` : baseUrl;
        const res = await http_get(url, { "Referer": BASE_URL });
        if (!res || res.status !== 200) return [];
        return parseItems(res.body || "");
    }

    async function getHome(cb) {
        try {
            const homeData = {};

            // Fetch first 4 categories in parallel
            const firstBatch = CATEGORIES.slice(0, 4);
            const results = await Promise.allSettled(
                firstBatch.map(async function (cat) {
                    const items = await fetchCategoryPage(cat.url, 1);
                    return { name: cat.name, items };
                })
            );

            results.forEach(function (result) {
                if (result.status !== "fulfilled") return;
                if (!result.value.items.length) return;
                homeData[result.value.name] = result.value.items;
            });

            // Fetch remaining categories sequentially
            for (let i = 4; i < CATEGORIES.length; i++) {
                try {
                    const items = await fetchCategoryPage(CATEGORIES[i].url, 1);
                    if (items.length) homeData[CATEGORIES[i].name] = items;
                } catch (_) {}
            }

            if (!Object.keys(homeData).length) {
                return cb({ success: false, errorCode: "HOME_ERROR", message: "No home sections available" });
            }

            cb({ success: true, data: homeData });
        } catch (e) {
            cb({ success: false, errorCode: "HOME_ERROR", message: e.message });
        }
    }

    async function search(query, cb) {
        try {
            const url = `${BASE_URL}/search/${encodeURIComponent(query)}`;
            const res = await http_get(url, { "Referer": BASE_URL });
            if (!res || res.status !== 200) {
                return cb({ success: false, errorCode: "SEARCH_ERROR", message: "Request failed" });
            }
            const items = parseItems(res.body || "");
            cb({ success: true, data: items });
        } catch (e) {
            cb({ success: false, errorCode: "SEARCH_ERROR", message: e.message });
        }
    }

    async function load(url, cb) {
        try {
            const res = await http_get(url, { "Referer": BASE_URL });
            if (!res || res.status !== 200) {
                return cb({ success: false, message: "Failed to load page" });
            }
            const html = res.body || "";

            // Title
            const titleMatch = html.match(/<div[^>]+class="[^"]*mvic-desc[^"]*"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/i);
            const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, "").trim() : null;
            if (!title) return cb({ success: false, message: "Title not found" });

            // Poster
            const posterMatch = html.match(/<div[^>]+class="[^"]*thumb[^"]*"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/i);
            const posterUrl = posterMatch ? fixUrl(posterMatch[1]) : null;

            // Description
            const descMatch = html.match(/<div[^>]+class="[^"]*mvic-desc[^"]*"[^>]*>[\s\S]*?<div[^>]+class="[^"]*desc[^"]*"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
            const description = descMatch ? descMatch[1].replace(/<[^>]*>/g, "").trim() : null;

            // Year — looks for "Released Date:" row
            const yearMatch = html.match(/Released Date:[^<]*,\s*(\d{4})/i);
            const year = yearMatch ? parseInt(yearMatch[1]) : undefined;

            // Duration in minutes
            const durationMatch = html.match(/(\d+)\s*mins/i);
            const duration = durationMatch ? parseInt(durationMatch[1]) : undefined;

            // Genres/Tags
            const tags = [];
            const genreBlockMatch = html.match(/Genres:[\s\S]*?(<span[\s\S]*?<\/p>)/i);
            if (genreBlockMatch) {
                const tagRegex = /<a[^>]*>([\s\S]*?)<\/a>/g;
                let tagMatch;
                while ((tagMatch = tagRegex.exec(genreBlockMatch[1])) !== null) {
                    const t = tagMatch[1].replace(/<[^>]*>/g, "").trim();
                    if (t) tags.push(t);
                }
            }

            // Cast (Pornstars)
            const cast = [];
            const pornstarBlockMatch = html.match(/Pornstars:[\s\S]*?(<span[\s\S]*?<\/p>)/i);
            if (pornstarBlockMatch) {
                const actorRegex = /<a[^>]*>([\s\S]*?)<\/a>/g;
                let actorMatch;
                while ((actorMatch = actorRegex.exec(pornstarBlockMatch[1])) !== null) {
                    const name = actorMatch[1].replace(/<[^>]*>/g, "").trim();
                    if (name) cast.push(new Actor({ name }));
                }
            }

            // Recommendations
            const recommendations = parseItems(html);

            const result = new MultimediaItem({
                title,
                url,
                posterUrl,
                type: "movie",
                description,
                year,
                duration,
                tags: tags.length ? tags : undefined,
                cast: cast.length ? cast : undefined,
                recommendations: recommendations.length ? recommendations : undefined,
                isAdult: true,
                contentRating: "18+"
            });

            cb({ success: true, data: result });
        } catch (e) {
            cb({ success: false, errorCode: "LOAD_ERROR", message: e.message });
        }
    }

    // Danh sách domain video host hợp lệ
    const VIDEO_HOSTS = [
        "dood", "doply", "mixdrop", "voe.sx", "streamtape",
        "luluvid", "lulustream", "rpmplay", "rpmshare",
        "upns.online", "upnshare", "player4me", "embedseek",
        "seekplayer", "seekstreaming", "easyvidplayer", "easyvidplay",
        "filemoon", "streamwish", "vidoza", "upstream",
        "fembed", "mp4upload", "vidlox", "burstcloud"
    ];

    // Domain rác cần bỏ qua
    const SKIP_HOSTS = ["localnews.click", "google.com", "xxxparodyhd.net", "nitroflare", "frdl.io", "freedl"];

    function isVideoHost(url) {
        const u = url.toLowerCase();
        return VIDEO_HOSTS.some(function (h) { return u.includes(h); });
    }

    function isBadUrl(url) {
        const u = url.toLowerCase();
        return SKIP_HOSTS.some(function (h) { return u.includes(h); });
    }

    async function loadStreams(url, cb) {
        try {
            const res = await http_get(url, {
                "Referer": BASE_URL,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
            });

            if (!res || res.status !== 200) {
                return cb({ success: false, errorCode: "STREAM_ERROR", message: "HTTP error: " + (res && res.status) });
            }

            const html = res.body || "";

            // HTML thực tế có dạng:
            // <a href="https://doply.net/e/xxx" rel="nofollow" id="#iframe">...</a>
            // Đây chính xác là cấu trúc CloudStream parse bằng: document.select("div.Rtable1 a#\\#iframe")
            const videoUrls = [];

            // Method 1: tìm chính xác thẻ <a> có id="#iframe"
            const iframeTagRegex = /<a[^>]+id="#iframe"[^>]*href="(https?:\/\/[^"]+)"|<a[^>]+href="(https?:\/\/[^"]+)"[^>]+id="#iframe"/gi;
            let m;
            while ((m = iframeTagRegex.exec(html)) !== null) {
                const u = (m[1] || m[2] || "").trim();
                if (u && !isBadUrl(u)) videoUrls.push(u);
            }

            // Method 2: fallback — tìm trong div.Rtable1, lấy tất cả href không phải rác
            if (!videoUrls.length) {
                const rtableMatch = html.match(/<div[^>]+class="[^"]*Rtable1[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div[^>]+class="[^"]*Rtable1/i);
                const rtableArea = rtableMatch ? rtableMatch[1] : html;
                const fallbackRegex = /href="(https?:\/\/[^"]+)"/gi;
                while ((m = fallbackRegex.exec(rtableArea)) !== null) {
                    const u = m[1].trim();
                    if (u && !isBadUrl(u) && (isVideoHost(u) || /\/e\/[a-z0-9]+/i.test(u))) {
                        videoUrls.push(u);
                    }
                }
            }

            // Method 3: fallback toàn trang — lấy href có /e/ hoặc host video đã biết
            if (!videoUrls.length) {
                const globalRegex = /href="(https?:\/\/[^"]+)"/gi;
                while ((m = globalRegex.exec(html)) !== null) {
                    const u = m[1].trim();
                    if (u && !isBadUrl(u) && isVideoHost(u)) {
                        videoUrls.push(u);
                    }
                }
            }

            if (!videoUrls.length) {
                return cb({ success: false, errorCode: "STREAM_ERROR", message: "No streams found for this movie" });
            }

            const streamResults = [];

            await Promise.allSettled(
                videoUrls.map(async function (videoUrl) {
                    if (typeof globalThis.loadExtractor === "function") {
                        try {
                            const before = streamResults.length;
                            await globalThis.loadExtractor(videoUrl, function (stream) {
                                streamResults.push(stream);
                            });
                            // Nếu extractor xử lý được thì thôi
                            if (streamResults.length > before) return;
                        } catch (_) {}
                    }
                    // Fallback: push thẳng URL
                    streamResults.push(new StreamResult({
                        url: videoUrl,
                        source: "XXXParodyHD - " + (videoUrl.match(/(?:https?:\/\/)?(?:www\.)?([^./]+)/)?.[1] || "stream"),
                        headers: { "Referer": BASE_URL }
                    }));
                })
            );

            // Deduplicate theo url
            const deduped = [];
            const seen = new Set();
            streamResults.forEach(function (item) {
                if (!item || !item.url) return;
                if (seen.has(item.url)) return;
                seen.add(item.url);
                deduped.push(item);
            });

            if (!deduped.length) {
                return cb({ success: false, errorCode: "STREAM_ERROR", message: "Extractors could not resolve any streams" });
            }

            cb({ success: true, data: deduped });
        } catch (e) {
            cb({ success: false, errorCode: "STREAM_ERROR", message: e.message });
        }
    }

    // Export
    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();
