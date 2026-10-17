"""Create the initial user, job, and application schema.

Revision ID: 0001_initial
Revises:
"""
from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None

uuid_type = sa.Uuid()


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("email", sa.String(length=254), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_role", "users", ["role"], unique=False)

    op.create_table(
        "jobs",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("employer_id", uuid_type, nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("company", sa.String(length=160), nullable=False),
        sa.Column("location", sa.String(length=160), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=False),
        sa.Column("employment_type", sa.String(length=30), nullable=False),
        sa.Column("salary", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("skills", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["employer_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("employer_id", "title", "location", "category", "employment_type"):
        op.create_index(f"ix_jobs_{column}", "jobs", [column], unique=False)

    op.create_table(
        "applications",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("job_id", uuid_type, nullable=False),
        sa.Column("applicant_id", uuid_type, nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["applicant_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("job_id", "applicant_id", name="uq_application_job_applicant"),
    )
    op.create_index("ix_applications_applicant_id", "applications", ["applicant_id"], unique=False)
    op.create_index("ix_applications_job_id", "applications", ["job_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_applications_job_id", table_name="applications")
    op.drop_index("ix_applications_applicant_id", table_name="applications")
    op.drop_table("applications")
    for column in ("employment_type", "category", "location", "title", "employer_id"):
        op.drop_index(f"ix_jobs_{column}", table_name="jobs")
    op.drop_table("jobs")
    op.drop_index("ix_users_role", table_name="users")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
