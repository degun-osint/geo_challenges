"""Add geo_dynamic_challenge table

Revision ID: 3c8d0e6f7a12
Revises: 2b7c9d4e5f01
Create Date: 2026-10-04 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '3c8d0e6f7a12'
down_revision = '2b7c9d4e5f01'
branch_labels = None
depends_on = None


def upgrade(op=None):
    # Create geo_dynamic_challenge table if it doesn't exist
    try:
        op.create_table(
            'geo_dynamic_challenge',
            sa.Column('id', sa.Integer, sa.ForeignKey('challenges.id', ondelete='CASCADE'), primary_key=True),
            sa.Column('latitude', sa.Numeric(12, 10), server_default="0"),
            sa.Column('longitude', sa.Numeric(13, 10), server_default="0"),
            sa.Column('tolerance_radius', sa.Numeric(10, 2), server_default="10"),
            sa.Column('polygon', sa.Text, nullable=True),
            sa.Column('dynamic_initial', sa.Integer, nullable=True),
            sa.Column('dynamic_minimum', sa.Integer, nullable=True),
            sa.Column('dynamic_decay', sa.Integer, nullable=True),
            sa.Column('dynamic_function', sa.String(32), nullable=True),
        )
    except Exception as e:
        print(f"Table creation error (might already exist): {str(e)}")


def downgrade(op=None):
    try:
        op.drop_table('geo_dynamic_challenge')
    except Exception as e:
        print(f"Table drop error: {str(e)}")
