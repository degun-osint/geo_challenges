var _geolocMap = null;
var _geolocMarker = null;
var _geolocRadiusCircle = null;
var _fullscreenHandler = null;

// Compatibility shim — some themes expose CTFd but not CTFd.plugin.run()
if (window.CTFd && !window.CTFd.plugin) {
    window.CTFd.plugin = {
        run: function (f) { f(window.CTFd); }
    };
}

CTFd.plugin.run((_CTFd) => {
    const $ = _CTFd.lib.$;
    const dayjs = window.dayjs;

    // Extend the Alpine Challenge component with a submission history tab.
    document.addEventListener("alpine:init", () => {
        Alpine.data("Challenge", () => ({
            ...Alpine.data("Challenge")(),
            async showSubmissions() {
                try {
                    const resp = await CTFd.pages.users.userSubmissions("me", this.id);
                    this.submissions = (resp.data || []).map((s) => ({
                        ...s,
                        date: dayjs ? dayjs(s.date).format("MMM D, h:mm A") : s.date,
                    }));
                } catch (e) {
                    console.error("[GeoLoc] Failed to load submissions:", e);
                    this.submissions = [];
                }
            },
        }));
    });

    // Tolerance circle state — kept at this scope so pinLocation() can update it.
    let _tolCircle = null, _tolEnabled = false, _tolRadius = 0;

    // Returns the challenge ID from whichever hidden input is present.
    // Standard challenge.html uses #challenge-id; full-page contexts use #geoloc-challenge-id.
    function _getChallengeId() {
        return parseInt(
            (document.getElementById("challenge-id") ||
             document.getElementById("geoloc-challenge-id"))?.value || 0
        );
    }

    function teardownMap() {
        if (_fullscreenHandler) {
            document.removeEventListener("fullscreenchange", _fullscreenHandler);
            _fullscreenHandler = null;
        }
        if (_geolocMap) {
            try { _geolocMap.remove(); } catch (_) {}
            _geolocMap = null;
            _geolocMarker = null;
            _geolocRadiusCircle = null;
        }
        _tolCircle = null;
        _tolEnabled = false;
        $("#player-lat, #player-lon").val("");
        $("#geoloc-disp-lat, #geoloc-disp-lon").text("—");
        const extBanner = document.getElementById("geoloc-tol-banner");
        if (extBanner) extBanner.style.display = "none";
    }

    // defaultLayer: key from settings API ("osm" | "esri" | "google_street" | "google_hybrid")
    // tolRadius: acceptance radius in metres, pre-fetched by bootChallenge
    function buildMap(defaultLayer, tolRadius) {
        _tolRadius = tolRadius || 50;

        return new Promise((resolve, reject) => {
            const el = document.getElementById("geoloc-player-map");
            if (!el) return reject("Map container not found");

            el.innerHTML = "";
            el.style.height = "420px";

            try {
                _geolocMap = L.map("geoloc-player-map", {
                    center: [20, 0],
                    zoom: 2,
                    zoomControl: false,
                });
                L.control.zoom({ position: "bottomleft" }).addTo(_geolocMap);

                const osmLayer = L.tileLayer(
                    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
                    { maxZoom: 19, attribution: "© OpenStreetMap contributors" }
                );
                const esriSat = L.tileLayer(
                    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
                    { maxZoom: 19, attribution: "Tiles © Esri" }
                );
                const gStreet = L.tileLayer(
                    "https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
                    { maxZoom: 20, subdomains: ["0","1","2","3"], attribution: "© Google" }
                );
                const gHybrid = L.tileLayer(
                    "https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
                    { maxZoom: 20, subdomains: ["0","1","2","3"], attribution: "© Google" }
                );

                // Apply the admin-configured default layer.
                const _layerMap = { osm: osmLayer, esri: esriSat, google_street: gStreet, google_hybrid: gHybrid };
                (_layerMap[defaultLayer] || gHybrid).addTo(_geolocMap);

                L.control.layers({
                    "🗺️ OpenStreetMap":    osmLayer,
                    "🛰️ Satellite (Esri)": esriSat,
                    "🗺️ Google Street":    gStreet,
                    "🛰️ Google Hybrid":    gHybrid,
                }, {}, { position: "topright" }).addTo(_geolocMap);

                // Geocoder — collapsed on mobile to avoid covering the layer selector.
                const isMobile = window.innerWidth < 576;
                const geocoder = L.Control.geocoder({
                    defaultMarkGeocode: false,
                    placeholder: window.GeoLocI18n ? window.GeoLocI18n.t("search_placeholder") : "Search a location…",
                    collapsed: isMobile,
                    position: "topleft",
                    suggestMinLength: 2,
                    suggestTimeout: 300,
                }).addTo(_geolocMap);

                setTimeout(() => {
                    const geocoderEl = geocoder.getContainer();
                    if (geocoderEl && geocoderEl.parentNode) {
                        const wrap = document.createElement("div");
                        if (isMobile) {
                            // Top-left, next to the fullscreen button; leaves layer selector free.
                            wrap.style.cssText = "position:absolute;top:10px;left:46px;z-index:1000;pointer-events:auto;max-width:calc(100% - 100px);";
                        } else {
                            wrap.style.cssText = "position:absolute;top:10px;left:50%;transform:translateX(-50%);z-index:1000;pointer-events:auto;max-width:calc(100% - 120px);";
                        }
                        geocoderEl.parentNode.removeChild(geocoderEl);
                        wrap.appendChild(geocoderEl);
                        _geolocMap.getContainer().appendChild(wrap);
                    }
                }, 0);

                geocoder.on("markgeocode", (e) => {
                    const { lat, lng } = e.geocode.center;
                    pinLocation(lat, lng);
                    _geolocMap.fitBounds(e.geocode.bbox);
                });

                const FullscreenCtrl = L.Control.extend({
                    options: { position: "topleft" },
                    onAdd(m) {
                        const div = L.DomUtil.create("div", "leaflet-bar");
                        const btn = L.DomUtil.create("a", "", div);
                        btn.href = "#";
                        btn.title = window.GeoLocI18n ? window.GeoLocI18n.t("fullscreen") : "Fullscreen";
                        btn.innerHTML = '<i class="fas fa-expand" style="font-size:13px;line-height:26px;padding:0 4px;"></i>';
                        btn.style.cssText = "width:26px;height:26px;display:flex;align-items:center;justify-content:center;color:#666;text-decoration:none;font-style:normal;";
                        L.DomEvent.on(btn, "click", function (e) {
                            L.DomEvent.stop(e);
                            if (!document.fullscreenElement) {
                                m.getContainer().requestFullscreen && m.getContainer().requestFullscreen();
                                btn.innerHTML = '<i class="fas fa-compress" style="font-size:13px;line-height:26px;padding:0 4px;"></i>';
                                btn.title = window.GeoLocI18n ? window.GeoLocI18n.t("fullscreen_exit") : "Exit fullscreen";
                            } else {
                                document.exitFullscreen && document.exitFullscreen();
                            }
                        });
                        _fullscreenHandler = function () {
                            if (!document.fullscreenElement) {
                                btn.innerHTML = '<i class="fas fa-expand" style="font-size:13px;line-height:26px;padding:0 4px;"></i>';
                                btn.title = window.GeoLocI18n ? window.GeoLocI18n.t("fullscreen") : "Fullscreen";
                            }
                            setTimeout(() => m.invalidateSize(), 100);
                        };
                        document.addEventListener("fullscreenchange", _fullscreenHandler);
                        return div;
                    },
                });
                new FullscreenCtrl().addTo(_geolocMap);

                _geolocMap.on("click",       (e) => pinLocation(e.latlng.lat, e.latlng.lng));
                _geolocMap.on("contextmenu", (e) => pinLocation(e.latlng.lat, e.latlng.lng));

                // Arrow keys for fine-tuning the marker position.
                _geolocMap.getContainer().setAttribute("tabindex", "0");
                _geolocMap.getContainer().addEventListener("keydown", (e) => {
                    if (!_geolocMarker) return;
                    const arrows = ["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"];
                    if (!arrows.includes(e.key)) return;
                    e.preventDefault();
                    // Step shrinks as zoom increases (~1 m precision at zoom 18).
                    const step = 0.0001 / Math.pow(2, Math.max(0, _geolocMap.getZoom() - 14));
                    const ll = _geolocMarker.getLatLng();
                    let lat = ll.lat, lng = ll.lng;
                    if (e.key === "ArrowUp")    lat += step;
                    if (e.key === "ArrowDown")  lat -= step;
                    if (e.key === "ArrowRight") lng += step;
                    if (e.key === "ArrowLeft")  lng -= step;
                    pinLocation(lat, lng);
                });

                const TolCtrl = L.Control.extend({
                    options: { position: "bottomright" },
                    onAdd(map) {
                        const d = L.DomUtil.create("div", "leaflet-bar");
                        const a = L.DomUtil.create("a", "", d);
                        a.href = "#";
                        a.title = window.GeoLocI18n ? window.GeoLocI18n.t("tol_off_title") : "Show acceptance zone";
                        a.innerHTML = '<i class="fas fa-bullseye" style="font-size:13px;line-height:26px;padding:0 4px;"></i>';
                        a.style.cssText = "width:auto;min-width:26px;height:26px;display:flex;align-items:center;justify-content:center;color:#666;text-decoration:none;";

                        L.DomEvent.on(a, "click", function (ev) {
                            L.DomEvent.stop(ev);
                            _tolEnabled = !_tolEnabled;
                            a.style.color = _tolEnabled ? "#28a745" : "#666";
                            a.title = _tolEnabled
                                ? (window.GeoLocI18n ? window.GeoLocI18n.t("tol_on_title") : "Acceptance zone visible")
                                : (window.GeoLocI18n ? window.GeoLocI18n.t("tol_off_title") : "Show acceptance zone");
                            const banner = document.getElementById("geoloc-tol-banner");
                            if (banner) banner.style.display = _tolEnabled ? "block" : "none";
                            if (_tolEnabled && _geolocMarker && _tolRadius > 0) {
                                if (_tolCircle) map.removeLayer(_tolCircle);
                                _tolCircle = L.circle(_geolocMarker.getLatLng(), {
                                    radius: _tolRadius, color: "#3388ff", fillColor: "#3388ff",
                                    fillOpacity: 0.08, weight: 2, dashArray: "6 4",
                                }).addTo(map);
                            } else if (!_tolEnabled && _tolCircle) {
                                map.removeLayer(_tolCircle);
                                _tolCircle = null;
                            }
                        });
                        return d;
                    },
                });
                new TolCtrl().addTo(_geolocMap);

                const RecenterCtrl = L.Control.extend({
                    options: { position: "bottomright" },
                    onAdd() {
                        const div = L.DomUtil.create("div", "leaflet-bar");
                        const btn = L.DomUtil.create("a", "", div);
                        btn.href = "#";
                        btn.title = window.GeoLocI18n ? window.GeoLocI18n.t("recenter_title") : "Go to my pin";
                        btn.innerHTML = '<i class="fas fa-map-marker-alt" style="font-size:13px;line-height:26px;padding:0 4px;color:#e74c3c;"></i>';
                        btn.style.cssText = "width:26px;height:26px;display:flex;align-items:center;justify-content:center;text-decoration:none;";
                        L.DomEvent.on(btn, "click", function (e) {
                            L.DomEvent.stop(e);
                            if (_geolocMarker) {
                                _geolocMap.setView(_geolocMarker.getLatLng());
                            }
                        });
                        return div;
                    },
                });
                new RecenterCtrl().addTo(_geolocMap);

                const manualInput = document.getElementById("geo-coord-manual");
                if (manualInput) {
                    manualInput.addEventListener("input", function () {
                        const m = this.value.trim().match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
                        if (m) {
                            const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
                            if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                                pinLocation(lat, lng);
                                _geolocMap.setView([lat, lng], Math.max(_geolocMap.getZoom(), 13));
                            }
                        }
                    });
                }

                setTimeout(() => { _geolocMap.invalidateSize(); resolve(); }, 150);
            } catch (err) {
                reject(err);
            }
        });
    }

    function pinLocation(lat, lng) {
        const ll = L.latLng(lat, lng);
        $("#player-lat").val(lat.toFixed(10));
        $("#player-lon").val(lng.toFixed(10));
        $("#geoloc-disp-lat").text(lat.toFixed(6));
        $("#geoloc-disp-lon").text(lng.toFixed(6));

        if (_geolocMarker) {
            _geolocMarker.setLatLng(ll);
        } else {
            _geolocMarker = L.marker(ll, { draggable: true }).addTo(_geolocMap);
            _geolocMarker.on("drag", (ev) => {
                const p = ev.latlng;
                $("#geoloc-disp-lat").text(p.lat.toFixed(6));
                $("#geoloc-disp-lon").text(p.lng.toFixed(6));
                if (_tolCircle) _tolCircle.setLatLng(p);
            });
            _geolocMarker.on("dragend", () => {
                const p = _geolocMarker.getLatLng();
                pinLocation(p.lat, p.lng);
            });
        }
        if (_tolCircle) _tolCircle.setLatLng(ll);
    }

    // Builds the map. defaultLayer and tolRadius are passed by bootChallenge.
    // The layer is read first from the server-rendered data-layer attribute (instant,
    // no network), then confirmed/overridden by the API fetch (handles mid-session
    // admin changes). Only tolRadius strictly needs the API round-trip.
    async function bootChallenge() {
        teardownMap();

        const challengeId = _getChallengeId();
        const mapEl = document.getElementById("geoloc-player-map");

        // Server-rendered fallback — always correct on first open after hard refresh.
        let defaultLayer = mapEl?.dataset.layer || "google_hybrid";
        let tolRadius    = 50;
        try {
            const resp = await _CTFd.fetch(`/api/v1/challenges/${challengeId}`, {
                credentials: "same-origin",
                cache:       "no-store",
                headers:     { Accept: "application/json" },
            }).then((r) => r.json());
            if (resp.success) {
                defaultLayer = resp.data.default_layer || defaultLayer;
                tolRadius    = parseFloat(resp.data.radius_meters) || 50;
            }
        } catch (_) {}

        setTimeout(() => {
            buildMap(defaultLayer, tolRadius)
                .catch((err) => console.error("[GeoLoc] Map init failed:", err));
        }, 200);
    }

    CTFd._internal.challenge = {};
    CTFd._internal.challenge.preRender  = () => teardownMap();
    CTFd._internal.challenge.postRender = () => bootChallenge();

    // Monkey-patch CTFd.pages.challenge.submitChallenge so geoloc challenges
    // send {coord_lat, coord_lon} instead of the standard {submission} field.
    // view.js is loaded lazily (after Alpine init), so overriding
    // CTFd._internal.challenge.submit has no effect in the new Alpine-based CTFd;
    // patching the pages layer is the correct hook point.
    if (CTFd.pages && CTFd.pages.challenge && CTFd.pages.challenge.submitChallenge) {
        const _origSubmit = CTFd.pages.challenge.submitChallenge;
        CTFd.pages.challenge.submitChallenge = async function (challengeId, submission) {
            // Only intercept when a geoloc map is present in the current modal.
            if (!document.getElementById("geoloc-player-map")) {
                return _origSubmit.call(this, challengeId, submission);
            }

            const lat = parseFloat(document.getElementById("player-lat")?.value);
            const lon = parseFloat(document.getElementById("player-lon")?.value);

            if (isNaN(lat) || isNaN(lon)) {
                return {
                    success: true,
                    data: {
                        status: "incorrect",
                        message: window.GeoLocI18n
                            ? window.GeoLocI18n.t("no_pin")
                            : "Please place a pin on the map before submitting.",
                    },
                };
            }

            const endpoint = CTFd.config && CTFd.config.preview
                ? "/api/v1/challenges/attempt?preview=true"
                : "/api/v1/challenges/attempt";

            try {
                const resp = await _CTFd
                    .fetch(endpoint, {
                        method: "POST",
                        credentials: "same-origin",
                        headers: { Accept: "application/json", "Content-Type": "application/json" },
                        body: JSON.stringify({ challenge_id: challengeId, coord_lat: lat, coord_lon: lon }),
                    })
                    .then((r) => r.json());
                if (resp.success && resp.data.status === "correct") {
                    window.dispatchEvent(new CustomEvent("load-challenges"));
                }
                return resp;
            } catch (err) {
                console.error("[GeoLoc] Submit error:", err);
                return {
                    success: false,
                    data: {
                        status: "incorrect",
                        message: window.GeoLocI18n
                            ? window.GeoLocI18n.t("net_error")
                            : "Network error — please try again.",
                    },
                };
            }
        };
    }

    // GeoLocPlugin API — for themes that render challenges full-page (no modal).
    window.GeoLocPlugin = {
        getHTML: function (challengeId) {
            const safeId = parseInt(challengeId, 10) || 0;
            const t = window.GeoLocI18n ? (k, d) => window.GeoLocI18n.t(k, d) : (_k, d) => d;
            return `<style>
#geoloc-player-map{height:420px;width:100%;border-radius:8px;border:1px solid rgba(255,255,255,0.15);}
.geoloc-pin-bar{display:flex;align-items:center;justify-content:center;gap:12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:7px 18px;font-family:monospace;font-size:.85rem;margin:.6rem auto .4rem;max-width:420px;color:#555e7a;pointer-events:none;user-select:none;}
.geoloc-pin-bar .glabel{color:#555e7a;font-family:sans-serif;font-size:.78rem;}
.geo-coord-manual-input{width:100%;padding:.35rem .6rem;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#555e7a;font-family:monospace;font-size:.85rem;}
.leaflet-control-geocoder-form input{color:#000!important;background:#fff!important;}
</style>
<div id="geoloc-player-map"></div>
<div class="geoloc-pin-bar">
  <i class="fas fa-map-marker-alt" style="color:#e74c3c;"></i>
  <span class="glabel">Lat</span><strong id="geoloc-disp-lat">—</strong>
  <span class="glabel">Lon</span><strong id="geoloc-disp-lon">—</strong>
</div>
<div id="geoloc-tol-banner" style="display:none;margin:.4rem 0;padding:9px 16px;background:rgba(30,80,160,0.93);color:#fff;border-radius:8px;font-size:0.82rem;text-align:center;line-height:1.4;box-shadow:0 2px 8px rgba(0,0,0,0.35);">
  🗺️ <strong>${t("banner_title","Accepted answer zone")}</strong> — ${t("banner_line1","This challenge allows some imprecision.")}<br>
  ${t("banner_line2","Place your marker where you think the location is.")}<br>
  ${t("banner_line3","The blue circle shows the acceptance radius around the exact target.")}<br>
  <em style="opacity:.85">${t("banner_line4","If your marker is inside the circle, your submission will be validated.")}</em>
</div>
<div style="margin-top:.5rem;">
  <input type="text" class="geo-coord-manual-input" id="geo-coord-manual"
         placeholder="${t("coord_placeholder","Enter coordinates: 48.858398, 2.294417")}">
</div>
<p style="text-align:center;font-size:.75rem;color:#555e7a;margin:.4rem 0 0;">
  <i class="fas fa-info-circle" style="color:#4facfe;margin-right:.3rem;"></i>
  ${t("pin_hint_desktop","Click · drag pin · ↑↓←→ for precision · or type coordinates above")}
</p>
<input type="hidden" id="geoloc-challenge-id" value="${safeId}">
<input type="hidden" id="player-lat" value="">
<input type="hidden" id="player-lon" value="">`;
        },
        initFullPage: function () {
            bootChallenge();
        },
        teardown: function () { teardownMap(); },
        getCoords: function () {
            const latEl = document.getElementById("player-lat");
            const lonEl = document.getElementById("player-lon");
            if (!latEl || !lonEl) return null;
            const lat = parseFloat(latEl.value);
            const lon = parseFloat(lonEl.value);
            if (isNaN(lat) || isNaN(lon)) return null;
            return { coord_lat: lat, coord_lon: lon };
        },
    };
});
