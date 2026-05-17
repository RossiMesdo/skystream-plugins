(function() {
    /**
     * @type {import('@skystream/sdk').Manifest}
     */
    // manifest is injected at runtime

    // --- Constants ---
    const MAIN_URL = "https://missav.live";
    const HEADERS = {
        "Referer": MAIN_URL + "/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    };

    // --- Helpers ---
    function fixUrl(url) {
        if (!url) return null;
        if (url.startsWith("http")) return url;
        if (url.startsWith("//")) return "https:" + url;
        try {
            return new URL(url, MAIN_URL).toString();
        } catch (_) {
            return null;
        }
    }

    // Lấy nội dung HTML và parse thành DOM object (giả định parse_html có sẵn)
    async function fetchDocument(url) {
        const res = await http_get(url, HEADERS);
        if (res.status !== 200 || !res.body) return null;
        // parse_html trả về object có thể query kiểu cheerio: select, selectFirst, attr, text...
        // Nếu môi trường không có parse_html, ta sẽ fallback sang regex đơn giản.
        if (typeof parse_html === "function") {
            return parse_html(res.body);
        }
        // Fallback: trả về text để dùng regex
        return { text: res.body, type: "raw" };
    }

    // Parse danh sách item từ HTML (trả về mảng các đối tượng {title, url, poster})
    async function parseMainItems(doc) {
        if (doc.type === "raw") {
            // Fallback regex
            const html = doc.text;
            const items = [];
            const blockRegex = /<div[^>]*class="[^"]*thumbnail[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
            let match;
            while ((match = blockRegex.exec(html)) !== null) {
                const block = match[1];
                const linkMatch = block.match(/<a[^>]+href="([^"]*\/en\/[^"]*)"[^>]*>/i) || block.match(/<a[^>]+href="([^"]*\/dm[^"]*)"[^>]*>/i);
                if (!linkMatch) continue;
                const url = fixUrl(linkMatch[1]);
                const titleMatch = block.match(/<div[^>]*class="[^"]*my-2[^"]*"[^>]*>([\s\S]*?)<\/div>/i) || block.match(/<a[^>]*class="[^"]*text-secondary[^"]*"[^>]*>([^<]+)<\/a>/i);
                const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, "").trim() : "";
                const imgMatch = block.match(/<img[^>]+(?:data-src|src)="([^"]+)"[^>]*>/i);
                const poster = imgMatch ? fixUrl(imgMatch[1]) : null;
                if (title && url && poster) {
                    items.push({ title, url, poster });
                }
            }
            return items;
        }
        // Sử dụng parse_html object (có select, selectFirst)
        const elements = doc.select("div.grid.grid-cols-2 > div, div.thumbnail.group");
        const results = [];
        for (let i = 0; i < elements.length; i++) {
            const el = elements[i];
            const linkEl = el.selectFirst("a[href*='/en/'], a[href*='/dm']");
            if (!linkEl) continue;
            const url = fixUrl(linkEl.attr("abs:href") || linkEl.attr("href"));
            if (!url) continue;
            let title = el.selectFirst("div.my-2 a")?.text()?.trim() ||
                        el.selectFirst("div.title a")?.text()?.trim() ||
                        el.selectFirst("a.text-secondary")?.text()?.trim() ||
                        linkEl.text().trim();
            if (!title) continue;
            const blacklist = ["Recent update", "Contact", "Support", "DMCA", "Home"];
            if (blacklist.some(b => title.toLowerCase() === b.toLowerCase())) continue;
            const imgEl = el.selectFirst("img");
            const rawPoster = imgEl?.attr("data-src") || imgEl?.attr("src");
            const poster = fixUrl(rawPoster);
            if (!poster) continue;
            results.push({ title, url, poster });
        }
        return results;
    }

    // Chuyển item thành MultimediaItem
    function toMultimediaItem(item) {
        return new MultimediaItem({
            title: item.title,
            url: item.url,
            posterUrl: item.poster,
            type: "movie", // NSFW video
            headers: HEADERS
        });
    }

    // --- Core Functions ---
    async function getHome(cb) {
        try {
            const sections = [
                { name: "Weekly Hot", url: "/dm169/en/weekly-hot?sort=weekly_views" },
                { name: "Monthly Hot", url: "/dm263/en/monthly-hot?sort=views" },
                { name: "Newly Added", url: "/en/new?sort=published_at" },
                { name: "English Subtitles", url: "/en/english-subtitle" },
                { name: "Uncensored Leak", url: "/dm628/en/uncensored-leak" },
                { name: "FC2", url: "/dm150/en/fc2" },
                { name: "Madou", url: "/dm35/en/madou" },
                { name: "K-Live", url: "/en/klive" },
                { name: "C-Live", url: "/en/clive" },
                { name: "Tokyo Hot", url: "/dm29/en/tokyohot" },
                { name: "HEYZO", url: "/dm1198483/en/heyzo" },
                { name: "1pondo", url: "/dm2469695/en/1pondo" },
                { name: "Caribbeancom", url: "/dm3959622/en/caribbeancom" },
                { name: "Caribbeancom Premium", url: "/dm48032/en/caribbeancompr" },
                { name: "10musume", url: "/dm3710098/en/10musume" },
                { name: "Pacopacomama", url: "/dm1342558/en/pacopacomama" },
                { name: "Gachinco", url: "/dm136/en/gachinco" },
                { name: "XXX-AV", url: "/dm29/en/xxxav" },
                { name: "Married Slash", url: "/dm24/en/marriedslash" },
                { name: "Naughty 4610", url: "/dm20/en/naughty4610" },
                { name: "Naughty 0930", url: "/dm22/en/naughty0930" }
            ];

            const homeData = {};
            const results = await Promise.allSettled(sections.map(async (section) => {
                const doc = await fetchDocument(MAIN_URL + section.url + "?page=1");
                if (!doc) return { name: section.name, items: [] };
                const items = await parseMainItems(doc);
                return { name: section.name, items: items.map(toMultimediaItem).filter(Boolean) };
            }));

            results.forEach(result => {
                if (result.status === "fulfilled" && result.value.items.length > 0) {
                    homeData[result.value.name] = result.value.items;
                }
            });

            if (Object.keys(homeData).length === 0) {
                return cb({ success: false, errorCode: "HOME_ERROR", message: "No home sections available" });
            }
            cb({ success: true, data: homeData });
        } catch (e) {
            cb({ success: false, errorCode: "HOME_ERROR", message: e.message });
        }
    }

    async function search(query, cb) {
        try {
            const url = MAIN_URL + "/en/search/" + encodeURIComponent(query) + "?page=1";
            const doc = await fetchDocument(url);
            if (!doc) return cb({ success: false, errorCode: "SEARCH_ERROR", message: "Failed to fetch search" });
            const items = await parseMainItems(doc);
            cb({ success: true, data: items.map(toMultimediaItem).filter(Boolean) });
        } catch (e) {
            cb({ success: false, errorCode: "SEARCH_ERROR", message: e.message });
        }
    }

    async function load(url, cb) {
        try {
            const doc = await fetchDocument(url);
            if (!doc) return cb({ success: false, errorCode: "LOAD_ERROR", message: "Failed to fetch detail" });
            let title, poster, year, tags = [], actors = [];

            if (doc.type === "raw") {
                const text = doc.text;
                const titleMatch = text.match(/<h1[^>]*class="[^"]*text-base[^"]*"[^>]*>([^<]+)<\/h1>/i);
                title = titleMatch ? titleMatch[1].trim() : null;
                const posterMatch = text.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i);
                poster = posterMatch ? fixUrl(posterMatch[1]) : null;
                const timeMatch = text.match(/<time[^>]*>([^<]+)<\/time>/i);
                if (timeMatch) {
                    const dateStr = timeMatch[1].split("-")[0];
                    year = parseInt(dateStr) || undefined;
                }
                const genreRegex = /<div[^>]*text-secondary[^>]*>[^<]*genre[^<]*<\/div>[\s\S]*?<a[^>]*>([^<]+)<\/a>/gi;
                let m;
                while ((m = genreRegex.exec(text)) !== null) tags.push(m[1].trim());
                const actressRegex = /<div[^>]*text-secondary[^>]*>[^<]*actress[^<]*<\/div>[\s\S]*?<a[^>]*>([^<]+)<\/a>/gi;
                while ((m = actressRegex.exec(text)) !== null) actors.push(new Actor({ name: m[1].trim() }));
            } else {
                title = doc.selectFirst("h1.text-base")?.text()?.trim();
                if (!title) return cb({ success: false, errorCode: "LOAD_ERROR", message: "Title not found" });
                poster = fixUrl(doc.selectFirst("meta[property='og:image']")?.attr("content"));
                const timeEl = doc.selectFirst("time");
                if (timeEl) {
                    const dateStr = timeEl.text().split("-")[0];
                    year = parseInt(dateStr) || undefined;
                }
                const genreEls = doc.select("div.text-secondary:contains(genre) a");
                genreEls.forEach(el => tags.push(el.text().trim()));
                const actressEls = doc.select("div.text-secondary:contains(actress) a");
                actressEls.forEach(el => actors.push(new Actor({ name: el.text().trim() })));
            }

            if (!title) return cb({ success: false, errorCode: "LOAD_ERROR", message: "Title not found" });

            const result = new MultimediaItem({
                title: title,
                url: url,
                posterUrl: poster,
                type: "movie",
                year: year,
                tags: tags,
                cast: actors,
                description: "",
                headers: HEADERS
            });

            cb({ success: true, data: result });
        } catch (e) {
            cb({ success: false, errorCode: "LOAD_ERROR", message: e.message });
        }
    }

    async function loadStreams(url, cb) {
        try {
            // url ở đây chính là link chi tiết của phim
            const res = await http_get(url, HEADERS);
            if (res.status !== 200 || !res.body) {
                return cb({ success: false, errorCode: "STREAM_ERROR", message: "Failed to fetch page" });
            }
            const html = res.body;
            // Tìm playlist ID trực tiếp trong source, tránh unpack eval
            const match = html.match(/surrit\.com\/([a-f0-9\-]{36})\/playlist\.m3u8/i);
            if (!match) {
                // Thử unpack script nếu cần (có thể dùng regex lấy chuỗi)
                // Trong file Kotlin họ dùng getAndUnpack, nhưng ta không có sẵn.
                // Dự phòng: tìm chuỗi 36 ký tự hex/'-' trong thẻ script
                const scriptRegex = /([a-f0-9\-]{36})\/playlist\.m3u8/i;
                const altMatch = html.match(scriptRegex);
                if (!altMatch) {
                    return cb({ success: false, errorCode: "STREAM_ERROR", message: "Playlist not found" });
                }
                var playlistId = altMatch[1];
            } else {
                var playlistId = match[1];
            }
            const streamUrl = `https://surrit.com/${playlistId}/playlist.m3u8`;
            const streamResult = new StreamResult({
                url: streamUrl,
                source: "MissAV",
                quality: 1080,
                headers: { ...HEADERS, "Referer": MAIN_URL + "/" }
            });
            cb({ success: true, data: [streamResult] });
        } catch (e) {
            cb({ success: false, errorCode: "STREAM_ERROR", message: e.message });
        }
    }

    // --- Export ---
    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();