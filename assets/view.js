var mapInstance = null;
var marker = null;
var toleranceCircle = null;

CTFd.plugin.run((_CTFd) => {
  const $ = _CTFd.lib.$;
  
  // Import required modules for submissions
  const { Tab } = window.bootstrap || {};
  const dayjs = window.dayjs;
  
  // Extend Alpine Challenge data to add showSubmissions method
  document.addEventListener('alpine:init', () => {
    Alpine.data('Challenge', () => ({
      ...Alpine.data('Challenge')(),
      
      async showSubmissions() {
        try {
          let response = await CTFd.pages.users.userSubmissions("me", this.id);
          this.submissions = response.data;
          
          if (dayjs) {
            this.submissions.forEach(s => {
              s.date = dayjs(s.date).format("MMMM Do, h:mm:ss A");
              return s;
            });
          }
          
          if (Tab) {
            new Tab(this.$el).show();
          }
        } catch (error) {
          console.error('[GeoChallenge] Error loading submissions:', error);
          this.submissions = [];
        }
      }
    }));
  });

  function destroyMap() {
    if (mapInstance) {
      try {
        mapInstance.remove();
      } catch (e) {
        console.log("Error removing map:", e);
      }
      mapInstance = null;
      marker = null;
      toleranceCircle = null;
    }

    $("#submit-latitude").val("");
    $("#submit-longitude").val("");
    $("#result-notification").hide();
  }

  function createMap() {
    return new Promise((resolve, reject) => {
      const mapDiv = document.getElementById("map-solve");
      if (!mapDiv) {
        return reject("Map container not found");
      }

      // Ensure clean state
      mapDiv.innerHTML = "";
      mapDiv.style.height = "400px";
      mapDiv.style.width = "100%";

      try {
        mapInstance = L.map("map-solve", {
          center: [0, 0],
          zoom: 2,
        });

        // Define base layers
        const osmLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "© OpenStreetMap contributors",
        });

        const esriWorldImagery = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
          maxZoom: 19,
          attribution: "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
        });

        // Add default layer
        osmLayer.addTo(mapInstance);

        // Create layer control
        const baseLayers = {
          "Street Map": osmLayer,
          "Satellite": esriWorldImagery,
        };

        L.control.layers(baseLayers).addTo(mapInstance);

        const geocoder = L.Control.geocoder({
          defaultMarkGeocode: false,
        }).addTo(mapInstance);

        geocoder.on("markgeocode", function (event) {
          const center = event.geocode.center;

          $("#submit-latitude").val(center.lat.toFixed(10));
          $("#submit-longitude").val(center.lng.toFixed(10));

          if (marker) {
            marker.setLatLng(center);
          } else {
            marker = L.marker(center).addTo(mapInstance);
          }

          // Update tolerance circle around the new marker position
          updateToleranceCircle();

          // Zoom to location
          mapInstance.fitBounds(event.geocode.bbox);
        });

        mapInstance.on("click", (e) => {
          const lat = e.latlng.lat;
          const lng = e.latlng.lng;

          $("#submit-latitude").val(lat.toFixed(10));
          $("#submit-longitude").val(lng.toFixed(10));

          if (marker) {
            marker.setLatLng(e.latlng);
          } else {
            marker = L.marker(e.latlng).addTo(mapInstance);
          }

          // Update tolerance circle around the new marker position
          updateToleranceCircle();
        });

        $('#submit-latitude, #submit-longitude').on('change', function() {
          const lat = parseFloat($('#submit-latitude').val());
          const lng = parseFloat($('#submit-longitude').val());
          
          if (isNaN(lat) || isNaN(lng)) {
              return;
          }
          
          const latlng = L.latLng(lat.toFixed(10), lng.toFixed(10));
          
          // Update or create marker
          if (marker) {
              marker.setLatLng(latlng);
          } else {
              marker = L.marker(latlng).addTo(mapInstance);
          }
          
          // Center map on marker
          mapInstance.setView(latlng);
      });

        // Fetch challenge details to get the tolerance radius
        fetchChallengeDetails()
          .then(() => {
            // Force a redraw after a short delay
            setTimeout(() => {
              mapInstance.invalidateSize();
              resolve();
            }, 100);
          })
          .catch((error) => {
            console.error("Error fetching challenge details:", error);
            // Still resolve to not block the map creation
            setTimeout(() => {
              mapInstance.invalidateSize();
              resolve();
            }, 100);
          });
      } catch (error) {
        console.error("Error creating map:", error);
        reject(error);
      }
    });
  }

  function fetchChallengeDetails() {
    const challengeId = parseInt($("#challenge-id").val());
    if (!challengeId) {
      return Promise.reject("No challenge ID found");
    }

    return _CTFd
      .fetch(`/api/v1/challenges/${challengeId}`, {
        method: "GET",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
        },
      })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          // Store tolerance radius in a data attribute
          $("#map-solve").attr("data-tolerance", data.data.tolerance_radius || 10);
        }
        return data;
      });
  }

  function updateToleranceCircle() {
    if (!marker) return;
    
    // Get tolerance radius from data attribute
    const tolerance = parseFloat($("#map-solve").attr("data-tolerance") || 10);
    
    // Remove existing circle if it exists
    if (toleranceCircle) {
      mapInstance.removeLayer(toleranceCircle);
    }
    
    // Create new circle with the tolerance radius
    toleranceCircle = L.circle(marker.getLatLng(), {
      radius: tolerance,
      color: "#3388ff",
      fillColor: "#3388ff",
      fillOpacity: 0.1,
      weight: 2
    }).addTo(mapInstance);
  }

  function initializeChallenge() {
    destroyMap();

    // Wait a bit for any modal animations to complete
    setTimeout(() => {
      createMap()
        .then(() => {
          // Apply translations if the function is available
          if (window.GeoChallenge && window.GeoChallenge.applyTranslations) {
            window.GeoChallenge.applyTranslations();
          }
          
          // Add submit handler
          $("#geo-submit")
            .off("click")
            .on("click", function (e) {
              e.preventDefault();
              CTFd._internal.challenge.submit();
            });
        })
        .catch((error) => {
          console.error("Failed to initialize map:", error);
        });
    }, 200);
  }

  CTFd._internal.challenge = {};
  CTFd._internal.challenge.data = undefined;

  CTFd._internal.challenge.preRender = function () {
    destroyMap();
  };

  CTFd._internal.challenge.render = null;

  CTFd._internal.challenge.postRender = function () {
    initializeChallenge();
  };

  CTFd._internal.challenge.submit = function (preview) {
    var challenge_id = parseInt($("#challenge-id").val());
    var latitude = parseFloat($("#submit-latitude").val());
    var longitude = parseFloat($("#submit-longitude").val());

    if (isNaN(latitude) || isNaN(longitude)) {
        var result = $("#result-notification");
        var message = $("#result-message");
        result.show();
        result.addClass("alert-danger");
        
        // Utiliser la traduction si disponible
        const errorMsg = window.GeoChallenge && window.GeoChallenge.translate ? 
            window.GeoChallenge.translate('select_location_first') : 
            "Please select a location on the map first.";
            
        message.text(errorMsg);
        return Promise.reject();
    }

    var body = {
        challenge_id: challenge_id,
        latitude: latitude,
        longitude: longitude,
    };

    var endpoint = "/api/v1/challenges/attempt";
    if (preview) {
        endpoint += "?preview=true";
    }

    return _CTFd
        .fetch(endpoint, {
            method: "POST",
            credentials: "same-origin",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        })
        .then(function (response) {
            return response.json();
        })
        .then(function (response) {
            var result = $("#result-notification");
            var message = $("#result-message");

            result.show();

            if (response.success && response.data.status === "correct") {
                result.removeClass("alert-danger").addClass("alert-success");
                message.text(response.data.message);
                
                // Déclencher l'événement Alpine.js pour recharger les challenges
                window.dispatchEvent(new CustomEvent('load-challenges'));
            } else {
                result.removeClass("alert-success").addClass("alert-danger");
                message.text(response.data.message);
            }

            return response;
        })
        .catch(function (error) {
            var result = $("#result-notification");
            var message = $("#result-message");

            result.show();
            result.removeClass("alert-success").addClass("alert-danger");
            
            // Utiliser la traduction si disponible
            const errorMsg = window.GeoChallenge && window.GeoChallenge.translate ? 
                window.GeoChallenge.translate('error_submitting') : 
                "Error submitting challenge";
                
            message.text(errorMsg);

            console.error(error);
            throw error;
        });
};
});