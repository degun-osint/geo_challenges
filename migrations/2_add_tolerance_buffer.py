"""GeoLoc challenge — add tolerance_buffer_pct column

Revision ID: gl2f3e4d5c6b
Revises: gl1a2b3c4d5e
Create Date: 2026-03-07
"""
from alembic import op
import sqlalchemy as sa

revision = "gl2f3e4d5c6b"
down_revision = "gl1a2b3c4d5e"
branch_labels = None
depends_on = None


def upgrade(op=None):
    try:
        op.add_column(
            "geoloc_challenge",
            sa.Column(
                "tolerance_buffer_pct",
                sa.Numeric(5, 2),
                nullable=False,
                server_default="0",
            ),
        )
    except Exception as exc:
        print(f"[geoloc] Migration 2 skipped (column may already exist): {exc}")


def downgrade(op=None):
    try:
        op.drop_column("geoloc_challenge", "tolerance_buffer_pct")
    except Exception as exc:
        print(f"[geoloc] Downgrade migration 2 error: {exc}")
