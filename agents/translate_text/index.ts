/**
 * translate_text agent route — EdgeOne Makers
 * ===========================================
 *
 * File path agents/translate_text/index.ts maps to **POST /translate_text**,
 * and is auto-registered as the MCP tool `translate_text` by the runtime
 * (see `agents.mcp` in edgeone.json).
 *
 * Behaviour is shared with the in-agent tool via `agents/_tool-core.ts`.
 *
 * @mcp_description Translate text to the specified language.
 * @mcp_parameters
 *   text: { "type": "string", "description": "The text to translate", "required": true }
 *   target_language: { "type": "string", "description": "Target language code, e.g. en, ja, fr, ko, de", "required": true }
 */

import { createToolRoute } from '../_tool-route';
import { translateTextDef } from '../_tool-core';

export const onRequest = createToolRoute(translateTextDef);
