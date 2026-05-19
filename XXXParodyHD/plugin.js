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

            // SkyStream cần ít nhất 1 Episode để nút Watch không bị xám
            // URL của episode = URL trang phim → loadStreams sẽ fetch và parse link
            const episode = new Episode({
                name: title,
                url: url,
                season: 1,
                episode: 1,
                dubStatus: "none"
            });

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
                episodes: [episode],
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

    // Map mirror domain → real host để loadExtractor nhận ra
    const MIRROR_MAP = {
        "doply.net":          "doodstream.com",
        "luluvid.com":        "lulustream.com",
        "mixdrop.my":         "mixdrop.co",
        "mixdrop.ag":         "mixdrop.co",
        "my.rpmplay.online":  "rpmshare.com",
        "my.upns.online":     "upnshare.com",
        "vip.player4me.vip":  "player4me.com",
        "my.player4me.online":"player4me.com",
        "my.embedseek.online":"seekstreaming.com",
        "vip.seekplayer.vip": "seekstreaming.com",
        "p.easyvidplayer.com":"easyvidplay.com",
        "vip.easyvidplayer.com":"easyvidplay.com",
    };

    // Cố gắng đổi mirror URL → URL gốc cùng path
    function normalizeMirrorUrl(url) {
        try {
            const parsed = new URL(url);
            const realHost = MIRROR_MAP[parsed.hostname];
            if (realHost) {
                return `https://${realHost}${parsed.pathname}${parsed.hash}${parsed.search}`;
            }
        } catch (_) {}
        return url;
    }

    // ============================================================
    // MANUAL EXTRACTORS — dựa theo Kotlin extractor thực tế
    // ============================================================

    const DOOD_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0";

    // DoodStream / DoodDoply → thật ra dùng myvidplay.com
    async function extractDoodStream(url) {
        try {
            const embedUrl = url
                .replace("doply.net", "myvidplay.com")
                .replace("doodstream.com", "myvidplay.com")
                .replace("dood.wf", "myvidplay.com")
                .replace("dood.la", "myvidplay.com")
                .replace("d000d.com", "myvidplay.com")
                .replace("ds2play.com", "myvidplay.com");

            const res = await http_get(embedUrl, {
                "Referer": "https://myvidplay.com",
                "User-Agent": DOOD_UA
            });
            if (!res || !res.body) return [];
            const html = res.body;

            // Regex: /pass_md5/(expiry)/(token)
            const md5Match = html.match(/\/pass_md5\/([^/]*)\/([^/'"\s]*)/);
            if (!md5Match) return [];

            const md5Path = md5Match[0];
            const expiry = md5Match[1];
            const token = md5Match[2];
            const md5Url = "https://myvidplay.com" + md5Path;

            const md5Res = await http_get(md5Url, {
                "Referer": embedUrl,
                "User-Agent": DOOD_UA
            });
            if (!md5Res || !md5Res.body) return [];

            const baseLink = md5Res.body.trim();
            const directLink = (token && expiry)
                ? `${baseLink}?token=${token}&expiry=${expiry}000`
                : baseLink;

            return [new StreamResult({
                url: directLink,
                source: "DoodStream",
                quality: 1080,
                headers: {
                    "Referer": "https://myvidplay.com",
                    "User-Agent": DOOD_UA
                }
            })];
        } catch (_) { return []; }
    }

    // Streamwish / swhoi / Javsw / Streamhihi — parse file: "..." trong script
    async function extractStreamwish(url, sourceName) {
        try {
            const res = await http_get(url, { "User-Agent": DOOD_UA });
            if (!res || !res.body) return [];
            const html = res.body;

            const fileMatch = html.match(/file\s*:\s*["']([^"']+)["']/);
            if (!fileMatch) return [];

            return [new StreamResult({
                url: fileMatch[1],
                source: sourceName || "Streamwish",
                quality: 1080,
                headers: {
                    "Referer": url,
                    "User-Agent": DOOD_UA
                }
            })];
        } catch (_) { return []; }
    }

    // Vidhidepro / Javlion / VidhideVIP — sources:[{file:"..."}]
    async function extractVidhide(url, sourceName) {
        try {
            const res = await http_get(url, { "User-Agent": DOOD_UA });
            if (!res || !res.body) return [];
            const html = res.body;

            const match = html.match(/sources\s*:\s*\[\s*\{\s*file\s*:\s*["']([^"']+)["']/);
            if (!match) return [];

            return [new StreamResult({
                url: match[1],
                source: sourceName || "Vidhide",
                quality: 1080,
                headers: { "Referer": url }
            })];
        } catch (_) { return []; }
    }

    // Javggvideo — var urlPlay = '...'
    async function extractJavggvideo(url) {
        try {
            const res = await http_get(url, { "User-Agent": DOOD_UA });
            if (!res || !res.body) return [];
            const match = res.body.match(/var urlPlay\s*=\s*['"]([^'"]+)['"]/);
            if (!match) return [];
            return [new StreamResult({
                url: match[1],
                source: "Javgg Video",
                quality: 1080,
                headers: { "Referer": url }
            })];
        } catch (_) { return []; }
    }

    // Maxstream — P.A.C.K.E.R obfuscated, unpack rồi parse file:"..."
    async function extractMaxstream(url) {
        try {
            const res = await http_get(url, { "User-Agent": DOOD_UA });
            if (!res || !res.body) return [];
            const html = res.body;

            // Thử unpack P.A.C.K.E.R nếu có
            let script = html;
            if (typeof getAndUnpack === "function" && /function\(p,a,c,k,e,d\)/.test(html)) {
                try { script = getAndUnpack(html) || html; } catch (_) {}
            }

            const match = script.match(/file\s*:\s*["']([^"']+)["']/);
            if (!match) return [];

            return [new StreamResult({
                url: match[1],
                source: "Maxstream",
                quality: 1080,
                headers: { "Referer": url }
            })];
        } catch (_) { return []; }
    }

    // MixDrop / MixDropis — MDCore.wurl
    async function extractMixDrop(url) {
        try {
            const embedUrl = url.replace("/f/", "/e/");
            const res = await http_get(embedUrl, {
                "Referer": "https://mixdrop.co/",
                "User-Agent": DOOD_UA
            });
            if (!res || !res.body) return [];
            const html = res.body;

            const wurlMatch = html.match(/MDCore\.wurl\s*=\s*"([^"]+)"/)
                || html.match(/wurl\s*=\s*"([^"]+)"/);
            if (!wurlMatch) return [];

            let streamUrl = wurlMatch[1];
            if (streamUrl.startsWith("//")) streamUrl = "https:" + streamUrl;

            return [new StreamResult({
                url: streamUrl,
                source: "MixDrop",
                quality: 1080,
                headers: { "Referer": "https://mixdrop.co/" }
            })];
        } catch (_) { return []; }
    }

    // VOE — 'hls': '...' hoặc 'mp4': '...'
    async function extractVoe(url) {
        try {
            const res = await http_get(url, {
                "Referer": "https://voe.sx/",
                "User-Agent": DOOD_UA
            });
            if (!res || !res.body) return [];
            const html = res.body;

            const hlsMatch = html.match(/'hls'\s*:\s*'([^']+)'/) || html.match(/"hls"\s*:\s*"([^"]+)"/);
            const mp4Match = html.match(/'mp4'\s*:\s*'([^']+)'/) || html.match(/"mp4"\s*:\s*"([^"]+)"/);

            const results = [];
            if (hlsMatch) results.push(new StreamResult({
                url: hlsMatch[1],
                source: "VOE",
                quality: 1080,
                headers: { "Referer": "https://voe.sx/" }
            }));
            if (mp4Match) results.push(new StreamResult({
                url: mp4Match[1],
                source: "VOE MP4",
                quality: 1080,
                headers: { "Referer": "https://voe.sx/" }
            }));
            return results;
        } catch (_) { return []; }
    }

    // StreamTape — innerHTML token obfuscation
    async function extractStreamTape(url) {
        try {
            const res = await http_get(url, {
                "Referer": "https://streamtape.com/",
                "User-Agent": DOOD_UA
            });
            if (!res || !res.body) return [];
            const html = res.body;

            const match = html.match(/id="ideoooolink"[^>]*>(.*?)</)
                || html.match(/\.innerHTML\s*=\s*"(\/\/[^"]+\.streamtape\.com[^"]+)"/)
                || html.match(/document\.getElementById\('ideoooolink'\)[^=]*=[^"]*"([^"]+)"/);

            if (!match) return [];
            let streamUrl = match[1].replace(/\s/g, "");
            if (!streamUrl.startsWith("http")) streamUrl = "https:" + streamUrl;

            return [new StreamResult({
                url: streamUrl,
                source: "StreamTape",
                quality: 720,
                headers: { "Referer": "https://streamtape.com/" }
            })];
        } catch (_) { return []; }
    }

    // EmturbovidExtractor / javclan — file:"..." trong script
    async function extractFilesim(url, sourceName) {
        try {
            const res = await http_get(url, { "User-Agent": DOOD_UA });
            if (!res || !res.body) return [];
            const match = res.body.match(/file\s*:\s*["']([^"']+)["']/);
            if (!match) return [];
            return [new StreamResult({
                url: match[1],
                source: sourceName || "FileMoon",
                quality: 1080,
                headers: {
                    "Referer": url,
                    "Origin": new URL(url).origin
                }
            })];
        } catch (_) { return []; }
    }

    // Router chính — phân loại URL → đúng extractor
    async function resolveVideoUrl(rawUrl) {
        const u = rawUrl.toLowerCase();

        // DoodStream family
        if (u.includes("doply.net") || u.includes("doodstream") || u.includes("dood.")
            || u.includes("myvidplay") || u.includes("d000d.com") || u.includes("ds2play")) {
            return await extractDoodStream(rawUrl);
        }
        // VOE
        if (u.includes("voe.sx")) return await extractVoe(rawUrl);
        // StreamTape
        if (u.includes("streamtape")) return await extractStreamTape(rawUrl);
        // MixDrop
        if (u.includes("mixdrop")) return await extractMixDrop(rawUrl);
        // Streamwish family
        if (u.includes("streamwish") || u.includes("swhoi") || u.includes("javsw")
            || u.includes("streamhihi") || u.includes("wishfast") || u.includes("strwish")) {
            return await extractStreamwish(rawUrl, "Streamwish");
        }
        // Vidhide family
        if (u.includes("vidhide") || u.includes("javlion") || u.includes("javmoon")) {
            return await extractVidhide(rawUrl, u.includes("javmoon") ? "FileMoon" : "Vidhide");
        }
        // FileMoon / Filesim / swhoi / javclan / emturbovid
        if (u.includes("filemoon") || u.includes("emturbovid") || u.includes("javclan")) {
            return await extractFilesim(rawUrl, u.includes("filemoon") ? "FileMoon" : "Stream");
        }
        // Javggvideo
        if (u.includes("javggvideo")) return await extractJavggvideo(rawUrl);
        // Maxstream
        if (u.includes("maxstream")) return await extractMaxstream(rawUrl);

        // Fallback: thử loadExtractor rồi push thẳng
        if (typeof globalThis.loadExtractor === "function") {
            const results = [];
            try { await globalThis.loadExtractor(rawUrl, s => results.push(s)); } catch (_) {}
            if (results.length) return results;
        }
        return [new StreamResult({
            url: rawUrl,
            source: "XXXParodyHD",
            headers: { "Referer": BASE_URL }
        })];
    }

    async function loadStreams(url, cb) {
        try {
            const res = await http_get(url, {
                "Referer": BASE_URL,
                "User-Agent": DOOD_UA
            });

            if (!res || res.status !== 200) {
                return cb({ success: false, errorCode: "STREAM_ERROR", message: "HTTP error: " + (res && res.status) });
            }

            const html = res.body || "";
            const videoUrls = [];
            const seen = new Set();

            function addUrl(u) {
                if (!u || seen.has(u) || isBadUrl(u)) return;
                seen.add(u);
                videoUrls.push(u);
            }

            // Ưu tiên 1: data-fl-source (URL embed gốc)
            const flSourceRegex = /data-fl-source="(https?:\/\/[^"]+)"/gi;
            let m;
            while ((m = flSourceRegex.exec(html)) !== null) addUrl(m[1].trim());

            // Ưu tiên 2: data-fl-url
            const flUrlRegex = /data-fl-url="(https?:\/\/[^"]+)"/gi;
            while ((m = flUrlRegex.exec(html)) !== null) addUrl(m[1].trim());

            // Fallback: href của <a id="#iframe">
            if (!videoUrls.length) {
                const iframeRegex = /<a\s[^>]*id="#iframe"[^>]*>/gi;
                while ((m = iframeRegex.exec(html)) !== null) {
                    const hrefMatch = m[0].match(/href="(https?:\/\/[^"]+)"/i);
                    if (hrefMatch) addUrl(hrefMatch[1].trim());
                }
            }

            if (!videoUrls.length) {
                return cb({ success: false, errorCode: "STREAM_ERROR", message: "No stream links found" });
            }

            const allResults = await Promise.all(videoUrls.map(u => resolveVideoUrl(u)));
            const flat = allResults.flat();

            // Deduplicate
            const deduped = [];
            const seenUrls = new Set();
            flat.forEach(function (item) {
                if (!item || !item.url || seenUrls.has(item.url)) return;
                seenUrls.add(item.url);
                deduped.push(item);
            });

            if (!deduped.length) {
                return cb({ success: false, errorCode: "STREAM_ERROR", message: "Could not extract any streams" });
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
