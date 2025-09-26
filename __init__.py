from flask import Blueprint
from CTFd.models import Challenges, Solves, Fails, db
from CTFd.plugins import register_plugin_assets_directory, register_plugin_script, register_plugin_stylesheet, register_admin_plugin_stylesheet, register_admin_plugin_script
from CTFd.plugins.challenges import CHALLENGE_CLASSES, BaseChallenge, ChallengeResponse
from CTFd.utils.user import get_ip
from CTFd.plugins.migrations import upgrade
import math
from sqlalchemy import Numeric

# Patch CTFd's Challenge view to include additional fields
from CTFd.api.v1.challenges import Challenge as ChallengeAPI
original_challenge_get = ChallengeAPI.get

def patched_challenge_get(self, challenge_id):
    response = original_challenge_get(self, challenge_id)

    # Check if this is a geo challenge and add the tolerance_radius
    if isinstance(response, dict) and response.get('success'):
        challenge_data = response.get('data', {})
        if challenge_data.get('type') == 'geo':
            challenge = GeoChallenge.query.filter_by(id=challenge_id).first()
            if challenge:
                response['data']['tolerance_radius'] = float(challenge.tolerance_radius)
                # SECURITY FIX: Ne jamais exposer les coordonnées exactes de la solution
                # Les coordonnées sont uniquement utilisées côté serveur pour la validation
                # Supprimer les coordonnées de solution si elles existent dans la réponse
                if 'latitude' in response['data']:
                    del response['data']['latitude']
                if 'longitude' in response['data']:
                    del response['data']['longitude']

    return response

# Apply the patch
ChallengeAPI.get = patched_challenge_get

class GeoChallenge(Challenges):
    __mapper_args__ = {"polymorphic_identity": "geo"}
    id = db.Column(
        db.Integer, db.ForeignKey("challenges.id", ondelete="CASCADE"), primary_key=True
    )
    latitude = db.Column(Numeric(12, 10), default=0)
    longitude = db.Column(Numeric(13, 10), default=0)
    tolerance_radius = db.Column(Numeric(10, 2), default=10)

    def __init__(self, *args, **kwargs):
        self.latitude = kwargs.pop('latitude', 0)
        self.longitude = kwargs.pop('longitude', 0)
        self.tolerance_radius = kwargs.pop('tolerance_radius', 10)
        
        # Remove any Leaflet-related fields that might have been added
        keys_to_remove = []
        for key in kwargs.keys():
            if 'leaflet' in key.lower() or 'layer' in key.lower():
                keys_to_remove.append(key)
        
        for key in keys_to_remove:
            kwargs.pop(key, None)
            
        super(GeoChallenge, self).__init__(**kwargs)


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
    challenge_model = GeoChallenge

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
        submission = f"lat:{data['latitude']},lon:{data['longitude']}"

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
        submission = f"lat:{data['latitude']},lon:{data['longitude']}"

        fail = Fails(
            user_id=user.id,
            team_id=team.id if team else None,
            challenge_id=challenge.id,
            ip=get_ip(request),
            provided=submission
        )
        
        db.session.add(fail)
        db.session.commit()

def load(app):
    
    upgrade(plugin_name="geo_challenges")

    # Create tables for the plugin
    app.db.create_all()
    
    # Add API endpoint for formatting submissions
    @app.route('/plugins/geo_challenges/api/format-submission', methods=['POST'])
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
    
    register_plugin_script("/plugins/geo_challenges/assets/view.js")

    # Ajout d'un script très simple pour les liens de coordonnées GPS
    @app.route('/plugins/geo_challenges/geo_link.js')
    def geo_link_script():
        return """
        document.addEventListener('DOMContentLoaded', function() {
            // Script minimal pour convertir les coordonnées GPS en liens
            setInterval(function() {
                var elements = document.querySelectorAll('pre, td');
                elements.forEach(function(el) {
                    if (el.hasAttribute('data-processed')) return;
                    
                    var text = el.innerText || '';
                    var match = text.match(/^lat:([-\\d.]+),lon:([-\\d.]+)$/);
                    
                    if (match) {
                        var lat = match[1];
                        var lon = match[2];
                        var url = 'https://www.openstreetmap.org/?mlat=' + lat + '&mlon=' + lon + '&zoom=15';
                        
                        // Créer un lien simple sans toucher au DOM complexe
                        var originalText = el.innerHTML;
                        var newHtml = '<a href="' + url + '" target="_blank">' + originalText + '</a>';
                        el.innerHTML = newHtml;
                        
                        // Marquer comme traité
                        el.setAttribute('data-processed', 'true');
                    }
                });
            }, 2000); // Exécuter toutes les 2 secondes
        });
        """

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