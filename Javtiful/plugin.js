(function() {
    /**
     * Javtiful Plugin for SkyStream
     * Site: https://javtiful.com
     * Ported from: Cs-GizliKeyif CloudStream repo
     * Author: Lord
     */

    const BASE_URL = manifest.baseUrl;
    const HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:137.0) Gecko/20100101 Firefox/137.0",
        "Referer": BASE_URL + "/"
    };

    const CATEGORIES = [
        { name: "Newest",             url: `${BASE_URL}/videos` },
        { name: "Most Viewed",        url: `${BASE_URL}/videos?sort=most_viewed` },
        { name: "Top Rated",          url: `${BASE_URL}/videos?sort=top_rated` },
        { name: "Uncensored",         url: `${BASE_URL}/uncensored` },
        { name: "Female Investigator",url: `${BASE_URL}/category/female-investigator` },
        { name: "Chinese AV",         url: `${BASE_URL}/category/chinese-av` },
        { name: "Female Boss",        url: `${BASE_URL}/category/female-boss` },
        { name: "Mature Woman",       url: `${BASE_URL}/category/mature-woman` },
        { name: "Cosplay",            url: `${BASE_URL}/category/cosplay` },
        { name: "Amateur",            url: `${BASE_URL}/category/amateur` },
        { name: "Housekeeper",        url: `${BASE_URL}/category/housekeeper` },
        { name: "Nurse",              url: `${BASE_URL}/category/nurse` },
        { name: "Female Student",     url: `${BASE_URL}/category/female-student` },
        { name: "School Girls",       url: `${BASE_URL}/category/school-girls` },
        { name: "Office Lady",        url: `${BASE_URL}/category/office-lady` },
        { name: "Sister-in-law",      url: `${BASE_URL}/category/sister-in-law` },
        { name: "Hypnosis",           url: `${BASE_URL}/category/hypnosis` },
        { name: "Beautiful Girl",     url: `${BASE_URL}/category/beautiful-girl` },
        { name: "BBW",                url: `${BASE_URL}/category/bbw` },
        { name: "Drama",              url: `${BASE_URL}/category/drama` },
        { name: "Married Woman",      url: `${BASE_URL}/category/married-woman` },
        { name: "MILF",               url: `${BASE_URL}/category/milf` },
        { name: "Female Teacher",     url: `${BASE_URL}/category/female-teacher` },
        { name: "Affair",             url: `${BASE_URL}/category/affair` },
        { name: "Big Tits",           url: `${BASE_URL}/category/big-tits` },
    ];

    function fixUrl(u) {
        if (!u) return "";
        if (u.startsWith("//")) return "https:" + u;
        if (u.startsWith("/")) return BASE_URL + u;
        return u;
    }

    // CloudStream: page 1 dùng URL gốc, page 2+ thêm ?page=N
    function buildPageUrl(base, page) {
        if (page <= 1) return base;
        return base.includes("?") ? `${base}&page=${page}` : `${base}?page=${page}`;
    }

    // CloudStream: article.front-video-card:not(.front-partner-card)
    // title từ a.front-video-title, poster từ img[data-front-lazy-src] fallback src
    function parseItems(doc) {
        return Array.from(
            doc.querySelectorAll("article.front-video-card:not(.front-partner-card)")
        ).map(el => {
            const link = el.querySelector("a.front-video-title");
            if (!link) return null;
            const title = link.textContent.trim();
            const url = fixUrl(link.getAttribute("href") || "");
            if (!title || !url) return null;
            const img = el.querySelector("img");
            const poster = fixUrl(
                img?.getAttribute("data-front-lazy-src") || img?.getAttribute("src") || ""
            );
            return new MultimediaItem({ title, url, posterUrl: poster, type: "movie" });
        }).filter(Boolean);
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
            // CloudStream: page 1 = /search?q=query, page 2+ = /search?page=N&q=query
            const res = await http_get(`${BASE_URL}/search?q=${encodeURIComponent(query)}`, HEADERS);
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

            // CloudStream: div.front-watch-title h1
            const title = doc.querySelector("div.front-watch-title h1")?.textContent?.trim();
            if (!title) return cb({ success: false, errorCode: "PARSE_ERROR", message: "No title" });

            const poster = fixUrl(doc.querySelector("meta[property='og:image']")?.getAttribute("content") || "");
            const description = doc.querySelector("meta[property='og:description']")?.getAttribute("content")?.trim() || "";

            // CloudStream: year từ div.front-watch-detail:contains(Added on) time[datetime]
            const dateEl = Array.from(doc.querySelectorAll("div.front-watch-detail")).find(d =>
                d.textContent.includes("Added on")
            );
            const year = parseInt(dateEl?.querySelector("time")?.getAttribute("datetime")?.split("-")[0]) || undefined;

            // CloudStream: tags từ div.front-watch-detail:contains(Categories) a
            //              + div.front-watch-detail:contains(Tags) a
            const tags = [];
            doc.querySelectorAll("div.front-watch-detail").forEach(div => {
                const text = div.textContent;
                if (text.includes("Categories") || text.includes("Tags")) {
                    div.querySelectorAll("a").forEach(a => {
                        const t = a.textContent.trim();
                        if (t) tags.push(t);
                    });
                }
            });

            // CloudStream: cast từ a.front-watch-actor-card
            const cast = Array.from(doc.querySelectorAll("a.front-watch-actor-card")).map(el => {
                const name = el.querySelector("span")?.textContent?.trim() || "";
                const img = el.querySelector("img");
                const image = img?.getAttribute("src") || "";
                const validImage = image && !image.includes("profile-placeholder.png") ? fixUrl(image) : undefined;
                return name ? new Actor({ name, image: validImage }) : null;
            }).filter(Boolean);

            // CloudStream: recommendations từ div.front-video-grid-related article.front-video-card:not(.front-partner-card)
            const recommendations = Array.from(
                doc.querySelectorAll("div.front-video-grid-related article.front-video-card:not(.front-partner-card)")
            ).map(el => {
                const link = el.querySelector("a.front-video-title");
                if (!link) return null;
                const recTitle = link.textContent.trim();
                const recUrl = fixUrl(link.getAttribute("href") || "");
                if (!recTitle || !recUrl) return null;
                const img = el.querySelector("img");
                const recPoster = fixUrl(
                    img?.getAttribute("data-front-lazy-src") || img?.getAttribute("src") || ""
                );
                return new MultimediaItem({ title: recTitle, url: recUrl, posterUrl: recPoster, type: "movie" });
            }).filter(Boolean);

            cb({
                success: true,
                data: new MultimediaItem({
                    title,
                    url,
                    posterUrl: poster,
                    type: "movie",
                    description,
                    year,
                    tags: tags.length ? tags : undefined,
                    cast: cast.length ? cast : undefined,
                    recommendations: recommendations.length ? recommendations : undefined,
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

            // CloudStream: parse JSON từ <script id="frontWatchConfig" type="application/json">
            const raw = res.body
                .split(`id="frontWatchConfig" type="application/json">`)[1]
                ?.split("</script>")[0]
                ?.trim();

            if (!raw) return cb({ success: true, data: [] });

            let config;
            try { config = JSON.parse(raw); } catch (e) { return cb({ success: true, data: [] }); }

            const sources = config?.playerSources;
            if (!Array.isArray(sources) || sources.length === 0) return cb({ success: true, data: [] });

            // Sort: quality cao nhất lên đầu
            const streams = sources
                .filter(s => s.src)
                .sort((a, b) => (b.size || 0) - (a.size || 0))
                .map(s => new StreamResult({
                    url: s.src,
                    source: s.size ? `Javtiful ${s.size}p` : "Javtiful",
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
