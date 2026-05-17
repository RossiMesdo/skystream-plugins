(function() {
    const BASE_URL = "https://www.aznude.com";
    const HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    };

    // ========== HELPERS ==========
    async function fetchDoc(url) {
        const res = await http_get(url, HEADERS);
        if (res.status !== 200) throw new Error('HTTP ' + res.status);
        return await parseHtml(res.body);
    }

    function resolveUrl(href, base) {
        if (!href) return '';
        if (href.startsWith('http')) return href;
        if (href.startsWith('//')) return 'https:' + href;
        if (href.startsWith('/')) return base + href;
        return base + '/' + href;
    }

    // Tạo MultimediaItem từ element (dùng cho getHome và search)
    function itemToMedia(el, base, type = 'nsfw') {
        const img = el.querySelector('img');
        const title = img?.getAttribute('alt')?.trim();
        if (!title) return null;
        const a = el.querySelector('a');
        const href = a?.getAttribute('href');
        if (!href) return null;
        const poster = img?.getAttribute('src') || '';
        // Loại bỏ video có thời lượng 00:0x hoặc 00:20
        const timeSpan = el.querySelector('span.video-timestamp, span.play-icon-active2.video-time');
        if (timeSpan) {
            const timeText = timeSpan.textContent.trim();
            if (/^00:(?:[0-1]\d|20)$/.test(timeText)) return null;
        }
        return new MultimediaItem({
            title: title,
            url: resolveUrl(href, base),
            posterUrl: resolveUrl(poster, base),
            type: type,
            headers: HEADERS
        });
    }

    // ========== DANH SÁCH TAG ==========
    const TAGS = [
        "topless", "undressing", "black", "shower", "pokies", "missionary", "stripper", "latina",
        "breastfondling", "upskirt", "doggystyle", "threesome", "groupnudity", "cunnilingus",
        "bottomless", "bbw", "milf", "outdoornudity", "blowjob", "publicnudity", "reversecowgirl",
        "fingering", "labia", "bouncingboobs", "masturbating", "orgasm", "orgy", "indian", "dildo",
        "roughsex", "skinnydip", "scissoring", "breastsucking", "handjob", "spanking", "penetration",
        "strapon", "anus", "shaved", "cum"
    ];

    async function fetchTagVideos(tag) {
        const basePath = `/browse/tags/vids/${tag}/`;
        const pages = [1,2,3,4,5]; // lấy 5 trang đầu để có nhiều video
        const allItems = [];
        const seenUrls = new Set();
        for (const page of pages) {
            try {
                const url = BASE_URL + basePath + page + '.html';
                const doc = await fetchDoc(url);
                const items = doc.querySelectorAll('div.media-list div.media-list-item');
                for (const el of items) {
                    const item = itemToMedia(el, BASE_URL);
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
            // Lấy song song tất cả tag (mỗi tag lấy nhiều trang)
            const results = await Promise.allSettled(
                TAGS.map(async tag => {
                    const items = await fetchTagVideos(tag);
                    return { name: tag.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), items };
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

    // ========== SEARCH (API) ==========
    async function search(query, cb) {
        try {
            // 1. Lấy token
            const tokenRes = await http_get("https://main-aq7es5tiuq-uc.a.run.app/app/search-token", {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0",
                    "Accept": "*/*",
                    "Accept-Language": "en-US,en;q=0.5",
                    "Referer": BASE_URL + "/"
                }
            });
            const tokenData = JSON.parse(tokenRes.body);
            const sid = tokenData.sid || "";
            const xst = tokenData.token || "";

            // 2. Gọi search API
            const apiUrl = `https://main-aq7es5tiuq-uc.a.run.app/app/exp/initial-search?q=${encodeURIComponent(query)}&gender=f&type=null&sortByDate=DESC&sortByViews=views_alltime&dateRange=anytime`;
            const searchRes = await http_get(apiUrl, {
                headers: {
                    "x-sid": sid,
                    "x-st": xst,
                    "Referer": BASE_URL + "/",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0"
                }
            });
            const searchData = JSON.parse(searchRes.body);
            const items = [];

            // Xử lý celebs, movies, videos, stories
            const processItems = (list) => {
                list.forEach(entry => {
                    const url = resolveUrl(entry.url, BASE_URL);
                    if (url.includes('/view/celeb/') || url.includes('/view/movie/')) {
                        let poster = entry.thumb || '';
                        if (poster && !poster.startsWith('http')) {
                            poster = 'https://cdn2.aznude.com' + poster;
                        }
                        items.push(new MultimediaItem({
                            title: entry.text,
                            url: url,
                            posterUrl: poster,
                            type: 'nsfw',
                            headers: HEADERS
                        }));
                    }
                });
            };

            if (searchData.data) {
                if (searchData.data.celebs) processItems(searchData.data.celebs);
                if (searchData.data.movies) processItems(searchData.data.movies);
                if (searchData.data.videos) processItems(searchData.data.videos);
                if (searchData.data.stories) processItems(searchData.data.stories);
            }

            cb({ success: true, data: items });
        } catch (e) {
            cb({ success: false, errorCode: 'SEARCH_ERROR', message: e.message });
        }
    }

    // ========== LOAD ==========
    async function load(url, cb) {
        try {
            const doc = await fetchDoc(url);

            if (url.includes('/view/celeb/') || url.includes('/view/movie/')) {
                // Dạng series
                const title = doc.querySelector('h1')?.textContent.trim() || 'No Title';
                const poster = doc.querySelector('div.single-page-banner_wrapper img')?.getAttribute('src');
                const tags = Array.from(doc.querySelectorAll('div.col-md-12 h2.video-tags a')).map(a => a.textContent.trim());
                const episodes = Array.from(doc.querySelectorAll('div.media-list-item.video-list-item')).map(el => {
                    const a = el.querySelector('a');
                    const href = a?.getAttribute('href');
                    const img = el.querySelector('img');
                    const epTitle = img?.getAttribute('alt')?.trim() || 'Episode';
                    const epPoster = img?.getAttribute('src') || '';
                    return new Episode({
                        name: epTitle,
                        url: resolveUrl(href, BASE_URL),
                        posterUrl: resolveUrl(epPoster, BASE_URL)
                    });
                }).filter(ep => ep.url);

                // Recommendations (đơn giản)
                const recs = Array.from(doc.querySelectorAll('div.col-lg-2 a.video, div.col-lg-3 a.video')).map(el => itemToMedia(el, BASE_URL)).filter(Boolean);

                cb({ success: true, data: new MultimediaItem({
                    title: title,
                    url: url,
                    posterUrl: resolveUrl(poster, BASE_URL),
                    type: 'series',
                    description: title + ' +18',
                    tags: tags,
                    recommendations: recs,
                    episodes: episodes,
                    headers: HEADERS
                })});
            } else {
                // Movie đơn
                const title = doc.querySelector('meta[name=title]')?.getAttribute('content') || doc.querySelector('h1')?.textContent.trim() || 'No Title';
                const poster = doc.querySelector('link[rel=preload][as=image]')?.getAttribute('href');
                const description = doc.querySelector('meta[name=description]')?.getAttribute('content');
                const tags = Array.from(doc.querySelectorAll('div.col-md-12 h2.video-tags a')).map(a => a.textContent.trim());
                const recs = Array.from(doc.querySelectorAll('div.col-lg-3 a.video')).map(el => itemToMedia(el, BASE_URL)).filter(Boolean);

                // Tạo một episode duy nhất để kích hoạt nút Play
                const episode = new Episode({
                    name: title,
                    url: url,
                    posterUrl: resolveUrl(poster, BASE_URL)
                });

                cb({ success: true, data: new MultimediaItem({
                    title: title,
                    url: url,
                    posterUrl: resolveUrl(poster, BASE_URL),
                    type: 'movie',
                    description: description,
                    tags: tags,
                    recommendations: recs,
                    episodes: [episode],
                    headers: HEADERS
                })});
            }
        } catch (e) {
            cb({ success: false, errorCode: 'LOAD_ERROR', message: e.message });
        }
    }

    // ========== LOAD STREAMS ==========
    async function loadStreams(dataUrl, cb) {
        try {
            const doc = await fetchDoc(dataUrl);
            const scripts = doc.querySelectorAll('script');
            let sourcesFound = false;

            for (const script of scripts) {
                const content = script.textContent || '';
                if (content.includes('jwplayer') && content.includes('setup') && content.includes('playlist')) {
                    // Tìm sources block
                    const sourcesMatch = content.match(/sources:\s*\[\s*([\s\S]*?)\s*\]/);
                    if (!sourcesMatch) continue;
                    const sourcesText = sourcesMatch[1];
                    const fileRegex = /\{\s*file:\s*"([^"]+)",\s*label:\s*"([^"]+)"(?:,\s*default:\s*"true")?\s*\}/g;
                    let match;
                    while ((match = fileRegex.exec(sourcesText)) !== null) {
                        const videoUrl = match[1];
                        const label = match[2];
                        const qualityMap = {
                            'LQ': 240,
                            'HQ': 480,
                            'HD': 720,
                            'FHD': 1080,
                            '4K': 2160
                        };
                        const quality = qualityMap[label.toUpperCase()] || 0;
                        const stream = new StreamResult({
                            url: videoUrl,
                            source: `AZNude ${label}`,
                            quality: quality,
                            headers: { 'Referer': BASE_URL + '/' }
                        });
                        // Dùng callback nếu có, nếu không thì đưa vào mảng
                        if (typeof cb === 'function') {
                            cb({ success: true, data: [stream] });
                        }
                        sourcesFound = true;
                    }
                }
            }
            if (!sourcesFound) throw new Error('No jwplayer sources found');
            // Gọi cb một lần duy nhất nếu chưa gọi
            if (typeof cb === 'function' && !sourcesFound) {
                cb({ success: false, errorCode: 'STREAM_ERROR', message: 'No sources found' });
            }
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