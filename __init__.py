import json
import logging
import math
import os

from flask import Blueprint, jsonify, request as flask_request
from CTFd.models import Challenges, Solves, Fails, Users, db
from CTFd.plugins import (
    register_plugin_assets_directory,
    register_plugin_script,
    register_plugin_stylesheet,
    register_admin_plugin_stylesheet,
    register_admin_plugin_script,
)
from CTFd.plugins.challenges import CHALLENGE_CLASSES, BaseChallenge, ChallengeResponse
from CTFd.utils.user import get_ip
from CTFd.utils import get_config, set_config
from CTFd.utils.decorators import admins_only
from CTFd.plugins.migrations import upgrade
from sqlalchemy import Numeric

logger = logging.getLogger(__name__)

# Derive paths from the actual directory name so renaming the plugin folder
# does not break asset registration or template URLs.
_PLUGIN_DIR = os.path.basename(os.path.dirname(os.path.abspath(__file__)))
_ASSETS = f"/plugins/{_PLUGIN_DIR}/assets"
_PLUGIN = f"/plugins/{_PLUGIN_DIR}"


class GeolocChallenge(Challenges):
    __mapper_args__ = {"polymorphic_identity": "geoloc"}
    id = db.Column(
        db.Integer,
        db.ForeignKey("challenges.id", ondelete="CASCADE"),
        primary_key=True,
    )
    target_lat = db.Column(Numeric(12, 10), nullable=False, server_default="0")
    target_lon = db.Column(Numeric(13, 10), nullable=False, server_default="0")
    radius_meters = db.Column(Numeric(10, 2), nullable=False, server_default="50")
    tolerance_buffer_pct = db.Column(Numeric(5, 2), nullable=False, server_default="0")


