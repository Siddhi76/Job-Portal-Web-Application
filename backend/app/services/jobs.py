import math
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.models.application import Application
from app.models.job import Job
from app.models.user import User
from app.schemas.job import JobCreate, JobPage, JobRead, JobUpdate


def _to_job_read(job: Job) -> JobRead:
    return JobRead(
        id=str(job.id),
        title=job.title,
        company=job.company,
        location=job.location,
        category=job.category,
        employment_type=job.employment_type,
        salary=job.salary,
        description=job.description,
        skills=job.skills,
        status=job.status,
        posted=job.created_at.strftime("%b %d, %Y").replace(" 0", " ")
        if job.created_at
        else "Recently",
        logo=job.company[:1].upper(),
        applicants=len(job.applications),
    )


def list_jobs(
    db: Session,
    *,
    q: str | None,
    title: str | None,
    location: str | None,
    category: str | None,
    employment_type: str | None,
    page: int,
    page_size: int,
) -> JobPage:
    statement = select(Job).where(Job.status == "open").options(joinedload(Job.applications))
    count_statement = select(func.count(Job.id)).where(Job.status == "open")
    filters = []
    query = q or title
    if query:
        pattern = f"%{query.strip()}%"
        filters.append(
            or_(
                Job.title.ilike(pattern),
                Job.company.ilike(pattern),
                Job.category.ilike(pattern),
                cast(Job.skills, String).ilike(pattern),
            )
        )
    if location:
        filters.append(Job.location.ilike(f"%{location.strip()}%"))
    if category:
        filters.append(Job.category.ilike(category.strip()))
    if employment_type:
        filters.append(Job.employment_type.ilike(employment_type.strip()))
    if filters:
        statement = statement.where(*filters)
        count_statement = count_statement.where(*filters)

    total = db.scalar(count_statement) or 0
    jobs = (
        db.scalars(
            statement.order_by(Job.created_at.desc(), Job.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        .unique()
        .all()
    )
    return JobPage(
        items=[_to_job_read(job) for job in jobs],
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size),
    )


def list_employer_jobs(db: Session, employer: User) -> list[JobRead]:
    jobs = db.scalars(
        select(Job)
        .where(Job.employer_id == employer.id)
        .options(joinedload(Job.applications))
        .order_by(Job.created_at.desc(), Job.id)
    ).unique().all()
    return [_to_job_read(job) for job in jobs]


def get_job(db: Session, job_id: UUID) -> JobRead:
    job = db.scalar(
        select(Job).where(Job.id == job_id).options(joinedload(Job.applications))
    )
    if job is None or job.status != "open":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return _to_job_read(job)


def create_job(db: Session, employer: User, payload: JobCreate) -> JobRead:
    job = Job(employer_id=employer.id, **payload.model_dump())
    db.add(job)
    db.commit()
    db.refresh(job)
    return _to_job_read(job)


def update_job(
    db: Session, employer: User, job_id: UUID, payload: JobUpdate
) -> JobRead:
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if job.employer_id != employer.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this job")
    for field, value in payload.model_dump().items():
        setattr(job, field, value)
    db.commit()
    db.refresh(job)
    return _to_job_read(job)


def delete_job(db: Session, employer: User, job_id: UUID) -> None:
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if job.employer_id != employer.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this job")
    db.delete(job)
    db.commit()


def get_owned_job(db: Session, employer: User, job_id: UUID) -> Job:
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if job.employer_id != employer.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this job")
    return job
