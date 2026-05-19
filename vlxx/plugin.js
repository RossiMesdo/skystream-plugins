(function () {

    const DEFAULT_HEADERS = {
        "User-Agent": "Mozilla/5.0",
        "Referer": manifest.baseUrl + "/"
    };

    async function request(url, options = {}) {
        const res = await fetch(url, {
            method: options.method || "GET",
            headers: {
                ...DEFAULT_HEADERS,
                ...(options.headers || {})
            },
            body: options.body || null
        });

        return await res.text();
    }

    function extractItems(html) {
        const results = [];

        const blocks = html.match(/<div class="video-item">[\s\S]*?<\/div>\s*<\/div>/g) || [];

        for (const block of blocks) {
            try {
                const url = block.match(/href="([^"]+)"/)?.[1];
                const title = block.match(/title="([^"]+)"/)?.[1];
                const poster = block.match(/data-src="([^"]+)"/)?.[1]
                    || block.match(/src="([^"]+)"/)?.[1];

                if (!url || !title || !poster) continue;

                results.push(new MultimediaItem({
                    title: decodeHtml(title.trim()),
                    url: absoluteUrl(url),
                    posterUrl: absoluteUrl(poster),
                    type: "movie"
                }));
            } catch (_) {}
        }

        return results;
    }

    function absoluteUrl(url) {
        if (!url) return "";
        if (url.startsWith("http")) return url;
        return manifest.baseUrl + url;
    }

    function decodeHtml(str) {
        return str
            .replace(/&amp;/g, "&")
            .replace(/&#039;/g, "'")
            .replace(/&quot;/g, '"');
    }

    async function getHome(cb) {
        try {
            const html = await request(manifest.baseUrl);

            const items = extractItems(html);

            cb({
                success: true,
                data: {
                    "Trending": items.slice(0, 20),
                    "Latest": items.slice(20, 60)
                }
            });

        } catch (e) {
            cb({
                success: false,
                errorCode: "HOME_ERROR",
                message: e.toString()
            });
        }
    }

    async function search(query, cb) {
        try {
            const url = `${manifest.baseUrl}/search/${encodeURIComponent(query)}/`;

            const html = await request(url);

            const items = extractItems(html);

            cb({
                success: true,
                data: items
            });

        } catch (e) {
            cb({
                success: false,
                errorCode: "SEARCH_ERROR",
                message: e.toString()
            });
        }
    }

    async function load(url, cb) {
        try {
            const html = await request(url);

            const title =
                html.match(/<title>(.*?)<\/title>/i)?.[1]
                    ?.replace("- VLXX.*", "")
                    ?.trim() || "Unknown";

            const poster =
                html.match(/property="og:image"\s*content="([^"]+)"/)?.[1] || "";

            const description =
                html.match(/property="og:description"\s*content="([^"]+)"/)?.[1] || "";

            const item = new MultimediaItem({
                title: decodeHtml(title),
                url: url,
                posterUrl: absoluteUrl(poster),
                description: decodeHtml(description),
                type: "movie"
            });

            cb({
                success: true,
                data: item
            });

        } catch (e) {
            cb({
                success: false,
                errorCode: "LOAD_ERROR",
                message: e.toString()
            });
        }
    }

    async function loadStreams(url, cb) {
        try {

            const html = await request(url);

            const videoId =
                html.match(/video_id\s*=\s*["']?(\d+)/i)?.[1]
                || html.match(/id:\s*["']?(\d+)/i)?.[1];

            if (!videoId) {
                return cb({
                    success: false,
                    errorCode: "NO_VIDEO_ID",
                    message: "Could not find video id"
                });
            }

            const body = new URLSearchParams();
            body.append("vlxx_server", "1");
            body.append("id", videoId);
            body.append("server", "1");

            const ajax = await request(`${manifest.baseUrl}/ajax.php`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "X-Requested-With": "XMLHttpRequest"
                },
                body: body.toString()
            });

            const sourcesMatch =
                ajax.match(/sources\s*:\s*(\[[\s\S]*?\])/);

            if (!sourcesMatch) {
                return cb({
                    success: true,
                    data: []
                });
            }

            let sources = [];

            try {
                sources = JSON.parse(sourcesMatch[1]);
            } catch (_) {}

            const streams = [];

            for (const source of sources) {
                if (!source.file) continue;

                streams.push(new StreamResult({
                    url: source.file,
                    quality: source.label || "Auto",
                    headers: {
                        Referer: manifest.baseUrl + "/"
                    }
                }));
            }

            cb({
                success: true,
                data: streams
            });

        } catch (e) {
            cb({
                success: false,
                errorCode: "STREAM_ERROR",
                message: e.toString()
            });
        }
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;

})();