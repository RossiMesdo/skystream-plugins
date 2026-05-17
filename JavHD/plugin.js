(function() {
    const HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    };

    // Helper: lấy text sạch từ parse_html object
    function getText(el) { return el ? el.text.trim() : ''; }
    // Helper: lấy giá trị thuộc tính (href, src, title...)
    function getAttrVal(el) { return el ? el.attr : null; }

    function cleanTitle(str) {
        return str.replace(/^JAV HD\s*/i, '').trim();
    }

    // Lấy href của thẻ a đầu tiên trong khối HTML
    function getHref(blockHtml) {
        const as = parse_html(blockHtml, 'a', 'href');
        if (!as || as.length === 0) return null;
        return getAttrVal(as[0]);
    }

    // Lấy src của img đầu tiên
    function getImgSrc(blockHtml) {
        const imgs = parse_html(blockHtml, 'img', 'src');
        if (!imgs || imgs.length === 0) return null;
        return getAttrVal(imgs[0]);
    }

    // Lấy title từ thẻ a (title attribute) hoặc alt của img
    function getTitle(blockHtml) {
        const as = parse_html(blockHtml, 'a', 'title');
        if (as && as.length > 0 && as[0].attr) return cleanTitle(as[0].attr);
        const imgs = parse_html(blockHtml, 'img', 'alt');
        if (imgs && imgs.length > 0 && imgs[0].attr) return cleanTitle(imgs[0].attr);
        return '';
    }

    function toMultimediaItem(item) {
        return new MultimediaItem({
            title: item.title,
            url: item.link,
            posterUrl: item.image,
            type: 'nsfw',
            headers: HEADERS
        });
    }

    async function fetchDoc(url) {
        const res = await http_get(url, HEADERS);
        if (res.status !== 200) throw new Error('HTTP ' + res.status);
        return res.body;
    }

    // ========================
    globalThis.getHome = async function(cb) {
        try {
            const homeUrl = manifest.baseUrl + '/page/1';
            const html = await fetchDoc(homeUrl);
            const homeData = {};

            // Lấy tiêu đề section
            const sectionHeaders = parse_html(html, 'div.section-header');
            const titles = sectionHeaders.map(el => getText(el)).filter(t => t);

            // Lấy widget container
            const widgets = parse_html(html, 'div#video-widget-3016');
            for (let i = 0; i < widgets.length; i++) {
                const widgetHtml = widgets[i].attr; // innerHTML của widget
                const sectionTitle = titles[i] || `Section ${i + 1}`;
                const itemBlocks = parse_html(widgetHtml, 'div.col-md-3.col-sm-6.col-xs-6.item.responsive-height.post');
                const items = [];
                for (let j = 0; j < itemBlocks.length; j++) {
                    const blockHtml = itemBlocks[j].attr;
                    const link = getHref(blockHtml);
                    if (!link) continue;
                    items.push(toMultimediaItem({
                        title: getTitle(blockHtml),
                        link: link,
                        image: getImgSrc(blockHtml) || ''
                    }));
                }
                if (items.length > 0) homeData[sectionTitle] = items;
            }
            if (Object.keys(homeData).length === 0) throw new Error('No home sections');
            cb({ success: true, data: homeData });
        } catch (e) {
            cb({ success: false, errorCode: 'HOME_ERROR', message: e.message });
        }
    };

    globalThis.search = async function(query, cb) {
        try {
            const searchUrl = manifest.baseUrl + '/?s=' + encodeURIComponent(query);
            const html = await fetchDoc(searchUrl);
            const items = [];
            const itemBlocks = parse_html(html, 'div.item.responsive-height.col-md-4.col-sm-6.col-xs-6');
            for (let i = 0; i < itemBlocks.length; i++) {
                const blockHtml = itemBlocks[i].attr;
                const link = getHref(blockHtml);
                if (!link) continue;
                items.push(toMultimediaItem({
                    title: getTitle(blockHtml),
                    link: link,
                    image: getImgSrc(blockHtml) || ''
                }));
            }
            cb({ success: true, data: items });
        } catch (e) {
            cb({ success: false, errorCode: 'SEARCH_ERROR', message: e.message });
        }
    };

    globalThis.load = async function(url, cb) {
        try {
            const html = await fetchDoc(url);
            const poster = getImgSrc(html); // ảnh đầu tiên thường là poster

            // Title: p.wp-caption-text
            const titleEls = parse_html(html, 'div.video-details div.post-entry p.wp-caption-text');
            const title = titleEls.length > 0 ? cleanTitle(getText(titleEls[0]) || 'No Title') : 'No Title';

            // Description: p đầu tiên không phải caption
            let description = null;
            const descPs = parse_html(html, 'div.video-details div.post-entry p');
            if (descPs.length > 0) {
                for (let i = 0; i < descPs.length; i++) {
                    const txt = getText(descPs[i]);
                    if (txt && !txt.toLowerCase().includes('caption')) {
                        description = txt;
                        break;
                    }
                }
            }

            // Year
            let year = null;
            const dateSpan = parse_html(html, 'span.date');
            if (dateSpan.length > 0) {
                const dateText = getText(dateSpan[0]);
                const match = dateText.replace(/[^0-9]/g, '').match(/(\d{4})$/);
                if (match) year = parseInt(match[1]);
            }

            // Tags
            const tags = [];
            const metaSpans = parse_html(html, 'span.meta');
            metaSpans.forEach(metaSpan => {
                const metaHtml = metaSpan.attr;
                const info = parse_html(metaHtml, 'span.meta-info');
                if (info.length > 0) {
                    const caption = getText(info[0]).toLowerCase();
                    if (caption === 'category' || caption === 'tag') {
                        const aTags = parse_html(metaHtml, 'a');
                        aTags.forEach(a => {
                            const tagText = getText(a);
                            if (tagText) tags.push(tagText);
                        });
                    }
                }
            });

            // Recommendations
            const recs = [];
            const recDivs = parse_html(html, 'div.latest-wrapper div.item.active > div');
            recDivs.forEach(recDiv => {
                const blockHtml = recDiv.attr;
                const link = getHref(blockHtml);
                if (!link) return;
                const recTitle = getTitle(blockHtml);
                recs.push(toMultimediaItem({
                    title: recTitle,
                    link: link,
                    image: getImgSrc(blockHtml) || ''
                }));
            });

            // Kiểm tra scenes
            const sceneLis = parse_html(html, 'ul.pagination.post-tape > li');
            if (sceneLis.length > 0) {
                const episodes = [];
                for (let i = 0; i < sceneLis.length; i++) {
                    const liHtml = sceneLis[i].attr;
                    const aHref = getHref(liHtml);
                    const numText = getText(parse_html(liHtml, 'a')[0]);
                    const num = parseInt(numText) || (i + 1);
                    if (aHref) {
                        try {
                            const sceneHtml = await fetchDoc(aHref);
                            const iframes = parse_html(sceneHtml, 'iframe', 'src')
                                .map(el => el.attr)
                                .filter(src => src && !src.startsWith('https://a.realsrv.com'));
                            episodes.push(new Episode({
                                name: `Scene ${num}`,
                                url: JSON.stringify(iframes),
                                episode: num,
                                posterUrl: poster
                            }));
                        } catch (e) {}
                    }
                }
                if (episodes.length > 0) {
                    return cb({
                        success: true,
                        data: new MultimediaItem({
                            title: title,
                            url: url,
                            posterUrl: poster,
                            type: 'series',
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

            // Movie
            const iframes = parse_html(html, 'iframe', 'src')
                .map(el => el.attr)
                .filter(src => src && !src.startsWith('https://a.realsrv.com'));
            cb({
                success: true,
                data: new MultimediaItem({
                    title: title,
                    url: JSON.stringify(iframes), // truyền vào loadStreams
                    posterUrl: poster,
                    type: 'movie',
                    description: description,
                    year: year,
                    tags: tags,
                    recommendations: recs,
                    headers: HEADERS
                })
            });
        } catch (e) {
            cb({ success: false, errorCode: 'LOAD_ERROR', message: e.message });
        }
    };

    globalThis.loadStreams = async function(dataUrl, cb) {
        try {
            const links = JSON.parse(dataUrl);
            const streams = [];
            for (let link of links) {
                // Rewrite domains
                if (link.startsWith('https://javhdfree.icu')) {
                    const withoutHttps = link.replace('https://', '');
                    const idx = withoutHttps.indexOf('/') + 1;
                    link = 'https://embedsito.com/' + withoutHttps.substring(idx);
                } else if (link.startsWith('https://viewsb.com')) {
                    link = link.replace('viewsb.com', 'watchsb.com');
                }

                if (typeof loadExtractor === 'function') {
                    const extractorResult = await loadExtractor(link);
                    if (Array.isArray(extractorResult)) {
                        extractorResult.forEach(s => {
                            s.source = 'JavHD';
                            streams.push(s);
                        });
                    }
                } else {
                    streams.push(new StreamResult({
                        url: link,
                        source: 'JavHD',
                        quality: 1080,
                        headers: HEADERS
                    }));
                }
            }
            // Dedup
            const seen = new Set();
            const deduped = streams.filter(s => {
                const key = s.url + '|' + s.source;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
            cb({ success: true, data: deduped });
        } catch (e) {
            cb({ success: false, errorCode: 'STREAM_ERROR', message: e.message });
        }
    };
})();