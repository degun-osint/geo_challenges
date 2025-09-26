CTFd._internal.challenge.data = undefined;
CTFd._internal.challenge.renderer = null;

let mapInstance = null;
let marker = null;

CTFd.plugin.run((_CTFd) => {
    const $ = _CTFd.lib.$;
    
    CTFd._internal.challenge.preRender = function() { };

    CTFd._internal.challenge.render = function() {
        console.log("GEO: render called");
        initMap();
    };

    CTFd._internal.challenge.postRender = function() { };

    function initMap() {
        console.log("GEO: Initializing map");
        const mapElement = $('#map-solve');
        if (!mapElement.length) {
            console.log("GEO: Map element not found, retrying...");
            setTimeout(initMap, 100);
            return;
        }

        if (mapInstance) {
            mapInstance.remove();
            mapInstance = null;
            marker = null;
        }

        mapInstance = L.map('map-solve').setView([0, 0], 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
        }).addTo(mapInstance);

        setTimeout(() => {
            mapInstance.invalidateSize();
        }, 100);

        mapInstance.on('click', function(e) {
            console.log("GEO: Map clicked", e.latlng);
            const lat = e.latlng.lat;
            const lng = e.latlng.lng;
            
            $('#submit-latitude').val(lat.toFixed(6));
            $('#submit-longitude').val(lng.toFixed(6));
            
            if (marker) {
                marker.setLatLng(e.latlng);
            } else {
                marker = L.marker(e.latlng).addTo(mapInstance);
            }
        });

        $('#geo-submit').off('click').on('click', function(e) {
            e.preventDefault();
            CTFd._internal.challenge.submit();
        });
    }

    CTFd._internal.challenge.submit = function() {
        console.log("GEO: submit called");
        const challenge_id = parseInt($('#challenge-id').val());
        const latitude = parseFloat($('#submit-latitude').val());
        const longitude = parseFloat($('#submit-longitude').val());

        if (isNaN(latitude) || isNaN(longitude)) {
            const result = $('#result-notification');
            const message = $('#result-message');
            result.show();
            message.text('Please select a location on the map first.');
            return Promise.reject();
        }

        return CTFd.fetch('/api/v1/challenges/attempt', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                challenge_id: challenge_id,
                submission: "placeholder",
                latitude: latitude,
                longitude: longitude
            })
        })
        .then(response => response.json())
        .then(response => {
            const result = $('#result-notification');
            const message = $('#result-message');
            
            result.show();
            if (response.success) {
                result.attr('class', 'alert alert-success alert-dismissable text-center w-100');
            } else {
                result.attr('class', 'alert alert-danger alert-dismissable text-center w-100');
            }
            
            message.text(response.message);
            
            return response;
        });
    };
});