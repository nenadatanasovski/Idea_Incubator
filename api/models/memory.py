"""
Pydantic models for Memory Graph entities.

ARCH-001: 9 canonical block types
"""

from datetime import datetime
from typing import Literal, Any
from pydantic import BaseModel, Field


# ARCH-001: Canonical block types
BlockType = Literal[
    "knowledge",   # Verified facts, patterns, insights
    "decision",    # Choices made with rationale
    "assumption",  # Unverified beliefs to test
    "question",    # Open unknowns to investigate
    "requirement", # Constraints, must-haves
    "task",        # Work items, actions
    "proposal",    # Suggested changes awaiting approval
    "artifact",    # Outputs (code, docs, specs)
    "evidence",    # Validation data, proof
]

BlockStatus = Literal["draft", "active", "validated", "superseded", "abandoned"]
AbstractionLevel = Literal["vision", "strategy", "tactic", "implementation"]

LinkType = Literal[
    "addresses", "creates", "requires", "conflicts", "supports",
    "depends_on", "enables", "suggests", "supersedes", "validates",
    "invalidates", "references", "evidence_for", "elaborates",
    "refines", "specializes", "alternative_to", "instance_of",
    "constrained_by", "derived_from", "measured_by",
]

LinkDegree = Literal["full", "partial", "minimal"]
LinkStatus = Literal["active", "superseded", "removed"]


class MemoryBlockBase(BaseModel):
    """Base schema for memory blocks."""
    type: BlockType
    title: str | None = None
    content: str
    session_id: str
    idea_id: str | None = None
    properties: dict[str, Any] | None = None
    status: BlockStatus = "active"
    confidence: float | None = Field(None, ge=0, le=1)
    abstraction_level: AbstractionLevel | None = None
    artifact_id: str | None = None


class MemoryBlockCreate(MemoryBlockBase):
    """Schema for creating a memory block."""
    pass


class MemoryBlockUpdate(BaseModel):
    """Schema for updating a memory block."""
    type: BlockType | None = None
    title: str | None = None
    content: str | None = None
    properties: dict[str, Any] | None = None
    status: BlockStatus | None = None
    confidence: float | None = Field(None, ge=0, le=1)
    abstraction_level: AbstractionLevel | None = None
    artifact_id: str | None = None


class MemoryBlock(MemoryBlockBase):
    """Full memory block schema with all fields."""
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MemoryLinkBase(BaseModel):
    """Base schema for memory links."""
    source_block_id: str
    target_block_id: str
    link_type: LinkType
    session_id: str
    degree: LinkDegree | None = None
    confidence: float | None = Field(None, ge=0, le=1)
    reason: str | None = None
    status: LinkStatus = "active"


class MemoryLinkCreate(MemoryLinkBase):
    """Schema for creating a memory link."""
    pass


class MemoryLinkUpdate(BaseModel):
    """Schema for updating a memory link."""
    link_type: LinkType | None = None
    degree: LinkDegree | None = None
    confidence: float | None = Field(None, ge=0, le=1)
    reason: str | None = None
    status: LinkStatus | None = None


class MemoryLink(MemoryLinkBase):
    """Full memory link schema with all fields."""
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class GraphQuery(BaseModel):
    """Query parameters for graph traversal."""
    session_id: str | None = None
    block_type: BlockType | None = None
    status: BlockStatus | None = None
    search_text: str | None = None
    limit: int = Field(default=50, le=500)
    offset: int = Field(default=0, ge=0)


class GraphStats(BaseModel):
    """Graph statistics response."""
    total_blocks: int
    total_links: int
    blocks_by_type: dict[str, int]
    blocks_by_status: dict[str, int]
