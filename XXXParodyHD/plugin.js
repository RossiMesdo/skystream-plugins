(function () {
    /**
     * XXXParodyHD Plugin for SkyStream
     * Converted from CloudStream (Kotlin)
     * Original: @Kraptor123 for @Cs-GizliKeyif
     */

    const BASE_URL = (typeof manifest !== "undefined" && manifest?.baseUrl) || "https://xxxparodyhd.net";
    const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0";
    const HEADERS = { "User-Agent": UA, "Referer": BASE_URL };

    const CATEGORIES = [
        { name: "Movies",          url: `${BASE_URL}/movies/` },
        { name: "18+ Teens",       url: `${BASE_URL}/genre/free-18-teens/` },
        { name: "All Girl",        url: `${BASE_URL}/genre/free-all-girl/` },
        { name: "All Sex",         url: `${BASE_URL}/genre/free-all-sex/` },
        { name: "Amateurs",        url: `${BASE_URL}/genre/free-amateurs/` },
        { name: "Anal",            url: `${BASE_URL}/genre/free-anal/` },
        { name: "Animation",       url: `${BASE_URL}/genre/free-animation/` },
        { name: "Asian",           url: `${BASE_URL}/genre/free-asian/` },
        { name: "BDSM",            url: `${BASE_URL}/genre/free-bdsm/` },
        { name: "Big Boobs",       url: `${BASE_URL}/genre/free-big-boobs/` },
        { name: "Blowjobs",        url: `${BASE_URL}/genre/free-blowjobs/` },
        { name: "Creampie",        url: `${BASE_URL}/genre/free-creampie/` },
        { name: "European",        url: `${BASE_URL}/genre/free-european/` },
        { name: "Family Roleplay", url: `${BASE_URL}/genre/free-family-roleplay/` },
        { name: "Fantasy",         url: `${BASE_URL}/genre/free-fantasy/` },
        { name: "Fetish",          url: `${BASE_URL}/genre/free-fetish/` },
        { name: "Gangbang",        url: `${BASE_URL}/genre/free-gangbang/` },
        { name: "Hardcore",        url: `${BASE_URL}/genre/free-hardcore/` },
        { name: "Hentai",          url: `${BASE_URL}/genre/free-hentai/` },
        { name: "Japanese",        url: `${BASE_URL}/genre/free-japanese/` },
        { name: "Lesbian",         url: `${BASE_URL}/genre/free-lesbian/` },
        { name: "Massage",         url: `${BASE_URL}/genre/free-massage/` },
        { name: "Mature",          url: `${BASE_URL}/genre/free-mature/` },
        { name: "MILF",            url: `${BASE_URL}/genre/free-milf/` },
        { name: "Parody",          url: `${BASE_URL}/genre/free-parody/` },
        { name: "POV",             url: `${BASE_URL}/genre/free-pov/` },
        { name: "Squirting",       url: `${BASE_URL}/genre/free-squirting/` },
        { name: "Threesomes",      url: `${BASE_URL}/genre/free-threesomes/` },
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

    function parseItems(html) {
        const items = [];
        const seen = new Set();
        const blockRegex = /<div[^>]+class="[^"]*\bml-item\b[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
        let block;
        while ((block = blockRegex.exec(html)) !== null) {
            const inner = block[1];
            const aMatch = inner.match(/<a[^>]+href="([^"]+)"/i);
            const href = aMatch ? fixUrl(aMatch[1]) : null;
            if (!href || seen.has(href)) continue;
            seen.add(href);
            const h2 = inner.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
            const title = h2 ? stripTags(h2[1]) : "Unknown";
            const img = inner.match(/<img[^>]+src="([^"]+)"/i);
            const poster = img ? fixUrl(img[1]) : null;
            items.push(new MultimediaItem({
                title, url: href, posterUrl: poster,
                type: "movie", isAdult: true, contentRating: "18+"
            }));
        }
        return items;
    }

    // ==================== getHome ====================

    async function getHome(cb) {
        try {
            const homeData = {};
            const batch1 = await Promise.allSettled(
                CATEGORIES.slice(0, 4).map(async (cat) => {
                    const res = await http_get(cat.url, HEADERS);
                    return { name: cat.name, items: (res && res.body) ? parseItems(res.body) : [] };
                })
            );
            batch1.forEach(r => {
                if (r.status === "fulfilled" && r.value.items.length)
                    homeData[r.value.name] = r.value.items;
            });
            for (let i = 4; i < CATEGORIES.length; i++) {
                try {
                    const res = await http_get(CATEGORIES[i].url, HEADERS);
                    const items = (res && res.body) ? parseItems(res.body) : [];
                    if (items.length) homeData[CATEGORIES[i].name] = items;
                } catch (_) {}
            }
            if (!Object.keys(homeData).length)
                return cb({ success: false, errorCode: "HOME_ERROR", message: "No data" });
            cb({ success: true, data: homeData });
        } catch (e) {
            cb({ success: false, errorCode: "HOME_ERROR", message: e.message });
        }
    }

    // ==================== search ====================

    async function search(query, cb) {
        try {
            const res = await http_get(`${BASE_URL}/search/${encodeURIComponent(query)}`, HEADERS);
            cb({ success: true, data: (res && res.body) ? parseItems(res.body) : [] });
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

            // Title — nhiều fallback
            let title = "Unknown";
            const tMatch = html.match(/<div[^>]*mvic-desc[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/i)
                || html.match(/<h1[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)
                || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
                || html.match(/<title>([\s\S]*?)<\/title>/i);
            if (tMatch) title = stripTags(tMatch[1]).replace(/\s*[-|–]\s*.+$/, "").trim() || "Unknown";

            // Poster
            const pMatch = html.match(/<div[^>]*\bthumb\b[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/i)
                || html.match(/property="og:image"\s+content="([^"]+)"/i)
                || html.match(/content="([^"]+)"\s+property="og:image"/i);
            const posterUrl = pMatch ? fixUrl(pMatch[1]) : null;

            // Description
            const dMatch = html.match(/<div[^>]*\bdesc\b[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
            const description = dMatch ? stripTags(dMatch[1]) : undefined;

            // Year
            const yMatch = html.match(/Released[^:]*:[^<]*,\s*(\d{4})/i);
            const year = yMatch ? parseInt(yMatch[1]) : undefined;

            // Duration
            const durMatch = html.match(/(\d+)\s*mins?/i);
            const duration = durMatch ? parseInt(durMatch[1]) : undefined;

            // Tags
            const tags = [];
            const genreBlock = html.match(/Genres?\s*:[\s\S]{0,50}(<span[\s\S]*?)<\/p>/i);
            if (genreBlock) {
                const aReg = /<a[^>]*>([\s\S]*?)<\/a>/gi;
                let am;
                while ((am = aReg.exec(genreBlock[1])) !== null) {
                    const t = stripTags(am[1]);
                    if (t) tags.push(t);
                }
            }

            // Cast
            const cast = [];
            const starBlock = html.match(/Pornstars?\s*:[\s\S]{0,50}(<span[\s\S]*?)<\/p>/i);
            if (starBlock) {
                const aReg = /<a[^>]*>([\s\S]*?)<\/a>/gi;
                let am;
                while ((am = aReg.exec(starBlock[1])) !== null) {
                    const n = stripTags(am[1]);
                    if (n) cast.push(new Actor({ name: n }));
                }
            }

            // Recommendations
            const recommendations = parseItems(html);

            // BẮT BUỘC có episode để nút Watch không xám
            // episode.url = URL trang phim → loadStreams fetch lại trang và parse link
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
                    year, duration,
                    tags: tags.length ? tags : undefined,
                    cast: cast.length ? cast : undefined,
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

    // ==================== EXTRACTORS ====================

    const BAD_HOSTS = ["localnews.click", "google.com", "xxxparodyhd.net", "nitroflare", "freedl", "frdl.io"];
    function isBadUrl(u) {
        const low = (u || "").toLowerCase();
        return BAD_HOSTS.some(h => low.includes(h));
    }

    async function extractDood(url) {
        try {
            const embed = url
                .replace("doply.net", "myvidplay.com")
                .replace(/doodstream\.[a-z]+/i, "myvidplay.com")
                .replace(/(?<!\.)dood\.[a-z]+/i, "myvidplay.com")
                .replace("d000d.com", "myvidplay.com")
                .replace("ds2play.com", "myvidplay.com");

            const r1 = await http_get(embed, { "Referer": "https://myvidplay.com", "User-Agent": UA });
            if (!r1 || !r1.body) return [];
            const m = r1.body.match(/['"](\/pass_md5\/[^'"]+)['"]/);
            if (!m) return [];
            const passPath = m[1];
            const token = passPath.split("/").pop();
            const r2 = await http_get("https://myvidplay.com" + passPath, { "Referer": embed, "User-Agent": UA });
            if (!r2 || !r2.body) return [];
            const base = r2.body.trim();
            if (!base.startsWith("http")) return [];
            const rand = Math.random().toString(36).slice(2, 12).padEnd(10, "x");
            return [new StreamResult({
                url: `${base}${rand}?token=${token}&expiry=${Date.now()}`,
                source: "DoodStream", quality: 1080,
                headers: { "Referer": "https://myvidplay.com", "User-Agent": UA }
            })];
        } catch (_) { return []; }
    }

    async function extractVoe(url) {
        try {
            const r = await http_get(url, { "Referer": "https://voe.sx/", "User-Agent": UA });
            if (!r || !r.body) return [];
            const hls = r.body.match(/'hls'\s*:\s*'([^']+)'/) || r.body.match(/"hls"\s*:\s*"([^"]+)"/);
            const mp4 = r.body.match(/'mp4'\s*:\s*'([^']+)'/) || r.body.match(/"mp4"\s*:\s*"([^"]+)"/);
            const out = [];
            if (hls) out.push(new StreamResult({ url: hls[1], source: "VOE", quality: 1080, headers: { "Referer": "https://voe.sx/" } }));
            if (mp4) out.push(new StreamResult({ url: mp4[1], source: "VOE MP4", quality: 1080, headers: { "Referer": "https://voe.sx/" } }));
            return out;
        } catch (_) { return []; }
    }

    async function extractStreamTape(url) {
        try {
            const r = await http_get(url, { "Referer": "https://streamtape.com/", "User-Agent": UA });
            if (!r || !r.body) return [];
            const m = r.body.match(/id="ideoooolink"[^>]*>([^<]*)/)
                || r.body.match(/\.innerHTML\s*=\s*"(\/\/[^"]+streamtape[^"]+)"/);
            if (!m) return [];
            let su = m[1].replace(/\s/g, "");
            if (!su.startsWith("http")) su = "https:" + su;
            return [new StreamResult({ url: su, source: "StreamTape", quality: 720, headers: { "Referer": "https://streamtape.com/" } })];
        } catch (_) { return []; }
    }

    async function extractMixDrop(url) {
        try {
            const r = await http_get(url.replace("/f/", "/e/"), { "Referer": "https://mixdrop.co/", "User-Agent": UA });
            if (!r || !r.body) return [];
            const m = r.body.match(/MDCore\.wurl\s*=\s*"([^"]+)"/) || r.body.match(/wurl\s*=\s*"([^"]+)"/);
            if (!m) return [];
            let su = m[1];
            if (su.startsWith("//")) su = "https:" + su;
            return [new StreamResult({ url: su, source: "MixDrop", quality: 1080, headers: { "Referer": "https://mixdrop.co/" } })];
        } catch (_) { return []; }
    }

    async function extractFilePattern(url, sourceName) {
        try {
            const r = await http_get(url, { "User-Agent": UA, "Referer": url });
            if (!r || !r.body) return [];
            let src = r.body;
            if (typeof getAndUnpack === "function" && /function\(p,a,c,k,e,d\)/.test(src)) {
                try { src = getAndUnpack(src) || src; } catch (_) {}
            }
            const m = src.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/)
                || src.match(/sources\s*:\s*\[[\s\S]*?file\s*:\s*["']([^"']+)["']/)
                || src.match(/file\s*:\s*["']([^"']+)["']/)
                || src.match(/var urlPlay\s*=\s*['"]([^'"]+)['"]/);
            if (!m) return [];
            return [new StreamResult({ url: m[1], source: sourceName || "Stream", quality: 1080, headers: { "Referer": url, "User-Agent": UA } })];
        } catch (_) { return []; }
    }

    async function resolveOne(rawUrl) {
        const u = rawUrl.toLowerCase();
        if (u.includes("doply.net") || u.includes("doodstream") || u.includes("myvidplay")
            || u.includes("d000d") || u.includes("ds2play") || /dood\.[a-z]/.test(u))
            return extractDood(rawUrl);
        if (u.includes("voe.sx"))     return extractVoe(rawUrl);
        if (u.includes("streamtape")) return extractStreamTape(rawUrl);
        if (u.includes("mixdrop"))    return extractMixDrop(rawUrl);
        // Tất cả host còn lại đều dùng pattern file:"..." hoặc urlPlay
        return extractFilePattern(rawUrl,
            u.includes("streamwish") || u.includes("swhoi") || u.includes("javsw") ? "Streamwish" :
            u.includes("vidhide") || u.includes("javlion") ? "Vidhide" :
            u.includes("filemoon") || u.includes("javmoon") ? "FileMoon" :
            u.includes("javggvideo") ? "JavggVideo" :
            u.includes("maxstream") ? "Maxstream" : "Stream"
        );
    }

    // ==================== loadStreams ====================

    async function loadStreams(url, cb) {
        try {
            const res = await http_get(url, HEADERS);
            if (!res || !res.body)
                return cb({ success: false, errorCode: "STREAM_ERROR", message: "Failed to fetch page" });

            const html = res.body;
            const urls = [];
            const seen = new Set();
            function add(u) {
                u = (u || "").trim();
                if (!u || seen.has(u) || isBadUrl(u)) return;
                seen.add(u);
                urls.push(u);
            }

            // Ưu tiên 1: data-fl-source (URL embed trực tiếp)
            let m;
            const r1 = /data-fl-source="(https?:\/\/[^"]+)"/gi;
            while ((m = r1.exec(html)) !== null) add(m[1]);

            // Ưu tiên 2: data-fl-url (URL trang host gốc)
            const r2 = /data-fl-url="(https?:\/\/[^"]+)"/gi;
            while ((m = r2.exec(html)) !== null) add(m[1]);

            // Fallback: <a id="#iframe" href="...">
            const r3 = /<a\b[^>]*\bid="#iframe"[^>]*>/gi;
            while ((m = r3.exec(html)) !== null) {
                const hm = m[0].match(/href="(https?:\/\/[^"]+)"/i);
                if (hm) add(hm[1]);
            }

            if (!urls.length)
                return cb({ success: false, errorCode: "STREAM_ERROR", message: "No stream URLs found" });

            const allStreams = (await Promise.all(urls.map(resolveOne))).flat();

            const final = [];
            const finalSeen = new Set();
            allStreams.forEach(s => {
                if (!s || !s.url || finalSeen.has(s.url)) return;
                finalSeen.add(s.url);
                final.push(s);
            });

            if (!final.length)
                return cb({ success: false, errorCode: "STREAM_ERROR", message: "All sources failed" });

            cb({ success: true, data: final });
        } catch (e) {
            cb({ success: false, errorCode: "STREAM_ERROR", message: e.message });
        }
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();
