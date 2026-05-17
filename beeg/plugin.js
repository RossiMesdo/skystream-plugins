(function() {
    /**
     * @type {import('@skystream/sdk').Manifest}
     */
    // manifest is injected at runtime

    // --- Constants ---
    const MAIN_URL = "https://beeg.com";
    const API_BEEG = "https://store.externulls.com";
    const HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Origin": MAIN_URL,
        "Referer": `${MAIN_URL}/`,
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7"
    };

    // --- Helpers ---
    function parseVideoItem(item) {
        if (!item || !item.file || !item.file.data || !item.file.data[0]) return null;
        
        const file = item.file;
        const firstData = file.data[0];
        const title = firstData.cd_value || "Unknown Video";
        const posterId = firstData.cd_file || file.id;
        const posterUrl = `https://thumbs.externulls.com/videos/${posterId}/49.webp?size=480x270`;
        
        return new MultimediaItem({
            title: title,
            url: JSON.stringify({ 
                type: "video", 
                id: file.id, 
                title: title, 
                poster: posterUrl,
                hls: file.hls_resources?.fl_cdn_multi 
            }),
            posterUrl: posterUrl,
            type: "movie", // Treat standalone videos as movies
            headers: HEADERS
        });
    }

    // --- Core Functions ---

    async function getHome(cb) {
        try {
            // Định nghĩa các trang danh mục như trong beeg.kt
            const categories = {
                "Main Page": `${API_BEEG}/facts/tag?id=27173&limit=48&offset=0`,
                "Wow Girls": `${API_BEEG}/facts/tag?slug=WowGirls&limit=48&offset=0`,
                "Tushy": `${API_BEEG}/facts/tag?slug=Tushy&limit=48&offset=0`,
                "Blacked": `${API_BEEG}/facts/tag?slug=Blacked&limit=48&offset=0`,
                "Vixen": `${API_BEEG}/facts/tag?slug=VixenCom&limit=48&offset=0`,
                "Japanese": `${API_BEEG}/facts/tag?slug=Japanese&limit=48&offset=0`,
                "Lesbian": `${API_BEEG}/facts/tag?slug=Lesbian&limit=48&offset=0`,
                "MILF": `${API_BEEG}/facts/tag?slug=MILF&limit=48&offset=0`,
                "Bratty Sis": `${API_BEEG}/facts/tag?slug=BrattySis&limit=48&offset=0`
            };

            const homeData = {};
            const categoryEntries = Object.entries(categories);
            
            // Tải dữ liệu các section song song
            const sectionResults = await Promise.allSettled(categoryEntries.map(async function (entry) {
                const name = entry[0];
                const url = entry[1];
                const res = await http_get(url, HEADERS);
                const itemsList = JSON.parse(res.body || "[]");
                
                const items = itemsList.map(parseVideoItem).filter(Boolean);
                return { name: name, items: items };
            }));

            sectionResults.forEach(function (result) {
                if (result.status !== "fulfilled") return;
                if (!result.value.items.length) return;
                homeData[result.value.name] = result.value.items;
            });

            if (!Object.keys(homeData).length) {
                return cb({ success: false, errorCode: "HOME_ERROR", message: "No home sections available" });
            }
            cb({ success: true, data: homeData });
        } catch (e) {
            cb({ success: false, errorCode: "HOME_ERROR", message: e.message });
        }
    }

    async function search(query, cb) {
        try {
            // Trong source kt, tính năng search hoạt động chủ yếu để tìm tên các "Actors"
            const res = await http_get(`${API_BEEG}/tag/recommends?type=person&slug=index`, HEADERS);
            const players = JSON.parse(res.body || "[]");
            
            const results = players
                .filter(p => (p.tg_name || "").toLowerCase().includes(query.toLowerCase()))
                .map(p => {
                    const thumb = p.thumbs?.[0]?.crops?.[0];
                    let poster = "";
                    if (thumb && thumb.pt_photo && thumb.id) {
                         poster = `https://thumbs.externulls.com/photos/${thumb.pt_photo}/to.webp?crop_id=${thumb.id}&size_new=112x112`;
                    }
                    return new MultimediaItem({
                        title: p.tg_name,
                        // Lưu thông tin actor để load danh sách video
                        url: JSON.stringify({ type: 'actor', slug: p.tg_slug, name: p.tg_name, poster: poster }),
                        posterUrl: poster,
                        type: "tv", // Treat actor profiles as TV shows containing episodes (videos)
                        headers: HEADERS
                    });
                });

            cb({ success: true, data: results });
        } catch (e) {
            cb({ success: false, errorCode: "SEARCH_ERROR", message: e.message });
        }
    }

    async function load(url, cb) {
        try {
            const data = JSON.parse(url);

            if (data.type === "video") {
                // Nếu URL là dữ liệu của 1 video trực tiếp (từ trang Home)
                const item = new MultimediaItem({
                    title: data.title || "Video",
                    url: url, // Đẩy nguyên cục json url này sang loadStreams
                    posterUrl: data.poster,
                    type: "movie",
                    headers: HEADERS
                });
                return cb({ success: true, data: item });

            } else if (data.type === "actor") {
                // Nếu URL là một diễn viên (từ trang Search), ta sẽ load các video của họ như list episodes
                const epsRes = await http_get(`${API_BEEG}/tag/videos/${data.slug}?limit=48&offset=0`, HEADERS);
                const videos = JSON.parse(epsRes.body || "[]");
                
                const episodes = videos.map((v, index) => {
                    const fileObj = v.file;
                    if (!fileObj) return null;
                    
                    const firstData = fileObj.data?.[0];
                    const epTitle = firstData?.cd_value || `Video ${index + 1}`;
                    const videoId = v.id || fileObj.id;
                    
                    let durationStr = "0:00";
                    if (fileObj.fl_duration) {
                        const secs = parseInt(fileObj.fl_duration);
                        durationStr = `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, '0')}`;
                    }

                    return new Episode({
                        name: epTitle,
                        url: JSON.stringify({ type: 'video', id: videoId, title: epTitle, hls: fileObj.hls_resources?.fl_cdn_multi }),
                        episode: index + 1,
                        season: 1,
                        description: `Duration: ${durationStr}`,
                        posterUrl: `https://thumbs.externulls.com/videos/${videoId}/0.webp?size=480x270`,
                        headers: HEADERS
                    });
                }).filter(Boolean);

                const item = new MultimediaItem({
                    title: data.name,
                    url: url,
                    posterUrl: data.poster,
                    type: "tv",
                    episodes: episodes,
                    headers: HEADERS
                });
                return cb({ success: true, data: item });
            }

            cb({ success: false, message: "Invalid URL data" });
        } catch (e) {
            cb({ success: false, errorCode: "LOAD_ERROR", message: e.message });
        }
    }

    async function loadStreams(url, cb) {
        try {
            const data = JSON.parse(url);
            let hlsMulti = data.hls;
            
            // Fetch thêm chi tiết nếu ban đầu object không có sẵn link HLS
            if (!hlsMulti && data.id) {
                const res = await http_get(`${API_BEEG}/facts/file/${data.id}`, HEADERS);
                const root = JSON.parse(res.body || "{}");
                
                hlsMulti = root.file?.hls_resources?.fl_cdn_multi 
                        || root.fc_facts?.[0]?.hls_resources?.fl_cdn_multi;
            }

            if (hlsMulti) {
                const stream = new StreamResult({
                    url: `https://video.beeg.com/${hlsMulti}`,
                    source: "Beeg HLS",
                    quality: 1080, // Có thể đọc trong M3U8 list
                    headers: HEADERS
                });
                cb({ success: true, data: [stream] });
            } else {
                cb({ success: false, errorCode: "STREAM_ERROR", message: "Stream not found" });
            }
        } catch (e) {
            cb({ success: false, errorCode: "STREAM_ERROR", message: e.message });
        }
    }

    // Export Global
    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();
