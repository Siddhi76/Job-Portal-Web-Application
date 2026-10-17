from pydantic import Field, field_validator

from app.schemas.common import ApiSchema

class JobCreate(ApiSchema):
    title: str = Field(min_length=2, max_length=160)
    company: str = Field(min_length=1, max_length=160)
    location: str = Field(min_length=1, max_length=160)
    category: str = Field(min_length=1, max_length=80)
    employment_type: str = Field(min_length=1, max_length=30)
    salary: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=10, max_length=12000)
    skills: list[str] = Field(default_factory=list, max_length=30)
    status: str = Field(default="open", pattern="^(open|closed|draft)$")

    @field_validator("title", "company", "location", "category", "employment_type", "salary")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field must not be blank")
        return value

    @field_validator("description")
    @classmethod
    def strip_description(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 10:
            raise ValueError("Description must contain at least 10 non-whitespace characters")
        return value

    @field_validator("skills")
    @classmethod
    def clean_skills(cls, values: list[str]) -> list[str]:
        return [skill.strip() for skill in values if skill.strip()]


class JobUpdate(JobCreate):
    pass


class JobRead(ApiSchema):
    id: str
    title: str
    company: str
    location: str
    category: str
    employment_type: str
    salary: str
    description: str
    skills: list[str]
    status: str = "open"
    posted: str
    featured: bool = False
    logo: str
    color: str = "mint"
    applicants: int


class JobPage(ApiSchema):
    items: list[JobRead]
    total: int
    page: int
    page_size: int
    pages: int
