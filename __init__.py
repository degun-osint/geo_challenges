# Thanks to https://github.com/MBAY-Clement for identifying several bugs
# and suggesting improvements via PR review.

from flask import Blueprint
from CTFd.models import Challenges, Solves, Fails, db
from CTFd.plugins import register_plugin_assets_directory, register_plugin_script, register_plugin_stylesheet, register_admin_plugin_stylesheet, register_admin_plugin_script
from CTFd.plugins.challenges import CHALLENGE_CLASSES, BaseChallenge, ChallengeResponse
from CTFd.utils.user import get_ip
from CTFd.utils.decorators import authed_only
from CTFd.plugins.migrations import upgrade
import math
import json
from sqlalchemy import Numeric

from CTFd.exceptions.challenges import ChallengeCreateException

from .decay import DECAY_FUNCTIONS, logarithmic


class GeoFieldsMixin:
    """Answer zone columns and create-form handling shared by the geo models."""
    latitude = db.Column(Numeric(12, 10), server_default="0")
    longitude = db.Column(Numeric(13, 10), server_default="0")
    tolerance_radius = db.Column(Numeric(10, 2), server_default="10")
    # Optional GeoJSON-like polygon (JSON array of [lat, lng] vertices).
    # When set, validation uses point-in-polygon instead of point + radius.
    polygon = db.Column(db.Text)

    def __init__(self, *args, **kwargs):
        self.latitude = kwargs.pop('latitude', 0)
        self.longitude = kwargs.pop('longitude', 0)
        self.tolerance_radius = kwargs.pop('tolerance_radius', 10)
        # Empty string => no polygon (point + radius mode)
        self.polygon = kwargs.pop('polygon', None) or None
        # UI-only field, never persisted
        kwargs.pop('geo_mode', None)

        # Remove any Leaflet-related fields that might have been added
        keys_to_remove = []
        for key in kwargs.keys():
            if 'leaflet' in key.lower() or 'layer' in key.lower():
                keys_to_remove.append(key)

        for key in keys_to_remove:
            kwargs.pop(key, None)

        super().__init__(**kwargs)


class GeoStaticChallenge(GeoFieldsMixin, Challenges):
    # Explicit: the table name used to be derived from the old class name
    # (GeoChallenge) and existing installs depend on it.
    __tablename__ = "geo_challenge"
    __mapper_args__ = {"polymorphic_identity": "geo"}
    id = db.Column(
        db.Integer, db.ForeignKey("challenges.id", ondelete="CASCADE"), primary_key=True
    )


class GeoDynamicChallenge(GeoFieldsMixin, Challenges):
    """Geo challenge whose value decays with solves, like CTFd's "dynamic" type."""
    __tablename__ = "geo_dynamic_challenge"
    __mapper_args__ = {"polymorphic_identity": "geo_dynamic"}
    id = db.Column(
        db.Integer, db.ForeignKey("challenges.id", ondelete="CASCADE"), primary_key=True
    )
    # Prefixed like CTFd's DynamicChallenge: CTFd >= 3.8 also has initial/minimum/
    # decay/function columns on `challenges`, which the properties below shadow.
    dynamic_initial = db.Column(db.Integer, default=0)
    dynamic_minimum = db.Column(db.Integer, default=0)
    dynamic_decay = db.Column(db.Integer, default=0)
    dynamic_function = db.Column(db.String(32), default="logarithmic")

    @property
    def initial(self):
        return self.dynamic_initial

    @initial.setter
    def initial(self, initial_value):
        self.dynamic_initial = initial_value

    @property
    def minimum(self):
        return self.dynamic_minimum

    @minimum.setter
    def minimum(self, minimum_value):
        self.dynamic_minimum = minimum_value

    @property
    def decay(self):
        return self.dynamic_decay

    @decay.setter
    def decay(self, decay_value):
        self.dynamic_decay = decay_value

    @property
    def function(self):
        return self.dynamic_function

    @function.setter
    def function(self, function_value):
        self.dynamic_function = function_value

    def __init__(self, *args, **kwargs):
        for attr in ("initial", "minimum", "decay"):
            if kwargs.get(attr) in (None, ""):
                raise ChallengeCreateException(f"Missing {attr} value for challenge")
            try:
                kwargs[attr] = int(float(kwargs[attr]))
            except (ValueError, TypeError):
                raise ChallengeCreateException(f"Invalid input for '{attr}'")
        if kwargs.get("function") not in DECAY_FUNCTIONS:
            kwargs["function"] = "logarithmic"
        super().__init__(**kwargs)
        self.value = self.initial


