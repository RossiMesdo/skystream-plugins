// MissAV plugin for SkyStream
// Chuyển đổi từ CloudStream, dùng DOMParser & unpack JS
(function() {
    const MAIN_URL = "https://missav.live";
    const HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": MAIN_URL + "/"
    };

    const CATEGORIES = [
        { name: "Weekly Hot", path: "/dm169/en/weekly-hot?sort=weekly_views" },
        { name: "Monthly Hot", path: "/dm263/en/monthly-hot?sort=views" },
        { name: "Newly Added", path: "/en/new?sort=published_at" },
        { name: "English Subtitles", path: "/en/english-subtitle" },
        { name: "Uncensored Leak", path: "/dm628/en/uncensored-leak" },
        { name: "FC2", path: "/dm150/en/fc2" },
        { name: "Madou", path: "/dm35/en/madou" },
        { name: "K-Live", path: "/en/klive" },
        { name: "C-Live", path: "/en/clive" },
        { name: "Tokyo Hot", path: "/dm29/en/tokyohot" },
        { name: "HEYZO", path: "/dm1198483/en/heyzo" },
        { name: "1pondo", path: "/dm2469695/en/1pondo" },
        { name: "Caribbeancom", path: "/dm3959622/en/caribbeancom" },
        { name: "Caribbeancom Premium", path: "/dm48032/en/caribbeancompr" },
        { name: "10musume", path: "/dm3710098/en/10musume" },
        { name: "Pacopacomama", path: "/dm1342558/en/pacopacomama" },
        { name: "Gachinco", path: "/dm136/en/gachinco" },
        { name: "XXX-AV", path: "/dm29/en/xxxav" },
        { name: "Married Slash", path: "/dm24/en/marriedslash" },
        { name: "Naughty 4610", path: "/dm20/en/naughty4610" },
        { name: "Naughty 0930", path: "/dm22/en/naughty0930" }
    ];

    // Hàm parse HTML thành Document (dùng DOMParser, khả dụng trong SkyStream)
    function parseHTML(html) {
        const parser = new DOMParser();
        return parser.parseFromString(html, "text/html");
    }

    // Hàm giải nén JavaScript kiểu packed (p,a,c,k,e,d)
    function getAndUnpack(html) {
        const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
        let match;
        while ((match = scriptRegex.exec(html)) !== null) {
            const scriptContent = match[1];
            if (scriptContent.includes('eval(function(p,a,c,k,e,d)')) {
                // Tìm phần eval(function...
                const packedMatch = /eval\(function\(p,a,c,k,e,d\)\{.*?\}\((.*?)\)\)/.exec(scriptContent.replace(/\s+/g, ' '));
                if (!packedMatch) continue;
                const argsStr = packedMatch[1];
                // Phân tách các tham số, lưu ý các chuỗi có thể có dấu phẩy bên trong
                const args = [];
                let depth = 0;
                let current = '';
                for (let i = 0; i < argsStr.length; i++) {
                    const ch = argsStr[i];
                    if ((ch === ',' || ch === ';') && depth === 0) {
                        args.push(current.trim());
                        current = '';
                    } else {
                        if (ch === '(' || ch === '{' || ch === '[') depth++;
                        else if (ch === ')' || ch === '}' || ch === ']') depth--;
                        current += ch;
                    }
                }
                if (current.trim()) args.push(current.trim());

                if (args.length < 5) continue;
                const p = parseInt(args[0]);
                const a = parseInt(args[1]);
                const c = parseInt(args[2]);
                const k = args[3].split('|');
                const e = args[4] || '';
                const d = args[5] || '';

                function unpack() {
                    let result = "";
                    for (let i = 0; i < p; i++) {
                        if (i < a) {
                            result += String.fromCharCode(c + i);
                        } else {
                            result += k[i - a] || '';
                        }
                    }
                    return result;
                }
                try {
                    return unpack();
                } catch (ex) {
                    return scriptContent;
                }
            }
        }
        return html;
    }

    // Parse danh sách video từ HTML (dùng DOMParser)
    function parseVideoItems(html, baseUrl) {
        const doc = parseHTML(html);
        const items = [];
        const seenUrls = new Set();
        // Selector: div.grid.grid-cols-2 > div hoặc div.thumbnail.group
        const elements = doc.querySelectorAll("div.grid.grid-cols-2 > div, div.thumbnail.group");
        for (const el of elements) {
            const link = el.querySelector("a[href*='/en/'], a[href*='/dm']");
            if (!link) continue;
            let href = link.getAttribute("href");
            if (!href) continue;
            const url = href.startsWith("http") ? href : baseUrl + href;
            if (seenUrls.has(url)) continue;
            seenUrls.add(url);

            // Title
            let title = "";
            const titleEl = el.querySelector("div.my-2 a, div.title a, a.text-secondary");
            if (titleEl) title = titleEl.textContent.trim();
            if (!title) title = link.textContent.trim();
            if (!title) continue;
            // Bỏ qua các mục không phải phim
            if (/^(Recent update|Contact|Support|DMCA|Home)$/i.test(title)) continue;

            // Uncensored check
            const outer = el.outerHTML + href;
            const isUncensored = /uncensored[-_ ]?leak/i.test(outer);
            if (isUncensored && !title.toLowerCase().startsWith("uncensored - ")) {
                title = "Uncensored - " + title;
            }

            // Poster
            let posterUrl = null;
            const img = el.querySelector("img");
            if (img) {
                posterUrl = img.getAttribute("data-src") || img.getAttribute("src");
                if (posterUrl && !posterUrl.startsWith("http")) posterUrl = baseUrl + posterUrl;
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

    // Lấy thông tin chi tiết phim
    function parseMovieDetail(html, url) {
        const doc = parseHTML(html);
        const title = (doc.querySelector("h1.text-base")?.textContent || "").trim();
        if (!title) return null;

        let posterUrl = null;
        const metaImg = doc.querySelector("meta[property='og:image']");
        if (metaImg) {
            posterUrl = metaImg.getAttribute("content");
            if (posterUrl && !posterUrl.startsWith("http")) posterUrl = MAIN_URL + posterUrl;
        }

        // Tags (genre)
        const tags = [];
        doc.querySelectorAll("div.text-secondary:contains(genre) a, div.text-secondary a").forEach(a => {
            const text = a.textContent.trim();
            if (text && !tags.includes(text)) tags.push(text);
        });

        // Actresses
        const actresses = [];
        doc.querySelectorAll("div.text-secondary:contains(actress) a").forEach(a => {
            actresses.push(a.textContent.trim());
        });

        return { title, posterUrl, tags, actresses };
    }

    // --- Core Functions ---
    async function getHome(cb) {
        try {
            const homeData = {};
            const fetchPromises = CATEGORIES.map(async cat => {
                const firstPageUrl = MAIN_URL + cat.path + (cat.path.includes("?") ? "&page=1" : "?page=1");
                const res = await http_get(firstPageUrl, HEADERS);
                if (res.status !== 200) return { name: cat.name, items: [] };
                const items = parseVideoItems(res.body || "", MAIN_URL);
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
            const items = parseVideoItems(res.body || "", MAIN_URL);
            cb({ success: true, data: items });
        } catch (e) {
            cb({ success: false, errorCode: "SEARCH_ERROR", message: e.message });
        }
    }

    async function load(url, cb) {
        try {
            const res = await http_get(url, HEADERS);
            const html = res.body || "";
            const detail = parseMovieDetail(html, url);
            if (!detail) return cb({ success: false, message: "Could not parse movie details" });

            const episode = new Episode({
                name: detail.title,
                url: url, // URL gốc của phim, mỗi phim là 1 tập duy nhất
                episode: 1,
                posterUrl: detail.posterUrl,
                description: detail.tags.length ? "Genre: " + detail.tags.join(", ") : "MissAV video",
                headers: HEADERS
            });

            const item = new MultimediaItem({
                title: detail.title,
                url: url,
                posterUrl: detail.posterUrl,
                type: "movie",
                description: detail.title,
                plot: detail.actresses.length ? "Actresses: " + detail.actresses.join(", ") : "",
                tags: detail.tags,
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
            const unpacked = getAndUnpack(html);
            // Tìm UUID playlist (36 ký tự hex)
            const uuidRegex = /\/([a-f0-9\-]{36})\/playlist\.m3u8/;
            const match = uuidRegex.exec(unpacked);
            const playlistId = match ? match[1] : null;

            if (!playlistId) {
                return cb({ success: false, message: "Stream playlist not found" });
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

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();