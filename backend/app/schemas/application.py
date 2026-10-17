from enum import StrEnum

from pydantic import Field, HttpUrl

from app.schemas.common import ApiSchema


class ApplicationStatus(StrEnum):
    PENDING = "Pending"
    SHORTLISTED = "Shortlisted"
    REJECTED = "Rejected"
    ACCEPTED = "Accepted"


class ApplicationRead(ApiSchema):
    id: str
    job_id: str
    applicant_id: str
    applicant_name: str
    job_title: str
    status: ApplicationStatus
    applied_at: str
    resume_url: str | None = None
    cover_letter: str | None = None


class ApplicationStatusUpdate(ApiSchema):
    status: ApplicationStatus = Field()


class ApplicationCreate(ApiSchema):
    resume_url: HttpUrl | None = None
    cover_letter: str | None = Field(default=None, max_length=12000)
