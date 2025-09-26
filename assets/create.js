CTFd.plugin.run((_CTFd) => {
    const $ = _CTFd.lib.$;
    
    // Wait for Leaflet and Geocoder to be loaded
    const waitForDeps = setInterval(() => {
        if (window.L && window.L.Control.Geocoder) {
            clearInterval(waitForDeps);
            initMap();
        }
    }, 100);

    function initMap() {
        // Initialize the map
        const map = L.map('map-create').setView([0, 0], 2);
        
        // Define base layers
        const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
        });

        const esriWorldImagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19,
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
        });

        // Add default layer
        osmLayer.addTo(map);

        // Create layer control
        const baseLayers = {
            "Street Map": osmLayer,
            "Satellite": esriWorldImagery
        };

        // Add layer control outside of any form elements
        const layerControl = L.control.layers(baseLayers);
        layerControl.addTo(map);
        
        // Ensure the layer control doesn't interfere with form submission
        const layerControlContainer = document.querySelector('.leaflet-control-layers');
        if (layerControlContainer) {
            // Prevent any form elements inside the control from being submitted
            const inputs = layerControlContainer.querySelectorAll('input');
            inputs.forEach(input => {
                input.setAttribute('form', 'no-form');
            });
        }

        // Add geocoder control
        const geocoder = L.Control.geocoder({
            defaultMarkGeocode: false
        }).addTo(map);

        geocoder.on('markgeocode', function(event) {
            const center = event.geocode.center;
            
            // Update form fields
            $('#latitude').val(center.lat.toFixed(10));
            $('#longitude').val(center.lng.toFixed(10));
            
            // Update or create marker
            if (marker) {
                marker.setLatLng(center);
            } else {
                marker = L.marker(center).addTo(map);
            }
            
            // Update circles
            updateCircles();
            
            // Zoom to location
            map.fitBounds(event.geocode.bbox);
        });

        let marker = null;
        
        // Handle map clicks
        map.on('click', function(e) {
            const lat = e.latlng.lat;
            const lng = e.latlng.lng;
            
            // Update form fields
            $('#latitude').val(lat.toFixed(10));
            $('#longitude').val(lng.toFixed(10));
            
            // Update or create marker
            if (marker) {
                marker.setLatLng(e.latlng);
            } else {
                marker = L.marker(e.latlng).addTo(map);
            }

            // Update circles
            updateCircles();
        });

        // Handle manual coordinate input
        $('#latitude, #longitude').on('change', function() {
            const lat = parseFloat($('#latitude').val());
            const lng = parseFloat($('#longitude').val());
            
            if (isNaN(lat) || isNaN(lng)) {
                return;
            }
            
            const latlng = L.latLng(lat, lng);
            
            // Update or create marker
            if (marker) {
                marker.setLatLng(latlng);
            } else {
                marker = L.marker(latlng).addTo(map);
            }
            
            // Center map on marker
            map.setView(latlng);
            
            // Update circles
            updateCircles();
        });

        // Add circles for visualization
        function updateCircles() {
            // Clear existing circles
            map.eachLayer((layer) => {
                if (layer instanceof L.Circle) {
                    map.removeLayer(layer);
                }
            });

            if (!marker) return;

            const tolerance = parseFloat($('input[name="tolerance_radius"]').val());

            if (isNaN(tolerance)) return;

            // Add tolerance radius circle
            L.circle(marker.getLatLng(), {
                radius: tolerance,
                color: 'green',
                fillColor: '#3f3',
                fillOpacity: 0.2
            }).addTo(map);
        }

        // Update circles when values change
        $('input[name="tolerance_radius"]').on('change', updateCircles);

        // Update circles when marker moves
        map.on('click', updateCircles);
    }
});