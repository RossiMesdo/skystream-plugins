(function() {
    const BASE_URL = typeof manifest !== 'undefined' && manifest.baseUrl ? manifest.baseUrl : "https://en.xchina.co";
    const HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    };

    // ========== HELPERS ==========
    async function fetchDoc(url) {
        const res = await http_get(url, HEADERS);
        if (res.status !== 200) throw new Error('HTTP ' + res.status);
        return await parseHtml(res.body);
    }

    async function fetchRaw(url) {
        const res = await http_get(url, HEADERS);
        if (res.status !== 200) throw new Error('HTTP ' + res.status);
        return res.body;
    }

    function resolveUrl(href, base) {
        if (!href) return '';
        if (href.startsWith('http')) return href;
        if (href.startsWith('//')) return 'https:' + href;
        if (href.startsWith('/')) return base + href;
        return base + '/' + href;
    }

    function cleanText(el) {
        return el ? el.textContent.trim() : '';
    }

    // ========== ITEM PARSING (dùng chung cho home, search, recommendations) ==========
    function parseVideoItem(el, base) {
        const titleEl = el.querySelector('div.title a');
        if (!titleEl) return null;
        const title = cleanText(titleEl);
        if (!title) return null;
        const href = titleEl.getAttribute('href');
        if (!href) return null;
        const url = resolveUrl(href, base);

        // Lấy poster từ style của div.img hoặc từ img bên trong
        const imgDiv = el.querySelector('div.img');
        let poster = '';
        if (imgDiv) {
            const style = imgDiv.getAttribute('style') || '';
            const urlMatch = style.match(/url\(['"]?([^'"]*)['"]?\)/);
            poster = urlMatch ? urlMatch[1] : '';
        }
        if (!poster) {
            const img = el.querySelector('img');
            poster = img?.getAttribute('src') || img?.getAttribute('data-src') || '';
        }
        poster = resolveUrl(poster, base);

        return new MultimediaItem({
            title: title,
            url: url,
            posterUrl: poster,
            type: 'nsfw',
            headers: { ...HEADERS, 'Referer': base }
        });
    }

    // ========== DANH SÁCH SERIES (từ mainPage) ==========
    const SERIES = [
        { name: "Censored AV", path: "/videos/series-6395aba3deb74.html" },
        { name: "Model Media", path: "/videos/series-5f904550b8fcc.html" },
        { name: "Uncensored AV", path: "/videos/series-6395ab7fee104.html" },
        { name: "Independent Creators", path: "/videos/series-61bf6e439fed6.html" },
        { name: "Pans Videos", path: "/videos/series-63963186ae145.html" },
        { name: "TXVLOG", path: "/videos/series-61014080dbfde.html" },
        { name: "Peach Media", path: "/videos/series-5fe8403919165.html" },
        { name: "Star Media", path: "/videos/series-6054e93356ded.html" },
        { name: "Timi Media", path: "/videos/series-60153c49058ce.html" },
        { name: "91mv", path: "/videos/series-5fe840718d665.html" }
    ];

    // Lấy nhiều trang cho một series để có nhiều video
    async function fetchSeriesVideos(seriesPath) {
        const pages = [1, 2, 3, 4, 5]; // lấy 5 trang đầu
        const allItems = [];
        const seenUrls = new Set();
        for (const page of pages) {
            try {
                const url = page === 1
                    ? BASE_URL + seriesPath
                    : BASE_URL + seriesPath.replace('.html', `/${page}.html`);
                const doc = await fetchDoc(url);
                const items = doc.querySelectorAll('div.item.video');
                for (const el of items) {
                    const item = parseVideoItem(el, BASE_URL);
                    if (item && !seenUrls.has(item.url)) {
                        seenUrls.add(item.url);
                        allItems.push(item);
                        if (allItems.length >= 200) break;
                    }
                }
            } catch (e) {}
            if (allItems.length >= 200) break;
        }
        return allItems;
    }

    // ========== GET HOME ==========
    async function getHome(cb) {
        try {
            const homeData = {};
            const results = await Promise.allSettled(
                SERIES.map(async series => {
                    const items = await fetchSeriesVideos(series.path);
                    return { name: series.name, items };
                })
            );

            results.forEach(res => {
                if (res.status === 'fulfilled' && res.value.items.length) {
                    homeData[res.value.name] = res.value.items;
                }
            });

            if (Object.keys(homeData).length === 0) throw new Error('No categories loaded');
            cb({ success: true, data: homeData });
        } catch (e) {
            cb({ success: false, errorCode: 'HOME_ERROR', message: e.message });
        }
    }

    // ========== SEARCH ==========
    async function search(query, cb) {
        try {
            const url = BASE_URL + '/videos/keyword-' + encodeURIComponent(query) + '.html';
            const doc = await fetchDoc(url);
            const items = Array.from(doc.querySelectorAll('div.item.video'))
                .map(el => parseVideoItem(el, BASE_URL))
                .filter(Boolean);
            cb({ success: true, data: items });
        } catch (e) {
            cb({ success: false, errorCode: 'SEARCH_ERROR', message: e.message });
        }
    }

    // ========== LOAD (trang chi tiết) ==========
    async function load(url, cb) {
        try {
            const doc = await fetchDoc(url);

            // Tiêu đề
            const titleEl = doc.querySelector('h1');
            const title = titleEl ? cleanText(titleEl) : 'No Title';

            // Poster
            const posterMeta = doc.querySelector('meta[property="og:image"]');
            const posterUrl = posterMeta ? posterMeta.getAttribute('content') : '';

            // Mã code (volume) nếu có
            const volumeEl = doc.querySelector('div.item:has(i.fa-hashtag) div.text');
            const volume = volumeEl ? cleanText(volumeEl) : '';

            // Mô tả
            const plotEl = doc.querySelector('.info-card.video-detail .item .text');
            const plot = plotEl ? cleanText(plotEl) : '';

            // Ghép mô tả
            const description = volume ? `Code: ${volume}\n\n${plot}` : plot;

            // Tags
            const tagElements = doc.querySelectorAll('.info-card .item:has(i.fa-tags) .text, .info-card.video-detail .item .text a');
            const tags = Array.from(tagElements).map(el => cleanText(el)).filter(t => t);

            // Diễn viên
            const actorElements = doc.querySelectorAll('.model-item');
            const actors = Array.from(actorElements).map(el => new Actor({ name: cleanText(el) }));

            // Đề xuất
            const recElements = doc.querySelectorAll('div.item.video');
            const recommendations = Array.from(recElements)
                .map(el => parseVideoItem(el, BASE_URL))
                .filter(Boolean);

            // Tạo Episode để có nút Play
            const episode = new Episode({
                name: title,
                url: url, // truyền URL phim cho loadStreams
                posterUrl: posterUrl,
                description: description
            });

            cb({ success: true, data: new MultimediaItem({
                title: title,
                url: url,
                posterUrl: posterUrl,
                type: 'movie',
                description: description,
                tags: tags,
                cast: actors,
                recommendations: recommendations,
                episodes: [episode],
                headers: { ...HEADERS, 'Referer': BASE_URL }
            })});
        } catch (e) {
            cb({ success: false, errorCode: 'LOAD_ERROR', message: e.message });
        }
    }

    // ========== LOAD STREAMS ==========
    async function loadStreams(dataUrl, cb) {
        try {
            const html = await fetchRaw(dataUrl);

            // Tìm link m3u8 giống regex gốc: src: 'http...m3u8...'
            const m3u8Match = html.match(/src:\s*['"](https?:\/\/video\.xchina\.download\/m3u8\/.*?\.m3u8[^'"]*)['"]/i);
            if (!m3u8Match) throw new Error('M3U8 link not found');

            const streamUrl = m3u8Match[1];

            cb({ success: true, data: [
                new StreamResult({
                    url: streamUrl,
                    source: 'XChina',
                    quality: 1080,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Referer': BASE_URL
                    }
                })
            ]});
        } catch (e) {
            cb({ success: false, errorCode: 'STREAM_ERROR', message: e.message });
        }
    }

    // Export
    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();