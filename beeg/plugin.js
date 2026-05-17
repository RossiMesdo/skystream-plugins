(function () {

    async function getHome(cb) {

        try {

            const item = new MultimediaItem({
                title: "Test Video",
                url: "test_video",
                posterUrl: "https://picsum.photos/300/450",
                description: "Plugin test"
            });

            cb({
                success: true,
                data: [
                    {
                        title: "Featured",
                        data: [item]
                    }
                ]
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
                title: query,
                url: "search_test",
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
                title: "Test Video",
                url: url,
                posterUrl: "https://picsum.photos/300/450",
                description: "Working plugin test",
                episodes: [
                    new Episode({
                        name: "Episode 1",
                        url: "stream_1"
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
                        url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
                        quality: 720,
                        source: "Test Stream"
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
