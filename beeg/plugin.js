const BASE = "https://store.externulls.com";

async function request(url) {
    const res = await fetch(url, {
        headers: {
            "Referer": "https://beeg.com/",
            "Origin": "https://beeg.com",
            "User-Agent": "Mozilla/5.0"
        }
    });

    return await res.json();
}

async function getHome(cb) {
    try {
        const data = await request(
            `${BASE}/facts/tag?slug=Japanese&limit=20&offset=0`
        );

        const items = [];

        for (const item of data) {
            const vid = item.file?.data?.[0];

            if (!vid) continue;

            items.push({
                title: vid.cd_value,
                url: JSON.stringify(item.file),
                poster: `https://thumbs.externulls.com/videos/${vid.cd_file}/49.webp?size=480x270`
            });
        }

        cb({
            success: true,
            data: {
                "Japanese": items
            }
        });

    } catch (e) {
        cb({
            success: false,
            message: e.toString()
        });
    }
}

async function search(query, cb) {
    cb({
        success: true,
        data: []
    });
}

async function load(url, cb) {
    cb({
        success: true,
        data: {
            title: "Beeg Video",
            streams: [url]
        }
    });
}

async function loadStreams(data, cb) {
    try {
        const parsed = JSON.parse(data);

        const hls = parsed.hls_resources?.fl_cdn_multi;

        if (!hls) {
            cb({
                success: false,
                message: "No stream"
            });
            return;
        }

        cb({
            success: true,
            data: [
                {
                    url: `https://video.beeg.com/${hls}`,
                    quality: "HD"
                }
            ]
        });

    } catch (e) {
        cb({
            success: false,
            message: e.toString()
        });
    }
}

globalThis.getHome = getHome;
globalThis.search = search;
globalThis.load = load;
globalThis.loadStreams = loadStreams;
