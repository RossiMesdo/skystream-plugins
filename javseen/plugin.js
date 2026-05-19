(function () {
    const MAIN_URL = (typeof manifest !== "undefined" && manifest.baseUrl) || "https://javseen.tv";
    const HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    };

    const CATEGORIES = [
        { name: "Recent Videos",      url: `${MAIN_URL}/recent/` },
        { name: "Jav Censored",       url: `${MAIN_URL}/jav-censored/` },
        { name: "Solowork",           url: `${MAIN_URL}/solowork/` },
        { name: "Amateur",            url: `${MAIN_URL}/amateur/` },
        { name: "Asian",              url: `${MAIN_URL}/asian/` },
        { name: "Beautiful Girl",     url: `${MAIN_URL}/beautiful-girl/` },
        { name: "BBW",                url: `${MAIN_URL}/bbw/` },
        { name: "Married Woman",      url: `${MAIN_URL}/married-woman/` },
        { name: "Mature Woman",       url: `${MAIN_URL}/mature-woman/` },
        { name: "Big Tits",           url: `${MAIN_URL}/big-tits/` },
        { name: "Cosplay",            url: `${MAIN_URL}/cosplay/` },
        { name: "Hardcore",           url: `${MAIN_URL}/hardcore/` },
        { name: "Lesbian",            url: `${MAIN_URL}/lesbian/` },
        { name: "Massage",            url: `${MAIN_URL}/massage/` },
        { name: "POV",                url: `${MAIN_URL}/pov/` },
        { name: "Squirting",          url: `${MAIN_URL}/squirting/` },
        { name: "Mosaic",             url: `${MAIN_URL}/mosaic/` }
    ];

    // ─── Helpers ─────────────────────────────────────────────────────────────

    function fixUrl(href) {
        if (!href) return "";
        if (href.startsWith("http")) return href;
        if (href.startsWith("//")) return "https:" + href;
        return MAIN_URL + (href.startsWith("/") ? "" : "/") + href;
    }

    function buildPageUrl(base, page) {
        if (page <= 1) return base;
        return `${base.replace(/\/$/, "")}/${page}/`;
    }

    function buildSearchUrl(query, page) {
        if (page <= 1) return `${MAIN_URL}/search/video/?s=${encodeURIComponent(query)}`;
        return `${MAIN_URL}/search/video/?s=${encodeURIComponent(query)}&page=${page}`;
    }

    function parseItems(doc) {
        const items = [];
        doc.querySelectorAll("li[id^='video-']").forEach(el => {
            const link = el.querySelector("a.thumbnail");
            if (!link) return;
            const title = (link.querySelector("span.video-title")?.textContent || link.getAttribute("title") || "").trim();
            const href = fixUrl(link.getAttribute("href") || "");
            if (!title || !href) return;
            const img = link.querySelector("img");
            const poster = fixUrl(img?.getAttribute("src") || "");
            items.push(new MultimediaItem({ title, url: href, posterUrl: poster, type: "movie" }));
        });
        return items;
    }

    // ─── Extractors ──────────────────────────────────────────────────────────

    // Generic "file:'...'" extractor used by Streamwish, javclan, Streamhihi, Javsw, swhoi
    async function extractFileUrl(pageUrl, sourceName) {
        try {
            const res = await http_get(pageUrl, {
                ...HEADERS,
                "Referer": pageUrl,
                "Accept": "*/*",
                "Origin": new URL(pageUrl).origin
            });
            if (!res || !res.body) return [];
            // Try packed script first
            let source = res.body;
            if (typeof getAndUnpack === "function" && /function\(p,a,c,k,e,d\)/.test(source)) {
                try { source = getAndUnpack(source) || source; } catch (e) {}
            }
            const m = source.match(/file:\s*["']([^"']+)["']/);
            if (!m) return [];
            return [new StreamResult({
                url: m[1],
                source: sourceName,
                headers: { "Referer": pageUrl }
            })];
        } catch (e) {
            return [];
        }
    }

    // DoodStream family (myvidplay, doply, vide0, dooood, d000d, ds2play)
    async function extractDoodStream(pageUrl, sourceName) {
        try {
            const embedUrl = pageUrl
                .replace("doply.net", "myvidplay.com")
                .replace("vide0.net", "myvidplay.com");
            const res = await http_get(embedUrl, {
                ...HEADERS,
                "Referer": "https://myvidplay.com"
            });
            if (!res || !res.body) return [];
            const md5m = res.body.match(/\/pass_md5\/([^/]*)\/([^/'"]*)/);
            if (!md5m) return [];
            const md5Path = md5m[0];
            const expiry = md5m[1];
            const token = md5m[2];
            const md5Url = "https://myvidplay.com" + md5Path;
            const md5Res = await http_get(md5Url, {
                ...HEADERS,
                "Referer": embedUrl
            });
            const base = (md5Res?.body || "").trim();
            if (!base) return [];
            const directLink = token && expiry
                ? `${base}?token=${token}&expiry=${expiry}000`
                : base;
            return [new StreamResult({
                url: directLink,
                source: sourceName || "DoodStream",
                headers: { "Referer": "https://myvidplay.com" }
            })];
        } catch (e) {
            return [];
        }
    }

    // Vidhidepro / VidhideVIP / Javlion — sources:[{file:"..."}] in script
    async function extractVidhide(pageUrl, sourceName) {
        try {
            const res = await http_get(pageUrl, HEADERS);
            if (!res || !res.body) return [];
            const m = res.body.match(/sources:\s*\[\s*\{\s*file:\s*"([^"]+)"/);
            if (!m) return [];
            return [new StreamResult({
                url: m[1],
                source: sourceName || "Vidhide",
                headers: { "Referer": pageUrl }
            })];
        } catch (e) {
            return [];
        }
    }

    // Maxstream — packed script with file:"..."
    async function extractMaxstream(pageUrl) {
        try {
            const res = await http_get(pageUrl, HEADERS);
            if (!res || !res.body) return [];
            let source = res.body;
            if (typeof getAndUnpack === "function") {
                try { source = getAndUnpack(source) || source; } catch (e) {}
            }
            const m = source.match(/file:\s*["']([^"']+)["']/);
            if (!m) return [];
            return [new StreamResult({
                url: m[1],
                source: "Maxstream",
                headers: { "Referer": pageUrl }
            })];
        } catch (e) {
            return [];
        }
    }

    // Javggvideo — var urlPlay = '...'
    async function extractJavgg(pageUrl) {
        try {
            const res = await http_get(pageUrl, HEADERS);
            if (!res || !res.body) return [];
            const m = res.body.match(/var urlPlay\s*=\s*['"]([^'"]+)['"]/);
            if (!m) return [];
            return [new StreamResult({
                url: m[1],
                source: "Javggvideo",
                headers: { "Referer": pageUrl }
            })];
        } catch (e) {
            return [];
        }
    }

    // javclan — file:"..." in script with CORS headers
    async function extractJavclan(pageUrl) {
        return extractFileUrl(pageUrl, "Javclan");
    }

    // Javmoon (FileMoon) — file:"..." pattern
    async function extractJavmoon(pageUrl) {
        return extractFileUrl(pageUrl, "Javmoon");
    }

    // StreamTape — reconstruct link from innerHTML split
    async function extractStreamTape(pageUrl) {
        try {
            const res = await http_get(pageUrl, HEADERS);
            if (!res || !res.body) return [];
            const m = res.body.match(/getElementById\('videolink'\)\.innerHTML\s*=\s*(.*?);/);
            if (!m) return [];
            // Extract all string parts and join
            const parts = [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
            if (!parts.length) return [];
            return [new StreamResult({
                url: "https:" + parts.join(""),
                source: "StreamTape",
                headers: { "Referer": pageUrl }
            })];
        } catch (e) {
            return [];
        }
    }

    // Voe — m3u8 from script
    async function extractVoe(pageUrl) {
        try {
            const res = await http_get(pageUrl, HEADERS);
            if (!res || !res.body) return [];
            const m = res.body.match(/['"]hls['"]\s*:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i)
                || res.body.match(/https?:\/\/[^'"]+\.m3u8[^'"]*/);
            if (!m) return [];
            return [new StreamResult({
                url: m[0].replace(/['"]/g, ""),
                source: "Voe",
                headers: { "Referer": pageUrl }
            })];
        } catch (e) {
            return [];
        }
    }

    // MixDrop
    async function extractMixDrop(pageUrl) {
        return extractFileUrl(pageUrl, "MixDrop");
    }

    // EmturboVid — file url from page
    async function extractEmturbovid(pageUrl) {
        return extractFileUrl(pageUrl, "EmturboVid");
    }

    // ─── Route extractor by hostname ─────────────────────────────────────────

    async function routeExtractor(url) {
        if (!url) return [];
        let host = "";
        try { host = new URL(url).hostname; } catch (e) { return []; }

        if (/myvidplay|dood|doply|vide0\.net|dooood|d000d|ds2play/i.test(host))
            return extractDoodStream(url, "DoodStream");
        if (/vidhidepro|vidhidevip/i.test(host))
            return extractVidhide(url, "Vidhide");
        if (/javlion/i.test(host))
            return extractVidhide(url, "Javlion");
        if (/maxstream/i.test(host))
            return extractMaxstream(url);
        if (/javggvideo/i.test(host))
            return extractJavgg(url);
        if (/javclan/i.test(host))
            return extractJavclan(url);
        if (/javmoon/i.test(host))
            return extractJavmoon(url);
        if (/streamtape/i.test(host))
            return extractStreamTape(url);
        if (/voe\.sx/i.test(host))
            return extractVoe(url);
        if (/mixdrop/i.test(host))
            return extractMixDrop(url);
        if (/emturbovid|emturbo/i.test(host))
            return extractEmturbovid(url);
        if (/streamwish|streamhihi|swhoi|javsw/i.test(host))
            return extractFileUrl(url, "Streamwish");

        // Generic fallback
        return extractFileUrl(url, host);
    }

    // ─── Core functions ───────────────────────────────────────────────────────

    async function getHome(cb) {
        try {
            const data = {};
            await Promise.all(CATEGORIES.map(async cat => {
                try {
                    const pages = await Promise.all([1, 2, 3].map(async p => {
                        try {
                            const res = await http_get(buildPageUrl(cat.url, p), HEADERS);
                            if (!res || !res.body) return [];
                            const doc = await parseHtml(res.body);
                            return parseItems(doc);
                        } catch (e) { return []; }
                    }));
                    const seen = new Set();
                    const items = pages.flat().filter(i => { if (seen.has(i.url)) return false; seen.add(i.url); return true; });
                    if (items.length > 0) data[cat.name] = items;
                } catch (e) {
                    console.error(`Javseen getHome [${cat.name}]: ${e.message}`);
                }
            }));
            cb({ success: true, data });
        } catch (e) {
            cb({ success: false, errorCode: "HOME_ERROR", message: e.message });
        }
    }

    async function search(query, cb) {
        try {
            const pages = await Promise.all([1, 2, 3].map(async p => {
                try {
                    const res = await http_get(buildSearchUrl(query, p), HEADERS);
                    if (!res || !res.body) return [];
                    const doc = await parseHtml(res.body);
                    return parseItems(doc);
                } catch (e) { return []; }
            }));
            const seen = new Set();
            const items = pages.flat().filter(i => { if (seen.has(i.url)) return false; seen.add(i.url); return true; });
            cb({ success: true, data: items });
        } catch (e) {
            cb({ success: false, errorCode: "SEARCH_ERROR", message: e.message });
        }
    }

    async function load(url, cb) {
        try {
            const res = await http_get(url, HEADERS);
            if (!res || !res.body) return cb({ success: false, errorCode: "LOAD_ERROR", message: "Empty response" });
            const doc = await parseHtml(res.body);

            const title = doc.querySelector("h1")?.textContent?.trim();
            if (!title) return cb({ success: false, errorCode: "LOAD_ERROR", message: "No title" });

            let poster = fixUrl(doc.querySelector("meta[property='og:image']")?.getAttribute("content") || "");
            const description = doc.querySelector("meta[name='description']")?.getAttribute("content")?.trim() || "";

            // Year
            const yearMatch = description.match(/Release Day:\s*(\d{4})/);
            const year = yearMatch ? parseInt(yearMatch[1]) : undefined;

            // Tags
            const tags = [];
            doc.querySelectorAll("a i.fa-th-list").forEach(i => {
                const t = i.parentElement?.textContent?.trim();
                if (t) tags.push(t);
            });

            // Cast from pornstar links or description
            const cast = [];
            const seenActors = new Set();
            doc.querySelectorAll("a[href*='/pornstar/']").forEach(a => {
                const n = a.textContent.trim();
                if (n && !seenActors.has(n)) { seenActors.add(n); cast.push(new Actor({ name: n })); }
            });

            // Duration (og:video:duration in seconds → minutes)
            const durSec = parseInt(doc.querySelector("meta[property='og:video:duration']")?.getAttribute("content") || "0");
            const duration = durSec > 0 ? Math.floor(durSec / 60) : undefined;

            // Server URLs: each button has data-embed (Base64 encoded URL)
            const serverUrls = [];
            doc.querySelectorAll("button.button_choice_server").forEach(btn => {
                const encoded = btn.getAttribute("data-embed");
                if (!encoded) return;
                try {
                    const decoded = atob(encoded);
                    if (decoded) serverUrls.push(decoded);
                } catch (e) {}
            });

            // Recommendations
            const recs = [];
            doc.querySelectorAll("ul.videos.related li").forEach(el => {
                const a = el.querySelector("a.thumbnail");
                if (!a) return;
                const t = (a.getAttribute("title") || el.querySelector("span.video-title")?.textContent || "").trim();
                const href = fixUrl(a.getAttribute("href") || "");
                const img = el.querySelector("img");
                const p = fixUrl(img?.getAttribute("src") || "");
                if (t && href) recs.push(new MultimediaItem({ title: t, url: href, posterUrl: p, type: "movie" }));
            });

            cb({
                success: true,
                data: new MultimediaItem({
                    title,
                    url,
                    posterUrl: poster,
                    description,
                    type: "movie",
                    year,
                    duration,
                    tags,
                    cast,
                    recommendations: recs,
                    episodes: [
                        new Episode({
                            name: "Play",
                            // Store server URLs as JSON for loadStreams
                            url: JSON.stringify(serverUrls),
                            season: 1,
                            episode: 1,
                            posterUrl: poster
                        })
                    ]
                })
            });
        } catch (e) {
            cb({ success: false, errorCode: "LOAD_ERROR", message: e.message });
        }
    }

    async function loadStreams(data, cb) {
        try {
            let urls = [];
            try {
                const parsed = JSON.parse(data);
                if (Array.isArray(parsed)) urls = parsed;
                else if (typeof parsed === "string") urls = [parsed];
            } catch (e) {
                urls = [data];
            }

            if (!urls.length) return cb({ success: true, data: [] });

            // Extract streams from all servers in parallel
            const results = await Promise.all(urls.map(u => routeExtractor(u)));
            const streams = results.flat();

            // Deduplicate
            const seen = new Set();
            const final = streams.filter(s => {
                if (!s.url || seen.has(s.url)) return false;
                seen.add(s.url);
                return true;
            });

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
