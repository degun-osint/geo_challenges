"""GeoLoc challenge — initial table migration

Revision ID: gl1a2b3c4d5e
Revises:
Create Date: 2026-03-07
"""
from alembic import op
import sqlalchemy as sa

revision = "gl1a2b3c4d5e"
down_revision = None
branch_labels = None
depends_on = None


def upgrade(op=None):
    try:
        op.create_table(
            "geoloc_challenge",
            sa.Column(
                "id",
                sa.Integer,
                sa.ForeignKey("challenges.id", ondelete="CASCADE"),
                primary_key=True,
            ),
            sa.Column("target_lat", sa.Numeric(12, 10), default=0),
            sa.Column("target_lon", sa.Numeric(13, 10), default=0),
            sa.Column("radius_meters", sa.Numeric(10, 2), default=50),
        )
    except Exception as exc:
        print(f"[geoloc] Migration skipped (table may already exist): {exc}")


def downgrade(op=None):
    try:
        op.drop_table("geoloc_challenge")
    except Exception as exc:
        print(f"[geoloc] Downgrade error: {exc}")