class GeoChallengeType(BaseChallenge):
    id = "geo"
    name = "geo"
    templates = {
        "create": "/plugins/geo_challenges/assets/create.html",
        "update": "/plugins/geo_challenges/assets/update.html",
        "view": "/plugins/geo_challenges/assets/view.html",
    }
    scripts = {
        "create": "/plugins/geo_challenges/assets/create.js",
        "update": "/plugins/geo_challenges/assets/update.js",
        "view": "/plugins/geo_challenges/assets/view.js",
    }
    route = "/plugins/geo_challenges/assets/"
    blueprint = Blueprint(
        "geo_challenges",
        __name__,
        template_folder="templates",
        static_folder="assets",
    )
    challenge_model = GeoStaticChallenge

    @classmethod
    def read(cls, challenge):
        data = super().read(challenge)
        data["tolerance_radius"] = float(challenge.tolerance_radius or 10)
        # Expose only whether the challenge uses a polygon zone, never the
        # polygon geometry itself (it would give away the answer).
        data["polygon_mode"] = bool(challenge.polygon)
        # Never expose target coordinates to players via the public API
        data.pop("latitude", None)
        data.pop("longitude", None)
        data.pop("polygon", None)
        return data

    @staticmethod
    def point_in_polygon(lat, lon, vertices):
        """Ray-casting point-in-polygon test.

        `vertices` is a list of [lat, lng] pairs. Coordinates are treated as
        planar, which is accurate enough at the scale of a building/zone.
        """
        inside = False
        n = len(vertices)
        if n < 3:
            return False
        j = n - 1
        for i in range(n):
            yi, xi = vertices[i][0], vertices[i][1]
            yj, xj = vertices[j][0], vertices[j][1]
            if ((yi > lat) != (yj > lat)) and (
                lon < (xj - xi) * (lat - yi) / (yj - yi) + xi
            ):
                inside = not inside
            j = i
        return inside

    @classmethod
    def calculate_distance(cls, lat1, lon1, lat2, lon2):
        """Calculate distance between two points using Haversine formula"""
        R = 6371e3  # Earth's radius in meters

        φ1 = math.radians(lat1)
        φ2 = math.radians(lat2)
        Δφ = math.radians(lat2 - lat1)
        Δλ = math.radians(lon2 - lon1)

        a = (math.sin(Δφ/2) * math.sin(Δφ/2) +
             math.cos(φ1) * math.cos(φ2) *
             math.sin(Δλ/2) * math.sin(Δλ/2))

        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        return R * c  # Distance in meters

    @classmethod
    def attempt(cls, challenge, request):
        """Handle submission attempt"""
        data = request.form or request.get_json()

        try:
            user_lat = float(data.get("latitude"))
            user_lon = float(data.get("longitude"))
        except (ValueError, TypeError):
            return ChallengeResponse(
                status="incorrect",
                message="Invalid coordinates submitted"
            )

        if not (-90 <= user_lat <= 90) or not (-180 <= user_lon <= 180):
            return ChallengeResponse(
                status="incorrect",
                message="Invalid coordinates submitted"
            )

        # Polygon mode: the answer is a drawn zone, not a point + radius
        if challenge.polygon:
            try:
                vertices = json.loads(challenge.polygon)
            except (ValueError, TypeError):
                vertices = None

            if vertices and cls.point_in_polygon(user_lat, user_lon, vertices):
                return ChallengeResponse(
                    status="correct",
                    message="Correct! You found the location!"
                )

            return ChallengeResponse(
                status="incorrect",
                message="Incorrect location. Try again!"
            )

        # Point + radius mode (default)
        distance = cls.calculate_distance(
            float(challenge.latitude), float(challenge.longitude),
            user_lat, user_lon
        )

        if distance <= float(challenge.tolerance_radius):
            return ChallengeResponse(
                status="correct",
                message="Correct! You found the location!"
            )

        return ChallengeResponse(
            status="incorrect",
            message="Incorrect location. Try again!"
        )

    @classmethod
    def format_submission(cls, submission_value):
        """Format submission for display in the frontend"""
        try:
            # Parse the lat:X,lon:Y format
            if submission_value.startswith("lat:") and ",lon:" in submission_value:
                parts = submission_value.split(",lon:")
                lat_part = parts[0].replace("lat:", "")
                lon_part = parts[1]

                try:
                    lat = float(lat_part)
                    lon = float(lon_part)
                    return f"📍 Latitude: {lat:.6f}, Longitude: {lon:.6f}"
                except ValueError:
                    return f"📍 {submission_value}"
            else:
                return f"📍 {submission_value}"
        except Exception:
            return submission_value

    @classmethod
    def solve(cls, user, team, challenge, request):
        """Record solve with the challenge value"""
        data = request.form or request.get_json()
        try:
            lat = float(data.get("latitude", 0))
            lon = float(data.get("longitude", 0))
        except (ValueError, TypeError):
            lat = 0.0
            lon = 0.0
        submission = f"lat:{lat},lon:{lon}"

        solve = Solves(
            user_id=user.id,
            team_id=team.id if team else None,
            challenge_id=challenge.id,
            ip=get_ip(request),
            provided=submission
        )

        db.session.add(solve)
        db.session.commit()

    @classmethod
    def fail(cls, user, team, challenge, request):
        data = request.form or request.get_json()
        try:
            lat = float(data.get("latitude", 0))
            lon = float(data.get("longitude", 0))
        except (ValueError, TypeError):
            lat = 0.0
            lon = 0.0
        submission = f"lat:{lat},lon:{lon}"

        fail = Fails(
            user_id=user.id,
            team_id=team.id if team else None,
            challenge_id=challenge.id,
            ip=get_ip(request),
            provided=submission
        )

        db.session.add(fail)
        db.session.commit()

