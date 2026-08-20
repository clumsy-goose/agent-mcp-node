/**
 * Agent Tools — private module (starts with _), not mapped as a route.
 *
 * Adapts the shared definitions in `_tool-core.ts` into OpenAI Agents SDK
 * `tool()` objects for the /chat agent.
 *
 * There is intentionally no tool logic in this file. Each tool's behaviour
 * lives in `_tool-core.ts` and is reused by two surfaces:
 *
 *   - this module → tools callable by the agent during a /chat run
 *   - `agents/<tool>/index.ts` → the same tool as a standalone agent route,
 *     which the runtime auto-registers as an individual MCP tool
 *
 * To add a tool: define it in `_tool-core.ts`, add it to `ALL_TOOL_DEFS`, and
 * create an `agents/<tool>/index.ts` route if it should be exposed over MCP.
 */

import { tool } from '@openai/agents';
import { ALL_TOOL_DEFS } from './_tool-core';

/**
 * Factory that returns all available tools.
 *
 * Derived from `ALL_TOOL_DEFS`, so the agent automatically picks up any tool
 * added there — no changes needed in this file.
 */
export function createTools() {
  return ALL_TOOL_DEFS.map(def =>
    tool({
      name: def.name,
      description: def.description,
      parameters: def.parameters as never,
      execute: def.execute as never,
    }),
  );
}
