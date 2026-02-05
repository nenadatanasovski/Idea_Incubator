"""
Memory Graph API routes.
"""

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query
from neo4j import AsyncSession

from ..core.database import get_session
from ..models.memory import (
    MemoryBlock, MemoryBlockCreate, MemoryBlockUpdate,
    MemoryLink, MemoryLinkCreate,
    GraphQuery, GraphStats, BlockType, BlockStatus,
)
from ..services.memory_service import MemoryService

router = APIRouter(prefix="/memory", tags=["Memory Graph"])


async def get_memory_service(
    session: Annotated[AsyncSession, Depends(get_session)]
) -> MemoryService:
    """Dependency to get MemoryService."""
    return MemoryService(session)


# ============================================
# Block Endpoints
# ============================================

@router.post("/blocks", response_model=MemoryBlock, status_code=201)
async def create_block(
    data: MemoryBlockCreate,
    service: Annotated[MemoryService, Depends(get_memory_service)],
):
    """Create a new memory block."""
    return await service.create_block(data)


@router.get("/blocks", response_model=list[MemoryBlock])
async def list_blocks(
    service: Annotated[MemoryService, Depends(get_memory_service)],
    session_id: str | None = None,
    block_type: BlockType | None = None,
    status: BlockStatus | None = None,
    search: str | None = Query(None, description="Full-text search"),
    limit: int = Query(50, le=500),
    offset: int = Query(0, ge=0),
):
    """List memory blocks with optional filters."""
    query = GraphQuery(
        session_id=session_id,
        block_type=block_type,
        status=status,
        search_text=search,
        limit=limit,
        offset=offset,
    )
    return await service.list_blocks(query)


@router.get("/blocks/{block_id}", response_model=MemoryBlock)
async def get_block(
    block_id: str,
    service: Annotated[MemoryService, Depends(get_memory_service)],
):
    """Get a memory block by ID."""
    block = await service.get_block(block_id)
    if block is None:
        raise HTTPException(status_code=404, detail="Block not found")
    return block


@router.patch("/blocks/{block_id}", response_model=MemoryBlock)
async def update_block(
    block_id: str,
    data: MemoryBlockUpdate,
    service: Annotated[MemoryService, Depends(get_memory_service)],
):
    """Update a memory block."""
    block = await service.update_block(block_id, data)
    if block is None:
        raise HTTPException(status_code=404, detail="Block not found")
    return block


@router.delete("/blocks/{block_id}", status_code=204)
async def delete_block(
    block_id: str,
    service: Annotated[MemoryService, Depends(get_memory_service)],
):
    """Delete a memory block and its links."""
    deleted = await service.delete_block(block_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Block not found")


# ============================================
# Link Endpoints
# ============================================

@router.post("/links", response_model=MemoryLink, status_code=201)
async def create_link(
    data: MemoryLinkCreate,
    service: Annotated[MemoryService, Depends(get_memory_service)],
):
    """Create a link between two blocks."""
    try:
        return await service.create_link(data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/blocks/{block_id}/links", response_model=list[MemoryLink])
async def get_block_links(
    block_id: str,
    service: Annotated[MemoryService, Depends(get_memory_service)],
    direction: str = Query("both", pattern="^(both|incoming|outgoing)$"),
):
    """Get links for a block."""
    return await service.get_block_links(block_id, direction)


@router.delete("/links/{link_id}", status_code=204)
async def delete_link(
    link_id: str,
    service: Annotated[MemoryService, Depends(get_memory_service)],
):
    """Delete a link."""
    deleted = await service.delete_link(link_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Link not found")


# ============================================
# Stats Endpoints
# ============================================

@router.get("/stats", response_model=GraphStats)
async def get_stats(
    service: Annotated[MemoryService, Depends(get_memory_service)],
    session_id: str | None = None,
):
    """Get memory graph statistics."""
    return await service.get_stats(session_id)
