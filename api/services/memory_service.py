"""
Memory Graph service for Neo4j operations.
"""

from datetime import datetime
from uuid import uuid4
from neo4j import AsyncSession
from ..models.memory import (
    MemoryBlock, MemoryBlockCreate, MemoryBlockUpdate,
    MemoryLink, MemoryLinkCreate, MemoryLinkUpdate,
    GraphQuery, GraphStats,
)


class MemoryService:
    """Service for memory graph operations."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_block(self, data: MemoryBlockCreate) -> MemoryBlock:
        """Create a new memory block."""
        block_id = str(uuid4())
        now = datetime.utcnow().isoformat()
        
        query = """
        CREATE (b:Block {
            id: $id,
            type: $type,
            title: $title,
            content: $content,
            sessionId: $session_id,
            ideaId: $idea_id,
            properties: $properties,
            status: $status,
            confidence: $confidence,
            abstractionLevel: $abstraction_level,
            artifactId: $artifact_id,
            createdAt: $created_at,
            updatedAt: $updated_at
        })
        RETURN b
        """
        
        result = await self.session.run(
            query,
            id=block_id,
            type=data.type,
            title=data.title,
            content=data.content,
            session_id=data.session_id,
            idea_id=data.idea_id,
            properties=str(data.properties) if data.properties else None,
            status=data.status,
            confidence=data.confidence,
            abstraction_level=data.abstraction_level,
            artifact_id=data.artifact_id,
            created_at=now,
            updated_at=now,
        )
        
        record = await result.single()
        return self._map_block(record["b"])

    async def get_block(self, block_id: str) -> MemoryBlock | None:
        """Get a memory block by ID."""
        query = "MATCH (b:Block {id: $id}) RETURN b"
        result = await self.session.run(query, id=block_id)
        record = await result.single()
        
        if record is None:
            return None
        return self._map_block(record["b"])

    async def update_block(self, block_id: str, data: MemoryBlockUpdate) -> MemoryBlock | None:
        """Update a memory block."""
        now = datetime.utcnow().isoformat()
        
        # Build dynamic SET clause
        set_parts = ["b.updatedAt = $updated_at"]
        params = {"id": block_id, "updated_at": now}
        
        if data.type is not None:
            set_parts.append("b.type = $type")
            params["type"] = data.type
        if data.title is not None:
            set_parts.append("b.title = $title")
            params["title"] = data.title
        if data.content is not None:
            set_parts.append("b.content = $content")
            params["content"] = data.content
        if data.status is not None:
            set_parts.append("b.status = $status")
            params["status"] = data.status
        if data.confidence is not None:
            set_parts.append("b.confidence = $confidence")
            params["confidence"] = data.confidence
        if data.abstraction_level is not None:
            set_parts.append("b.abstractionLevel = $abstraction_level")
            params["abstraction_level"] = data.abstraction_level
        
        query = f"MATCH (b:Block {{id: $id}}) SET {', '.join(set_parts)} RETURN b"
        result = await self.session.run(query, **params)
        record = await result.single()
        
        if record is None:
            return None
        return self._map_block(record["b"])

    async def delete_block(self, block_id: str) -> bool:
        """Delete a memory block and its links."""
        query = """
        MATCH (b:Block {id: $id})
        DETACH DELETE b
        RETURN count(b) as deleted
        """
        result = await self.session.run(query, id=block_id)
        record = await result.single()
        return record["deleted"] > 0

    async def list_blocks(self, query_params: GraphQuery) -> list[MemoryBlock]:
        """List memory blocks with filters."""
        where_parts = []
        params = {"limit": query_params.limit, "offset": query_params.offset}
        
        if query_params.session_id:
            where_parts.append("b.sessionId = $session_id")
            params["session_id"] = query_params.session_id
        if query_params.block_type:
            where_parts.append("b.type = $block_type")
            params["block_type"] = query_params.block_type
        if query_params.status:
            where_parts.append("b.status = $status")
            params["status"] = query_params.status
        
        where_clause = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""
        
        if query_params.search_text:
            query = f"""
            CALL db.index.fulltext.queryNodes("block_content_search", $search_text)
            YIELD node as b
            {where_clause}
            RETURN b
            ORDER BY b.createdAt DESC
            SKIP $offset LIMIT $limit
            """
            params["search_text"] = query_params.search_text
        else:
            query = f"""
            MATCH (b:Block)
            {where_clause}
            RETURN b
            ORDER BY b.createdAt DESC
            SKIP $offset LIMIT $limit
            """
        
        result = await self.session.run(query, **params)
        records = await result.data()
        return [self._map_block(r["b"]) for r in records]

    async def create_link(self, data: MemoryLinkCreate) -> MemoryLink:
        """Create a link between blocks."""
        link_id = str(uuid4())
        now = datetime.utcnow().isoformat()
        
        query = """
        MATCH (source:Block {id: $source_id})
        MATCH (target:Block {id: $target_id})
        CREATE (source)-[r:LINKS_TO {
            id: $id,
            linkType: $link_type,
            sessionId: $session_id,
            degree: $degree,
            confidence: $confidence,
            reason: $reason,
            status: $status,
            createdAt: $created_at,
            updatedAt: $updated_at
        }]->(target)
        RETURN r, source.id as source_id, target.id as target_id
        """
        
        result = await self.session.run(
            query,
            source_id=data.source_block_id,
            target_id=data.target_block_id,
            id=link_id,
            link_type=data.link_type,
            session_id=data.session_id,
            degree=data.degree,
            confidence=data.confidence,
            reason=data.reason,
            status=data.status,
            created_at=now,
            updated_at=now,
        )
        
        record = await result.single()
        return self._map_link(record["r"], record["source_id"], record["target_id"])

    async def get_block_links(self, block_id: str, direction: str = "both") -> list[MemoryLink]:
        """Get links for a block."""
        if direction == "outgoing":
            query = """
            MATCH (source:Block {id: $id})-[r:LINKS_TO]->(target:Block)
            RETURN r, source.id as source_id, target.id as target_id
            """
        elif direction == "incoming":
            query = """
            MATCH (source:Block)-[r:LINKS_TO]->(target:Block {id: $id})
            RETURN r, source.id as source_id, target.id as target_id
            """
        else:
            query = """
            MATCH (b:Block {id: $id})
            OPTIONAL MATCH (b)-[r1:LINKS_TO]->(t1:Block)
            OPTIONAL MATCH (s2:Block)-[r2:LINKS_TO]->(b)
            WITH collect({r: r1, source_id: b.id, target_id: t1.id}) + 
                 collect({r: r2, source_id: s2.id, target_id: b.id}) as links
            UNWIND links as link
            WHERE link.r IS NOT NULL
            RETURN link.r as r, link.source_id as source_id, link.target_id as target_id
            """
        
        result = await self.session.run(query, id=block_id)
        records = await result.data()
        return [self._map_link(r["r"], r["source_id"], r["target_id"]) for r in records if r["r"]]

    async def delete_link(self, link_id: str) -> bool:
        """Delete a link by ID."""
        query = """
        MATCH ()-[r:LINKS_TO {id: $id}]->()
        DELETE r
        RETURN count(r) as deleted
        """
        result = await self.session.run(query, id=link_id)
        record = await result.single()
        return record["deleted"] > 0

    async def get_stats(self, session_id: str | None = None) -> GraphStats:
        """Get graph statistics."""
        where_clause = "WHERE b.sessionId = $session_id" if session_id else ""
        params = {"session_id": session_id} if session_id else {}
        
        query = f"""
        MATCH (b:Block) {where_clause}
        WITH count(b) as total_blocks,
             collect(b.type) as types,
             collect(b.status) as statuses
        OPTIONAL MATCH ()-[r:LINKS_TO]->()
        RETURN total_blocks, 
               count(r) as total_links,
               types, statuses
        """
        
        result = await self.session.run(query, **params)
        record = await result.single()
        
        # Count by type and status
        types_count = {}
        for t in record["types"]:
            types_count[t] = types_count.get(t, 0) + 1
        
        status_count = {}
        for s in record["statuses"]:
            status_count[s] = status_count.get(s, 0) + 1
        
        return GraphStats(
            total_blocks=record["total_blocks"],
            total_links=record["total_links"],
            blocks_by_type=types_count,
            blocks_by_status=status_count,
        )

    def _map_block(self, node) -> MemoryBlock:
        """Map Neo4j node to MemoryBlock model."""
        return MemoryBlock(
            id=node["id"],
            type=node["type"],
            title=node.get("title"),
            content=node["content"],
            session_id=node["sessionId"],
            idea_id=node.get("ideaId"),
            properties=eval(node["properties"]) if node.get("properties") else None,
            status=node.get("status", "active"),
            confidence=node.get("confidence"),
            abstraction_level=node.get("abstractionLevel"),
            artifact_id=node.get("artifactId"),
            created_at=datetime.fromisoformat(node["createdAt"]),
            updated_at=datetime.fromisoformat(node["updatedAt"]),
        )

    def _map_link(self, rel, source_id: str, target_id: str) -> MemoryLink:
        """Map Neo4j relationship to MemoryLink model."""
        return MemoryLink(
            id=rel["id"],
            source_block_id=source_id,
            target_block_id=target_id,
            link_type=rel["linkType"],
            session_id=rel["sessionId"],
            degree=rel.get("degree"),
            confidence=rel.get("confidence"),
            reason=rel.get("reason"),
            status=rel.get("status", "active"),
            created_at=datetime.fromisoformat(rel["createdAt"]),
            updated_at=datetime.fromisoformat(rel["updatedAt"]),
        )
