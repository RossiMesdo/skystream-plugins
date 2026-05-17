(function() {
    // --- Constants ---
    const MAIN_URL = "https://javhd.icu";
    const PREFIX = "JAV HD";
    const HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    };

    // --- Helpers ---
    function cleanTitle(title) {
        if (!title) return "";
        return title.trim().replace(new RegExp("^" + PREFIX + "\\s*", "i"), "").trim();
    }

    function fetchDocument(url) {
        return http_get(url, HEADERS).then(res => {
            if (res.status !== 200) throw new Error("HTTP " + res.status);
            return res.body;
        });
    }

    // Sử dụng parse_html toàn cục (có sẵn trong môi trường plugin SkyStream)
    function select(html, cssSelector, attribute) {
        if (typeof parse_html !== "function") {
            throw new Error("parse_html is not available");
        }
        const elements = parse_html(html, cssSelector, attribute);
        return (elements || []).map(el => ({
            attr: el.attr,
            text: el.text
        }));
    }

    // Trích xuất href, src, text,... từ kết quả parse
    function getAttr(html, selector, attr) {
        const found = select(html, selector, attr);
        return found.length > 0 ? found[0].attr : null;
    }

    function getText(html, selector) {
        const found = select(html, selector, "text");
        return found.length > 0 ? found[0].text : null;
    }

    // Lấy danh sách các phần tử (dùng html để lấy innerHTML nếu cần parse tiếp)
    function getElementsHtml(html, selector) {
        if (typeof parse_html !== "function") return [];
        const elements = parse_html(html, selector, "html");
        return (elements || []).map(el => el.attr);
    }

    // Xây dựng MultimediaItem từ dữ liệu item
    function toMultimediaItem(item) {
        return new MultimediaItem({
            title: item.title,
            url: item.link,
            posterUrl: item.image,
            type: "nsfw",
            headers: HEADERS
        });
    }

    // Lấy danh sách iframe src từ trang chi tiết (loại bỏ link không hợp lệ)
    function getIframeSrcs(html) {
        return select(html, "iframe", "src")
            .map(x => x.attr)
            .filter(link => link && !link.startsWith("https://a.realsrv.com"));
    }

    // Rewrite domain nếu cần (theo logic trong .kt)
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
            const html = await fetchDocument(url);

            // Lấy tiêu đề từ section-header
            const titleElements = select(html, "div.section-header", "text");
            const titles = titleElements.map(el => el.text.trim()).filter(t => t);

            // Mỗi widget video-widget-3016 tương ứng một section
            const widgetHtmls = getElementsHtml(html, "div#video-widget-3016");
            const homeData = {};

            for (let i = 0; i < widgetHtmls.length; i++) {
                const widgetHtml = widgetHtmls[i];
                const sectionTitle = titles[i] || ("Section " + (i + 1));

                // Lấy các item trong widget
                const itemHtmls = getElementsHtml(widgetHtml, "div.col-md-3.col-sm-6.col-xs-6.item.responsive-height.post");
                const items = [];

                for (let j = 0; j < itemHtmls.length; j++) {
                    const itemHtml = itemHtmls[j];
                    const link = getAttr(itemHtml, "div.item-img > a", "href");
                    if (!link) continue;

                    const titleFromAttr = getAttr(itemHtml, "div.item-img > a", "title") || "";
                    const imgFromSrc = getAttr(itemHtml, "img", "src") || "";
                    const altText = getText(itemHtml, "img") || "";
                    const title = cleanTitle(titleFromAttr || altText);

                    items.push(toMultimediaItem({
                        title: title,
                        link: link,
                        image: imgFromSrc
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
            const html = await fetchDocument(url);

            const itemHtmls = getElementsHtml(html, "div.item.responsive-height.col-md-4.col-sm-6.col-xs-6");
            const items = [];

            for (let j = 0; j < itemHtmls.length; j++) {
                const itemHtml = itemHtmls[j];
                const link = getAttr(itemHtml, "div.item-img > a", "href");
                if (!link) continue;

                const titleFromAttr = getAttr(itemHtml, "div.item-img > a", "title") || "";
                const imgFromSrc = getAttr(itemHtml, "img", "src") || "";
                const altText = getText(itemHtml, "img") || "";
                const title = cleanTitle(titleFromAttr || altText);

                items.push(toMultimediaItem({
                    title: title,
                    link: link,
                    image: imgFromSrc
                }));
            }

            cb({ success: true, data: items });
        } catch (e) {
            cb({ success: false, errorCode: "SEARCH_ERROR", message: e.message });
        }
    };

    globalThis.load = async function(url, cb) {
        try {
            const html = await fetchDocument(url);

            // Poster
            const poster = getAttr(html, "div.video-details div.post-entry img", "src");

            // Title
            const rawTitle = getText(html, "div.video-details div.post-entry p.wp-caption-text");
            const title = cleanTitle(rawTitle || "No Title");

            // Description (p đầu tiên)
            const descEls = select(html, "div.video-details div.post-entry p", "text");
            const description = descEls.length > 0 ? descEls[0].text.trim() : null;

            // Year
            const yearText = getText(html, "span.date") || "";
            const yearMatch = yearText.replace(/[^0-9]/g, "").match(/(\d{4})$/);
            const year = yearMatch ? parseInt(yearMatch[1]) : null;

            // Tags
            const tags = [];
            const metaSpanHtmls = getElementsHtml(html, "span.meta");
            for (let i = 0; i < metaSpanHtmls.length; i++) {
                const spanHtml = metaSpanHtmls[i];
                const caption = (getText(spanHtml, "span.meta-info") || "").toLowerCase().trim();
                if (caption === "category" || caption === "tag") {
                    const tagLinks = select(spanHtml, "a", "text").map(e => e.text.trim()).filter(t => t);
                    tags.push(...tagLinks);
                }
            }

            // Recommendations
            const recHtmls = getElementsHtml(html, "div.latest-wrapper div.item.active > div");
            const recs = [];
            for (let i = 0; i < recHtmls.length; i++) {
                const recHtml = recHtmls[i];
                const recLink = getAttr(recHtml, "div.item-img > a", "href");
                if (!recLink) continue;
                const recName = getText(recHtml, "h3 > a") || "";
                const recImg = getAttr(recHtml, "img", "src") || "";
                recs.push(toMultimediaItem({
                    title: cleanTitle(recName),
                    link: recLink,
                    image: recImg
                }));
            }

            // Kiểm tra có phải series không (ul.pagination.post-tape > li)
            const sceneItems = getElementsHtml(html, "ul.pagination.post-tape > li");
            if (sceneItems.length > 0) {
                const episodes = [];
                for (let i = 0; i < sceneItems.length; i++) {
                    const liHtml = sceneItems[i];
                    const sceneLink = getAttr(liHtml, "a", "href");
                    const sceneNumText = getText(liHtml, "a") || "";
                    const sceneNum = parseInt(sceneNumText) || (i + 1);

                    if (sceneLink) {
                        try {
                            const sceneHtml = await fetchDocument(sceneLink);
                            const iframes = getIframeSrcs(sceneHtml);
                            episodes.push(new Episode({
                                name: "Scene " + sceneNum,
                                url: JSON.stringify(iframes), // lưu danh sách link để loadStreams xử lý
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

            // Nếu không phải series, là movie
            const iframes = getIframeSrcs(html);
            const dataUrl = JSON.stringify(iframes);
            cb({
                success: true,
                data: new MultimediaItem({
                    title: title,
                    url: dataUrl, // sẽ được truyền vào loadStreams
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

            // Hàm xử lý một link video
            const processLink = async (rawLink) => {
                const finalUrl = rewriteLink(rawLink);

                // Nếu có extractor tích hợp sẵn (Dood, Streamtape,...) thì dùng
                if (typeof globalThis.loadExtractor === "function") {
                    await new Promise((resolve) => {
                        try {
                            globalThis.loadExtractor(finalUrl, (stream) => {
                                if (stream) {
                                    stream.source = "JavHD";
                                    streams.push(stream);
                                }
                            });
                        } catch (e) {
                            // fallback
                        }
                        setTimeout(resolve, 8000); // chờ extractor xử lý
                    });
                } else {
                    // Không có extractor, thêm trực tiếp link
                    streams.push(new StreamResult({
                        url: finalUrl,
                        source: "JavHD",
                        quality: 1080,
                        headers: HEADERS
                    }));
                }
            };

            await Promise.all(links.map(link => processLink(link)));

            // Loại bỏ trùng lặp
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
