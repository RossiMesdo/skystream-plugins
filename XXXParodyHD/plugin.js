(function() {
    /**
     * @type {import('@skystream/sdk').Manifest}
     */
    // manifest is injected at runtime

    // ========== JsoupLite (HTML Parser) ==========
    class JNode {
        constructor(tag = null, attrs = {}, parent = null) {
            this.tag = tag;
            this.attrs = attrs;
            this.parent = parent;
            this.children = [];
            this.text = "";
        }
        attr(name) { return this.attrs[name] || ""; }
        textContent() {
            if (!this.tag) return this.text;
            let t = "";
            for (const c of this.children) t += c.textContent();
            return t;
        }
        html() { return this.children.map(c => c.outerHTML()).join(""); }
        outerHTML() {
            if (!this.tag) return this.text;
            const attrs = Object.entries(this.attrs).map(([k, v]) => ` ${k}="${v}"`).join("");
            return `<${this.tag}${attrs}>${this.html()}</${this.tag}>`;
        }
        matches(selector) {
            if (!this.tag) return false;
            if (selector.includes(".")) {
                const parts = selector.split(".");
                const t = parts[0];
                const c = parts[1];
                const tagMatch = !t || this.tag === t.toLowerCase();
                const classMatch = (this.attrs.class || "").split(/\s+/).includes(c);
                return tagMatch && classMatch;
            }
            if (selector.startsWith("#")) return this.attrs.id === selector.slice(1);
            return this.tag === selector.toLowerCase();
        }
        selectFirst(selector) {
            for (const c of this.children) {
                if (c.matches(selector)) return c;
                const r = c.selectFirst(selector);
                if (r) return r;
            }
            return null;
        }
        find(selector) { return this.selectFirst(selector); }
        select(selector, out = []) {
            for (const c of this.children) {
                if (c.matches(selector)) out.push(c);
                c.select(selector, out);
            }
            return out;
        }
    }

    class JsoupLite {
        constructor(html) {
            this.root = new JNode("root");
            let current = this.root;
            const re = /<\/?[a-z0-9]+(?:\s+[a-z0-9-]+(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?)*\s*\/?>|[^<]+/gi;
            let m;
            while ((m = re.exec(html))) {
                const token = m[0];
                if (token.startsWith("</")) {
                    if (current.parent) current = current.parent;
                    continue;
                }
                if (token.startsWith("<")) {
                    const tagNameMatch = token.match(/^<([a-z0-9]+)/i);
                    const tag = tagNameMatch ? tagNameMatch[1].toLowerCase() : "unknown";
                    const selfClosing = token.endsWith("/>") || /^(?:img|br|hr|input|meta|link)$/i.test(tag);
                    
                    const attrs = {};
                    const attrRe = /([a-z0-9-]+)=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
                    let am;
                    while ((am = attrRe.exec(token))) {
                        attrs[am[1].toLowerCase()] = am[2] || am[3] || am[4];
                    }
                    
                    const node = new JNode(tag, attrs, current);
                    current.children.push(node);
                    if (!selfClosing) {
                        current = node;
                        if (tag === "script" || tag === "style") {
                            const endTag = `</${tag}>`;
                            const endIndex = html.indexOf(endTag, re.lastIndex);
                            if (endIndex !== -1) {
                                const content = html.substring(re.lastIndex, endIndex);
                                const t = new JNode(null, {}, current);
                                t.text = content;
                                current.children.push(t);
                                re.lastIndex = endIndex + endTag.length;
                                current = current.parent;
                            }
                        }
                    }
                    continue;
                }
                const text = token.trim();
                if (text) {
                    const t = new JNode(null, {}, current);
                    t.text = text;
                    current.children.push(t);
                }
            }
        }
        find(selector) { return this.root.find(selector); }
        select(selector) { return this.root.select(selector); }
    }

    // ========== HELPERS ==========
    const CommonHeaders = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36" };

    function fixUrl(url) {
        if (!url) return "";
        if (url.startsWith("//")) return "https:" + url;
        if (url.startsWith("/")) return manifest.baseUrl + url;
        return url;
    }

    function parseItems(html) {
        const doc = new JsoupLite(html);
        const items = [];
        doc.select("div.movies-list div.ml-item").forEach(card => {
            const titleEl = card.find("h2");
            if (!titleEl) return;
            const title = titleEl.textContent().trim();
            const a = card.find("a");
            const href = a ? fixUrl(a.attr("href")) : "";
            if (!href) return;
            const img = card.find("img");
            const poster = img ? fixUrl(img.attr("src")) : "";
            items.push(new MultimediaItem({
                title: title,
                url: href,
                posterUrl: poster,
                type: "movie",
                isAdult: true
            }));
        });
        return items;
    }

    // ========== CATEGORIES ==========
    const categories = [
        { name: "Movies", url: "/movies/" },
        { name: "18+ Teens", url: "/genre/free-18-teens/" },
        { name: "All Girl", url: "/genre/free-all-girl/" },
        { name: "All Sex", url: "/genre/free-all-sex/" },
        { name: "Amateurs", url: "/genre/free-amateurs/" },
        { name: "Anal", url: "/genre/free-anal/" },
        { name: "Anal Creampie", url: "/genre/free-anal-creampie/" },
        { name: "Animation", url: "/genre/free-animation/" },
        { name: "Asian", url: "/genre/free-asian/" },
        { name: "Ass to Mouth", url: "/genre/free-ass-to-mouth/" },
        { name: "Babysitter", url: "/genre/free-babysitter/" },
        { name: "BDSM", url: "/genre/free-bdsm/" },
        { name: "Beach", url: "/genre/free-beach/" },
        { name: "Big Boobs", url: "/genre/free-big-boobs/" },
        { name: "Big Butt", url: "/genre/free-big-butt/" },
        { name: "Big Cocks", url: "/genre/free-big-cocks/" },
        { name: "Blondes", url: "/genre/free-blondes/" },
        { name: "Blowjobs", url: "/genre/free-blowjobs/" },
        { name: "Brazilian", url: "/genre/free-brazilian/" },
        { name: "Cheerleaders", url: "/genre/free-cheerleaders/" },
        { name: "College", url: "/genre/free-college/" },
        { name: "Cougars", url: "/genre/free-cougars/" },
        { name: "Couples", url: "/genre/free-couples/" },
        { name: "Creampie", url: "/genre/free-creampie/" },
        { name: "Cumshots", url: "/genre/free-cumshots/" },
        { name: "Czech", url: "/genre/free-czech/" },
        { name: "Deep Throat", url: "/genre/free-deep-throat/" },
        { name: "Erotica", url: "/genre/free-erotica/" },
        { name: "European", url: "/genre/free-european/" },
        { name: "Facesitting", url: "/genre/free-facesitting/" },
        { name: "Facials", url: "/genre/free-facials/" },
        { name: "Family Roleplay", url: "/genre/free-family-roleplay/" },
        { name: "Fantasy", url: "/genre/free-fantasy/" },
        { name: "Feature", url: "/genre/free-feature/" },
        { name: "Fetish", url: "/genre/free-fetish/" },
        { name: "Fingering", url: "/genre/free-fingering/" },
        { name: "Gangbang", url: "/genre/free-gangbang/" },
        { name: "German", url: "/genre/free-german/" },
        { name: "Hairy", url: "/genre/free-hairy/" },
        { name: "Handjobs", url: "/genre/free-handjobs/" },
        { name: "Hardcore", url: "/genre/free-hardcore/" },
        { name: "Hentai", url: "/genre/free-hentai/" },
        { name: "Italian", url: "/genre/free-italian/" },
        { name: "Japanese", url: "/genre/free-japanese/" },
        { name: "Latin", url: "/genre/free-latin/" },
        { name: "Lesbian", url: "/genre/free-lesbian/" },
        { name: "Lingerie", url: "/genre/free-lingerie/" },
        { name: "Massage", url: "/genre/free-massage/" },
        { name: "Masturbation", url: "/genre/free-masturbation/" },
        { name: "Mature", url: "/genre/free-mature/" },
        { name: "MILF", url: "/genre/free-milf/" },
        { name: "Mystery", url: "/genre/free-mystery/" },
        { name: "Oiled", url: "/genre/free-oiled/" },
        { name: "Outdoors", url: "/genre/free-outdoors/" },
        { name: "Parody", url: "/genre/free-parody/" },
        { name: "POV", url: "/genre/free-pov/" },
        { name: "Public Sex", url: "/genre/free-public-sex/" },
        { name: "Small Tits", url: "/genre/free-small-tits/" },
        { name: "Squirting", url: "/genre/free-squirting/" },
        { name: "Stockings", url: "/genre/free-stockings/" },
        { name: "Tattoos", url: "/genre/free-tattoos/" },
        { name: "Threesomes", url: "/genre/free-threesomes/" },
        { name: "Virgin", url: "/genre/free-virgin/" }
    ];

    // ========== CORE FUNCTIONS ==========

    async function getHome(cb) {
        try {
            const results = {};
            // Fetch first page of each category (limit 20 items per category to keep it fast)
            const fetchPromises = categories.map(async (cat) => {
                const url = `${manifest.baseUrl}${cat.url}`;
                try {
                    const res = await http_get(url, CommonHeaders);
                    if (res && res.body) {
                        const items = parseItems(res.body).slice(0, 20);
                        if (items.length > 0) {
                            results[cat.name] = items;
                        }
                    }
                } catch (e) {
                    console.error(`Error fetching ${cat.name}:`, e);
                }
            });

            await Promise.all(fetchPromises);

            if (Object.keys(results).length === 0) {
                return cb({ success: false, errorCode: "HOME_ERROR", message: "No categories loaded" });
            }
            cb({ success: true, data: results });
        } catch (e) {
            cb({ success: false, errorCode: "HOME_ERROR", message: e.message });
        }
    }

    async function search(query, cb) {
        try {
            const url = `${manifest.baseUrl}/search/${encodeURIComponent(query)}/`;
            const res = await http_get(url, CommonHeaders);
            if (!res || !res.body) return cb({ success: false, errorCode: "SEARCH_ERROR", message: "No response" });
            const items = parseItems(res.body);
            cb({ success: true, data: items });
        } catch (e) {
            cb({ success: false, errorCode: "SEARCH_ERROR", message: e.message });
        }
    }

    async function load(url, cb) {
        try {
            const res = await http_get(url, CommonHeaders);
            if (!res || !res.body) return cb({ success: false, errorCode: "LOAD_ERROR", message: "Failed to load details" });
            const doc = new JsoupLite(res.body);

            // Title
            const titleEl = doc.find("div.mvic-desc h3");
            if (!titleEl) return cb({ success: false, message: "Title not found" });
            const title = titleEl.textContent().trim();

            // Poster
            const imgEl = doc.find("div.thumb img");
            const poster = imgEl ? fixUrl(imgEl.attr("src")) : null;

            // Description
            const descEl = doc.find("div.mvic-desc div.desc p");
            const description = descEl ? descEl.textContent().trim() : "";

            // Year
            const yearEl = doc.select("div.mvic-desc div.mvici-left p").find(el => {
                const strong = el.find("strong");
                return strong && /Released Date:/i.test(strong.textContent());
            });
            let year = null;
            if (yearEl) {
                const strong = yearEl.find("strong");
                let text = yearEl.textContent();
                if (strong) text = text.replace(strong.textContent(), "").trim();
                // extract year after comma
                const match = text.match(/,?\s*(\d{4})/);
                if (match) year = parseInt(match[1], 10);
            }

            // Tags (Genres)
            const tagsEl = doc.select("div.mvici-left p").find(el => {
                const strong = el.find("strong");
                return strong && /Genres:/i.test(strong.textContent());
            });
            const tags = tagsEl ? tagsEl.select("span a").map(a => a.textContent().trim()).filter(Boolean) : [];

            // Duration
            const durEl = doc.select("p").find(el => {
                const strong = el.find("strong");
                return strong && /Duration/i.test(strong.textContent());
            });
            let duration = null;
            if (durEl) {
                const match = durEl.textContent().match(/(\d+)\s*mins/);
                if (match) duration = parseInt(match[1], 10);
            }

            // Actors (Pornstars)
            const actorsEl = doc.select("div.mvici-left p").find(el => {
                const strong = el.find("strong");
                return strong && /Pornstars:/i.test(strong.textContent());
            });
            const actors = actorsEl
                ? actorsEl.select("span a").map(a => new Actor({ name: a.textContent().trim() }))
                : [];

            // Recommendations
            const recItems = doc.select("div.movies-list div.ml-item").map(item => {
                const h2 = item.find("h2");
                if (!h2) return null;
                const recTitle = h2.textContent().trim();
                const a = item.find("a");
                const recHref = a ? fixUrl(a.attr("href")) : null;
                const recImg = item.find("img");
                const recPoster = recImg ? fixUrl(recImg.attr("src")) : null;
                if (!recHref) return null;
                return new MultimediaItem({
                    title: recTitle,
                    url: recHref,
                    posterUrl: recPoster,
                    type: "movie",
                    isAdult: true
                });
            }).filter(Boolean);

            const mediaItem = new MultimediaItem({
                title: title,
                url: url,
                posterUrl: poster,
                description: description,
                year: year || undefined,
                tags: tags.length > 0 ? tags : undefined,
                duration: duration || undefined,
                cast: actors.length > 0 ? actors : undefined,
                recommendations: recItems.length > 0 ? recItems : undefined,
                type: "movie",
                isAdult: true
            });

            cb({ success: true, data: mediaItem });
        } catch (e) {
            cb({ success: false, errorCode: "LOAD_ERROR", message: e.message });
        }
    }

    async function loadStreams(dataUrl, cb) {
        try {
            const res = await http_get(dataUrl, CommonHeaders);
            if (!res || !res.body) return cb({ success: false, errorCode: "STREAM_ERROR", message: "Page not loaded" });
            const doc = new JsoupLite(res.body);

            // Find iframe links with id="#iframe"
            const iframeAnchors = doc.select("div.Rtable1 a").filter(a => a.attr("id") === "#iframe");
            if (iframeAnchors.length === 0) return cb({ success: true, data: [] });

            const streamPromises = iframeAnchors.map(async (a) => {
                const videoUrl = fixUrl(a.attr("href"));
                if (!videoUrl) return [];

                // Try using built-in extractor if available
                try {
                    if (typeof globalThis.loadExtractor === "function") {
                        return new Promise(resolve => {
                            globalThis.loadExtractor(videoUrl, (streams) => {
                                resolve(Array.isArray(streams) ? streams : []);
                            });
                        });
                    }
                } catch (e) {
                    console.error("Built-in extractor failed:", e);
                }

                // Fallback: return as raw stream (HLS/MP4 maybe directly)
                return [new StreamResult({
                    url: videoUrl,
                    source: "XXXParodyHD",
                    headers: CommonHeaders
                })];
            });

            const results = (await Promise.all(streamPromises)).flat();
            // Deduplicate by URL
            const seen = new Set();
            const deduped = results.filter(stream => {
                const key = stream.url;
                if (!key || seen.has(key)) return false;
                seen.add(key);
                return true;
            });

            cb({ success: true, data: deduped });
        } catch (e) {
            cb({ success: false, errorCode: "STREAM_ERROR", message: e.message });
        }
    }

    // Exports
    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();