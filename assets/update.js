// Shared admin map script for both the Create and Update challenge pages.
// On the Create page target_lat / target_lon fields are empty, so the map
// starts at zoom 2 with no marker. On the Update page the existing
// coordinates are pre-filled, so the map centres on them with a marker.
CTFd.plugin.run((_CTFd) => {
    const $ = _CTFd.lib.$;

    // Poll until Leaflet and the Geocoder control are ready.
    const _ready = setInterval(() => {
        if (window.L && window.L.Control && window.L.Control.Geocoder) {
            clearInterval(_ready);
            initAdminMap();
        }
    }, 100);

    function initAdminMap() {
        const mapEl = document.getElementById("geoloc-admin-map");
        if (!mapEl) return;

        // Read existing coordinates (empty on Create → defaults to 0).
        const initLat   = parseFloat(document.getElementById("target_lat").value) || 0;
        const initLon   = parseFloat(document.getElementById("target_lon").value) || 0;
        const startZoom = (initLat !== 0 || initLon !== 0) ? 13 : 2;

        const map = L.map("geoloc-admin-map").setView([initLat, initLon], startZoom);
        let marker       = null;
        let radiusCircle = null;
        let marginCircle = null;

        const osmLayer = L.tileLayer(
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }
        );
        const esriSat = L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            { maxZoom: 19, attribution: "Tiles © Esri" }
        );
        const gStreet = L.tileLayer(
            "https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
            { maxZoom: 20, subdomains: ["0", "1", "2", "3"], attribution: "© Google Maps" }
        );
        const gHybrid = L.tileLayer(
            "https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
            { maxZoom: 20, subdomains: ["0", "1", "2", "3"], attribution: "© Google Maps" }
        );

        osmLayer.addTo(map);
        L.control.layers({
            "🗺️ OpenStreetMap":   osmLayer,
            "🛰️ Satellite (Esri)": esriSat,
            "🗺️ Google Street":   gStreet,
            "🛰️ Google Hybrid":   gHybrid,
        }, {}, { position: "topright" }).addTo(map);

        // Prevent Leaflet layer-switcher radio buttons from being submitted
        // as part of the challenge creation/update form.
        setTimeout(() => {
            document.querySelectorAll(".leaflet-control-layers input")
                .forEach((el) => el.setAttribute("form", "no-form"));
        }, 400);

        // Geocoder — always visible, centred at the top of the map.
        const geocoder = L.Control.geocoder({
            defaultMarkGeocode: false,
            placeholder: "Search a location…",
            collapsed: false,
            position: "topleft",
        }).addTo(map);

        setTimeout(() => {
            const geocoderEl = geocoder.getContainer();
            if (geocoderEl && geocoderEl.parentNode) {
                const centered = document.createElement("div");
                centered.style.cssText = "position:absolute;top:10px;left:50%;transform:translateX(-50%);z-index:1000;pointer-events:auto;";
                geocoderEl.parentNode.removeChild(geocoderEl);
                centered.appendChild(geocoderEl);
                map.getContainer().appendChild(centered);
            }
        }, 0);

        const FullscreenControl = L.Control.extend({
            options: { position: "topleft" },
            onAdd(m) {
                const div = L.DomUtil.create("div", "leaflet-bar");
                const btn = L.DomUtil.create("a", "", div);
                btn.href  = "#";
                btn.title = "Fullscreen";
                btn.innerHTML = '<i class="fas fa-expand" style="font-size:13px;line-height:26px;padding:0 4px;"></i>';
                btn.style.cssText = "width:26px;height:26px;display:flex;align-items:center;justify-content:center;color:#666;text-decoration:none;font-style:normal;";
                L.DomEvent.on(btn, "click", function (e) {
                    L.DomEvent.stop(e);
                    const container = m.getContainer();
                    if (!document.fullscreenElement) {
                        container.requestFullscreen && container.requestFullscreen();
                        btn.innerHTML = '<i class="fas fa-compress" style="font-size:13px;line-height:26px;padding:0 4px;"></i>';
                        btn.title = "Exit fullscreen";
                    } else {
                        document.exitFullscreen && document.exitFullscreen();
                    }
                });
                document.addEventListener("fullscreenchange", function () {
                    if (!document.fullscreenElement) {
                        btn.innerHTML = '<i class="fas fa-expand" style="font-size:13px;line-height:26px;padding:0 4px;"></i>';
                        btn.title = "Fullscreen";
                    }
                    setTimeout(() => m.invalidateSize(), 100);
                });
                return div;
            },
        });
        new FullscreenControl().addTo(map);

        geocoder.on("markgeocode", (e) => {
            const { lat, lng } = e.geocode.center;
            placeMarker(lat, lng);
            map.fitBounds(e.geocode.bbox);
        });

        function getRadius() {
            return parseFloat(document.getElementById("radius_meters")?.value) || 50;
        }

        function getTolerancePct() {
            return parseFloat(document.getElementById("tolerance_buffer_pct")?.value) || 0;
        }

        // Redraws the green acceptance circle and (when > 0) the orange admin-buffer ring.
        function refreshCircle() {
            if (radiusCircle) map.removeLayer(radiusCircle);
            if (marginCircle) map.removeLayer(marginCircle);
            if (!marker) return;
            const radius = getRadius();
            radiusCircle = L.circle(marker.getLatLng(), {
                radius, color: "#28a745", fillColor: "#28a745", fillOpacity: 0.15, weight: 2,
            }).addTo(map);
            const pct = getTolerancePct();
            if (pct > 0) {
                marginCircle = L.circle(marker.getLatLng(), {
                    radius: radius * (1 + pct / 100),
                    color: "#fd7e14", fillOpacity: 0, weight: 3, dashArray: "4 4",
                }).addTo(map);
            }
        }

        function placeMarker(lat, lng) {
            const ll = L.latLng(lat, lng);
            document.getElementById("target_lat").value = lat.toFixed(10);
            document.getElementById("target_lon").value = lng.toFixed(10);
            if (marker) {
                marker.setLatLng(ll);
            } else {
                marker = L.marker(ll).addTo(map);
            }
            refreshCircle();
            updateEffectiveRadiusDisplay();
        }

        // Shows the real acceptance radius (base + admin buffer) below the input.
        function updateEffectiveRadiusDisplay() {
            const el = document.getElementById("effective-radius-display");
            if (!el) return;
            const radius    = getRadius();
            const pct       = getTolerancePct();
            const margin    = radius * pct / 100;
            const effective = radius + margin;
            el.textContent = radius > 0
                ? `→ Effective acceptance zone: ${effective.toFixed(1)} m (${radius.toFixed(1)} m + ${margin.toFixed(1)} m buffer)`
                : "";
        }

        // If existing coordinates are present (Update page), place the initial marker.
        if (initLat !== 0 || initLon !== 0) {
            placeMarker(initLat, initLon);
        }

        map.on("click", (e) => placeMarker(e.latlng.lat, e.latlng.lng));

        document.getElementById("radius_meters")
            ?.addEventListener("input", () => { refreshCircle(); updateEffectiveRadiusDisplay(); });

        document.getElementById("tolerance_buffer_pct")
            ?.addEventListener("input", () => { refreshCircle(); updateEffectiveRadiusDisplay(); });

        ["target_lat", "target_lon"].forEach((id) => {
            document.getElementById(id)?.addEventListener("change", () => {
                const lat = parseFloat(document.getElementById("target_lat").value);
                const lng = parseFloat(document.getElementById("target_lon").value);
                if (!isNaN(lat) && !isNaN(lng)) {
                    placeMarker(lat, lng);
                    map.setView([lat, lng], 13);
                }
            });
        });

        // Trigger display on page load so pre-filled values are shown immediately.
        updateEffectiveRadiusDisplay();
        setTimeout(() => map.invalidateSize(), 150);
    }
});