class GeoDynamicChallengeType(GeoChallengeType):
    """Same answer checking as `geo`, scored like CTFd's `dynamic` type."""
    id = "geo_dynamic"
    name = "geo_dynamic"
    templates = {
        "create": "/plugins/geo_challenges/assets/create_dynamic.html",
        "update": "/plugins/geo_challenges/assets/update_dynamic.html",
        "view": "/plugins/geo_challenges/assets/view.html",
    }
    scripts = GeoChallengeType.scripts
    challenge_model = GeoDynamicChallenge

    @classmethod
    def calculate_value(cls, challenge):
        f = DECAY_FUNCTIONS.get(challenge.function, logarithmic)
        challenge.value = f(challenge)
        db.session.commit()
        return challenge

    @classmethod
    def read(cls, challenge):
        data = super().read(challenge)
        data.update(
            {
                "initial": challenge.initial,
                "decay": challenge.decay,
                "minimum": challenge.minimum,
                "function": challenge.function,
            }
        )
        return data

    @classmethod
    def update(cls, challenge, request):
        # BaseChallenge.update commits, so the dynamic fields are reloaded from
        # the database as numbers before the value is recalculated.
        challenge = super().update(challenge, request)
        if challenge.function not in DECAY_FUNCTIONS:
            challenge.function = "logarithmic"
        return cls.calculate_value(challenge)

    @classmethod
    def solve(cls, user, team, challenge, request):
        super().solve(user, team, challenge, request)
        cls.calculate_value(challenge)


