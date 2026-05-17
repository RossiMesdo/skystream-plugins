(function () {

    async function getHome(cb) {

        try {

            const item = new MultimediaItem({
                title: "Beeg Test",
                url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
                posterUrl: "https://picsum.photos/300/450"
            });

            cb({
                success: true,
                data: {
                    "Featured": [item]
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

            const item = new MultimediaItem({
                title: query || "Search Test",
                url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
                posterUrl: "https://picsum.photos/300/450"
            });

            cb({
                success: true,
                data: [item]
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

            const item = new MultimediaItem({
                title: "Beeg Test",
                url: url,
                posterUrl: "https://picsum.photos/300/450",
                episodes: [
                    new Episode({
                        name: "Video",
                        url: url
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
