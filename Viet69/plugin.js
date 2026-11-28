(function () {
    const BASE_URL = manifest.baseUrl;
    const HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/132.0 Safari/537.36",
        "Referer": `${BASE_URL}/`
    };
    const CATEGORIES = [
        { name: "Mới nhất", path: "/" },
        { name: "Sex Việt", path: "/category/sex-viet/" },
        { name: "Sinh viên", path: "/category/sinh-vien/" },
        { name: "Teen", path: "/category/teen/" },
        { name: "Xem nhiều", path: "/xem-nhieu/" }
    ];

    function fixUrl(url) {
        if (!url) return "";
        if (url.startsWith("//")) return `https:${url}`;
        if (url.startsWith("/")) return new URL(url, BASE_URL).href;
        return url;
    }

    function parseItems(doc) {
        const items = [];
        const seen = new Set();
        doc.querySelectorAll(".item-video").forEach(card => {
            const link = card.querySelector("a.clip-link[href]") || card.querySelector("h2 a[href], h3 a[href]");
            const url = fixUrl(link?.getAttribute("href"));
            const title = (link?.getAttribute("title") || link?.textContent || "").trim();
            if (!url || !title || seen.has(url)) return;
            seen.add(url);
            const image = card.querySelector("img");
            items.push(new MultimediaItem({
                title, url,
                posterUrl: fixUrl(image?.getAttribute("data-src") || image?.getAttribute("src")),
                type: "movie", isAdult: true, contentRating: "18+"
            }));
        });
        return items;
    }

    async function getHome(cb) {
        try {
            const home = {};
            await Promise.all(CATEGORIES.map(async category => {
                try {
                    const res = await http_get(fixUrl(category.path), HEADERS);
                    if (!res?.body) return;
                    const items = parseItems(await parseHtml(res.body));
                    if (items.length) home[category.name] = items;
                } catch (_) {}
            }));
            cb({ success: true, data: home });
        } catch (e) {
            cb({ success: false, errorCode: "HOME_ERROR", message: String(e?.message || e) });
        }
    }

    async function search(query, cb) {
        try {
            const res = await http_get(`${BASE_URL}/?s=${encodeURIComponent(query)}`, HEADERS);
            if (!res?.body) return cb({ success: true, data: [] });
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
            const title = doc.querySelector("h1")?.textContent?.trim()
                || doc.querySelector("meta[property='og:title']")?.getAttribute("content")?.trim();
            if (!title) return cb({ success: false, errorCode: "PARSE_ERROR", message: "Không tìm thấy tiêu đề video" });
            const poster = doc.querySelector("meta[property='og:image']")?.getAttribute("content") || "";
            const description = doc.querySelector("meta[name='description']")?.getAttribute("content") || "";
            cb({ success: true, data: new MultimediaItem({
                title, url, posterUrl: fixUrl(poster), description,
                type: "movie", isAdult: true, contentRating: "18+",
                episodes: [new Episode({ name: title, url, season: 1, episode: 1, posterUrl: fixUrl(poster) || undefined })]
            }) });
        } catch (e) {
            cb({ success: false, errorCode: "LOAD_ERROR", message: String(e?.message || e) });
        }
    }

    function unescapeJson(value) {
        return value.replace(/\\\//g, "/").replace(/\\u003d/gi, "=").replace(/\\u0026/gi, "&").replace(/&amp;/gi, "&");
    }

    async function resolvePlayer(pageUrl, movieId, type, index) {
        const useXvideo = String(type) === "10";
        const endpoint = `${BASE_URL}/${useXvideo ? "get.xvideo.php" : "get.video.php"}`;
        const postHeaders = {
            ...HEADERS,
            "Referer": pageUrl,
            "Origin": BASE_URL,
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest"
        };
        const body = `movie_id=${encodeURIComponent(movieId)}&type=${encodeURIComponent(type)}&index=${encodeURIComponent(index)}`;
        const playerRes = await http_post(endpoint, postHeaders, body);
        const embedUrl = (playerRes?.body || "").match(/<iframe[^>]+src=["']([^"']+)/i)?.[1]?.replace(/&amp;/g, "&");
        if (!embedUrl) return "";
        const embedId = embedUrl.match(/\/embed\/([a-f0-9-]+)/i)?.[1];
        if (!embedId) return "";
        const videoApi = await http_get(new URL(`/api/get-video?id=${encodeURIComponent(embedId)}`, embedUrl).href, {
            ...HEADERS,
            "Referer": embedUrl,
            "X-Requested-With": "XMLHttpRequest"
        });
        let playerData;
        try { playerData = JSON.parse(videoApi?.body || ""); } catch (_) { return ""; }
        const bloggerUrl = playerData?.url;
        if (!bloggerUrl) return "";
        const blogger = await http_get(bloggerUrl, { ...HEADERS, "Referer": embedUrl });
        const decoded = unescapeJson(blogger?.body || "");
        return decoded.match(/https?:\/\/[^"'\s<>]+googlevideo\.com\/videoplayback\?[^"'\s<>]+/i)?.[0] || "";
    }

    async function loadStreams(url, cb) {
        try {
            const res = await http_get(url, HEADERS);
            if (!res?.body) return cb({ success: true, data: [] });
            const doc = await parseHtml(res.body);
            const players = [];
            const primary = doc.querySelector(".movieLoader[data-movie]");
            if (primary) players.push({ id: primary.getAttribute("data-movie"), type: primary.getAttribute("data-type"), index: 1 });
            doc.querySelectorAll(".movieLoader-server .video2-btn[data-video]").forEach((button, index) => {
                players.push({ id: button.getAttribute("data-video"), type: button.getAttribute("data-type"), index: index + 1 });
            });
            const streams = [];
            const seen = new Set();
            for (const player of players) {
                if (!player.id || seen.has(player.id)) continue;
                seen.add(player.id);
                const videoUrl = await resolvePlayer(url, player.id, player.type || "25", player.index);
                if (!videoUrl) continue;
                streams.push(new StreamResult({
                    url: videoUrl,
                    source: `Viet69 Server ${player.index}`,
                    quality: "Auto",
                    headers: { ...HEADERS, "Referer": "https://www.blogger.com/" }
                }));
            }
            cb({ success: true, data: streams });
        } catch (e) {
            cb({ success: false, errorCode: "STREAM_ERROR", message: String(e?.message || e) });
        }
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();