(function () {
    const BASE_URL = manifest.baseUrl;
    const HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/132.0 Safari/537.36",
        "Referer": `${BASE_URL}/`
    };

    function fixUrl(url, baseUrl = BASE_URL) {
        if (!url) return "";
        try {
            return new URL(url, baseUrl).href;
        } catch (_) {
            return "";
        }
    }

    function parseItems(container) {
        const items = [];
        const seen = new Set();
        container.querySelectorAll(".card-list-item-video").forEach(card => {
            const link = card.querySelector("a.image-container[href]");
            const url = fixUrl(link?.getAttribute("href"));
            const title = card.parentElement?.querySelector(".card-list-item-desc")?.textContent?.trim();
            if (!url || !title || seen.has(url)) return;
            seen.add(url);

            const image = link.querySelector("img");
            const posterUrl = fixUrl(image?.getAttribute("data-src") || image?.getAttribute("src"));
            items.push(new MultimediaItem({
                title,
                url,
                posterUrl: posterUrl || undefined,
                type: "movie",
                isAdult: true,
                contentRating: "18+"
            }));
        });
        return items;
    }

    async function getHome(cb) {
        try {
            const res = await http_get(BASE_URL, HEADERS);
            if (!res?.body) return cb({ success: false, errorCode: "SITE_OFFLINE" });

            const doc = await parseHtml(res.body);
            const data = {};
            doc.querySelectorAll(".card-list[data-attr]").forEach(section => {
                const name = section.getAttribute("data-attr")?.trim();
                if (!name) return;
                const items = parseItems(section);
                if (items.length) data[name] = items;
            });
            if (!Object.keys(data).length) {
                return cb({ success: false, errorCode: "PARSE_ERROR", message: "Không tìm thấy danh sách video" });
            }

            cb({ success: true, data });
        } catch (e) {
            cb({ success: false, errorCode: "HOME_ERROR", message: String(e?.message || e) });
        }
    }

    async function search(query, cb) {
        try {
            const url = `${BASE_URL}/search/?query=${encodeURIComponent(query)}`;
            const res = await http_get(url, HEADERS);
            if (!res?.body) return cb({ success: false, errorCode: "SITE_OFFLINE" });
            cb({ success: true, data: parseItems(await parseHtml(res.body)) });
        } catch (e) {
            cb({ success: false, errorCode: "SEARCH_ERROR", message: String(e?.message || e) });
        }
    }

    async function load(url, cb) {
        try {
            const res = await http_get(url, HEADERS);
            if (!res?.body) return cb({ success: false, errorCode: "SITE_OFFLINE" });

            const doc = await parseHtml(res.body);
            const title = doc.querySelector("meta[property='og:title']")?.getAttribute("content")?.trim()
                || doc.querySelector(".plyr-video-title")?.textContent?.trim()
                || doc.querySelector("title")?.textContent?.trim();
            if (!title) return cb({ success: false, errorCode: "PARSE_ERROR", message: "Không tìm thấy tiêu đề video" });

            const posterUrl = fixUrl(doc.querySelector("meta[property='og:image']")?.getAttribute("content"));
            const description = doc.querySelector(".plyr-download-detail-desc")?.textContent?.trim()
                || doc.querySelector("meta[name='description']")?.getAttribute("content")?.trim()
                || "";

            cb({
                success: true,
                data: new MultimediaItem({
                    title,
                    url,
                    posterUrl,
                    description,
                    type: "movie",
                    isAdult: true,
                    contentRating: "18+",
                    episodes: [new Episode({
                        name: title,
                        url,
                        season: 1,
                        episode: 1,
                        posterUrl: posterUrl || undefined
                    })]
                })
            });
        } catch (e) {
            cb({ success: false, errorCode: "LOAD_ERROR", message: String(e?.message || e) });
        }
    }

    async function loadStreams(url, cb) {
        try {
            const res = await http_get(url, HEADERS);
            if (!res?.body) return cb({ success: false, errorCode: "SITE_OFFLINE" });

            const doc = await parseHtml(res.body);
            const player = doc.querySelector(".plyr-detail-page-video iframe[data-url]");
            const streamUrl = fixUrl(player?.getAttribute("data-url"), url);
            if (!streamUrl) {
                return cb({ success: false, errorCode: "STREAM_NOT_FOUND", message: "Không tìm thấy link HLS" });
            }

            const playerUrl = fixUrl(player.getAttribute("src") || "/i.html", url);
            cb({
                success: true,
                data: [new StreamResult({
                    url: streamUrl,
                    source: "KanAV",
                    quality: "Auto",
                    headers: {
                        "Referer": playerUrl,
                        "User-Agent": HEADERS["User-Agent"]
                    }
                })]
            });
        } catch (e) {
            cb({ success: false, errorCode: "STREAM_ERROR", message: String(e?.message || e) });
        }
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();
