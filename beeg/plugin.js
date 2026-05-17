(function () {

    async function getHome(cb) {

        const item = new MultimediaItem({
            title: "Test Video",
            url: "test",
            posterUrl: "https://picsum.photos/300/450"
        });

        cb({
            success: true,
            data: {
                "Featured": [item]
            }
        });
    }

    async function search(query, cb) {

        const item = new MultimediaItem({
            title: query,
            url: "test",
            posterUrl: "https://picsum.photos/300/450"
        });

        cb({
            success: true,
            data: [item]
        });
    }

    async function load(url, cb) {

        const item = new MultimediaItem({
            title: "Test Video",
            url: url,
            description: "This is a test item",
            posterUrl: "https://picsum.photos/300/450",
            episodes: [
                new Episode({
                    name: "Episode 1",
                    url: "stream1"
                })
            ]
        });

        cb({
            success: true,
            data: item
        });
    }

    async function loadStreams(url, cb) {

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
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;

})();
