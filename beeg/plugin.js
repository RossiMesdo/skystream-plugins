(function () {

    async function getHome(cb) {

        try {

            const res = await http.get(
                "https://store.externulls.com/facts/tag?slug=Japanese&limit=5&offset=0"
            );

            cb({
                success: true,
                data: {
                    "DEBUG": [
                        new MultimediaItem({
                            title: String(res),
                            url: "test",
                            posterUrl: "https://picsum.photos/300/450"
                        })
                    ]
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
        cb({ success: true, data: [] });
    }

    async function load(url, cb) {

        cb({
            success: true,
            data: new MultimediaItem({
                title: "Test",
                url: url,
                episodes: [
                    new Episode({
                        name: "Play",
                        url: "play"
                    })
                ]
            })
        });
    }

    async function loadStreams(url, cb) {

        cb({
            success: true,
            data: [
                new StreamResult({
                    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
                    quality: 720,
                    source: "Test"
                })
            ]
        });
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;

})();
