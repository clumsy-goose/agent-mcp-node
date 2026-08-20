/**
 * get_clothing_advice agent route — EdgeOne Makers
 * ================================================
 *
 * File path agents/get_clothing_advice/index.ts maps to
 * **POST /get_clothing_advice**, and is auto-registered as the MCP tool
 * `get_clothing_advice` by the runtime (see `agents.mcp` in edgeone.json).
 *
 * Behaviour is shared with the in-agent tool via `agents/_tool-core.ts`.
 */

import { createToolRoute } from '../_tool-route';
import { getClothingAdviceDef } from '../_tool-core';

export const onRequest = createToolRoute(getClothingAdviceDef);
