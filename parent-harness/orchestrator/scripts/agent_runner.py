#!/usr/bin/env python3
"""
Agent Runner - Python wrapper for Claude Agent SDK
Used by the Node.js spawner to run agents with proper OAuth auth.
"""

import asyncio
import sys
import json
import argparse
from pathlib import Path

from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient, TextBlock, ToolUseBlock


async def run_agent(prompt: str, model: str, cwd: str, allowed_tools: list[str]) -> dict:
    """Run an agent session and return results."""
    
    client = ClaudeSDKClient(
        options=ClaudeAgentOptions(
            model=model,
            allowed_tools=allowed_tools,
            max_turns=100,
            cwd=cwd,
        )
    )
    
    response_text = ""
    tool_calls = []
    
    try:
        async with client:
            await client.query(prompt)
            
            async for msg in client.receive_response():
                from claude_agent_sdk import AssistantMessage, UserMessage, ToolResultBlock
                
                if isinstance(msg, AssistantMessage):
                    for block in msg.content:
                        if isinstance(block, TextBlock):
                            response_text += block.text
                            # Print incrementally for progress
                            print(block.text, end="", flush=True, file=sys.stderr)
                        elif isinstance(block, ToolUseBlock):
                            tool_calls.append({
                                "name": block.name,
                                "input": str(block.input)[:200]
                            })
                            print(f"\n[Tool: {block.name}]", flush=True, file=sys.stderr)
                
                elif isinstance(msg, UserMessage):
                    for block in msg.content:
                        if isinstance(block, ToolResultBlock):
                            if block.is_error:
                                print(f"   [Error]", flush=True, file=sys.stderr)
                            else:
                                print(f"   [Done]", flush=True, file=sys.stderr)
        
        return {
            "success": True,
            "output": response_text,
            "tool_calls": tool_calls,
            "has_task_complete": "TASK_COMPLETE" in response_text,
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "output": response_text,
        }


def main():
    parser = argparse.ArgumentParser(description="Run Claude agent")
    parser.add_argument("--model", default="sonnet", help="Model to use")
    parser.add_argument("--cwd", default=".", help="Working directory")
    parser.add_argument("--tools", default="Read,Write,Edit,Bash", help="Allowed tools (comma-separated)")
    parser.add_argument("--prompt-file", help="File containing prompt")
    parser.add_argument("prompt", nargs="?", help="Prompt text")
    
    args = parser.parse_args()
    
    # Get prompt from file or argument
    if args.prompt_file:
        prompt = Path(args.prompt_file).read_text()
    elif args.prompt:
        prompt = args.prompt
    else:
        # Read from stdin
        prompt = sys.stdin.read()
    
    if not prompt.strip():
        print(json.dumps({"success": False, "error": "No prompt provided"}))
        sys.exit(1)
    
    # Parse tools
    allowed_tools = [t.strip() for t in args.tools.split(",")]
    
    # Run agent
    result = asyncio.run(run_agent(
        prompt=prompt,
        model=args.model,
        cwd=args.cwd,
        allowed_tools=allowed_tools,
    ))
    
    # Output JSON result
    print("\n---AGENT_RESULT_JSON---", file=sys.stderr)
    print(json.dumps(result))
    
    sys.exit(0 if result.get("success") else 1)


if __name__ == "__main__":
    main()
