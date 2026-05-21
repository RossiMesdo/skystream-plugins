(function() {
    /**
     * MissAV Plugin for SkyStream
     * Site: https://missav.live
     * Ported from: Cs-GizliKeyif CloudStream repo
     * Author: Lord
     */

    const BASE_URL = manifest.baseUrl;
    const HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:137.0) Gecko/20100101 Firefox/137.0",
        "Referer": BASE_URL + "/"
    };

    const BLACKLIST = ["recent update", "contact", "support", "dmca", "home"];

    const CATEGORIES = [
        { name: "Weekly Hot",           url: `${BASE_URL}/dm169/en/weekly-hot?sort=weekly_views` },
        { name: "Monthly Hot",          url: `${BASE_URL}/dm263/en/monthly-hot?sort=views` },
        { name: "Newly Added",          url: `${BASE_URL}/en/new?sort=published_at` },
        { name: "English Subtitles",    url: `${BASE_URL}/en/english-subtitle` },
        { name: "Uncensored Leak",      url: `${BASE_URL}/dm628/en/uncensored-leak` },
        { name: "FC2",                  url: `${BASE_URL}/dm150/en/fc2` },
        { name: "Madou",                url: `${BASE_URL}/dm35/en/madou` },
        { name: "K-Live",               url: `${BASE_URL}/en/klive` },
        { name: "C-Live",               url: `${BASE_URL}/en/clive` },
        { name: "Tokyo Hot",            url: `${BASE_URL}/dm29/en/tokyohot` },
        { name: "HEYZO",                url: `${BASE_URL}/dm1198483/en/heyzo` },
        { name: "1pondo",               url: `${BASE_URL}/dm2469695/en/1pondo` },
        { name: "Caribbeancom",         url: `${BASE_URL}/dm3959622/en/caribbeancom` },
        { name: "Caribbeancom Premium", url: `${BASE_URL}/dm48032/en/caribbeancompr` },
        { name: "10musume",             url: `${BASE_URL}/dm3710098/en/10musume` },
        { name: "Pacopacomama",         url: `${BASE_URL}/dm1342558/en/pacopacomama` },
        { name: "Gachinco",             url: `${BASE_URL}/dm136/en/gachinco` },
        { name: "XXX-AV",               url: `${BASE_URL}/dm29/en/xxxav` },
        { name: "Married Slash",        url: `${BASE_URL}/dm24/en/marriedslash` },
        { name: "Naughty 4610",         url: `${BASE_URL}/dm20/en/naughty4610` },
        { name: "Naughty 0930",         url: `${BASE_URL}/dm22/en/naughty0930` },
    ];

    function fixUrl(u) {
        if (!u) return "";
        if (u.startsWith("//")) return "https:" + u;
        if (u.startsWith("/")) return BASE_URL + u;
        return u;
    }

    function buildPageUrl(base, page) {
        if (page <= 1) return base;
        return base.includes("?") ? `${base}&page=${page}` : `${base}?page=${page}`;
    }

    // ── P.A.C.K.E.R unpack (thay thế getAndUnpack của CloudStream) ──
    // CloudStream dùng getAndUnpack() built-in — ta tự implement
    function unpackPacker(source) {
        const results = [];
        // Match tất cả eval(function(p,a,c,k,e,...) blocks
        const regex = /eval\(function\(p,a,c,k,e,[dr]\)\{[\s\S]*?\}\('([\s\S]*?)',(\d+),(\d+),'([\s\S]*?)'\.split\('\|'\)/g;
        let m;
        while ((m = regex.exec(source)) !== null) {
            try {
                const payload = m[1];
                const radix   = parseInt(m[2]);
                const keys    = m[4].split("|");
                let result    = payload;
                for (let i = keys.length - 1; i >= 0; i--) {
                    if (keys[i]) {
                        const re = new RegExp("\\b" + i.toString(radix) + "\\b", "g");
                        result = result.replace(re, keys[i]);
                    }
                }
                results.push(result);
            } catch (e) {}
        }
        return results.join("\n");
    }

    // ── UUID extractor ──
    // CloudStream: /([a-f0-9\-]{36})/
    const UUID_RE = /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/;

    function findUUID(text) {
        const m = UUID_RE.exec(text);
        return m ? m[1] : null;
    }

    // ── Parse danh sách phim ──
    function parseItems(doc) {
        const items = [];
        const seen = new Set();

        doc.querySelectorAll("div.grid.grid-cols-2 > div, div.thumbnail.group").forEach(el => {
            const link = el.querySelector("a[href*='/en/'], a[href*='/dm']");
            if (!link) return;

            const url = fixUrl(link.getAttribute("href") || "");
            if (!url || seen.has(url)) return;

            const titleEl = el.querySelector("div.my-2 a, div.title a, a.text-secondary");
            let title = (titleEl?.textContent || link.textContent || "").trim();
            if (!title || BLACKLIST.includes(title.toLowerCase())) return;

            const isUncensored = /uncensored[-_ ]?leak/i.test(
                (link.getAttribute("alt") || "") + (link.getAttribute("href") || "") + el.innerHTML
            );
            if (isUncensored && !title.toLowerCase().startsWith("uncensored - ")) {
                title = `Uncensored - ${title}`;
            }

            const img = el.querySelector("img");
            const poster = img?.getAttribute("data-src") || img?.getAttribute("src") || "";
            if (!poster) return;

            seen.add(url);
            items.push(new MultimediaItem({ title, url, posterUrl: poster, type: "movie" }));
        });

        return items;
    }

    async function getHome(cb) {
        try {
            const home = {};
            await Promise.all(CATEGORIES.map(async (cat) => {
                try {
                    const res = await http_get(buildPageUrl(cat.url, 1), HEADERS);
                    if (!res || res.status !== 200) return;
                    const doc = await parseHtml(res.body);
                    const items = parseItems(doc);
                    if (items.length > 0) home[cat.name] = items;
                } catch (e) {}
            }));
            cb({ success: true, data: home });
        } catch (e) {
            cb({ success: false, errorCode: "SITE_OFFLINE", message: e.message });
        }
    }

    async function search(query, cb) {
        try {
            const res = await http_get(`${BASE_URL}/en/search/${encodeURIComponent(query)}`, HEADERS);
            if (!res || res.status !== 200) return cb({ success: true, data: [] });
            const doc = await parseHtml(res.body);
            cb({ success: true, data: parseItems(doc) });
        } catch (e) {
            cb({ success: false, errorCode: "SEARCH_ERROR", message: e.message });
        }
    }

    async function load(url, cb) {
        try {
            const res = await http_get(url, HEADERS);
            if (!res || res.status !== 200) return cb({ success: false, errorCode: "SITE_OFFLINE" });
            const doc = await parseHtml(res.body);

            const title = doc.querySelector("h1.text-base")?.textContent?.trim();
            if (!title) return cb({ success: false, errorCode: "PARSE_ERROR", message: "No title" });

            const poster = fixUrl(doc.querySelector("meta[property='og:image']")?.getAttribute("content") || "");
            const year = parseInt(doc.querySelector("time")?.textContent?.trim()?.split("-")[0]) || undefined;

            const tags = [];
            const cast = [];
            doc.querySelectorAll("div.text-secondary").forEach(div => {
                const text = div.textContent.toLowerCase();
                if (text.includes("genre")) {
                    div.querySelectorAll("a").forEach(a => {
                        const t = a.textContent.trim();
                        if (t) tags.push(t);
                    });
                }
                if (text.includes("actress")) {
                    div.querySelectorAll("a").forEach(a => {
                        const n = a.textContent.trim();
                        if (n) cast.push(new Actor({ name: n }));
                    });
                }
            });

            cb({
                success: true,
                data: new MultimediaItem({
                    title,
                    url,
                    posterUrl: poster,
                    type: "movie",
                    year,
                    tags: tags.length ? tags : undefined,
                    cast: cast.length ? cast : undefined,
                    episodes: [
                        new Episode({
                            name: "Play",
                            url,
                            season: 1,
                            episode: 1,
                            posterUrl: poster || undefined
                        })
                    ]
                })
            });
        } catch (e) {
            cb({ success: false, errorCode: "PARSE_ERROR", message: e.message });
        }
    }

    async function loadStreams(url, cb) {
        try {
            const res = await http_get(url, HEADERS);
            if (!res || !res.body) return cb({ success: true, data: [] });

            const body = res.body;

            // Tầng 1: surrit.com xuất hiện trực tiếp trong raw HTML (không bị pack)
            const surritDirect = body.match(/surrit\.com\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/);
            if (surritDirect) {
                return cb({
                    success: true,
                    data: [new StreamResult({
                        url: `https://surrit.com/${surritDirect[1]}/playlist.m3u8`,
                        source: "MissAV",
                        headers: { "Referer": BASE_URL + "/" }
                    })]
                });
            }

            // Tầng 2: unpack P.A.C.K.E.R rồi tìm UUID — đây là cách CloudStream làm
            const unpacked = unpackPacker(body);
            if (unpacked) {
                // Ưu tiên tìm surrit.com URL sau khi unpack
                const surritUnpacked = unpacked.match(/surrit\.com\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/);
                if (surritUnpacked) {
                    return cb({
                        success: true,
                        data: [new StreamResult({
                            url: `https://surrit.com/${surritUnpacked[1]}/playlist.m3u8`,
                            source: "MissAV",
                            headers: { "Referer": BASE_URL + "/" }
                        })]
                    });
                }

                // Fallback: UUID bất kỳ trong unpacked (đúng theo CloudStream regex)
                const uuid = findUUID(unpacked);
                if (uuid) {
                    return cb({
                        success: true,
                        data: [new StreamResult({
                            url: `https://surrit.com/${uuid}/playlist.m3u8`,
                            source: "MissAV",
                            headers: { "Referer": BASE_URL + "/" }
                        })]
                    });
                }
            }

            cb({ success: true, data: [] });
        } catch (e) {
            cb({ success: false, errorCode: "STREAM_ERROR", message: e.message });
        }
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();
