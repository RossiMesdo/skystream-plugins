(function() {
    /**
     * CosXPlay Plugin for SkyStream
     * Site: https://cosxplay.com
     * Ported from: Cs-GizliKeyif CloudStream repo
     * Author: Lord
     */

    const BASE_URL = manifest.baseUrl;
    const HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:137.0) Gecko/20100101 Firefox/137.0",
        "Referer": BASE_URL + "/"
    };

    const CATEGORIES = [
        { name: "Home",          url: `${BASE_URL}/` },
        { name: "Most Viewed",   url: `${BASE_URL}/?filter=most-viewed` },
        { name: "Latest",        url: `${BASE_URL}/?filter=latest` },
        { name: "Popular",       url: `${BASE_URL}/?filter=popular` },
        { name: "Longest",       url: `${BASE_URL}/?filter=longest` },
        { name: "Halloween",     url: `${BASE_URL}/17220-halloween/` },
        { name: "Genshin",       url: `${BASE_URL}/70946-genshin-impact/` },
        { name: "POV",           url: `${BASE_URL}/11119-pov/` },
        { name: "JOI",           url: `${BASE_URL}/11121-joi/` },
        { name: "Anal",          url: `${BASE_URL}/11104-anal/` },
        { name: "Rem & Ram",     url: `${BASE_URL}/20911-rem-ram/` },
        { name: "2B",            url: `${BASE_URL}/7841-nier-automata/` },
        { name: "Makima",        url: `${BASE_URL}/73136-makima/` },
        { name: "Naruto",        url: `${BASE_URL}/7828-naruto/` },
        { name: "ASMR",          url: `${BASE_URL}/18231-18321-asmr/` },
        { name: "Hinata",        url: `${BASE_URL}/7828-naruto/12508-hinata/` },
        { name: "Femboy",        url: `${BASE_URL}/71061-femboy/` },
        { name: "Latex",         url: `${BASE_URL}/5230-latex/` },
        { name: "One Piece",     url: `${BASE_URL}/12814-anime/70920-one-piece/` },
        { name: "Ahegao",        url: `${BASE_URL}/4063-ahegao/` },
        { name: "Maid",          url: `${BASE_URL}/19621-uniform/13908-maid/` },
        { name: "Japanese",      url: `${BASE_URL}/11115-asian/12547-japanese/` },
        { name: "Solo",          url: `${BASE_URL}/16982-solo/` },
        { name: "Dildo",         url: `${BASE_URL}/11118-dildo/` },
        { name: "Anime",         url: `${BASE_URL}/12814-anime/` },
        { name: "Feet",          url: `${BASE_URL}/17809-feet/` },
        { name: "Lesbian",       url: `${BASE_URL}/11114-lesbian/` },
        { name: "Furry",         url: `${BASE_URL}/16652-furry/` },
        { name: "Nezuko",        url: `${BASE_URL}/12814-anime/59215-nezuko/` },
        { name: "Creampie",      url: `${BASE_URL}/11113-creampie/` },
        { name: "Succubus",      url: `${BASE_URL}/7837-creatures/7833-succubus/` },
        { name: "Bondage",       url: `${BASE_URL}/10570-bondage/` },
        { name: "Superheroines", url: `${BASE_URL}/17328-superheroines/` },
        { name: "Nun",           url: `${BASE_URL}/17862-nun/` },
        { name: "Harley Quinn",  url: `${BASE_URL}/7776-harley-quinn/` },
        { name: "Nurse",         url: `${BASE_URL}/19621-uniform/13154-nurse/` },
        { name: "Velma",         url: `${BASE_URL}/7832-films/7835-scooby-doo/11125-velma/` },
        { name: "Tsunade",       url: `${BASE_URL}/61046-tsunade/` },
        { name: "Supergirl",     url: `${BASE_URL}/2101-supergirl/` },
        { name: "BBW",           url: `${BASE_URL}/19001-bbw/` },
        { name: "Jinx",          url: `${BASE_URL}/61118-jinx/` },
        { name: "Kigurumi",      url: `${BASE_URL}/5231-kigurumi/` },
        { name: "Sakura",        url: `${BASE_URL}/7828-naruto/21040-sakura-haruno/` },
        { name: "Pokemon",       url: `${BASE_URL}/2166-pokemon/` },
        { name: "Public",        url: `${BASE_URL}/17216-public/` },
        { name: "Wonder Woman",  url: `${BASE_URL}/922-wonderwoman/` },
        { name: "D.va",          url: `${BASE_URL}/95-overwatch/293-dva/` },
        { name: "Poison Ivy",    url: `${BASE_URL}/7881-poison-ivy/` },
        { name: "Neko",          url: `${BASE_URL}/11101-neko-porn/` },
        { name: "Masturbation",  url: `${BASE_URL}/17807-masturbation/` },
        { name: "Big Boobs",     url: `${BASE_URL}/11117-big-boobs/` },
        { name: "Bunny",         url: `${BASE_URL}/8103-bunnies/` },
    ];

    function fixUrl(u) {
        if (!u) return "";
        if (u.startsWith("//")) return "https:" + u;
        if (u.startsWith("/")) return BASE_URL + u;
        return u;
    }

    // CloudStream pagination:
    // page 1 → URL gốc
    // page 2+ với ?filter → /page/N/URL_part (phần sau .com/)
    // page 2+ không có ?filter → URL/page/N/
    function buildPageUrl(base, page) {
        if (page <= 1) return base;
        if (base.includes("?filter")) {
            const part = base.replace(`${BASE_URL}/`, "");
            return `${BASE_URL}/page/${page}/${part}`;
        }
        return base.replace(/\/$/, "") + `/page/${page}/`;
    }

    // CloudStream: div.col-xl-2
    // title từ span.title, href từ a, poster từ img.video-img[data-src] fallback src
    function parseItems(doc) {
        return Array.from(doc.querySelectorAll("div.col-xl-2")).map(el => {
            const title = el.querySelector("span.title")?.textContent?.trim();
            if (!title) return null;
            const url = fixUrl(el.querySelector("a")?.getAttribute("href") || "");
            if (!url) return null;
            const img = el.querySelector("img.video-img");
            const poster = fixUrl(
                (img?.getAttribute("data-src") || "").trim() ||
                (img?.getAttribute("src") || "").trim()
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
            // CloudStream: page 1 = /?s=query, page 2+ = /page/N/?s=query
            const res = await http_get(`${BASE_URL}/?s=${encodeURIComponent(query)}`, HEADERS);
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

            // CloudStream: h1
            const title = doc.querySelector("h1")?.textContent?.trim();
            if (!title) return cb({ success: false, errorCode: "PARSE_ERROR", message: "No title" });

            // CloudStream: poster từ script chứa "thumbnail":"..."
            let poster = "";
            let duration;
            Array.from(doc.querySelectorAll("script")).forEach(s => {
                const data = s.textContent || "";
                if (data.includes('"thumbnail"')) {
                    const mPoster = data.match(/"thumbnail"\s*:\s*"([^"]+)"/);
                    if (mPoster) poster = mPoster[1];
                    const mDuration = data.match(/"length"\s*:\s*"([^"]+)"/);
                    if (mDuration) duration = parseInt(mDuration[1]) || undefined;
                }
            });

            const description = doc.querySelector("meta[property='og:description']")?.getAttribute("content")?.trim() || "";

            // CloudStream: year từ div.extra span.C a
            const year = parseInt(doc.querySelector("div.extra span.C a")?.textContent?.trim()) || undefined;

            // CloudStream: tags từ div.tags-list a
            const tags = Array.from(doc.querySelectorAll("div.tags-list a"))
                .map(a => a.textContent.trim()).filter(Boolean);

            // CloudStream: cast từ span.valor a
            const cast = Array.from(doc.querySelectorAll("span.valor a")).map(a => {
                const name = a.textContent.trim();
                return name ? new Actor({ name }) : null;
            }).filter(Boolean);

            // CloudStream: recommendations từ div.col-xl-2
            const recommendations = parseItems(doc);

            // Episode — plain object như bollyflix
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
                    episodes: [{
                        name: "Play",
                        url,
                        season: 1,
                        episode: 1,
                        posterUrl: poster || undefined
                    }]
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
            const doc = await parseHtml(res.body);

            // CloudStream: div.responsive-player.video-player video source
            // lấy src + title trực tiếp — không cần unpack
            const sources = Array.from(
                doc.querySelectorAll("div.responsive-player.video-player video source")
            );

            const streams = sources.map(s => {
                const src   = s.getAttribute("src") || "";
                const label = s.getAttribute("title") || s.getAttribute("label") || "";
                if (!src) return null;
                return new StreamResult({
                    url: fixUrl(src),
                    source: label ? `CosXPlay ${label}` : "CosXPlay",
                    headers: { "Referer": BASE_URL + "/" }
                });
            }).filter(Boolean);

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
