/**
 * Tool-route handler factory — private module (starts with _), not a route.
 *
 * Turns a `ToolDef` into an `onRequest` handler so that each tool can be
 * deployed as its own agent route (`agents/<tool>/index.ts`). Each such route
 * declares `@mcp_*` tags in its JSDoc, so the runtime auto-registers it as an
 * individual MCP tool — which is exactly what these routes are here to
 * demonstrate.
 *
 * Why the response is SSE and not plain JSON
 * ------------------------------------------
 * The MCP adapter aggregates an agent's SSE stream into the tool result's
 * `content.text`. A plain `Response.json(...)` from an agent route is parsed as
 * empty by the adapter. So the payload is emitted as `text_delta` frames, which
 * both the MCP adapter and the browser SSE client understand.
 *
 * Known limitation: MCP tool arguments
 * ------------------------------------
 * Verified against a live deployment — the runtime advertises the SAME fixed
 * inputSchema for every auto-registered agent route:
 *
 *   { message: string, session_id?: string }
 *
 * It does NOT introspect the handler to derive a per-tool schema. So an MCP
 * client following that schema sends `{ message: "Beijing" }`, which will fail
 * validation here because `get_weather` expects `{ city }`. Two ways to call a
 * tool successfully today:
 *
 *   - direct HTTP POST with the structured body, e.g. `{"city":"Beijing"}`
 *   - over MCP by putting JSON in `message`, e.g. `{"message":"{\"city\":\"Beijing\"}"}`
 *
 * Validation failures are reported through the SSE stream (see below) so that
 * the reason is actually visible to an MCP client instead of arriving as an
 * empty tool result.
 */

import { z } from 'zod';
import { createLogger } from './_logger';
import { sseResponse } from './_sse';
import type { ToolDef } from './_tool-core';

/**
 * Normalise whatever the caller sent into this tool's argument object.
 *
 *   1. `{ arguments: {...} }`  — some MCP clients nest tool arguments.
 *   2. `{ message: "<json>" }` — the MCP auto-generated schema. Only honoured
 *      when the string parses as a JSON object; free text is left alone so the
 *      zod error below names the field that is actually missing.
 *   3. the body itself         — a direct HTTP POST with structured args.
 */
function resolveArgs(rawBody: Record<string, unknown>): Record<string, unknown> {
  // 1. Unwrap `{ arguments: {...} }`.
  const body =
    rawBody.arguments && typeof rawBody.arguments === 'object'
      ? (rawBody.arguments as Record<string, unknown>)
      : rawBody;

  // 2. Accept structured args smuggled through `message` as JSON.
  if (typeof body.message === 'string') {
    try {
      const parsed = JSON.parse(body.message);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* not JSON — fall through and let validation report the real problem */
    }
  }

  // 3. Use the body as-is.
  return body;
}

/** Build an EdgeOne Makers agent handler for a single tool. */
export function createToolRoute<S extends z.ZodType>(tool: ToolDef<S>) {
  const logger = createLogger(tool.name);

  return async function onRequest(context: any): Promise<Response> {
    const rawBody = (context.request?.body ?? {}) as Record<string, unknown>;
    const args = resolveArgs(rawBody);

    logger.log(`[request] raw=${JSON.stringify(rawBody)} resolved=${JSON.stringify(args)}`);

    const parsed = tool.parameters.safeParse(args);
    const signal: AbortSignal | undefined = context.request?.signal;

    if (!parsed.success) {
      const issues = parsed.error.issues.map(i => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      logger.error('[request] invalid arguments:', issues);

      // Report the failure through SSE rather than as an HTTP 400: the MCP
      // adapter only reads the aggregated stream, so a plain 400 body would
      // reach the client as an empty tool result with no explanation.
      return sseResponse(
        async function* () {
          yield {
            event: 'text_delta',
            data: {
              delta: JSON.stringify({
                error: `Invalid arguments for '${tool.name}'`,
                tool: tool.name,
                issues,
                received: args,
              }),
            },
          };
        },
        { signal, logger },
      );
    }

    return sseResponse(
      async function* () {
        const result = await tool.execute(parsed.data);
        logger.log(`[response] ${result.slice(0, 120)}`);

        // `tool_called` lets the browser UI light up the matching lamp; the
        // MCP adapter ignores it and only aggregates `text_delta` frames.
        yield { event: 'tool_called', data: { tool: tool.name } };
        yield { event: 'text_delta', data: { delta: result } };
      },
      { signal, logger },
    );
  };
}
