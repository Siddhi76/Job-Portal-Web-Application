from enum import StrEnum

from pydantic import EmailStr, Field, field_validator, model_validator

from app.schemas.common import ApiSchema


class UserRole(StrEnum):
    JOB_SEEKER = "job_seeker"
    EMPLOYER = "employer"


class UserCreate(ApiSchema):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: UserRole

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Name must not be blank")
        return value


class UserRead(ApiSchema):
    id: str
    name: str
    email: EmailStr
    role: UserRole


class UserUpdate(ApiSchema):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    email: EmailStr | None = None

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Name must not be blank")
        return value

    @model_validator(mode="after")
    def require_update_field(self):
        if ("name" in self.model_fields_set and self.name is None) or (
            "email" in self.model_fields_set and self.email is None
        ):
            raise ValueError("Profile fields cannot be null")
        if self.name is None and self.email is None:
            raise ValueError("Provide a name or email to update")
        return self


class LoginRequest(ApiSchema):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class TokenResponse(ApiSchema):
    access_token: str
    token_type: str = "bearer"
    user: UserRead
