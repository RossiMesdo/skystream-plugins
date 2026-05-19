(function () {

    const BASE_HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
        "Referer": manifest.baseUrl + "/"
    };

    async function request(url, options = {}) {
        const response = await fetch(url, {
            method: options.method || "GET",
            headers: {
                ...BASE_HEADERS,
                ...(options.headers || {})
            },
            body: options.body || null
        });

        return await response.text();
    }

    function absolute(url) {
        if (!url) return "";
        if (url.startsWith("http")) return url;
        if (url.startsWith("//")) return "https:" + url;
        return manifest.baseUrl + url;
    }

    function clean(text = "") {
        return text
            .replace(/&amp;/g, "&")
            .replace(/&#039;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .trim();
    }

    function parseVideos(html) {

        const items = [];

        const matches = [
            ...html.matchAll(/<div[^>]*class="video-item[\s\S]*?<\/div>\s*<\/div>/gi)
        ];

        for (const match of matches) {

            const block = match[0];

            try {

                const href =
                    block.match(/href="([^"]+)"/i)?.[1];

                const title =
                    block.match(/title="([^"]+)"/i)?.[1]
                    || block.match(/alt="([^"]+)"/i)?.[1];

                const poster =
                    block.match(/data-src="([^"]+)"/i)?.[1]
                    || block.match(/src="([^"]+)"/i)?.[1];

                if (!href || !title || !poster) continue;

                items.push(new MultimediaItem({
                    title: clean(title),
                    url: absolute(href),
                    posterUrl: absolute(poster),
                    type: "movie"
                }));

            } catch (_) {}
        }

        return items;
    }

    async function getHome(cb) {

        try {

            const html = await request(manifest.baseUrl);

            const latest = parseVideos(html);

            const categories = {};

            categories["Trending"] = latest.slice(0, 15);
            categories["Latest"] = latest.slice(15, 50);

            cb({
                success: true,
                data: categories
            });

        } catch (e) {

            cb({
                success: false,
                errorCode: "HOME_ERROR",
                message: String(e)
            });

        }
    }

    async function search(query, cb) {

        try {

            const url =
                `${manifest.baseUrl}/search/${encodeURIComponent(query)}/`;

            const html = await request(url);

            const results = parseVideos(html);

            cb({
                success: true,
                data: results
            });

        } catch (e) {

            cb({
                success: false,
                errorCode: "SEARCH_ERROR",
                message: String(e)
            });

        }
    }

    async function load(url, cb) {

        try {

            const html = await request(url);

            const title =
                clean(
                    html.match(/<title>(.*?)<\/title>/i)?.[1]
                    ?.replace(/-?\s*VLXX.*$/i, "")
                    || "Unknown"
                );

            const poster =
                html.match(/property="og:image"\s*content="([^"]+)"/i)?.[1]
                || "";

            const description =
                html.match(/property="og:description"\s*content="([^"]+)"/i)?.[1]
                || "";

            const tags = [
                ...html.matchAll(/<a[^>]*href="[^"]*tag[^"]*"[^>]*>(.*?)<\/a>/gi)
            ].map(v => clean(v[1]));

            const item = new MultimediaItem({
                title,
                url,
                posterUrl: absolute(poster),
                description: clean(description),
                type: "movie"
            });

            if (tags.length > 0) {
                item.genres = tags;
            }

            cb({
                success: true,
                data: item
            });

        } catch (e) {

            cb({
                success: false,
                errorCode: "LOAD_ERROR",
                message: String(e)
            });

        }
    }

    async function extractSources(playerHtml) {

        const streams = [];

        const sourcesMatch =
            playerHtml.match(/sources\s*:\s*(\[[\s\S]*?\])/i);

        if (!sourcesMatch) {
            return streams;
        }

        let parsed = [];

        try {
            parsed = JSON.parse(sourcesMatch[1]);
        } catch (_) {}

        for (const source of parsed) {

            if (!source?.file) continue;

            streams.push(
                new StreamResult({
                    url: source.file,
                    quality: source.label || "Auto",
                    headers: {
                        Referer: manifest.baseUrl + "/"
                    }
                })
            );
        }

        return streams;
    }

    async function loadStreams(url, cb) {

        try {

            const html = await request(url);

            let videoId =
                html.match(/video_id\s*=\s*["']?(\d+)/i)?.[1];

            if (!videoId) {
                videoId =
                    html.match(/id_video\s*=\s*["']?(\d+)/i)?.[1];
            }

            if (!videoId) {

                return cb({
                    success: false,
                    errorCode: "NO_VIDEO_ID",
                    message: "Video id not found"
                });
            }

            const allStreams = [];

            for (const server of [1, 2, 3]) {

                try {

                    const body = new URLSearchParams();
                    body.append("vlxx_server", String(server));
                    body.append("id", videoId);
                    body.append("server", String(server));

                    const ajaxHtml = await request(
                        `${manifest.baseUrl}/ajax.php`,
                        {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                                "X-Requested-With": "XMLHttpRequest"
                            },
                            body: body.toString()
                        }
                    );

                    const extracted =
                        await extractSources(ajaxHtml);

                    allStreams.push(...extracted);

                } catch (_) {}
            }

            const unique = [];
            const used = new Set();

            for (const stream of allStreams) {

                if (used.has(stream.url)) continue;

                used.add(stream.url);

                unique.push(stream);
            }

            cb({
                success: true,
                data: unique
            });

        } catch (e) {

            cb({
                success: false,
                errorCode: "STREAM_ERROR",
                message: String(e)
            });

        }
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;

})();