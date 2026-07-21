from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.dashboard import RecordType


class Category(BaseModel):
    id: UUID
    name: str
    translation_key: str | None = None
    is_system: bool = False
    parent_id: UUID | None = None
    sort_order: int
    is_archived: bool

    model_config = ConfigDict(from_attributes=True)


class CategoryTree(Category):
    subcategories: list[Category] = Field(default_factory=list)


class CategoriesListResponse(BaseModel):
    categories: list[CategoryTree]


class CategoryCreateRequest(BaseModel):
    name: str = Field(min_length=1)
    category_type: RecordType | None = None
    parent_id: UUID | None = None

    model_config = ConfigDict(extra="forbid")

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Category name is required.")
        return stripped

    @model_validator(mode="after")
    def require_type_for_main_category(self) -> "CategoryCreateRequest":
        if self.parent_id is None and self.category_type is None:
            raise ValueError("category_type is required when creating a main category.")
        return self


class CategoryUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    is_archived: bool | None = None

    model_config = ConfigDict(extra="forbid")

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, value: str | None) -> str | None:
        if value is None:
            raise ValueError("Category name cannot be null.")
        stripped = value.strip()
        if not stripped:
            raise ValueError("Category name is required.")
        return stripped

    @field_validator("is_archived")
    @classmethod
    def is_archived_must_be_bool(cls, value: bool | None) -> bool | None:
        if value is None:
            raise ValueError("is_archived must be true or false.")
        return value

    @model_validator(mode="after")
    def require_update_field(self) -> "CategoryUpdateRequest":
        if not self.model_fields_set:
            raise ValueError("At least one field is required.")
        return self


class CategoryReorderRequest(BaseModel):
    category_type: RecordType | None = None
    parent_id: UUID | None = None
    category_ids: list[UUID] = Field(min_length=1)

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def require_scope(self) -> "CategoryReorderRequest":
        if self.parent_id is None and self.category_type is None:
            raise ValueError("category_type is required when parent_id is not provided.")
        return self
