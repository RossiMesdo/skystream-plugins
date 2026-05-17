(function() {
    const MAIN_URL = "https://javhd.icu";
    const PREFIX = "JAV HD";
    const HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    };

    // --- Helpers ---
    function cleanTitle(title) {
        if (!title) return "";
        return title.trim().replace(new RegExp("^" + PREFIX + "\\s*", "i"), "").trim();
    }

    async function fetchHtml(url) {
        const res = await http_get(url, HEADERS);
        if (res.status !== 200) throw new Error("HTTP " + res.status);
        return res.body;
    }

    // Lấy toàn bộ HTML của phần tử theo selector (dùng parse_html 2 tham số)
    function getElements(html, selector) {
        const elems = parse_html(html, selector);
        return (elems || []).map(el => el.attr); // attr là innerHTML
    }

    // Trích xuất giá trị thuộc tính bằng regex
    function extractAttr(html, attr) {
        const regex = new RegExp(attr + '="([^"]*)"', "i");
        const match = html.match(regex);
        return match ? match[1] : null;
    }

    // Lấy text thuần (dùng parse_html text)
    function getText(html, selector) {
        const elems = parse_html(html, selector);
        return elems.length > 0 ? elems[0].text.trim() : null;
    }

    // Lấy href của thẻ a bên trong item
    function getLinkFromItem(itemHtml) {
        // Lấy thẻ a đầu tiên
        const aElems = parse_html(itemHtml, "a");
        if (aElems.length === 0) return null;
        // Dùng regex từ chính itemHtml để lấy href của thẻ a
        const match = itemHtml.match(/<a[^>]*href="([^"]*)"/i);
        return match ? match[1] : null;
    }

    // Lấy src của img bên trong item
    function getImageFromItem(itemHtml) {
        const match = itemHtml.match(/<img[^>]*src="([^"]*)"/i);
        return match ? match[1] : null;
    }

    // Lấy title từ thẻ a (dùng attr title hoặc alt)
    function getTitleFromItem(itemHtml) {
        // Ưu tiên title của thẻ a
        const aMatch = itemHtml.match(/<a[^>]*title="([^"]*)"/i);
        if (aMatch) return cleanTitle(aMatch[1]);
        // Nếu không có, lấy alt của img
        const imgMatch = itemHtml.match(/<img[^>]*alt="([^"]*)"/i);
        return cleanTitle(imgMatch ? imgMatch[1] : "");
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

    // Lấy danh sách iframe src từ HTML (loại bỏ link không hợp lệ)
    function getIframeSrcs(html) {
        const iframeElems = parse_html(html, "iframe");
        const links = [];
        iframeElems.forEach(function(el) {
            const match = el.attr.match(/src="([^"]*)"/i);
            if (match && match[1] && !match[1].startsWith("https://a.realsrv.com")) {
                links.push(match[1]);
            }
        });
        return links;
    }

    // Rewrite domain
    function rewriteLink(vid) {
        if (vid.startsWith("https://javhdfree.icu")) {
            const withoutHttps = vid.replace("https://", "");
            const idx = withoutHttps.indexOf('/') + 1;
            return "https://embedsito.com/" + withoutHttps.substring(idx);
        } else if (vid.startsWith("https://viewsb.com")) {
            return vid.replace("viewsb.com", "watchsb.com");
        }
        return vid;
    }

    // --- Core Functions ---
    globalThis.getHome = async function(cb) {
        try {
            const page = 1;
            const url = MAIN_URL + "/page/" + page;
            const html = await fetchHtml(url);

            // Lấy tiêu đề từ section-header (text trực tiếp)
            const titleElems = parse_html(html, "div.section-header");
            const titles = titleElems.map(el => el.text.trim()).filter(t => t);

            // Lấy HTML của từng widget
            const widgetHtmls = getElements(html, "div#video-widget-3016");
            const homeData = {};

            for (let i = 0; i < widgetHtmls.length; i++) {
                const widgetHtml = widgetHtmls[i];
                const sectionTitle = titles[i] || ("Section " + (i + 1));

                const itemHtmls = getElements(widgetHtml, "div.col-md-3.col-sm-6.col-xs-6.item.responsive-height.post");
                const items = [];

                for (let j = 0; j < itemHtmls.length; j++) {
                    const itemHtml = itemHtmls[j];
                    const link = getLinkFromItem(itemHtml);
                    if (!link) continue;

                    const title = getTitleFromItem(itemHtml);
                    const image = getImageFromItem(itemHtml) || "";

                    items.push(toMultimediaItem({
                        title: title,
                        link: link,
                        image: image
                    }));
                }

                if (items.length > 0) {
                    homeData[sectionTitle] = items;
                }
            }

            if (Object.keys(homeData).length === 0) {
                return cb({ success: false, errorCode: "HOME_ERROR", message: "No home sections available" });
            }
            cb({ success: true, data: homeData });
        } catch (e) {
            cb({ success: false, errorCode: "HOME_ERROR", message: e.message });
        }
    };

    globalThis.search = async function(query, cb) {
        try {
            const url = MAIN_URL + "/?s=" + encodeURIComponent(query);
            const html = await fetchHtml(url);

            const itemHtmls = getElements(html, "div.item.responsive-height.col-md-4.col-sm-6.col-xs-6");
            const items = [];

            for (let j = 0; j < itemHtmls.length; j++) {
                const itemHtml = itemHtmls[j];
                const link = getLinkFromItem(itemHtml);
                if (!link) continue;

                const title = getTitleFromItem(itemHtml);
                const image = getImageFromItem(itemHtml) || "";

                items.push(toMultimediaItem({
                    title: title,
                    link: link,
                    image: image
                }));
            }

            cb({ success: true, data: items });
        } catch (e) {
            cb({ success: false, errorCode: "SEARCH_ERROR", message: e.message });
        }
    };

    globalThis.load = async function(url, cb) {
        try {
            const html = await fetchHtml(url);

            // Poster
            const poster = getImageFromItem(html); // thường là ảnh trong div.post-entry
            // Title
            const rawTitle = getText(html, "div.video-details div.post-entry p.wp-caption-text");
            const title = cleanTitle(rawTitle || "No Title");

            // Description (p đầu tiên)
            const descElems = parse_html(html, "div.video-details div.post-entry p");
            let description = null;
            if (descElems.length > 0) {
                // Lấy p đầu tiên không phải là caption
                for (let i = 0; i < descElems.length; i++) {
                    const txt = descElems[i].text.trim();
                    if (txt && !txt.includes("wp-caption-text")) {
                        description = txt;
                        break;
                    }
                }
            }

            // Year
            const yearText = getText(html, "span.date") || "";
            const yearMatch = yearText.replace(/[^0-9]/g, "").match(/(\d{4})$/);
            const year = yearMatch ? parseInt(yearMatch[1]) : null;

            // Tags
            const tags = [];
            const metaSpanHtmls = getElements(html, "span.meta");
            metaSpanHtmls.forEach(function(spanHtml) {
                const caption = (getText(spanHtml, "span.meta-info") || "").toLowerCase().trim();
                if (caption === "category" || caption === "tag") {
                    const tagLinks = parse_html(spanHtml, "a");
                    tagLinks.forEach(function(a) {
                        const tagText = a.text.trim();
                        if (tagText) tags.push(tagText);
                    });
                }
            });

            // Recommendations
            const recHtmls = getElements(html, "div.latest-wrapper div.item.active > div");
            const recs = [];
            recHtmls.forEach(function(recHtml) {
                const recLink = getLinkFromItem(recHtml);
                if (!recLink) return;
                const recName = getText(recHtml, "h3 > a") || "";
                const recImg = getImageFromItem(recHtml) || "";
                recs.push(toMultimediaItem({
                    title: cleanTitle(recName),
                    link: recLink,
                    image: recImg
                }));
            });

            // Kiểm tra series (pagination post-tape)
            const sceneItems = getElements(html, "ul.pagination.post-tape > li");
            if (sceneItems.length > 0) {
                const episodes = [];
                for (let i = 0; i < sceneItems.length; i++) {
                    const liHtml = sceneItems[i];
                    // Lấy href của thẻ a
                    const aMatch = liHtml.match(/<a[^>]*href="([^"]*)"/i);
                    const sceneLink = aMatch ? aMatch[1] : null;
                    const sceneNumText = parse_html(liHtml, "a")[0]?.text.trim() || "";
                    const sceneNum = parseInt(sceneNumText) || (i + 1);

                    if (sceneLink) {
                        try {
                            const sceneHtml = await fetchHtml(sceneLink);
                            const iframes = getIframeSrcs(sceneHtml);
                            episodes.push(new Episode({
                                name: "Scene " + sceneNum,
                                url: JSON.stringify(iframes),
                                episode: sceneNum,
                                posterUrl: poster
                            }));
                        } catch (e) {
                            // Bỏ qua scene lỗi
                        }
                    }
                }

                if (episodes.length > 0) {
                    return cb({
                        success: true,
                        data: new MultimediaItem({
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
                        })
                    });
                }
            }

            // Nếu không phải series -> movie
            const iframes = getIframeSrcs(html);
            const dataUrl = JSON.stringify(iframes);

            cb({
                success: true,
                data: new MultimediaItem({
                    title: title,
                    url: dataUrl,       // truyền vào loadStreams
                    posterUrl: poster,
                    type: "movie",
                    description: description,
                    year: year,
                    tags: tags,
                    recommendations: recs,
                    headers: HEADERS
                })
            });
        } catch (e) {
            cb({ success: false, errorCode: "LOAD_ERROR", message: e.message });
        }
    };

    globalThis.loadStreams = async function(dataUrl, cb) {
        try {
            const links = JSON.parse(dataUrl);
            const streams = [];

            const processLink = async function(rawLink) {
                const finalUrl = rewriteLink(rawLink);

                if (typeof globalThis.loadExtractor === "function") {
                    await new Promise(function(resolve) {
                        try {
                            globalThis.loadExtractor(finalUrl, function(stream) {
                                if (stream) {
                                    stream.source = "JavHD";
                                    streams.push(stream);
                                }
                            });
                        } catch (e) {
                            // fallback
                        }
                        setTimeout(resolve, 8000);
                    });
                } else {
                    streams.push(new StreamResult({
                        url: finalUrl,
                        source: "JavHD",
                        quality: 1080,
                        headers: HEADERS
                    }));
                }
            };

            await Promise.all(links.map(link => processLink(link)));

            // Loại bỏ trùng
            const deduped = [];
            const seen = new Set();
            streams.forEach(function(s) {
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