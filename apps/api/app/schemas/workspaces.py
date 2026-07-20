from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.currency import SupportedCurrency


WorkspaceType = Literal["personal", "team"]
WorkspaceRole = Literal["owner", "admin", "member", "viewer"]
AssignableMemberRole = Literal["admin", "member", "viewer"]


class Workspace(BaseModel):
    id: UUID
    type: WorkspaceType
    name: str
    role: WorkspaceRole
    currency: SupportedCurrency = "SAR"
    auto_delete_after_extraction: bool = False
    currency_locked: bool = False
    member_count: int | None = None

    model_config = ConfigDict(from_attributes=True)


class WorkspacesListResponse(BaseModel):
    workspaces: list[Workspace]


class WorkspaceCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class WorkspaceUpdateRequest(BaseModel):
    auto_delete_after_extraction: bool | None = None
    currency: SupportedCurrency | None = None

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def require_update_field(self) -> "WorkspaceUpdateRequest":
        if not any(
            field in self.model_fields_set and getattr(self, field) is not None
            for field in ("auto_delete_after_extraction", "currency")
        ):
            raise ValueError("At least one field is required.")
        return self


class WorkspaceSettingsResponse(BaseModel):
    id: UUID
    currency: SupportedCurrency = "SAR"
    auto_delete_after_extraction: bool


class WorkspaceMember(BaseModel):
    user_id: UUID
    email: str
    role: WorkspaceRole


class WorkspaceMembersListResponse(BaseModel):
    members: list[WorkspaceMember]


class MemberAddRequest(BaseModel):
    email: str
    role: str


class MemberRoleUpdateRequest(BaseModel):
    role: str
