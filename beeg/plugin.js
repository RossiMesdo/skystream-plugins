(function () {

    const API =
        "https://store.externulls.com";

    async function getHome(cb) {

        try {

            const res = await http.get(
                API +
                "/facts/tag?slug=Japanese&limit=12&offset=0"
            );

            const json =
                JSON.parse(res.body);

            const items = [];

            for (const obj of json) {

                const file = obj.file;

                const vid =
                    file?.data?.[0];

                if (!vid) continue;

                const poster =
                    "https://thumbs.externulls.com/videos/" +
                    vid.cd_file +
                    "/49.webp?size=480x270";

                items.push(
                    new MultimediaItem({
                        title: vid.cd_value,
                        url: JSON.stringify(file),
                        posterUrl: poster
                    })
                );
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
                error: e.toString()
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

        const parsed =
            JSON.parse(url);

        const title =
            parsed?.data?.[0]?.cd_value ||
            "Beeg Video";

        const poster =
            "https://picsum.photos/300/450";

        const item =
            new MultimediaItem({
                title: title,
                url: url,
                posterUrl: poster,
                episodes: [
                    new Episode({
                        name: "Watch",
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

        try {

            const parsed =
                JSON.parse(url);

            const hls =
                parsed?.hls_resources?.fl_cdn_multi;

            if (!hls) {

                cb({
                    success: false,
                    error: "No stream"
                });

                return;
            }

            cb({
                success: true,
                data: [
                    new StreamResult({
                        url:
                            "https://video.beeg.com/" +
                            hls,
                        quality: 720,
                        source: "Beeg"
                    })
                ]
            });

        } catch (e) {

            cb({
                success: false,
                error: e.toString()
            });
        }
    }

    globalThis.getHome =
        getHome;

    globalThis.search =
        search;

    globalThis.load =
        load;

    globalThis.loadStreams =
        loadStreams;

})();
