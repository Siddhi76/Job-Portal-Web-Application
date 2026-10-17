from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.models.application import Application
from app.models.job import Job
from app.models.user import User
from app.schemas.application import (
    ApplicationRead,
    ApplicationStatus,
    ApplicationStatusUpdate,
)
from app.services.jobs import get_owned_job


def _application_read(application: Application) -> ApplicationRead:
    return ApplicationRead(
        id=str(application.id),
        job_id=str(application.job_id),
        applicant_id=str(application.applicant_id),
        applicant_name=application.applicant.name,
        job_title=application.job.title,
        status=application.status,
        applied_at=application.created_at.isoformat() if application.created_at else "",
        resume_url=application.resume_url,
        cover_letter=application.cover_letter,
    )


def apply_to_job(
    db: Session,
    applicant: User,
    job_id: UUID,
    *,
    resume_url: str | None = None,
    cover_letter: str | None = None,
) -> ApplicationRead:
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if job.status != "open":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This job is not accepting applications",
        )
    existing = db.scalar(
        select(Application).where(
            Application.job_id == job_id,
            Application.applicant_id == applicant.id,
        )
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already applied for this job",
        )
    application = Application(
        job_id=job_id,
        applicant_id=applicant.id,
        resume_url=resume_url,
        cover_letter=cover_letter,
    )
    db.add(application)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already applied for this job",
        ) from exc
    db.refresh(application)
    return _application_read(
        db.scalar(
            select(Application)
            .where(Application.id == application.id)
            .options(joinedload(Application.applicant), joinedload(Application.job))
        )
    )


def list_my_applications(db: Session, applicant: User) -> list[ApplicationRead]:
    applications = db.scalars(
        select(Application)
        .where(Application.applicant_id == applicant.id)
        .options(joinedload(Application.applicant), joinedload(Application.job))
        .order_by(Application.created_at.desc())
    ).all()
    return [_application_read(application) for application in applications]


def list_job_applications(
    db: Session, employer: User, job_id: UUID
) -> list[ApplicationRead]:
    get_owned_job(db, employer, job_id)
    applications = db.scalars(
        select(Application)
        .where(Application.job_id == job_id)
        .options(joinedload(Application.applicant), joinedload(Application.job))
        .order_by(Application.created_at.desc())
    ).all()
    return [_application_read(application) for application in applications]


def update_application_status(
    db: Session,
    employer: User,
    application_id: UUID,
    payload: ApplicationStatusUpdate,
) -> ApplicationRead:
    application = db.scalar(
        select(Application)
        .where(Application.id == application_id)
        .options(joinedload(Application.job), joinedload(Application.applicant))
    )
    if application is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Application not found"
        )
    if application.job.employer_id != employer.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not own the job for this application",
        )
    application.status = ApplicationStatus(payload.status).value
    db.commit()
    db.refresh(application)
    return _application_read(application)
