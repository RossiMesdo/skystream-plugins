(function () {
    const MAIN_URL = (typeof manifest !== "undefined" && manifest.baseUrl) || "https://en.xchina.co";
    const HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Referer": MAIN_URL
    };

    const CATEGORIES = [
        { name: "Censored AV",           url: `${MAIN_URL}/videos/series-6395aba3deb74.html` },
        { name: "Model Media",           url: `${MAIN_URL}/videos/series-5f904550b8fcc.html` },
        { name: "Uncensored AV",         url: `${MAIN_URL}/videos/series-6395ab7fee104.html` },
        { name: "Independent Creators",  url: `${MAIN_URL}/videos/series-61bf6e439fed6.html` },
        { name: "Pans Videos",           url: `${MAIN_URL}/videos/series-63963186ae145.html` },
        { name: "TXVLOG",                url: `${MAIN_URL}/videos/series-61014080dbfde.html` },
        { name: "Peach Media",           url: `${MAIN_URL}/videos/series-5fe8403919165.html` },
        { name: "Star Media",            url: `${MAIN_URL}/videos/series-6054e93356ded.html` },
        { name: "Timi Media",            url: `${MAIN_URL}/videos/series-60153c49058ce.html` },
        { name: "91mv",                  url: `${MAIN_URL}/videos/series-5fe840718d665.html` }
    ];

    function buildPageUrl(baseUrl, page) {
        if (page <= 1) return baseUrl;
        return baseUrl.replace(".html", `/${page}.html`);
    }

    async function parsePage(url) {
        const res = await http_get(url, HEADERS);
        if (!res || !res.body) return [];
        const doc = await parseHtml(res.body);
        const items = [];
        doc.querySelectorAll("div.item.video").forEach(el => {
            const titleEl = el.querySelector("div.title a");
            if (!titleEl) return;
            const title = titleEl.textContent.trim();
            let href = titleEl.getAttribute("href") || "";
            if (href && !href.startsWith("http")) href = MAIN_URL + href;
            if (!href) return;

            // Poster from background-image style
            const imgDiv = el.querySelector("div.img");
            let poster = "";
            if (imgDiv) {
                const style = imgDiv.getAttribute("style") || "";
                const m = style.match(/url\(['"]?(.*?)['"]?\)/);
                if (m) poster = m[1];
            }
            if (!poster) {
                const img = el.querySelector("img");
                if (img) poster = img.getAttribute("data-src") || img.getAttribute("src") || "";
            }

            items.push(new MultimediaItem({
                title,
                url: href,
                posterUrl: poster,
                type: "movie"
            }));
        });
        return items;
    }

    async function getHome(cb) {
        try {
            const data = {};
            // Fetch 3 pages per category concurrently for more content
            await Promise.all(CATEGORIES.map(async (cat) => {
                try {
                    const pages = await Promise.all([1, 2, 3].map(p => parsePage(buildPageUrl(cat.url, p))));
                    const items = pages.flat();
                    // Deduplicate by url
                    const seen = new Set();
                    const unique = items.filter(i => { if (seen.has(i.url)) return false; seen.add(i.url); return true; });
                    if (unique.length > 0) data[cat.name] = unique;
                } catch (e) {
                    console.error(`XChina getHome error [${cat.name}]: ${e.message}`);
                }
            }));
            cb({ success: true, data });
        } catch (e) {
            cb({ success: false, errorCode: "HOME_ERROR", message: e.message });
        }
    }

    async function search(query, cb) {
        try {
            // Fetch 3 pages of search results
            const pages = await Promise.all([1, 2, 3].map(p => {
                const url = p <= 1
                    ? `${MAIN_URL}/videos/keyword-${encodeURIComponent(query)}.html`
                    : `${MAIN_URL}/videos/keyword-${encodeURIComponent(query)}/${p}.html`;
                return parsePage(url);
            }));
            const items = pages.flat();
            const seen = new Set();
            const unique = items.filter(i => { if (seen.has(i.url)) return false; seen.add(i.url); return true; });
            cb({ success: true, data: unique });
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

            const poster = doc.querySelector("meta[property='og:image']")?.getAttribute("content") || "";

            // Code/volume number
            const volumeEl = doc.querySelector("div.item i.fa-hashtag");
            const volume = volumeEl?.parentElement?.querySelector("div.text")?.textContent?.trim() || "";

            // Description
            const plot = doc.querySelector(".info-card.video-detail .item .text")?.textContent?.trim() || "";
            const description = volume ? `Code: ${volume}\n\n${plot}` : plot;

            // Tags
            const tags = [];
            doc.querySelectorAll(".info-card .item i.fa-tags ~ a, .info-card.video-detail .item .text a").forEach(a => {
                const t = a.textContent.trim();
                if (t) tags.push(t);
            });

            // Cast
            const cast = [];
            doc.querySelectorAll(".model-item").forEach(el => {
                const n = el.textContent.trim();
                if (n) cast.push(new Actor({ name: n }));
            });

            // Recommendations
            const recs = [];
            doc.querySelectorAll("div.item.video").forEach(el => {
                const titleEl = el.querySelector("div.title a");
                if (!titleEl) return;
                const t = titleEl.textContent.trim();
                let href = titleEl.getAttribute("href") || "";
                if (href && !href.startsWith("http")) href = MAIN_URL + href;
                if (!href) return;
                const imgDiv = el.querySelector("div.img");
                let p = "";
                if (imgDiv) { const m = (imgDiv.getAttribute("style") || "").match(/url\(['"]?(.*?)['"]?\)/); if (m) p = m[1]; }
                recs.push(new MultimediaItem({ title: t, url: href, posterUrl: p, type: "movie" }));
            });

            cb({
                success: true,
                data: new MultimediaItem({
                    title,
                    url,
                    posterUrl: poster,
                    description,
                    type: "movie",
                    tags,
                    cast,
                    recommendations: recs,
                    episodes: [
                        new Episode({
                            name: "Play",
                            url,
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

    async function loadStreams(url, cb) {
        try {
            const res = await http_get(url, HEADERS);
            const body = res?.body || "";
            // Extract m3u8 URL from page source
            const m = body.match(/src:\s*['"]( https?:\/\/video\.xchina\.download\/m3u8\/.*?\.m3u8.*?)['"]/);
            // Also try without leading space
            const m2 = body.match(/src:\s*['"]( ?https?:\/\/video\.xchina\.download\/m3u8\/[^'"]+)['"]/);
            const link = (m && m[1].trim()) || (m2 && m2[1].trim()) || "";

            if (!link) return cb({ success: true, data: [] });

            cb({
                success: true,
                data: [
                    new StreamResult({
                        url: link,
                        source: "XChina",
                        headers: {
                            "Referer": MAIN_URL,
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                        }
                    })
                ]
            });
        } catch (e) {
            cb({ success: false, errorCode: "STREAM_ERROR", message: e.message });
        }
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();
