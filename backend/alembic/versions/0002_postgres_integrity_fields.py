"""Add job/application fields and database-enforced status/role integrity.

Revision ID: 0002_postgres_integrity
Revises: 0001_initial
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_postgres_integrity"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.create_check_constraint(
            "ck_users_role",
            "role IN ('job_seeker', 'employer')",
        )

    with op.batch_alter_table("jobs") as batch_op:
        batch_op.add_column(
            sa.Column("status", sa.String(length=20), server_default="open", nullable=False)
        )
        batch_op.add_column(
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            )
        )
        batch_op.create_check_constraint(
            "ck_jobs_status",
            "status IN ('open', 'closed', 'draft')",
        )

    op.drop_index("ix_applications_applicant_id", table_name="applications")
    with op.batch_alter_table("applications") as batch_op:
        batch_op.drop_constraint(
            "uq_application_job_applicant", type_="unique"
        )
        batch_op.alter_column(
            "applicant_id",
            new_column_name="job_seeker_id",
            existing_type=sa.Uuid(),
            existing_nullable=False,
        )
        batch_op.add_column(
            sa.Column("resume_url", sa.String(length=2048), nullable=True)
        )
        batch_op.add_column(sa.Column("cover_letter", sa.Text(), nullable=True))
        if op.get_bind().dialect.name != "sqlite":
            batch_op.create_unique_constraint(
                "uq_application_job_job_seeker",
                ["job_id", "job_seeker_id"],
            )
        batch_op.create_check_constraint(
            "ck_applications_status",
            "status IN ('Pending', 'Shortlisted', 'Rejected', 'Accepted')",
        )
    op.create_index(
        "ix_applications_job_seeker_id",
        "applications",
        ["job_seeker_id"],
        unique=False,
    )
    if op.get_bind().dialect.name == "sqlite":
        op.create_index(
            "uq_application_job_job_seeker",
            "applications",
            ["job_id", "job_seeker_id"],
            unique=True,
        )


def downgrade() -> None:
    op.drop_index("ix_applications_job_seeker_id", table_name="applications")
    if op.get_bind().dialect.name == "sqlite":
        op.drop_index(
            "uq_application_job_job_seeker",
            table_name="applications",
        )
    with op.batch_alter_table("applications") as batch_op:
        batch_op.drop_constraint("ck_applications_status", type_="check")
        if op.get_bind().dialect.name != "sqlite":
            batch_op.drop_constraint(
                "uq_application_job_job_seeker", type_="unique"
            )
        batch_op.drop_column("cover_letter")
        batch_op.drop_column("resume_url")
        batch_op.alter_column(
            "job_seeker_id",
            new_column_name="applicant_id",
            existing_type=sa.Uuid(),
            existing_nullable=False,
        )
        batch_op.create_unique_constraint(
            "uq_application_job_applicant",
            ["job_id", "applicant_id"],
        )
    op.create_index(
        "ix_applications_applicant_id",
        "applications",
        ["applicant_id"],
        unique=False,
    )
    with op.batch_alter_table("jobs") as batch_op:
        batch_op.drop_constraint("ck_jobs_status", type_="check")
        batch_op.drop_column("updated_at")
        batch_op.drop_column("status")
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_constraint("ck_users_role", type_="check")
