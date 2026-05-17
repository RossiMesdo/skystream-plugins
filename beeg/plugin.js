(function () {

    const BASE_URL = "https://store.externulls.com";

    async function getHome(cb) {

        try {

            const res = await http_get(BASE_URL + "/api/video/random");

            const data = JSON.parse(res.body);

            const items = [];

            for (const vid of data.data.slice(0, 20)) {

                items.push(new MultimediaItem({
                    title: vid.title || "No title",
                    url: String(vid.id),
                    posterUrl: vid.preview_url || vid.thumbnail || ""
                }));
            }

            cb({
                success: true,
                data: {
                    "Featured": items
                }
            });

        } catch (e) {

            cb({
                success: false,
                errorCode: "HOME_ERROR",
                message: e.toString()
            });
        }
    }

    async function search(query, cb) {

        try {

            const res = await http_get(
                BASE_URL + "/api/video/search/" + encodeURIComponent(query)
            );

            const data = JSON.parse(res.body);

            const items = [];

            for (const vid of data.data) {

                items.push(new MultimediaItem({
                    title: vid.title || "No title",
                    url: String(vid.id),
                    posterUrl: vid.preview_url || vid.thumbnail || ""
                }));
            }

            cb({
                success: true,
                data: items
            });

        } catch (e) {

            cb({
                success: false,
                errorCode: "SEARCH_ERROR",
                message: e.toString()
            });
        }
    }

    async function load(url, cb) {

        try {

            const res = await http_get(BASE_URL + "/api/video/" + url);

            const vid = JSON.parse(res.body).data;

            const item = new MultimediaItem({
                title: vid.title || "No title",
                url: url,
                description: vid.description || "",
                posterUrl: vid.preview_url || vid.thumbnail || "",
                episodes: [
                    new Episode({
                        name: "Video",
                        url: vid.hls_resources?.["fl_cdn_720"] ||
                             vid.hls_resources?.["fl_cdn_480"] ||
                             vid.file
                    })
                ]
            });

            cb({
                success: true,
                data: item
            });

        } catch (e) {

            cb({
                success: false,
                errorCode: "LOAD_ERROR",
                message: e.toString()
            });
        }
    }

    async function loadStreams(url, cb) {

        try {

            cb({
                success: true,
                data: [
                    new StreamResult({
                        url: url,
                        quality: 720,
                        source: "Beeg"
                    })
                ]
            });

        } catch (e) {

            cb({
                success: false,
                errorCode: "STREAM_ERROR",
                message: e.toString()
            });
        }
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;

})();
