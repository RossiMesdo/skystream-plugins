// Beeg plugin for SkyStream
// Converted from CloudStream beeg.kt by @Kraptor123
(function() {
    /**
     * @type {import('@skystream/sdk').Manifest}
     */
    // manifest is injected at runtime

    // --- Constants ---
    const MAIN_URL = "https://beeg.com";
    const API_BASE = "https://store.externulls.com";
    const THUMB_BASE = "https://thumbs.externulls.com";
    const VIDEO_CDN = "https://video.beeg.com";

    const HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Origin": MAIN_URL,
        "Referer": MAIN_URL + "/",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9"
    };

    const CATEGORIES = [
        { name: "Wow Girls", slug: "WowGirls" },
        { name: "Bratty Sis", slug: "BrattySis" },
        { name: "Nubiles Porn", slug: "NubilesPorn" },
        { name: "Adult Time", slug: "AdultTime" },
        { name: "Ultra Films", slug: "UltraFilms" },
        { name: "Blacked", slug: "Blacked" },
        { name: "Nubile Films", slug: "NubileFilms" },
        { name: "LetsDoeIt!", slug: "LetsDoeIt" },
        { name: "Tiny 4K", slug: "Tiny4K" },
        { name: "Naughty America", slug: "NaughtyAmerica" },
        { name: "Family XXX", slug: "FamilyXXX" },
        { name: "Vixen", slug: "VixenCom" },
        { name: "New Sensations", slug: "NewSensations" },
        { name: "Pure Taboo", slug: "PureTaboo" },
        { name: "Step Siblings Caught", slug: "StepSiblingsCaught" },
        { name: "My Friend's Hot Mom", slug: "MyFriendsHotMom" },
        { name: "Dorcel Club", slug: "DorcelClub" },
        { name: "Porn Force", slug: "PornForce" },
        { name: "Moms Teach Sex", slug: "MomsTeachSex" },
        { name: "Bare Back Studios", slug: "BareBackStudios" },
        { name: "Passion HD", slug: "PassionHD" },
        { name: "My Family Pies", slug: "MyFamilyPies" },
        { name: "Hot Wife XXX", slug: "HotWifeXXX" },
        { name: "21 Naturals", slug: "21Naturals" },
        { name: "Teen Fidelity", slug: "TeenFidelity" },
        { name: "NF Busty", slug: "NFBusty" },
        { name: "Porn World", slug: "PornWorld" },
        { name: "Tushy", slug: "Tushy" },
        { name: "Anal", slug: "Anal" },
        { name: "Japanese", slug: "Japanese" },
        { name: "Big Tits", slug: "BigTits" },
        { name: "Big Ass", slug: "BigAss" },
        { name: "MILF", slug: "MILF" },
        { name: "Lesbian", slug: "Lesbian" },
        { name: "POV", slug: "POV" },
        { name: "Creampie", slug: "Creampie" },
        { name: "Blowjob", slug: "Blowjob" },
        { name: "Hardcore", slug: "Hardcore" },
        { name: "Squirting", slug: "Squirting" },
        { name: "Russian", slug: "Russian" },
        { name: "Longer Full", slug: "LongerFull" },
        { name: "Asian Girl", slug: "AsianGirl" },
        { name: "Compilation", slug: "Compilation" },
        { name: "3some", slug: "3some" },
        { name: "Stockings", slug: "Stockings" },
        { name: "Deepthroat", slug: "Deepthroat" },
        { name: "Latina", slug: "Latina" },
        { name: "Babe", slug: "Babe" },
        { name: "Cumshot", slug: "Cumshot" },
        { name: "Gangbang", slug: "Gangbang" },
        { name: "Cosplay", slug: "Cosplay" },
        { name: "Masturbation", slug: "Masturbation" },
        { name: "Cuckold", slug: "Cuckold" },
        { name: "Lingerie", slug: "Lingerie" },
        { name: "Indian", slug: "Indian" },
        { name: "Natural Tits", slug: "NaturalTits" },
        { name: "Redhead", slug: "Redhead" },
        { name: "Solo", slug: "Solo" },
        { name: "Female Orgasm", slug: "FemaleOrgasm" },
        { name: "DP", slug: "DP" },
        { name: "Schoolgirl", slug: "Schoolgirl" },
        { name: "BBC", slug: "BBC" },
        { name: "Homemade", slug: "Homemade" },
        { name: "Classic", slug: "Classic" },
        { name: "Blonde", slug: "Blonde" },
        { name: "BDSM", slug: "BDSM" },
        { name: "Skinny", slug: "Skinny" },
        { name: "Cowgirl", slug: "Cowgirl" },
        { name: "Taboo", slug: "Taboo" },
        { name: "Public", slug: "Public" },
        { name: "Interracial", slug: "Interracial" },
        { name: "Orgy", slug: "Orgy" },
        { name: "Mature Woman", slug: "MatureWoman" },
        { name: "Old Young", slug: "OldYoung" }
    ];

    // --- Helpers ---
    function videoToMultimediaItem(videoData, title, fileId) {
        // videoData: cd_file, cd_value từ Icerik; fileId: id video để tạo thumb
        const name = title || videoData.cd_value || "Unknown";
        const poster = `${THUMB_BASE}/videos/${fileId}/49.webp?size=480x270`;
        const url = JSON.stringify({ type: "video", fileId: fileId, fileData: videoData });
        return new MultimediaItem({
            title: name,
            url: url,
            posterUrl: poster,
            type: "movie", // Beeg content is mostly clips (NSFW)
            headers: HEADERS
        });
    }

    function actorToMultimediaItem(actor) {
        const name = actor.tg_name || "Unknown";
        const slug = actor.tg_slug || "";
        const url = `${MAIN_URL}/${slug}`;
        let posterUrl = "";
        try {
            const thumbs = actor.thumbs || [];
            const firstThumb = thumbs[0] || {};
            const crops = firstThumb.crops || [];
            const crop = crops[0] || {};
            if (crop.pt_photo && crop.id) {
                posterUrl = `${THUMB_BASE}/photos/${crop.pt_photo}/to.webp?crop_id=${crop.id}&size_new=112x112`;
            }
        } catch (e) {}
        return new MultimediaItem({
            title: name,
            url: url,
            posterUrl: posterUrl,
            type: "movie",
            headers: HEADERS
        });
    }

    async function fetchTagVideos(slug, limit = 48, offset = 0) {
        const url = `${API_BASE}/tag/videos/${slug}?limit=${limit}&offset=${offset}`;
        try {
            const res = await http_get(url, HEADERS);
            const body = res.body || "[]";
            return JSON.parse(body);
        } catch (e) {
            console.error("Beeg fetchTagVideos error:", e);
            return [];
        }
    }

    async function fetchActors() {
        const url = `${API_BASE}/tag/recommends?type=person&slug=index`;
        try {
            const res = await http_get(url, HEADERS);
            return JSON.parse(res.body || "[]");
        } catch (e) {
            console.error("Beeg fetchActors error:", e);
            return [];
        }
    }

    // --- Core Functions ---

    async function getHome(cb) {
        try {
            const homeData = {};
            // Lấy Actors section
            const actors = await fetchActors();
            if (actors && actors.length) {
                const actorItems = actors.slice(0, 30).map(actorToMultimediaItem).filter(Boolean);
                if (actorItems.length) homeData["Actors"] = actorItems;
            }

            // Lấy mỗi category video (chỉ lấy trang đầu tiên, limit=48)
            const categoryPromises = CATEGORIES.map(async (cat) => {
                const videos = await fetchTagVideos(cat.slug, 48, 0);
                // Mỗi video là một object có "file" chứa "data" là mảng Icerik
                const items = [];
                for (const entry of videos) {
                    const file = entry.file || {};
                    const dataArr = file.data || [];
                    const fileId = entry.id || file.id;
                    for (const vid of dataArr) {
                        if (vid.cd_value) {
                            items.push(videoToMultimediaItem(vid, vid.cd_value, fileId));
                        }
                    }
                }
                return { name: cat.name, items: items.slice(0, 48) }; // Giới hạn
            });

            const results = await Promise.allSettled(categoryPromises);
            results.forEach(res => {
                if (res.status === "fulfilled" && res.value.items.length) {
                    homeData[res.value.name] = res.value.items;
                }
            });

            if (Object.keys(homeData).length === 0) {
                return cb({ success: false, errorCode: "HOME_ERROR", message: "No sections available" });
            }
            cb({ success: true, data: homeData });
        } catch (e) {
            cb({ success: false, errorCode: "HOME_ERROR", message: e.message });
        }
    }

    async function search(query, cb) {
        try {
            const actors = await fetchActors();
            if (!actors || !actors.length) {
                return cb({ success: false, errorCode: "SEARCH_ERROR", message: "No data" });
            }
            const lowerQuery = query.toLowerCase();
            const matchedActors = actors.filter(actor => {
                const name = (actor.tg_name || "").toLowerCase();
                return name.includes(lowerQuery);
            });
            const items = matchedActors.map(actorToMultimediaItem).filter(Boolean);
            cb({ success: true, data: items });
        } catch (e) {
            cb({ success: false, errorCode: "SEARCH_ERROR", message: e.message });
        }
    }

    async function load(url, cb) {
        try {
            // Nếu url là JSON (từ video item)
            if (url.startsWith("{") && url.includes('"type":"video"')) {
                const parsed = JSON.parse(url);
                const title = parsed.fileData?.cd_value || "Video";
                const fileId = parsed.fileId;
                const poster = `${THUMB_BASE}/videos/${fileId}/49.webp?size=480x270`;
                const episode = new Episode({
                    name: title,
                    url: url,
                    posterUrl: poster,
                    description: "Beeg video",
                    headers: HEADERS
                });
                const item = new MultimediaItem({
                    title: title,
                    url: url,
                    posterUrl: poster,
                    type: "movie",
                    episodes: [episode],
                    headers: HEADERS
                });
                return cb({ success: true, data: item });
            }

            // Url là actor slug
            const slug = url.replace(MAIN_URL + "/", "").replace(/\/$/, "");
            if (!slug) return cb({ success: false, message: "Invalid URL" });

            // Lấy danh sách video của actor
            let allVideos = [];
            let offset = 0;
            while (true) {
                const batch = await fetchTagVideos(slug, 48, offset);
                if (!batch || !batch.length) break;
                allVideos = allVideos.concat(batch);
                if (batch.length < 48) break;
                offset += 48;
            }

            if (allVideos.length === 0) {
                return cb({ success: false, message: "No videos found" });
            }

            const episodes = [];
            for (const entry of allVideos) {
                const file = entry.file || {};
                const dataArr = file.data || [];
                const fileId = entry.id || file.id;
                const durationSec = parseInt(file.fl_duration || 0);
                const durationStr = `${Math.floor(durationSec / 60)}:${String(durationSec % 60).padStart(2, '0')}`;
                for (const vid of dataArr) {
                    if (!vid.cd_value) continue;
                    const epData = { type: "video", fileId: fileId, fileData: vid, fullFile: file };
                    const epUrl = JSON.stringify(epData);
                    episodes.push(new Episode({
                        name: vid.cd_value,
                        url: epUrl,
                        posterUrl: `${THUMB_BASE}/videos/${fileId}/0.webp?size=480x270`,
                        description: durationStr,
                        headers: HEADERS
                    }));
                }
            }

            const firstThumb = episodes[0]?.posterUrl;
            const title = slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

            const item = new MultimediaItem({
                title: title,
                url: url,
                posterUrl: firstThumb,
                type: "tvseries", // Coi như series để chứa nhiều tập
                episodes: episodes,
                headers: HEADERS
            });
            cb({ success: true, data: item });
        } catch (e) {
            cb({ success: false, errorCode: "LOAD_ERROR", message: e.message });
        }
    }

    async function loadStreams(url, cb) {
        try {
            const parsed = JSON.parse(url);
            const fileId = parsed.fileId;
            const fullFile = parsed.fullFile || {};
            let hlsMulti = (fullFile.hls_resources && fullFile.hls_resources.fl_cdn_multi) || null;

            // Nếu không có hls từ dữ liệu đã lưu, gọi API facts/file
            if (!hlsMulti && fileId) {
                const factUrl = `${API_BASE}/facts/file/${fileId}`;
                const res = await http_get(factUrl, HEADERS);
                const factData = JSON.parse(res.body || "{}");
                const fileObj = factData.file || (factData.fc_facts && factData.fc_facts[0]) || {};
                hlsMulti = (fileObj.hls_resources && fileObj.hls_resources.fl_cdn_multi) || null;
            }

            if (hlsMulti) {
                const streamUrl = `${VIDEO_CDN}/${hlsMulti}`;
                const stream = new StreamResult({
                    url: streamUrl,
                    source: "Beeg",
                    quality: 1080,
                    headers: { Referer: MAIN_URL + "/" },
                    type: "m3u8"
                });
                cb({ success: true, data: [stream] });
            } else {
                cb({ success: false, message: "No stream found" });
            }
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
