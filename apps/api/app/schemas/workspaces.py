from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


WorkspaceType = Literal["personal", "team"]
WorkspaceRole = Literal["owner", "admin", "member", "viewer"]
AssignableMemberRole = Literal["admin", "member", "viewer"]


class Workspace(BaseModel):
    id: UUID
    type: WorkspaceType
    name: str
    role: WorkspaceRole
    member_count: int | None = None

    model_config = ConfigDict(from_attributes=True)


class WorkspacesListResponse(BaseModel):
    workspaces: list[Workspace]


class WorkspaceCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)


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
