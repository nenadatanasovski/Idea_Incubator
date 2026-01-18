"""
Observability API Client for Python Agents

Provides HTTP client for the observability API, allowing Python agents
to record execution runs, tool uses, assertions, and heartbeats.

Usage:
    from observability_api import create_execution_run, complete_execution_run

    execution_id = create_execution_run(task_list_id="my-list", source="build-agent")
    # ... do work ...
    complete_execution_run(execution_id, status="completed")
"""

import os
import time
import logging
from typing import Optional, Dict, Any, Literal

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger(__name__)

# Configuration
API_BASE = os.environ.get("OBSERVABILITY_API_URL", "http://localhost:3001")
API_TIMEOUT = int(os.environ.get("OBSERVABILITY_API_TIMEOUT", "10"))
MAX_RETRIES = int(os.environ.get("OBSERVABILITY_MAX_RETRIES", "3"))

# Session with retry logic
_session: Optional[requests.Session] = None


def _get_session() -> requests.Session:
    """Get or create a session with retry configuration."""
    global _session
    if _session is None:
        _session = requests.Session()
        retry_strategy = Retry(
            total=MAX_RETRIES,
            backoff_factor=0.5,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET", "POST", "PUT"],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        _session.mount("http://", adapter)
        _session.mount("https://", adapter)
    return _session


def _api_request(
    method: str,
    endpoint: str,
    json_data: Optional[Dict[str, Any]] = None,
    params: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Make an API request with error handling and retries.

    Args:
        method: HTTP method (GET, POST, PUT)
        endpoint: API endpoint path (e.g., /executions)
        json_data: Request body for POST/PUT
        params: Query parameters for GET

    Returns:
        Response JSON data

    Raises:
        requests.RequestException: On network errors after retries
        ValueError: On API error response
    """
    url = f"{API_BASE}/api/observability{endpoint}"
    session = _get_session()

    try:
        response = session.request(
            method=method,
            url=url,
            json=json_data,
            params=params,
            timeout=API_TIMEOUT,
        )
        response.raise_for_status()
        return response.json()
    except requests.Timeout:
        logger.warning(f"Timeout calling {method} {url}")
        raise
    except requests.ConnectionError as e:
        logger.warning(f"Connection error calling {method} {url}: {e}")
        raise
    except requests.HTTPError as e:
        logger.error(f"HTTP error {response.status_code} from {method} {url}: {response.text}")
        raise ValueError(f"API error: {response.status_code} - {response.text}") from e


# =============================================================================
# EXECUTION RUN MANAGEMENT
# =============================================================================


def create_execution_run(
    task_list_id: str,
    source: str = "python-agent",
    session_id: Optional[str] = None,
) -> str:
    """Create a new execution run for observability tracking.

    Args:
        task_list_id: ID of the task list being executed
        source: Source identifier (e.g., 'build-agent-worker', 'ralph-loop')
        session_id: Optional session ID for concurrent execution tracking

    Returns:
        execution_id: The created execution run ID

    Example:
        >>> execution_id = create_execution_run("task-list-123", "build-agent")
        >>> print(f"Started execution: {execution_id}")
    """
    try:
        result = _api_request(
            "POST",
            "/executions",
            json_data={
                "taskListId": task_list_id,
                "source": source,
                "sessionId": session_id,
            },
        )
        execution_id = result.get("data", {}).get("executionId") or result.get("executionId")
        if not execution_id:
            raise ValueError("No executionId in response")
        logger.info(f"Created execution run: {execution_id}")
        return execution_id
    except Exception as e:
        logger.error(f"Failed to create execution run: {e}")
        raise


def complete_execution_run(
    execution_id: str,
    status: Literal["completed", "failed", "cancelled"] = "completed",
    summary: Optional[Dict[str, Any]] = None,
) -> None:
    """Complete an execution run.

    Args:
        execution_id: ID of the execution to complete
        status: Final status (completed, failed, cancelled)
        summary: Optional summary data

    Example:
        >>> complete_execution_run("exec-123", status="completed")
    """
    try:
        _api_request(
            "PUT",
            f"/executions/{execution_id}/complete",
            json_data={
                "status": status,
                "summary": summary or {},
            },
        )
        logger.info(f"Completed execution run: {execution_id} with status: {status}")
    except Exception as e:
        logger.error(f"Failed to complete execution run {execution_id}: {e}")
        # Don't raise - completion failures shouldn't crash the agent


def record_heartbeat(
    execution_id: str,
    instance_id: str,
    status: str = "running",
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    """Record a heartbeat for an active agent instance.

    Args:
        execution_id: The execution run ID
        instance_id: The agent instance ID
        status: Current status (running, idle, blocked)
        metadata: Optional metadata (current task, progress, etc.)

    Example:
        >>> record_heartbeat("exec-123", "agent-456", metadata={"task": "T-001"})
    """
    try:
        _api_request(
            "POST",
            f"/executions/{execution_id}/heartbeat",
            json_data={
                "instanceId": instance_id,
                "status": status,
                "metadata": metadata or {},
                "timestamp": time.time(),
            },
        )
        logger.debug(f"Recorded heartbeat for {instance_id} in {execution_id}")
    except Exception as e:
        # Heartbeat failures should not crash the agent
        logger.warning(f"Failed to record heartbeat: {e}")


# =============================================================================
# TOOL USE LOGGING
# =============================================================================


def log_tool_start(
    execution_id: str,
    tool_name: str,
    tool_input: Dict[str, Any],
    task_id: Optional[str] = None,
) -> str:
    """Log the start of a tool invocation.

    Args:
        execution_id: The execution run ID
        tool_name: Name of the tool (e.g., 'Read', 'Bash', 'Edit')
        tool_input: Tool input parameters
        task_id: Optional task ID this tool is associated with

    Returns:
        tool_use_id: ID of the tool use record for logging completion

    Example:
        >>> tool_id = log_tool_start("exec-123", "Bash", {"command": "npm test"})
        >>> # ... execute tool ...
        >>> log_tool_end(tool_id, result, is_error=False)
    """
    try:
        result = _api_request(
            "POST",
            f"/executions/{execution_id}/tool-uses",
            json_data={
                "tool": tool_name,
                "input": tool_input,
                "taskId": task_id,
            },
        )
        tool_id = result.get("data", {}).get("toolUseId") or result.get("toolUseId")
        if not tool_id:
            raise ValueError("No toolUseId in response")
        return tool_id
    except Exception as e:
        logger.warning(f"Failed to log tool start: {e}")
        # Return a placeholder ID so log_tool_end doesn't fail
        return f"local-{int(time.time() * 1000)}"


def log_tool_end(
    tool_use_id: str,
    output: Any,
    is_error: bool = False,
    duration_ms: Optional[int] = None,
) -> None:
    """Log the completion of a tool invocation.

    Args:
        tool_use_id: ID returned from log_tool_start
        output: Tool output/result
        is_error: Whether the tool invocation resulted in an error
        duration_ms: Optional duration in milliseconds

    Example:
        >>> log_tool_end(tool_id, {"success": True}, is_error=False, duration_ms=150)
    """
    if tool_use_id.startswith("local-"):
        # Skip if we couldn't log the start
        return

    try:
        _api_request(
            "PUT",
            f"/tool-uses/{tool_use_id}/complete",
            json_data={
                "output": output if isinstance(output, dict) else {"result": str(output)[:1000]},
                "isError": is_error,
                "durationMs": duration_ms,
            },
        )
    except Exception as e:
        logger.warning(f"Failed to log tool end: {e}")


def log_tool_simple(
    execution_id: str,
    tool_name: str,
    tool_input: Dict[str, Any],
    tool_output: Any,
    is_error: bool = False,
    duration_ms: int = 0,
    task_id: Optional[str] = None,
) -> None:
    """Log a complete tool invocation in one call.

    Use this when you have both input and output available at once.

    Args:
        execution_id: The execution run ID
        tool_name: Name of the tool
        tool_input: Tool input parameters
        tool_output: Tool output/result
        is_error: Whether the tool resulted in an error
        duration_ms: Duration in milliseconds
        task_id: Optional task ID

    Example:
        >>> log_tool_simple("exec-123", "Grep", {"pattern": "TODO"}, {"matches": 5})
    """
    try:
        _api_request(
            "POST",
            f"/executions/{execution_id}/tool-uses",
            json_data={
                "tool": tool_name,
                "input": tool_input,
                "output": tool_output if isinstance(tool_output, dict) else {"result": str(tool_output)[:1000]},
                "isError": is_error,
                "durationMs": duration_ms,
                "taskId": task_id,
                "complete": True,  # Indicates this is a complete record
            },
        )
    except Exception as e:
        logger.warning(f"Failed to log tool use: {e}")


# =============================================================================
# ASSERTION RECORDING
# =============================================================================


def start_assertion_chain(
    execution_id: str,
    task_id: str,
    chain_name: str,
) -> str:
    """Start an assertion chain for grouping related assertions.

    Args:
        execution_id: The execution run ID
        task_id: The task being validated
        chain_name: Name of the assertion chain (e.g., 'Validation', 'TypeCheck')

    Returns:
        chain_id: ID of the assertion chain for recording assertions

    Example:
        >>> chain_id = start_assertion_chain("exec-123", "task-456", "Validation")
        >>> record_assertion(chain_id, "TypeScript compiles", True)
        >>> end_assertion_chain(chain_id, passed=True)
    """
    try:
        result = _api_request(
            "POST",
            f"/executions/{execution_id}/assertion-chains",
            json_data={
                "taskId": task_id,
                "name": chain_name,
            },
        )
        chain_id = result.get("data", {}).get("chainId") or result.get("chainId")
        if not chain_id:
            raise ValueError("No chainId in response")
        return chain_id
    except Exception as e:
        logger.warning(f"Failed to start assertion chain: {e}")
        return f"local-chain-{int(time.time() * 1000)}"


def record_assertion(
    chain_id: str,
    description: str,
    passed: bool,
    evidence: Optional[Dict[str, Any]] = None,
    category: str = "validation",
) -> None:
    """Record an assertion result.

    Args:
        chain_id: ID from start_assertion_chain
        description: What was being asserted
        passed: Whether the assertion passed
        evidence: Optional evidence/details
        category: Assertion category (validation, syntax, runtime, etc.)

    Example:
        >>> record_assertion(chain_id, "File exists: src/index.ts", True)
        >>> record_assertion(chain_id, "No TypeScript errors", False, {"errors": ["..."]} )
    """
    if chain_id.startswith("local-"):
        return

    try:
        _api_request(
            "POST",
            f"/assertion-chains/{chain_id}/assertions",
            json_data={
                "description": description,
                "passed": passed,
                "evidence": evidence or {},
                "category": category,
            },
        )
    except Exception as e:
        logger.warning(f"Failed to record assertion: {e}")


def end_assertion_chain(
    chain_id: str,
    passed: bool = True,
    summary: Optional[str] = None,
) -> None:
    """End an assertion chain.

    Args:
        chain_id: ID from start_assertion_chain
        passed: Overall pass/fail status
        summary: Optional summary text

    Example:
        >>> end_assertion_chain(chain_id, passed=True, summary="All validations passed")
    """
    if chain_id.startswith("local-"):
        return

    try:
        _api_request(
            "PUT",
            f"/assertion-chains/{chain_id}/complete",
            json_data={
                "passed": passed,
                "summary": summary,
            },
        )
    except Exception as e:
        logger.warning(f"Failed to end assertion chain: {e}")


# =============================================================================
# PHASE/EVENT LOGGING
# =============================================================================


def log_phase_start(
    execution_id: str,
    phase_name: str,
    metadata: Optional[Dict[str, Any]] = None,
) -> str:
    """Log the start of an execution phase.

    Args:
        execution_id: The execution run ID
        phase_name: Name of the phase (e.g., 'Initialization', 'Execution', 'Cleanup')
        metadata: Optional phase metadata

    Returns:
        phase_id: ID of the phase for logging completion

    Example:
        >>> phase_id = log_phase_start("exec-123", "Code Generation")
        >>> # ... do work ...
        >>> log_phase_end(phase_id)
    """
    try:
        result = _api_request(
            "POST",
            f"/executions/{execution_id}/phases",
            json_data={
                "name": phase_name,
                "metadata": metadata or {},
            },
        )
        phase_id = result.get("data", {}).get("phaseId") or result.get("phaseId")
        if not phase_id:
            raise ValueError("No phaseId in response")
        return phase_id
    except Exception as e:
        logger.warning(f"Failed to log phase start: {e}")
        return f"local-phase-{int(time.time() * 1000)}"


def log_phase_end(
    phase_id: str,
    status: str = "completed",
    summary: Optional[str] = None,
) -> None:
    """Log the end of an execution phase.

    Args:
        phase_id: ID from log_phase_start
        status: Phase status (completed, failed, skipped)
        summary: Optional summary text
    """
    if phase_id.startswith("local-"):
        return

    try:
        _api_request(
            "PUT",
            f"/phases/{phase_id}/complete",
            json_data={
                "status": status,
                "summary": summary,
            },
        )
    except Exception as e:
        logger.warning(f"Failed to log phase end: {e}")


# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================


def is_observable_available() -> bool:
    """Check if the observability API is available.

    Returns:
        True if the API responds to health check

    Example:
        >>> if is_observable_available():
        ...     execution_id = create_execution_run(...)
    """
    try:
        response = _get_session().get(
            f"{API_BASE}/api/observability/stats",
            timeout=2,
        )
        return response.status_code == 200
    except Exception:
        return False


# Flag for checking observability availability
OBSERVABLE_AVAILABLE = None


def check_observable() -> bool:
    """Check and cache observability availability.

    Returns:
        True if observability is available (cached after first check)
    """
    global OBSERVABLE_AVAILABLE
    if OBSERVABLE_AVAILABLE is None:
        OBSERVABLE_AVAILABLE = is_observable_available()
        if OBSERVABLE_AVAILABLE:
            logger.info("Observability API is available")
        else:
            logger.warning("Observability API is not available - logging disabled")
    return OBSERVABLE_AVAILABLE
