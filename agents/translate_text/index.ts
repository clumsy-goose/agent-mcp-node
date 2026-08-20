/**
 * translate_text agent route — EdgeOne Makers
 * ===========================================
 *
 * File path agents/translate_text/index.ts maps to **POST /translate_text**,
 * and is auto-registered as the MCP tool `translate_text` by the runtime
 * (see `agents.mcp` in edgeone.json).
 *
 * Behaviour is shared with the in-agent tool via `agents/_tool-core.ts`.
 */

import { createToolRoute } from '../_tool-route';
import { translateTextDef } from '../_tool-core';

export const onRequest = createToolRoute(translateTextDef);
