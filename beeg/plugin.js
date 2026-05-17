(function () {

    async function getHome(cb) {

        const res = await http.get(
            "https://store.externulls.com/facts/tag?slug=Japanese&limit=10&offset=0"
        );

        const json = JSON.parse(res.body);

        const items = [];

        for (const entry of json) {

            if (!entry.file || !entry.file.data) continue;

            for (const vid of entry.file.data) {

                items.push(
                    new MultimediaItem({
                        title: vid.cd_value,
                        url: JSON.stringify(entry.file),
                        posterUrl:
                            "https://thumbs.externulls.com/videos/" +
                            vid.cd_file +
                            "/0.webp"
                    })
                );
            }
        }

        cb({
            success: true,
            data: {
                "Beeg": items
            }
        });
    }

    async function search(query, cb) {

        cb({
            success: true,
            data: []
        });
    }

    async function load(url, cb) {

        const data = JSON.parse(url);

        const title = data.data[0].cd_value;

        const item = new MultimediaItem({
            title: title,
            url: url,
            posterUrl:
                "https://thumbs.externulls.com/videos/" +
                data.data[0].cd_file +
                "/0.webp",
            episodes: [
                new Episode({
                    name: title,
                    url: url
                })
            ]
        });

        cb({
            success: true,
            data: item
        });
    }

    async function loadStreams(url, cb) {

        const data = JSON.parse(url);

        const hls = data.hls_resources.fl_cdn_multi;

        cb({
            success: true,
            data: [
                new StreamResult({
                    url: "https://video.beeg.com/" + hls,
                    quality: 720,
                    source: "Beeg"
                })
            ]
        });
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;

})();
