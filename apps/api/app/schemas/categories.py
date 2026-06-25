from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class Category(BaseModel):
    id: UUID
    name: str
    sort_order: int
    is_archived: bool

    model_config = ConfigDict(from_attributes=True)


class CategoriesListResponse(BaseModel):
    categories: list[Category]


class CategoryCreateRequest(BaseModel):
    name: str = Field(min_length=1)

    model_config = ConfigDict(extra="forbid")

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Category name is required.")
        return stripped


class CategoryUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    is_archived: bool | None = None

    model_config = ConfigDict(extra="forbid")

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, value: str | None) -> str | None:
        if value is None:
            return value
        stripped = value.strip()
        if not stripped:
            raise ValueError("Category name is required.")
        return stripped

    @model_validator(mode="after")
    def require_update_field(self) -> "CategoryUpdateRequest":
        if not self.model_fields_set:
            raise ValueError("At least one field is required.")
        return self


class CategoryReorderRequest(BaseModel):
    category_ids: list[UUID] = Field(min_length=1)

    model_config = ConfigDict(extra="forbid")
