from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from app.dependencies.auth import DbSession, require_role
from app.models.user import User
from app.schemas.application import ApplicationRead, ApplicationStatusUpdate
from app.services.applications import list_my_applications, update_application_status

router = APIRouter(prefix="/applications", tags=["applications"])
JobSeekerUser = Annotated[User, Depends(require_role("job_seeker"))]
EmployerUser = Annotated[User, Depends(require_role("employer"))]


@router.get("/my", response_model=list[ApplicationRead])
def get_my_applications(
    db: DbSession,
    applicant: JobSeekerUser,
) -> list[ApplicationRead]:
    return list_my_applications(db, applicant)


@router.patch("/{application_id}/status", response_model=ApplicationRead)
def patch_application_status(
    application_id: UUID,
    payload: ApplicationStatusUpdate,
    db: DbSession,
    employer: EmployerUser,
) -> ApplicationRead:
    return update_application_status(db, employer, application_id, payload)
