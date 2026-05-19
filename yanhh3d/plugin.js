(function () {
    // manifest.baseUrl is injected at runtime (default: https://yanhh3d.ee)

    const HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Referer": "https://yanhh3d.ee/"
    };

    // ─── Helpers ───────────────────────────────────────────────────────────────

    function getBaseUrl() {
        return (manifest.baseUrl || "https://yanhh3d.ee").replace(/\/$/, "");
    }

    async function fetchHtml(url) {
        const res = await http_get(url, HEADERS);
        if (!res || res.status !== 200) throw new Error("HTTP " + (res ? res.status : "?") + " for " + url);
        return res.body || "";
    }

    // Regex scrape helper
    function matchAll(html, pattern) {
        const results = [];
        let m;
        const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
        while ((m = re.exec(html)) !== null) results.push(m);
        return results;
    }

    // Extract og/meta tag values
    function getMeta(html, property) {
        const m = html.match(new RegExp('<meta[^>]+(?:property|name)=["\']' + property + '["\'][^>]+content=["\']([^"\']+)["\']', "i"))
            || html.match(new RegExp('<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']' + property + '["\']', "i"));
        return m ? m[1].trim() : null;
    }

    // Parse poster from <img> with class or alt containing the title
    function getPoster(html) {
        const m = html.match(/<img[^>]+class="[^"]*wp-post-image[^"]*"[^>]+src="([^"]+)"/i)
            || html.match(/<div[^>]+class="[^"]*film-poster[^"]*"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/i)
            || html.match(/<img[^>]+src="([^"]+(?:300x450|poster)[^"]+)"/i);
        return m ? m[1] : null;
    }

    // Parse all episode links from a show page
    // Pattern: href="/genre/slug/tap-N.html"
    function parseEpisodes(html, showUrl) {
        const slugMatch = showUrl.replace(getBaseUrl(), "").match(/^\/[^/]+\/([^/]+)$/);
        const slug = slugMatch ? slugMatch[1] : null;
        if (!slug) return [];

        const pattern = /href="(https?:\/\/[^"]+\/tap-(\d+)\.html)"/gi;
        const seen = new Set();
        const eps = [];
        let m;
        while ((m = pattern.exec(html)) !== null) {
            const epUrl = m[1];
            const epNum = parseInt(m[2], 10);
            if (seen.has(epNum)) continue;
            seen.add(epNum);
            eps.push({ url: epUrl, episode: epNum });
        }
        // Sort ascending
        eps.sort((a, b) => a.episode - b.episode);
        return eps;
    }

    // Parse total episodes from text like "Tập 138/180 [4K]" or "Tập 83 [4K]"
    function parseTotalEps(text) {
        const m = (text || "").match(/(\d+)\/(\d+)/);
        return m ? parseInt(m[2], 10) : null;
    }

    // Parse status from text
    function parseStatus(html) {
        if (/Đang chiếu/i.test(html)) return "ongoing";
        if (/Hoàn thành|Đã hoàn thành/i.test(html)) return "completed";
        return undefined;
    }

    // Parse genres from links
    function parseGenres(html) {
        const genres = [];
        const pattern = /href="https?:\/\/yanhh3d\.ee\/([a-z-]+)"[^>]*>([^<]+)<\/a>/gi;
        const genreMap = {
            "tu-tien": "Tu Tiên", "kiem-hiep": "Kiếm Hiệp", "co-trang": "Cổ Trang",
            "hien-dai": "Hiện Đại", "do-thi": "Đô Thị", "trung-sinh": "Trùng Sinh",
            "hai-huoc": "Hài Hước", "tien-hiep": "Tiên Hiệp", "xuyen-khong": "Xuyên Không"
        };
        let m;
        while ((m = pattern.exec(html)) !== null) {
            const key = m[1];
            if (genreMap[key]) genres.push(genreMap[key]);
        }
        return [...new Set(genres)];
    }

    // Parse iframe src or data-src containing video embed from episode page
    function extractIframeSrc(html) {
        // Try data attribute first (lazy-loaded)
        let m = html.match(/data-src="(https?:\/\/[^"]+(?:embed|player|video|watch|iframe)[^"]*)"/i)
            || html.match(/data-lazy-src="(https?:\/\/[^"]+)"/i)
            || html.match(/<iframe[^>]+src="(https?:\/\/[^"]+)"/i);
        if (m) return m[1];
        return null;
    }

    // Try to extract m3u8 / mp4 from inline script or data-options
    function extractDirectStream(html) {
        // jwplayer setup
        let m = html.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i)
            || html.match(/file\s*:\s*["']([^"']+\.mp4[^"']*)["']/i)
            || html.match(/source\s*src=["']([^"']+\.m3u8[^"']*)["']/i)
            || html.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i)
            || html.match(/["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i);
        return m ? m[1] : null;
    }

    // Extract all server buttons info from episode page HTML
    // Buttons are rendered as something like:
    //   <button data-src="https://embed.../...">VIETSUB 1080 V1</button>
    // or links with data attributes
    function extractServers(html) {
        const servers = [];
        // Try data-src on buttons/divs
        const btnPattern = /(?:data-src|data-url|data-iframe)="([^"]+)"[^>]*>([^<]*(?:VIETSUB|Vietsub|vietsub|Thuyết minh|thuyetminh|1080|4[Kk]|V1|V2)[^<]*)</gi;
        let m;
        while ((m = btnPattern.exec(html)) !== null) {
            servers.push({ src: m[1], label: m[2].trim() });
        }
        // Also try onclick patterns
        const onclickPattern = /onclick="[^"]*['"](https?:\/\/[^'"]+)['"]/gi;
        while ((m = onclickPattern.exec(html)) !== null) {
            servers.push({ src: m[1], label: "Server" });
        }
        return servers;
    }

    // ─── Home Page Scraper ─────────────────────────────────────────────────────

    async function getHome(cb) {
        try {
            const base = getBaseUrl();
            const [mainHtml, newHtml, topHtml] = await Promise.all([
                fetchHtml(base + "/").catch(() => ""),
                fetchHtml(base + "/yanhh3d-moi-cap-nhat").catch(() => ""),
                fetchHtml(base + "/top-yanhh3d-xem-nhieu").catch(() => "")
            ]);

            const data = {};

            // Parse items from a section of HTML
            function parseItems(html) {
                const items = [];
                // Pattern: article or div with link + img + title
                const cardPattern = /<a[^>]+href="(https?:\/\/yanhh3d\.ee\/[a-z-]+\/[^/"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*>[\s\S]*?(?:<h[23][^>]*>([^<]+)<\/h[23]>|<p[^>]+class="[^"]*title[^"]*"[^>]*>([^<]+)<\/p>)/gi;
                let m;
                while ((m = cardPattern.exec(html)) !== null) {
                    const url = m[1];
                    const poster = m[2];
                    const title = (m[3] || m[4] || "").replace(/\n/g, "").trim();
                    if (!title || !url) continue;
                    // Skip non-show URLs
                    if (/\/(yanhh3d|lich-chieu|lich-su|top-|moi-cap-nhat|hoan-thanh|tu-tien$|kiem-hiep$|co-trang$|hien-dai$)/.test(url)) continue;
                    items.push(new MultimediaItem({
                        title,
                        url,
                        posterUrl: poster,
                        type: "anime"
                    }));
                }
                // Deduplicate by url
                const seen = new Set();
                return items.filter(i => { if (seen.has(i.url)) return false; seen.add(i.url); return true; });
            }

            // Extract sections from main page
            // Try to find named sections
            const sectionPattern = /<(?:h[23]|div)[^>]+class="[^"]*(?:section-title|cat-title|heading)[^"]*"[^>]*>([^<]+)<\/(?:h[23]|div)>([\s\S]*?)(?=<(?:h[23]|div)[^>]+class="[^"]*(?:section-title|cat-title|heading)[^"]*"|$)/gi;
            let sm;
            let foundSections = false;
            while ((sm = sectionPattern.exec(mainHtml)) !== null) {
                const sectionName = sm[1].trim();
                const sectionHtml = sm[2];
                const items = parseItems(sectionHtml);
                if (items.length > 0) {
                    data[sectionName] = items;
                    foundSections = true;
                }
            }

            // Fallback: parse all items from main page
            if (!foundSections) {
                const allItems = parseItems(mainHtml);
                if (allItems.length > 0) data["Trending"] = allItems.slice(0, 20);
            }

            // Mới cập nhật section
            const newItems = parseItems(newHtml);
            if (newItems.length > 0) data["Mới Cập Nhật"] = newItems.slice(0, 30);

            // Top section
            const topItems = parseItems(topHtml);
            if (topItems.length > 0) data["Top Xem Nhiều"] = topItems.slice(0, 20);

            if (!Object.keys(data).length) {
                return cb({ success: false, errorCode: "HOME_ERROR", message: "Không tìm thấy nội dung" });
            }

            cb({ success: true, data });
        } catch (e) {
            cb({ success: false, errorCode: "HOME_ERROR", message: e.message });
        }
    }

    // ─── Search ─────────────────────────────────────────────────────────────────

    async function search(query, cb) {
        try {
            const base = getBaseUrl();
            // WordPress search: /?s=query
            const searchUrl = base + "/?s=" + encodeURIComponent(query);
            const html = await fetchHtml(searchUrl);

            const items = [];
            const cardPattern = /<a[^>]+href="(https?:\/\/yanhh3d\.ee\/[a-z-]+\/[^/"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*>[\s\S]*?<(?:h[23]|p)[^>]*>([^<]+)<\/(?:h[23]|p)>/gi;
            const seen = new Set();
            let m;
            while ((m = cardPattern.exec(html)) !== null) {
                const url = m[1];
                const poster = m[2];
                const title = m[3].replace(/\n/g, "").trim();
                if (!title || !url || seen.has(url)) continue;
                if (/\/(yanhh3d|lich-|top-|moi-|hoan-|tu-tien$|kiem-|co-trang$|hien-|do-thi$|trung-|hai-|tien-hiep$|xuyen-)/.test(url)) continue;
                seen.add(url);
                items.push(new MultimediaItem({
                    title,
                    url,
                    posterUrl: poster,
                    type: "anime"
                }));
            }

            cb({ success: true, data: items });
        } catch (e) {
            cb({ success: false, errorCode: "SEARCH_ERROR", message: e.message });
        }
    }

    // ─── Load (show detail) ──────────────────────────────────────────────────────

    async function load(url, cb) {
        try {
            const html = await fetchHtml(url);

            // Title
            const title = getMeta(html, "og:title")
                || (html.match(/<h1[^>]*>([^<]+)<\/h1>/i) || [])[1]
                || "Unknown";

            // Poster
            const posterUrl = getMeta(html, "og:image") || getPoster(html);

            // Description
            const desc = getMeta(html, "og:description")
                || (html.match(/<div[^>]+class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i) || [])[1]?.replace(/<[^>]*>/g, "").trim();

            // Status
            const status = parseStatus(html);

            // Genres
            const genres = parseGenres(html);

            // Rating
            const ratingMatch = html.match(/(\d+(?:\.\d+)?)\s*\/\s*5/);
            const score = ratingMatch ? (parseFloat(ratingMatch[1]) * 2) : undefined; // convert /5 to /10

            // Parse episodes
            const epList = parseEpisodes(html, url);

            const episodes = epList.map(ep => new Episode({
                name: "Tập " + ep.episode,
                url: ep.url,
                season: 1,
                episode: ep.episode
            }));

            const item = new MultimediaItem({
                title: title.replace(/\s*\|.*$/, "").replace(/Thuyết Minh.*$/i, "").trim(),
                url,
                posterUrl,
                type: "anime",
                description: desc,
                status,
                score,
                episodes,
                headers: HEADERS
            });

            cb({ success: true, data: item });
        } catch (e) {
            cb({ success: false, errorCode: "LOAD_ERROR", message: e.message });
        }
    }

    // ─── Load Streams (episode) ───────────────────────────────────────────────

    async function loadStreams(url, cb) {
        try {
            const html = await fetchHtml(url);
            const streams = [];

            // 1. Try to find server buttons with data attributes
            const serverBtns = extractServers(html);
            if (serverBtns.length > 0) {
                await Promise.allSettled(serverBtns.map(async (btn) => {
                    if (!btn.src) return;
                    const label = btn.label || "Server";
                    // Determine quality from label
                    const quality = /4[Kk]/.test(label) ? 2160 : /1080/.test(label) ? 1080 : undefined;
                    // Fetch embed page to get actual m3u8
                    try {
                        const embedHtml = await fetchHtml(btn.src);
                        const streamUrl = extractDirectStream(embedHtml);
                        if (streamUrl) {
                            streams.push(new StreamResult({
                                url: streamUrl,
                                quality,
                                source: "YanHH3D - " + label,
                                headers: { ...HEADERS, "Referer": btn.src }
                            }));
                        } else {
                            // Maybe it's a nested iframe
                            const iframeSrc = extractIframeSrc(embedHtml);
                            if (iframeSrc) {
                                const innerHtml = await fetchHtml(iframeSrc);
                                const innerUrl = extractDirectStream(innerHtml);
                                if (innerUrl) {
                                    streams.push(new StreamResult({
                                        url: innerUrl,
                                        quality,
                                        source: "YanHH3D - " + label,
                                        headers: { ...HEADERS, "Referer": iframeSrc }
                                    }));
                                }
                            }
                        }
                    } catch (_) {}
                }));
            }

            // 2. Fallback: try to find iframe directly in episode page
            if (streams.length === 0) {
                const iframeSrc = extractIframeSrc(html);
                if (iframeSrc) {
                    try {
                        const embedHtml = await fetchHtml(iframeSrc);
                        const streamUrl = extractDirectStream(embedHtml);
                        if (streamUrl) {
                            streams.push(new StreamResult({
                                url: streamUrl,
                                source: "YanHH3D",
                                headers: { ...HEADERS, "Referer": iframeSrc }
                            }));
                        }
                    } catch (_) {}
                }
            }

            // 3. Last resort: try to find direct stream in episode page itself
            if (streams.length === 0) {
                const direct = extractDirectStream(html);
                if (direct) {
                    streams.push(new StreamResult({
                        url: direct,
                        source: "YanHH3D",
                        headers: HEADERS
                    }));
                }
            }

            if (streams.length === 0) {
                return cb({ success: false, errorCode: "NO_STREAMS", message: "Không tìm thấy stream. Trang có thể cần JavaScript." });
            }

            cb({ success: true, data: streams });
        } catch (e) {
            cb({ success: false, errorCode: "STREAM_ERROR", message: e.message });
        }
    }

    // ─── Export ───────────────────────────────────────────────────────────────
    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();
