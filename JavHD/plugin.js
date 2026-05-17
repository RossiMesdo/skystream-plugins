(function() {
    const MAIN_URL = "https://javhd.icu";
    const PREFIX = "JAV HD";
    const HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    };

    // --- Helpers ---
    function cleanTitle(str) {
        return str.replace(new RegExp('^' + PREFIX + '\\s*', 'i'), '').trim();
    }

    async function fetchHtml(url) {
        const res = await http_get(url, HEADERS);
        if (res.status !== 200) throw new Error("HTTP " + res.status);
        return res.body;
    }

    function parseHtml(html, selector, attr) {
        if (typeof parse_html !== 'function') throw new Error('parse_html not available');
        const results = parse_html(html, selector, attr);
        return (results || []).map(r => ({ attr: r.attr, text: r.text }));
    }

    function toMultimediaItem(item) {
        return new MultimediaItem({
            title: item.title,
            url: item.link,
            posterUrl: item.image,
            type: "nsfw",
            headers: HEADERS
        });
    }

    // --- getHome ---
    globalThis.getHome = async function(cb) {
        try {
            const page = 1;
            const url = MAIN_URL + "/page/" + page;
            const html = await fetchHtml(url);
            const titles = parseHtml(html, "div.section-header", "text").map(e => e.text.trim()).filter(t => t);
            const widgetHtmls = parseHtml(html, "div#video-widget-3016", "html").map(e => e.attr);
            const homeData = {};
            for (let i = 0; i < widgetHtmls.length; i++) {
                const widgetHtml = widgetHtmls[i];
                const sectionTitle = titles[i] || "No Name";
                const itemsHtml = parseHtml(widgetHtml, "div.item.responsive-height.post", "html").map(e => e.attr);
                const items = itemsHtml.map(itemHtml => {
                    const a = parseHtml(itemHtml, "div.item-img > a", "href")[0]?.attr;
                    if (!a) return null;
                    const aTitle = parseHtml(itemHtml, "div.item-img > a", "title")[0]?.attr || "";
                    const img = parseHtml(itemHtml, "img", "src")[0]?.attr || "";
                    const title = cleanTitle(aTitle || parseHtml(itemHtml, "img", "alt")[0]?.attr || "");
                    return toMultimediaItem({ title, link: a, image: img });
                }).filter(Boolean);
                if (items.length) homeData[sectionTitle] = items;
            }
            if (!Object.keys(homeData).length) throw new Error("No home sections");
            cb({ success: true, data: homeData });
        } catch (e) {
            cb({ success: false, errorCode: "HOME_ERROR", message: e.message });
        }
    };

    // --- search ---
    globalThis.search = async function(query, cb) {
        try {
            const url = MAIN_URL + "/?s=" + encodeURIComponent(query);
            const html = await fetchHtml(url);
            const itemsHtml = parseHtml(html, "div.item.responsive-height.post", "html").map(e => e.attr);
            const items = itemsHtml.map(itemHtml => {
                const a = parseHtml(itemHtml, "div.item-img > a", "href")[0]?.attr;
                if (!a) return null;
                const aTitle = parseHtml(itemHtml, "div.item-img > a", "title")[0]?.attr || "";
                const img = parseHtml(itemHtml, "img", "src")[0]?.attr || "";
                const title = cleanTitle(aTitle || parseHtml(itemHtml, "img", "alt")[0]?.attr || "");
                return toMultimediaItem({ title, link: a, image: img });
            }).filter(Boolean);
            cb({ success: true, data: items });
        } catch (e) {
            cb({ success: false, errorCode: "SEARCH_ERROR", message: e.message });
        }
    };

    // --- load ---
    globalThis.load = async function(url, cb) {
        try {
            const html = await fetchHtml(url);
            const poster = parseHtml(html, "div.video-details div.post-entry img", "src")[0]?.attr || null;
            const titleEl = parseHtml(html, "div.video-details div.post-entry p.wp-caption-text", "text")[0]?.text;
            const title = cleanTitle(titleEl || "No Title");
            const descEls = parseHtml(html, "div.video-details div.post-entry p", "text");
            const description = (descEls.length > 0) ? descEls[0].text.trim() : null;
            const yearText = parseHtml(html, "span.date", "text")[0]?.text || "";
            const year = yearText.replace(/[^0-9]/g, '').slice(-4) || null;
            const tags = [];
            const metaSpans = parseHtml(html, "span.meta", "html").map(e => e.attr);
            metaSpans.forEach(spanHtml => {
                const caption = parseHtml(spanHtml, "span.meta-info", "text")[0]?.text?.toLowerCase() || "";
                if (caption === "category" || caption === "tag") {
                    const tagLinks = parseHtml(spanHtml, "a", "text").map(e => e.text.trim()).filter(t => t);
                    tags.push(...tagLinks);
                }
            });
            const recItemsHtml = parseHtml(html, "div.latest-wrapper div.item.active > div", "html").map(e => e.attr);
            const recs = recItemsHtml.map(recHtml => {
                const a = parseHtml(recHtml, "div.item-img > a", "href")[0]?.attr;
                if (!a) return null;
                const aName = parseHtml(recHtml, "h3 > a", "text")[0]?.text || "";
                const aImg = parseHtml(recHtml, "img", "src")[0]?.attr || "";
                return toMultimediaItem({ title: cleanTitle(aName), link: a, image: aImg });
            }).filter(Boolean);

            // Check for scenes (pagination)
            const sceneLi = parseHtml(html, "ul.pagination.post-tape > li", "html").map(e => e.attr);
            if (sceneLi.length > 0) {
                const episodes = [];
                for (let i = 0; i < sceneLi.length; i++) {
                    const liHtml = sceneLi[i];
                    const aTag = parseHtml(liHtml, "a", "href")[0];
                    const sceneLink = aTag ? aTag.attr : null;
                    const sceneNumText = parseHtml(liHtml, "a", "text")[0]?.text;
                    const sceneNum = parseInt(sceneNumText) || (i + 1);
                    if (sceneLink) {
                        try {
                            const sceneHtml = await fetchHtml(sceneLink);
                            const iframeSrcs = parseHtml(sceneHtml, "iframe", "src")
                                .map(e => e.attr)
                                .filter(link => link && !link.startsWith("https://a.realsrv.com"));
                            episodes.push(new Episode({
                                name: `Scene ${sceneNum}`,
                                url: JSON.stringify(iframeSrcs),
                                episode: sceneNum,
                                posterUrl: poster,
                            }));
                        } catch (e) {
                            // skip broken scenes
                        }
                    }
                }
                if (episodes.length) {
                    cb({ success: true, data: new MultimediaItem({
                        title: title,
                        url: url,
                        posterUrl: poster,
                        type: "series",
                        description: description,
                        year: year,
                        tags: tags,
                        recommendations: recs,
                        episodes: episodes,
                        headers: HEADERS
                    })});
                    return;
                }
            }

            // Movie (single video)
            const iframeSrcs = parseHtml(html, "iframe", "src")
                .map(e => e.attr)
                .filter(link => link && !link.startsWith("https://a.realsrv.com"));
            const dataUrl = JSON.stringify(iframeSrcs);
            cb({ success: true, data: new MultimediaItem({
                title: title,
                url: dataUrl,          // will be passed to loadStreams
                posterUrl: poster,
                type: "movie",
                description: description,
                year: year,
                tags: tags,
                recommendations: recs,
                headers: HEADERS
            })});
        } catch (e) {
            cb({ success: false, errorCode: "LOAD_ERROR", message: e.message });
        }
    };

    // --- loadStreams ---
    globalThis.loadStreams = async function(dataUrl, cb) {
        try {
            const links = JSON.parse(dataUrl);
            const streams = [];
            const processLink = async (vid) => {
                let finalUrl = vid;
                // Domain rewrites (mirrors)
                if (vid.startsWith("https://javhdfree.icu")) {
                    const withoutHttps = vid.replace("https://", "");
                    const idx = withoutHttps.indexOf('/') + 1;
                    finalUrl = "https://embedsito.com/" + withoutHttps.substring(idx);
                } else if (vid.startsWith("https://viewsb.com")) {
                    finalUrl = vid.replace("viewsb.com", "watchsb.com");
                }

                if (typeof globalThis.loadExtractor === 'function') {
                    await new Promise((resolve) => {
                        globalThis.loadExtractor(finalUrl, (stream) => {
                            if (stream) streams.push(stream);
                        });
                        // safety timeout
                        setTimeout(resolve, 8000);
                    });
                } else {
                    // fallback direct link
                    streams.push(new StreamResult({
                        url: finalUrl,
                        source: "JavHD",
                        quality: 1080,
                        headers: HEADERS
                    }));
                }
            };

            await Promise.all(links.map(link => processLink(link)));
            // Deduplicate by url+source
            const deduped = [];
            const seen = new Set();
            streams.forEach(s => {
                const key = s.url + "|" + s.source;
                if (!seen.has(key)) {
                    seen.add(key);
                    deduped.push(s);
                }
            });
            cb({ success: true, data: deduped });
        } catch (e) {
            cb({ success: false, errorCode: "STREAM_ERROR", message: e.message });
        }
    };
})();
