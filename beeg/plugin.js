(function () {

    async function getHome(cb) {
        cb({
            success: true,
            data: {
                "Test": []
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
        cb({
            success: false,
            message: "Not implemented"
        });
    }

    async function loadStreams(url, cb) {
        cb({
            success: false,
            message: "Not implemented"
        });
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;

})();