def load(app):

    upgrade(plugin_name="geo_challenges")

    # Create tables for the plugin
    app.db.create_all()

    # API endpoint for formatting submissions (authenticated)
    @app.route('/plugins/geo_challenges/api/format-submission', methods=['POST'])
    @authed_only
    def format_geo_submission():
        """API endpoint to format geo submissions for display"""
        try:
            from flask import request, jsonify

            data = request.get_json()
            if not data or 'submission' not in data:
                return jsonify({"success": False, "error": "No submission provided"}), 400

            submission_value = data['submission']
            formatted = GeoChallengeType.format_submission(submission_value)

            return jsonify({
                "success": True,
                "formatted": formatted
            })
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

    # Register Leaflet globally
    register_plugin_stylesheet("/plugins/geo_challenges/assets/leaflet/leaflet.css")
    register_plugin_script("/plugins/geo_challenges/assets/leaflet/leaflet.js")
    register_admin_plugin_stylesheet("/plugins/geo_challenges/assets/leaflet/leaflet.css")
    register_admin_plugin_script("/plugins/geo_challenges/assets/leaflet/leaflet.js")

    # register geocontrol

    register_plugin_stylesheet("/plugins/geo_challenges/assets/geocoder/Control.Geocoder.css")
    register_plugin_script("/plugins/geo_challenges/assets/geocoder/Control.Geocoder.js")
    register_admin_plugin_stylesheet("/plugins/geo_challenges/assets/geocoder/Control.Geocoder.css")
    register_admin_plugin_script("/plugins/geo_challenges/assets/geocoder/Control.Geocoder.js")

    # Register Leaflet.Draw (admin only — used to draw polygon answer zones)
    register_admin_plugin_stylesheet("/plugins/geo_challenges/assets/draw/leaflet.draw.css")
    register_admin_plugin_script("/plugins/geo_challenges/assets/draw/leaflet.draw.js")

    register_plugin_script("/plugins/geo_challenges/assets/view.js")

    # Convert GPS coordinates in submission tables to clickable OSM links.
    # Runs once on DOMContentLoaded + observes dynamically added elements
    # instead of polling with setInterval.
    @app.route('/plugins/geo_challenges/geo_link.js')
    def geo_link_script():
        return """
        document.addEventListener('DOMContentLoaded', function() {
            function processElement(el) {
                if (el.hasAttribute('data-processed')) return;
                var text = el.innerText || '';
                var match = text.match(/^lat:([\\-\\d.]+),lon:([\\-\\d.]+)$/);
                if (match) {
                    var lat = match[1];
                    var lon = match[2];
                    var url = 'https://www.openstreetmap.org/?mlat=' + lat + '&mlon=' + lon + '&zoom=15';
                    var originalText = el.innerHTML;
                    el.innerHTML = '<a href="' + url + '" target="_blank">' + originalText + '</a>';
                    el.setAttribute('data-processed', 'true');
                }
            }

            // Process existing elements once
            document.querySelectorAll('pre, td').forEach(processElement);

            // Watch for dynamically added elements
            var observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    mutation.addedNodes.forEach(function(node) {
                        if (node.nodeType !== 1) return;
                        if (node.matches && node.matches('pre, td')) {
                            processElement(node);
                        }
                        if (node.querySelectorAll) {
                            node.querySelectorAll('pre, td').forEach(processElement);
                        }
                    });
                });
            });
            observer.observe(document.body, { childList: true, subtree: true });
        });
        """, 200, {'Content-Type': 'application/javascript'}

    # Enregistrer le script personnalisé
    register_plugin_script("/plugins/geo_challenges/geo_link.js")
    register_admin_plugin_script("/plugins/geo_challenges/geo_link.js")
    register_plugin_script("/plugins/geo_challenges/assets/i18n.js")

    # Register the plugin assets directory
    register_plugin_assets_directory(
        app, base_path="/plugins/geo_challenges/assets/"
    )

    # Register the challenge type's blueprint
    app.register_blueprint(GeoChallengeType.blueprint)

    # Register the challenge type
    CHALLENGE_CLASSES["geo"] = GeoChallengeType
    CHALLENGE_CLASSES["geo_dynamic"] = GeoDynamicChallengeType
