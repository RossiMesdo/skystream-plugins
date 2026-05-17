(function() {
    const HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    };

    function cleanTitle(str) {
        return str.replace(/^JAV HD\s*/i, '').trim();
    }

    // Lấy text sạch từ element
    function getText(el) { return el.text.trim(); }

    // Lấy href của thẻ a đầu tiên trong khối
    function getHref(blockHtml) {
        const a = parse_html(blockHtml, 'a', 'href')[0];
        return a ? a.attr : null;
    }
    // Lấy src của img
    function getImgSrc(blockHtml) {
        const img = parse_html(blockHtml, 'img', 'src')[0];
        return img ? img.attr : null;
    }
    // Lấy title từ a (title attr) hoặc alt của img
    function getTitle(blockHtml) {
        const a = parse_html(blockHtml, 'a', 'title')[0];
        if (a && a.attr) return cleanTitle(a.attr);
        const img = parse_html(blockHtml, 'img', 'alt')[0];
        return img && img.attr ? cleanTitle(img.attr) : '';
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

    // --- Core ---
    globalThis.getHome = async function(cb) {
        try {
            const html = await fetchDoc(`${manifest.baseUrl}/page/1`);
            const homeData = {};

            // Lấy tiêu đề section-header
            const sectionHeaders = parse_html(html, 'div.section-header');
            const titles = sectionHeaders.map(el => getText(el)).filter(t => t);

            // Lấy các widget
            const widgets = parse_html(html, 'div#video-widget-3016');
            for (let i = 0; i < widgets.length; i++) {
                const widgetHtml = widgets[i].attr;
                const sectionTitle = titles[i] || `Section ${i+1}`;
                const itemBlocks = parse_html(widgetHtml, 'div.col-md-3.col-sm-6.col-xs-6.item.responsive-height.post');
                const items = [];
                for (const block of itemBlocks) {
                    const blockHtml = block.attr;
                    const link = getHref(blockHtml);
                    if (!link) continue;
                    items.push(toMultimediaItem({
                        title: getTitle(blockHtml),
                        link: link,
                        image: getImgSrc(blockHtml) || ''
                    }));
                }
                if (items.length) homeData[sectionTitle] = items;
            }
            if (!Object.keys(homeData).length) throw new Error('No home data');
            cb({ success: true, data: homeData });
        } catch (e) {
            cb({ success: false, errorCode: 'HOME_ERROR', message: e.message });
        }
    };

    globalThis.search = async function(query, cb) {
        try {
            const html = await fetchDoc(`${manifest.baseUrl}/?s=${encodeURIComponent(query)}`);
            const items = [];
            const itemBlocks = parse_html(html, 'div.item.responsive-height.col-md-4.col-sm-6.col-xs-6');
            for (const block of itemBlocks) {
                const blockHtml = block.attr;
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
            const poster = parse_html(html, 'div.video-details div.post-entry img', 'src')[0]?.attr || null;
            const titleRaw = parse_html(html, 'div.video-details div.post-entry p.wp-caption-text')[0]?.text || '';
            const title = cleanTitle(titleRaw || 'No Title');

            let desc = null;
            const descPs = parse_html(html, 'div.video-details div.post-entry p');
            if (descPs.length > 0) desc = descPs[0].text.trim();

            const dateSpan = parse_html(html, 'span.date')[0]?.text || '';
            const year = parseInt(dateSpan.replace(/[^0-9]/g, '').slice(-4)) || null;

            const tags = [];
            for (const metaBlock of parse_html(html, 'span.meta')) {
                const caption = parse_html(metaBlock.attr, 'span.meta-info')[0]?.text.trim().toLowerCase() || '';
                if (caption === 'category' || caption === 'tag') {
                    for (const a of parse_html(metaBlock.attr, 'a')) {
                        tags.push(a.text.trim());
                    }
                }
            }

            const recs = [];
            for (const recBlock of parse_html(html, 'div.latest-wrapper div.item.active > div')) {
                const link = getHref(recBlock.attr);
                if (!link) continue;
                recs.push(toMultimediaItem({
                    title: getTitle(recBlock.attr),
                    link: link,
                    image: getImgSrc(recBlock.attr) || ''
                }));
            }

            // Check scenes
            const sceneLis = parse_html(html, 'ul.pagination.post-tape > li');
            if (sceneLis.length > 0) {
                const episodes = [];
                for (const li of sceneLis) {
                    const a = parse_html(li.attr, 'a', 'href')[0]?.attr;
                    const num = parseInt(parse_html(li.attr, 'a')[0]?.text) || (episodes.length + 1);
                    if (a) {
                        try {
                            const sceneHtml = await fetchDoc(a);
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
                if (episodes.length) {
                    return cb({ success: true, data: new MultimediaItem({
                        title, url, posterUrl: poster, type: 'series',
                        description: desc, year, tags, recommendations: recs,
                        episodes, headers: HEADERS
                    })});
                }
            }

            // Movie
            const iframes = parse_html(html, 'iframe', 'src')
                .map(el => el.attr)
                .filter(src => src && !src.startsWith('https://a.realsrv.com'));
            cb({ success: true, data: new MultimediaItem({
                title, url: JSON.stringify(iframes), posterUrl: poster, type: 'movie',
                description: desc, year, tags, recommendations: recs, headers: HEADERS
            })});
        } catch (e) {
            cb({ success: false, errorCode: 'LOAD_ERROR', message: e.message });
        }
    };

    globalThis.loadStreams = async function(dataUrl, cb) {
        try {
            const links = JSON.parse(dataUrl);
            const streams = [];
            for (let link of links) {
                if (link.startsWith('https://javhdfree.icu')) {
                    link = 'https://embedsito.com/' + link.replace('https://', '').split('/').slice(1).join('/');
                } else if (link.startsWith('https://viewsb.com')) {
                    link = link.replace('viewsb.com', 'watchsb.com');
                }
                if (typeof loadExtractor === 'function') {
                    try {
                        const res = await loadExtractor(link);
                        streams.push(...res);
                    } catch (e) {}
                } else {
                    streams.push(new StreamResult({ url: link, source: 'JavHD', quality: 1080, headers: HEADERS }));
                }
            }
            // Dedup
            const seen = new Set();
            const deduped = streams.filter(s => {
                const k = s.url + '|' + s.source;
                if (seen.has(k)) return false;
                seen.add(k);
                return true;
            });
            cb({ success: true, data: deduped });
        } catch (e) {
            cb({ success: false, errorCode: 'STREAM_ERROR', message: e.message });
        }
    };
})();