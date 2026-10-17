from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.dependencies.auth import DbSession, require_role
from app.models.user import User
from app.schemas.application import ApplicationCreate, ApplicationRead
from app.schemas.job import JobCreate, JobPage, JobRead, JobUpdate
from app.services.applications import apply_to_job, list_job_applications
from app.services.jobs import (
    create_job,
    delete_job,
    get_job,
    list_employer_jobs,
    list_jobs,
    update_job,
)

router = APIRouter(prefix="/jobs", tags=["jobs"])
EmployerUser = Annotated[User, Depends(require_role("employer"))]


@router.get("", response_model=JobPage)
def get_jobs(
    db: DbSession,
    q: str | None = Query(default=None, max_length=160),
    title: str | None = Query(default=None, max_length=160),
    location: str | None = Query(default=None, max_length=160),
    category: str | None = Query(default=None, max_length=80),
    employment_type: str | None = Query(default=None, alias="employmentType", max_length=30),
    employment_type_snake: str | None = Query(default=None, alias="employment_type", max_length=30),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=6, ge=1, le=100, alias="pageSize"),
    page_size_snake: int | None = Query(default=None, alias="page_size", ge=1, le=100),
) -> JobPage:
    return list_jobs(
        db,
        q=q,
        title=title,
        location=location,
        category=category,
        employment_type=employment_type or employment_type_snake,
        page=page,
        page_size=page_size_snake or page_size,
    )


@router.get("/mine", response_model=list[JobRead])
def get_my_jobs(db: DbSession, employer: EmployerUser) -> list[JobRead]:
    return list_employer_jobs(db, employer)


@router.get("/{job_id}", response_model=JobRead)
def get_job_by_id(job_id: UUID, db: DbSession) -> JobRead:
    return get_job(db, job_id)


@router.post("", response_model=JobRead, status_code=status.HTTP_201_CREATED)
def post_job(payload: JobCreate, db: DbSession, employer: EmployerUser) -> JobRead:
    return create_job(db, employer, payload)


@router.put("/{job_id}", response_model=JobRead)
def put_job(
    job_id: UUID, payload: JobUpdate, db: DbSession, employer: EmployerUser
) -> JobRead:
    return update_job(db, employer, job_id, payload)


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_job(job_id: UUID, db: DbSession, employer: EmployerUser) -> Response:
    delete_job(db, employer, job_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{job_id}/apply",
    response_model=ApplicationRead,
    status_code=status.HTTP_201_CREATED,
)
def apply_for_job(
    job_id: UUID,
    db: DbSession,
    applicant: Annotated[User, Depends(require_role("job_seeker"))],
    payload: ApplicationCreate | None = None,
) -> ApplicationRead:
    application = payload or ApplicationCreate()
    return apply_to_job(
        db,
        applicant,
        job_id,
        resume_url=str(application.resume_url) if application.resume_url else None,
        cover_letter=application.cover_letter,
    )


@router.get("/{job_id}/applications", response_model=list[ApplicationRead])
def get_applications_for_job(
    job_id: UUID,
    db: DbSession,
    employer: EmployerUser,
) -> list[ApplicationRead]:
    return list_job_applications(db, employer, job_id)
