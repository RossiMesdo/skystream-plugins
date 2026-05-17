// MissAV plugin for SkyStream
// Chuyển đổi từ CloudStream - @ByAyzen
(function() {
    const MAIN_URL = "https://missav.live";
    const HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": MAIN_URL + "/",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
    };

    const CATEGORIES = [
        { name: "Weekly Hot", url: MAIN_URL + "/dm169/en/weekly-hot?sort=weekly_views" },
        { name: "Monthly Hot", url: MAIN_URL + "/dm263/en/monthly-hot?sort=views" },
        { name: "Newly Added", url: MAIN_URL + "/en/new?sort=published_at" },
        { name: "English Subtitles", url: MAIN_URL + "/en/english-subtitle" },
        { name: "Uncensored Leak", url: MAIN_URL + "/dm628/en/uncensored-leak" },
        { name: "FC2", url: MAIN_URL + "/dm150/en/fc2" },
        { name: "Madou", url: MAIN_URL + "/dm35/en/madou" },
        { name: "K-Live", url: MAIN_URL + "/en/klive" },
        { name: "C-Live", url: MAIN_URL + "/en/clive" },
        { name: "Tokyo Hot", url: MAIN_URL + "/dm29/en/tokyohot" },
        { name: "HEYZO", url: MAIN_URL + "/dm1198483/en/heyzo" },
        { name: "1pondo", url: MAIN_URL + "/dm2469695/en/1pondo" },
        { name: "Caribbeancom", url: MAIN_URL + "/dm3959622/en/caribbeancom" },
        { name: "Caribbeancom Premium", url: MAIN_URL + "/dm48032/en/caribbeancompr" },
        { name: "10musume", url: MAIN_URL + "/dm3710098/en/10musume" },
        { name: "Pacopacomama", url: MAIN_URL + "/dm1342558/en/pacopacomama" },
        { name: "Gachinco", url: MAIN_URL + "/dm136/en/gachinco" },
        { name: "XXX-AV", url: MAIN_URL + "/dm29/en/xxxav" },
        { name: "Married Slash", url: MAIN_URL + "/dm24/en/marriedslash" },
        { name: "Naughty 4610", url: MAIN_URL + "/dm20/en/naughty4610" },
        { name: "Naughty 0930", url: MAIN_URL + "/dm22/en/naughty0930" }
    ];

    // === Hỗ trợ parse HTML ===
    function parseHTML(html, selector) {
        if (typeof parse_html === "function") {
            return parse_html(html, selector);
        }
        // Fallback đơn giản: không hỗ trợ nếu thiếu parse_html
        console.error("parse_html not available");
        return [];
    }

    function extractText(element) {
        if (!element) return "";
        return element.text ? element.text() : "";
    }

    function extractAttr(element, attr) {
        if (!element) return null;
        if (element.attr) return element.attr(attr);
        return null;
    }

    // === Hàm giải nén JavaScript (unpack) ===
    function getAndUnpack(html) {
        const packedRegex = /eval\s*\(\s*function\s*\(\s*p\s*,\s*a\s*,\s*c\s*,\s*k\s*,\s*(e|r)\s*,\s*d\s*\)/;
        const match = packedRegex.exec(html);
        if (!match) return html; // không packed

        // Lấy toàn bộ khối eval
        const start = match.index;
        let bracketCount = 0;
        let end = start;
        for (let i = start; i < html.length; i++) {
            if (html[i] === '(') bracketCount++;
            else if (html[i] === ')') {
                bracketCount--;
                if (bracketCount === 0) {
                    end = i + 1;
                    break;
                }
            }
        }
        const packedStr = html.slice(start, end);
        // Tách tham số p,a,c,k,e,d
        const argsMatch = /function\s*\(\s*p\s*,\s*a\s*,\s*c\s*,\s*k\s*,\s*(e|r)\s*,\s*d\s*\)\s*\{.*?\}\s*\(\s*(.*?)\s*\)/.exec(packedStr.replace(/\n/g, ''));
        if (!argsMatch) return html;

        const args = argsMatch[2].split(',');
        if (args.length < 5) return html;

        const p = parseInt(args[0]);
        const a = parseInt(args[1]);
        const c = parseInt(args[2]);
        const k = args[3].split('|');
        const e = args[4];
        const d = args[5] ? args[5] : '';

        function unpack() {
            const data = p;
            let result = "";
            for (let i = 0; i < data; i++) {
                if (i < a) {
                    result += String.fromCharCode(c + i);
                } else {
                    result += k[i - a];
                }
            }
            return result;
        }

        try {
            return unpack();
        } catch (err) {
            return html;
        }
    }

    // === Parse danh sách video từ HTML ===
    function parseVideoList(html) {
        const items = [];
        const elements = parseHTML(html, "div.grid.grid-cols-2 > div, div.thumbnail.group");
        const seenUrls = new Set();

        for (const el of elements) {
            const linkEl = el.select ? el.select("a[href*='/en/'], a[href*='/dm']")[0] : null;
            if (!linkEl) continue;

            const href = extractAttr(linkEl, "href");
            if (!href) continue;
            const url = href.startsWith("http") ? href : MAIN_URL + href;
            if (seenUrls.has(url)) continue;
            seenUrls.add(url);

            let title = extractText(el.select ? el.select("div.my-2 a, div.title a, a.text-secondary")[0] : null) ||
                        extractText(linkEl);
            title = title.trim();
            if (!title || /^(Recent update|Contact|Support|DMCA|Home)$/i.test(title)) continue;

            // Kiểm tra uncensored
            const outer = el.outerHTML ? el.outerHTML() : "";
            const isUncensored = /uncensored[-_ ]?leak/i.test(outer + href);
            if (isUncensored && !title.toLowerCase().startsWith("uncensored - ")) {
                title = "Uncensored - " + title;
            }

            let posterUrl = null;
            const img = el.select ? el.select("img")[0] : null;
            if (img) {
                posterUrl = extractAttr(img, "data-src") || extractAttr(img, "src");
                if (posterUrl && !posterUrl.startsWith("http")) {
                    posterUrl = MAIN_URL + posterUrl;
                }
            }
            if (!posterUrl) continue;

            items.push(new MultimediaItem({
                title: title,
                url: url,
                posterUrl: posterUrl,
                type: "movie",
                headers: HEADERS
            }));
        }
        return items;
    }

    // === Core Functions ===
    async function getHome(cb) {
        try {
            const homeData = {};
            const fetchPromises = CATEGORIES.map(async cat => {
                const firstPageUrl = cat.url.includes("?") ? cat.url + "&page=1" : cat.url + "?page=1";
                const res = await http_get(firstPageUrl, HEADERS);
                if (res.status !== 200) return { name: cat.name, items: [] };
                const items = parseVideoList(res.body || "");
                return { name: cat.name, items: items };
            });

            const results = await Promise.allSettled(fetchPromises);
            results.forEach(res => {
                if (res.status === "fulfilled" && res.value.items.length) {
                    homeData[res.value.name] = res.value.items;
                }
            });

            if (Object.keys(homeData).length === 0) {
                return cb({ success: false, errorCode: "HOME_ERROR", message: "No content" });
            }
            cb({ success: true, data: homeData });
        } catch (e) {
            cb({ success: false, errorCode: "HOME_ERROR", message: e.message });
        }
    }

    async function search(query, cb) {
        try {
            const searchUrl = MAIN_URL + "/en/search/" + encodeURIComponent(query);
            const res = await http_get(searchUrl, HEADERS);
            const items = parseVideoList(res.body || "");
            cb({ success: true, data: items });
        } catch (e) {
            cb({ success: false, errorCode: "SEARCH_ERROR", message: e.message });
        }
    }

    async function load(url, cb) {
        try {
            const res = await http_get(url, HEADERS);
            const html = res.body || "";

            // Dùng parse_html để lấy chi tiết
            const titleEl = parseHTML(html, "h1.text-base")[0];
            const title = titleEl ? extractText(titleEl).trim() : "Unknown";
            if (!title) return cb({ success: false, message: "No title found" });

            let posterUrl = null;
            const metaImg = parseHTML(html, "meta[property='og:image']")[0];
            if (metaImg) {
                posterUrl = extractAttr(metaImg, "content");
                if (posterUrl && !posterUrl.startsWith("http")) posterUrl = MAIN_URL + posterUrl;
            }

            // Tags
            const tags = [];
            const tagElements = parseHTML(html, "div.text-secondary a");
            for (const el of tagElements) {
                const text = extractText(el).trim();
                if (text) tags.push(text);
            }

            // Actresses
            const actresses = [];
            const actressElements = parseHTML(html, "div.text-secondary a");
            for (const el of actressElements) {
                const text = extractText(el).trim();
                if (text) actresses.push(text);
            }

            // Episode duy nhất
            const episode = new Episode({
                name: title,
                url: url,
                episode: 1,
                posterUrl: posterUrl,
                description: "MissAV video",
                headers: HEADERS
            });

            const item = new MultimediaItem({
                title: title,
                url: url,
                posterUrl: posterUrl,
                type: "movie",
                description: title,
                plot: actresses.length ? "Actresses: " + actresses.join(", ") : "",
                tags: tags,
                episodes: [episode],
                headers: HEADERS
            });

            cb({ success: true, data: item });
        } catch (e) {
            cb({ success: false, errorCode: "LOAD_ERROR", message: e.message });
        }
    }

    async function loadStreams(url, cb) {
        try {
            const res = await http_get(url, HEADERS);
            const html = res.body || "";

            // Tìm playlist UUID
            let unpacked = getAndUnpack(html);
            let playlistId = null;
            const uuidRegex = /\/([a-f0-9\-]{36})\/playlist\.m3u8/;
            const match = uuidRegex.exec(unpacked);
            if (match) {
                playlistId = match[1];
            } else {
                const fallbackMatch = /\/([a-f0-9\-]{36})\//.exec(unpacked);
                if (fallbackMatch) playlistId = fallbackMatch[1];
            }

            if (!playlistId) {
                return cb({ success: false, message: "Stream not found" });
            }

            const streamUrl = `https://surrit.com/${playlistId}/playlist.m3u8`;
            const stream = new StreamResult({
                url: streamUrl,
                source: "MissAV",
                quality: 1080,
                headers: { "Referer": MAIN_URL + "/" }
            });

            cb({ success: true, data: [stream] });
        } catch (e) {
            cb({ success: false, errorCode: "STREAM_ERROR", message: e.message });
        }
    }

    // Export
    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();