class GeolocChallengeType(BaseChallenge):
    id = "geoloc"
    name = "geoloc"
    templates = {
        "create": f"{_ASSETS}/create.html",
        "update": f"{_ASSETS}/update.html",
        "view":   f"{_ASSETS}/view.html",
    }
    scripts = {
        # update.js handles both create and update (reads initial coords from
        # form fields, falls back to (0,0) / zoom-2 when fields are empty).
        "create": f"{_ASSETS}/update.js",
        "update": f"{_ASSETS}/update.js",
        "view":   f"{_ASSETS}/view.js",
    }
    route = f"{_ASSETS}/"
    blueprint = Blueprint(
        "geo_challenges",
        __name__,
        template_folder="templates",
        static_folder="assets",
    )
    challenge_model = GeolocChallenge

    @classmethod
    def create(cls, request):
        data = request.form or request.get_json()
        challenge = cls.challenge_model(
            name=data.get("name", ""),
            description=data.get("description", ""),
            category=data.get("category", ""),
            value=int(data.get("value", 0)),
            state=data.get("state", "visible"),
            max_attempts=int(data.get("max_attempts", 0) or 0),
            type="geoloc",
        )
        lat    = float(data.get("target_lat", 0) or 0)
        lon    = float(data.get("target_lon", 0) or 0)
        radius = float(data.get("radius_meters", 50) or 50)
        tol    = float(data.get("tolerance_buffer_pct", 0) or 0)
        if not (-90 <= lat <= 90):               raise ValueError("target_lat out of range")
        if not (-180 <= lon <= 180):             raise ValueError("target_lon out of range")
        if not (0 < radius <= 40_075_000):       raise ValueError("radius_meters out of range")
        if not (0 <= tol <= 500):                raise ValueError("tolerance_buffer_pct out of range")
        challenge.target_lat           = lat
        challenge.target_lon           = lon
        challenge.radius_meters        = radius
        challenge.tolerance_buffer_pct = tol
        db.session.add(challenge)
        db.session.commit()
        return challenge

    _VALID_LAYERS = {"osm", "esri", "google_street", "google_hybrid"}

    @classmethod
    def read(cls, challenge):
        data = super().read(challenge)
        data["radius_meters"]        = float(challenge.radius_meters or 50)
        data["tolerance_buffer_pct"] = float(challenge.tolerance_buffer_pct or 0)
        # Expose the admin-configured default layer so view.js can apply it
        # immediately without a second round-trip.
        data["default_layer"] = get_config("geoloc_default_layer", default="google_hybrid")
        # Never expose target coordinates to players via the public API.
        return data

    @classmethod
    def update(cls, challenge, request):
        data = request.form or request.get_json()
        for attr in ("name", "description", "category", "value", "state",
                     "max_attempts", "next_id", "attribution", "connection_info"):
            if attr in data:
                val = data[attr]
                if attr in ("value", "max_attempts"):
                    try:
                        val = int(val)
                    except (ValueError, TypeError):
                        val = 0
                setattr(challenge, attr, val)
        if "target_lat" in data:
            lat = float(data["target_lat"] or 0)
            if not (-90 <= lat <= 90): raise ValueError("target_lat out of range")
            challenge.target_lat = lat
        if "target_lon" in data:
            lon = float(data["target_lon"] or 0)
            if not (-180 <= lon <= 180): raise ValueError("target_lon out of range")
            challenge.target_lon = lon
        if "radius_meters" in data:
            radius = float(data["radius_meters"] or 50)
            if not (0 < radius <= 40_075_000): raise ValueError("radius_meters out of range")
            challenge.radius_meters = radius
        if "tolerance_buffer_pct" in data:
            tol = float(data["tolerance_buffer_pct"] or 0)
            if not (0 <= tol <= 500): raise ValueError("tolerance_buffer_pct out of range")
            challenge.tolerance_buffer_pct = tol
        db.session.commit()
        return challenge

    @staticmethod
    def _haversine(lat1, lon1, lat2, lon2):
        """Return the distance in metres between two GPS coordinates (Haversine formula)."""
        R = 6_371_000
        p1, p2 = math.radians(lat1), math.radians(lat2)
        dp = math.radians(lat2 - lat1)
        dl = math.radians(lon2 - lon1)
        a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    @classmethod
    def attempt(cls, challenge, request):
        data = request.form or request.get_json()
        try:
            player_lat = float(data.get("coord_lat"))
            player_lon = float(data.get("coord_lon"))
        except (ValueError, TypeError):
            return ChallengeResponse(
                status="incorrect", message="Invalid coordinates submitted."
            )

        if not (-90 <= player_lat <= 90) or not (-180 <= player_lon <= 180):
            return ChallengeResponse(
                status="incorrect", message="Invalid coordinates submitted."
            )

        target_lat = float(challenge.target_lat)
        target_lon = float(challenge.target_lon)
        radius     = float(challenge.radius_meters)
        dist       = cls._haversine(target_lat, target_lon, player_lat, player_lon)

        logger.debug(
            "[GeoLoc] chall=%s target=(%.6f,%.6f) player=(%.6f,%.6f) dist=%.1fm radius=%.1fm",
            challenge.id, target_lat, target_lon, player_lat, player_lon, dist, radius,
        )

        # Accept when the player's pin lands inside the target zone,
        # optionally extended by the admin tolerance buffer.
        effective_radius = radius * (1 + float(challenge.tolerance_buffer_pct or 0) / 100)
        if dist <= effective_radius:
            return ChallengeResponse(
                status="correct",
                message=f"Location found! You were {int(dist):,} m from the exact point. 🎯"
            )

        # Proximity hints can be toggled globally or per challenge.
        per_key = f"geoloc_hint_chall_{challenge.id}"
        per_val = get_config(per_key)
        if per_val is not None:
            hints_enabled = str(per_val) not in ("0", "false", "False", "")
        else:
            hints_enabled = str(get_config("geoloc_proximity_hints", default="1")) not in ("0", "false", "False", "")

        if hints_enabled:
            if dist < 500:
                proximity = "Very close!"
            elif dist < 5_000:
                proximity = "Getting warm!"
            elif dist < 50_000:
                proximity = "You're lukewarm…"
            else:
                proximity = "Very far away."
            if dist >= 100_000:
                dist_str = f"~{dist / 1000:.0f} km"
            elif dist >= 1_000:
                dist_str = f"~{dist / 1000:.1f} km"
            else:
                dist_str = f"~{int(dist)} m"
            msg = f"Wrong location — {proximity} ({dist_str})"
        else:
            msg = "Wrong location. Try again!"

        return ChallengeResponse(status="incorrect", message=msg)

    @classmethod
    def solve(cls, user, team, challenge, request):
        data = request.form or request.get_json()
        try:
            coord_lat = float(data.get("coord_lat", 0))
            coord_lon = float(data.get("coord_lon", 0))
        except (ValueError, TypeError):
            coord_lat = 0.0
            coord_lon = 0.0
        db.session.add(
            Solves(
                user_id=user.id,
                team_id=team.id if team else None,
                challenge_id=challenge.id,
                ip=get_ip(request),
                provided=f"{coord_lat:.10f},{coord_lon:.10f}",
            )
        )
        db.session.commit()

    @classmethod
    def fail(cls, user, team, challenge, request):
        data = request.form or request.get_json()
        try:
            coord_lat = float(data.get("coord_lat", 0))
            coord_lon = float(data.get("coord_lon", 0))
        except (ValueError, TypeError):
            coord_lat = 0.0
            coord_lon = 0.0
        db.session.add(
            Fails(
                user_id=user.id,
                team_id=team.id if team else None,
                challenge_id=challenge.id,
                ip=get_ip(request),
                provided=f"{coord_lat:.10f},{coord_lon:.10f}",
            )
        )
        db.session.commit()


