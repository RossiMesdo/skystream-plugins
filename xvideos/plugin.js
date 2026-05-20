(function () {
    /**
     * XVideos Plugin for SkyStream
     * Ported from CloudStream cs3xxx (jacekun)
     * Author: Lord
     */

    const MAIN_URL = (typeof manifest !== "undefined" && manifest?.baseUrl) || "https://www.xvideos.com";
    const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
    const HEADERS = { "User-Agent": UA, "Referer": MAIN_URL, "Accept-Language": "en-US,en;q=0.9" };

    const CATEGORIES = [
        { name: "Main Page",  url: MAIN_URL },
        { name: "New",        url: `${MAIN_URL}/new/` },
        { name: "Best",       url: `${MAIN_URL}/best/` },
        { name: "Top",        url: `${MAIN_URL}/top/` },
        { name: "HD",         url: `${MAIN_URL}/new/hd/` },
        { name: "This Week",  url: `${MAIN_URL}/best/7days/` },
        { name: "This Month", url: `${MAIN_URL}/best/month/` },
        { name: "Anal",       url: `${MAIN_URL}/c/anal-sex/1/` },
        { name: "Asian",      url: `${MAIN_URL}/c/asian-women/5/` },
        { name: "Big Ass",    url: `${MAIN_URL}/c/big-ass/11/` },
        { name: "Big Tits",   url: `${MAIN_URL}/c/big-tits/2/` },
        { name: "Blowjob",    url: `${MAIN_URL}/c/blowjob/6/` },
        { name: "Creampie",   url: `${MAIN_URL}/c/creampie/14/` },
        { name: "Homemade",   url: `${MAIN_URL}/c/amateur/17/` },
        { name: "Japanese",   url: `${MAIN_URL}/c/japanese/32/` },
        { name: "Lesbian",    url: `${MAIN_URL}/c/lesbian/22/` },
        { name: "MILF",       url: `${MAIN_URL}/c/milf/44/` },
        { name: "POV",        url: `${MAIN_URL}/c/pov/19/` },
        { name: "Teen",       url: `${MAIN_URL}/c/teen/3/` },
        { name: "Threesome",  url: `${MAIN_URL}/c/threesome/45/` },
        { name: "Cumshot",    url: `${MAIN_URL}/c/cumshot/62/` },
        { name: "Latina",     url: `${MAIN_URL}/c/latina/23/` },
        { name: "Ebony",      url: `${MAIN_URL}/c/ebony/21/` },
        { name: "European",   url: `${MAIN_URL}/c/european/56/` },
        { name: "Massage",    url: `${MAIN_URL}/c/massage/46/` },
        { name: "Solo",       url: `${MAIN_URL}/c/solo/38/` },
    ];

    function fixUrl(url) {
        if (!url) return null;
        url = url.trim();
        if (url.startsWith("//")) return "https:" + url;
        if (url.startsWith("http")) return url;
        if (url.startsWith("/")) return MAIN_URL + url;
        return null;
    }

    // Dùng parseHtml + querySelector — chuẩn SkyStream, selector đúng theo cs3xxx
    async function parseThumbBlocks(html) {
        const doc = await parseHtml(html);
        const items = [];
        const seen = new Set();

        doc.querySelectorAll("div.thumb-block").forEach(el => {
            const titleEl = el.querySelector("p.title a");
            const title = titleEl ? titleEl.textContent.trim() : null;

            const linkEl = el.querySelector("div.thumb a");
            const href = linkEl ? fixUrl(linkEl.getAttribute("href")) : null;

            if (!href || !title || seen.has(href)) return;
            seen.add(href);

            const imgEl = el.querySelector("div.thumb a img");
            const poster = imgEl
                ? fixUrl(imgEl.getAttribute("data-src") || imgEl.getAttribute("src"))
                : null;

            items.push(new MultimediaItem({
                title,
                url: href,
                posterUrl: poster,
                type: "movie",
                isAdult: true,
                contentRating: "18+"
            }));
        });

        return items;
    }

    // Fetch tuần tự — tránh bị block khi fetch 26 cái song song
    async function getHome(cb) {
        try {
            const homeData = {};

            for (const cat of CATEGORIES) {
                try {
                    const res = await http_get(cat.url, HEADERS);
                    if (!res || !res.body) continue;
                    const items = await parseThumbBlocks(res.body);
                    if (items.length > 0) homeData[cat.name] = items;
                } catch (_) {
                    continue;
                }
            }

            if (!Object.keys(homeData).length)
                return cb({ success: false, errorCode: "HOME_ERROR", message: "No data found" });

            cb({ success: true, data: homeData });
        } catch (e) {
            cb({ success: false, errorCode: "HOME_ERROR", message: e.message });
        }
    }

    async function search(query, cb) {
        try {
            const url = `${MAIN_URL}?k=${encodeURIComponent(query)}`;
            const res = await http_get(url, HEADERS);
            if (!res || !res.body) return cb({ success: true, data: [] });
            const items = await parseThumbBlocks(res.body);
            cb({ success: true, data: items });
        } catch (e) {
            cb({ success: false, errorCode: "SEARCH_ERROR", message: e.message });
        }
    }

    async function load(url, cb) {
        try {
            const res = await http_get(url, HEADERS);
            if (!res || !res.body)
                return cb({ success: false, errorCode: "LOAD_ERROR", message: "Empty response" });

            const doc = await parseHtml(res.body);
            const isChannel = url.includes("/channels") || url.includes("/pornstars");

            let title;
            if (isChannel) {
                title = doc.querySelector("title")?.textContent?.trim();
            } else {
                title = doc.querySelector(".page-title")?.textContent?.trim();
            }
            title = title || "Unknown";

            let poster;
            if (isChannel) {
                poster = fixUrl(doc.querySelector(".profile-pic img")?.getAttribute("data-src"));
            } else {
                poster = fixUrl(doc.querySelector("meta[property='og:image']")?.getAttribute("content"));
            }

            const tags = [];
            doc.querySelectorAll(".video-tags-list li a").forEach(a => {
                const t = a.textContent.trim().replace(/,\s*$/, "");
                if (t && !tags.includes(t)) tags.push(t);
            });

            const episode = new Episode({
                name: title,
                url: url,
                season: 1,
                episode: 1,
                dubStatus: "none",
                posterUrl: poster || undefined
            });

            cb({
                success: true,
                data: new MultimediaItem({
                    title,
                    url,
                    posterUrl: poster,
                    type: "movie",
                    tags: tags.length ? tags : undefined,
                    episodes: [episode],
                    isAdult: true,
                    contentRating: "18+"
                })
            });
        } catch (e) {
            cb({ success: false, errorCode: "LOAD_ERROR", message: e.message });
        }
    }

    async function loadStreams(url, cb) {
        try {
            const res = await http_get(url, HEADERS);
            if (!res || !res.body)
                return cb({ success: false, errorCode: "STREAM_ERROR", message: "Failed to fetch page" });

            const doc = await parseHtml(res.body);
            const streams = [];

            doc.querySelectorAll("script").forEach(script => {
                const text = script.textContent || "";
                if (!text.includes("html5player") && !text.includes("HTML5Player")) return;

                const hlsMatch = text.match(/html5player\.setVideoHLS\('([^']+)'\)/i)
                    || text.match(/\.setVideoHLS\('([^']+)'\)/i);
                if (hlsMatch?.[1]) streams.push(new StreamResult({
                    url: hlsMatch[1].trim(),
                    source: "XVideos HLS",
                    quality: "HLS",
                    headers: { "Referer": MAIN_URL, "User-Agent": UA }
                }));

                const highMatch = text.match(/html5player\.setVideoUrlHigh\('([^']+)'\)/i)
                    || text.match(/\.setVideoUrlHigh\('([^']+)'\)/i);
                if (highMatch?.[1]) streams.push(new StreamResult({
                    url: highMatch[1].trim(),
                    source: "XVideos High",
                    quality: "High",
                    headers: { "Referer": MAIN_URL, "User-Agent": UA }
                }));

                const lowMatch = text.match(/html5player\.setVideoUrlLow\('([^']+)'\)/i)
                    || text.match(/\.setVideoUrlLow\('([^']+)'\)/i);
                if (lowMatch?.[1]) streams.push(new StreamResult({
                    url: lowMatch[1].trim(),
                    source: "XVideos Low",
                    quality: "Low",
                    headers: { "Referer": MAIN_URL, "User-Agent": UA }
                }));

                const contentUrlMatch = text.match(/"contentUrl"\s*:\s*"([^"]+)"/i);
                if (contentUrlMatch?.[1]) streams.push(new StreamResult({
                    url: contentUrlMatch[1].replace(/\\\//g, "/"),
                    source: "XVideos Auto",
                    quality: "Auto",
                    headers: { "Referer": MAIN_URL, "User-Agent": UA }
                }));
            });

            if (!streams.length)
                return cb({ success: false, errorCode: "STREAM_ERROR", message: "No streams found" });

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