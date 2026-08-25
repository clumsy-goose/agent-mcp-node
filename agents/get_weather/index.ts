/**
 * get_weather agent route — EdgeOne Makers
 * ========================================
 *
 * File path agents/get_weather/index.ts maps to **POST /get_weather**.
 *
 * Because `edgeone.json` sets `agents.mcp.enabled = true`, the runtime also
 * auto-registers this route as the MCP tool `get_weather`. This file exists
 * specifically to verify that auto-registration: no MCP-specific wiring is
 * written here, yet the tool shows up in the MCP client's tool list.
 *
 * The behaviour itself lives in `agents/_tool-core.ts` and is shared with the
 * in-agent tool used by /chat, so the two can never diverge.
 *
 * @mcp_description Get the current weather for a specified city.
 * @mcp_parameters
 *   city: { "type": "string", "description": "The city to get weather for", "required": true }
 */

import { createToolRoute } from '../_tool-route';
import { getWeatherDef } from '../_tool-core';

export const onRequest = createToolRoute(getWeatherDef);