# ── Plugin loader ─────────────────────────────────────────────────────────────
def load(app):
    upgrade(plugin_name=_PLUGIN_DIR)
    app.db.create_all()

    from flask import render_template as _render

    # Admin settings page — protected by @admins_only for consistency.
    @app.route(f"{_PLUGIN}/settings")
    @admins_only
    def geoloc_admin_settings_page():
        proximity_hints = str(get_config("geoloc_proximity_hints", default="1")) not in ("0", "false", "False", "")
        return _render("geoloc_settings.html", proximity_hints=proximity_hints)

    # Global settings: proximity hints + default map layer (read/write).
    @app.route(f"{_PLUGIN}/api/settings", methods=["GET", "POST"])
    @admins_only
    def geoloc_settings():
        if flask_request.method == "POST":
            body = flask_request.get_json() or {}
            if "proximity_hints" in body:
                set_config("geoloc_proximity_hints", "1" if body["proximity_hints"] else "0")
            if "default_layer" in body:
                layer = str(body["default_layer"])
                if layer in GeolocChallengeType._VALID_LAYERS:
                    set_config("geoloc_default_layer", layer)
            return jsonify({"success": True})
        proximity = str(get_config("geoloc_proximity_hints", default="1")) not in ("0", "false", "False", "")
        layer     = get_config("geoloc_default_layer", default="google_hybrid")
        return jsonify({"success": True, "proximity_hints": proximity, "default_layer": layer})

    # List all geoloc challenges with their per-challenge hint settings.
    @app.route(f"{_PLUGIN}/api/challenges")
    @admins_only
    def geoloc_challenges_list():
        challs = GeolocChallenge.query.all()
        result = []
        for gc in challs:
            per_val = get_config(f"geoloc_hint_chall_{gc.id}")
            result.append({
                "id":           gc.id,
                "name":         gc.name,
                "category":     gc.category,
                "value":        gc.value,
                "radius_meters": float(gc.radius_meters),
                # None = inherit global, "1" = forced on, "0" = forced off
                "hint_setting": per_val,
            })
        return jsonify({"success": True, "data": result})

    # Override the proximity-hint setting for a specific challenge.
    @app.route(f"{_PLUGIN}/api/challenges/<int:challenge_id>/hint", methods=["POST"])
    @admins_only
    def geoloc_challenge_hint(challenge_id):
        if not db.session.get(GeolocChallenge, challenge_id):
            return jsonify({"success": False, "message": "Challenge not found"}), 404
        body = flask_request.get_json() or {}
        val = body.get("hint_setting")
        if val is None or val == "inherit":
            set_config(f"geoloc_hint_chall_{challenge_id}", None)
        else:
            set_config(
                f"geoloc_hint_chall_{challenge_id}",
                "1" if str(val) in ("1", "true", "True") else "0",
            )
        return jsonify({"success": True})

    # All geoloc submissions with computed distances (last 500 each for solves/fails).
    @app.route(f"{_PLUGIN}/api/submissions")
    @admins_only
    def geoloc_submissions_list():
        challs = {c.id: c for c in GeolocChallenge.query.all()}
        if not challs:
            return jsonify({"success": True, "data": []})

        cids = list(challs.keys())
        rows = []

        solves = Solves.query.filter(Solves.challenge_id.in_(cids)).order_by(Solves.date.desc()).limit(500).all()
        fails  = Fails.query.filter(Fails.challenge_id.in_(cids)).order_by(Fails.date.desc()).limit(500).all()

        # Collect all unique user IDs then fetch them in one query instead of
        # one query per submission (avoids the N+1 problem).
        all_uids = {s.user_id for s in solves} | {s.user_id for s in fails}
        users = {u.id: u for u in Users.query.filter(Users.id.in_(all_uids)).all()}

        def _build_row(sub, kind):
            chall = challs[sub.challenge_id]
            user  = users.get(sub.user_id)
            try:
                plat, plon = [float(x) for x in sub.provided.split(",")]
                dist = GeolocChallengeType._haversine(
                    float(chall.target_lat), float(chall.target_lon), plat, plon)
            except Exception:
                plat = plon = dist = None
            return {
                "id": sub.id, "type": kind,
                "challenge_id": chall.id, "challenge_name": chall.name,
                "user": user.name if user else "?",
                "player_lat": plat, "player_lon": plon,
                "target_lat": float(chall.target_lat), "target_lon": float(chall.target_lon),
                "radius_meters": float(chall.radius_meters),
                "tolerance_buffer_pct": float(chall.tolerance_buffer_pct or 0),
                "distance_m": round(dist, 1) if dist is not None else None,
                "date": sub.date.strftime("%Y-%m-%d %H:%M") if sub.date else "",
            }

        for sub in solves:
            rows.append(_build_row(sub, "correct"))
        for sub in fails:
            rows.append(_build_row(sub, "incorrect"))

        rows.sort(key=lambda r: r["date"], reverse=True)
        return jsonify({"success": True, "data": rows})

    # Register Leaflet and Geocoder for both player and admin pages.
    for fn in (register_plugin_stylesheet, register_admin_plugin_stylesheet):
        fn(f"{_ASSETS}/leaflet/leaflet.css")
        fn(f"{_ASSETS}/geocoder/Control.Geocoder.css")

    for fn in (register_plugin_script, register_admin_plugin_script):
        fn(f"{_ASSETS}/leaflet/leaflet.js")
        fn(f"{_ASSETS}/geocoder/Control.Geocoder.js")

    register_plugin_script(f"{_ASSETS}/i18n.js")

    register_plugin_assets_directory(app, base_path=f"{_ASSETS}/")
    app.register_blueprint(GeolocChallengeType.blueprint)
    CHALLENGE_CLASSES["geoloc"] = GeolocChallengeType
