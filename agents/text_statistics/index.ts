/**
 * text_statistics agent route — EdgeOne Makers
 * ============================================
 *
 * File path agents/text_statistics/index.ts maps to **POST /text_statistics**,
 * and is auto-registered as the MCP tool `text_statistics` by the runtime
 * (see `agents.mcp` in edgeone.json).
 *
 * Behaviour is shared with the in-agent tool via `agents/_tool-core.ts`.
 */

import { createToolRoute } from '../_tool-route';
import { textStatisticsDef } from '../_tool-core';

export const onRequest = createToolRoute(textStatisticsDef);
