/**
 * Tool core logic — private module (starts with _), not mapped as a route.
 *
 * Single source of truth for what each tool actually *does*. Both consumers
 * share these definitions, so behaviour can never drift between them:
 *
 *   1. `_tools.ts`        wraps them as OpenAI Agents SDK `tool()` objects, so
 *                         the /chat agent can call them during a run.
 *   2. `agents/<name>/`   route handlers expose each one as a standalone agent
 *                         route, which the EdgeOne Makers runtime then
 *                         auto-registers as an individual MCP tool.
 *
 * Replacing mock data with a real implementation means editing only the
 * `execute` body here — both surfaces pick the change up automatically.
 */

import { z } from 'zod';

export interface ToolDef<S extends z.ZodType> {
  /** Tool name — also the MCP tool name once exposed as a route. */
  name: string;
  description: string;
  parameters: S;
  execute: (args: z.infer<S>) => Promise<string>;
}

/** Helper that preserves the concrete schema type through inference. */
function defineTool<S extends z.ZodType>(def: ToolDef<S>): ToolDef<S> {
  return def;
}

// ========== Tool: Get Weather ==========
export const getWeatherDef = defineTool({
  name: 'get_weather',
  description: 'Get the current weather for a specified city.',
  parameters: z.object({
    city: z.string().describe('The city to get weather for'),
  }),
  execute: async ({ city }) => {
    // TODO: Replace with real weather API (e.g. OpenWeatherMap, wttr.in)
    const mockWeather = {
      city,
      condition: 'Sunny',
      temperature: { min: 18, max: 25, unit: '°C' },
      wind: 'Light breeze',
    };
    return JSON.stringify(mockWeather);
  },
});

// ========== Tool: Get Clothing Advice ==========
export const getClothingAdviceDef = defineTool({
  name: 'get_clothing_advice',
  description: 'Give clothing advice based on weather conditions.',
  parameters: z.object({
    weather: z.string().describe('The weather description (JSON or plain text)'),
  }),
  execute: async ({ weather }) => {
    // TODO: Replace with more sophisticated logic or an external service
    // Basic temperature-aware advice based on input
    const cold = /(-\d|[0-9](?=\s*°))/;
    const hot = /(3[0-9]|4[0-9])\s*°/;

    if (hot.test(weather)) {
      return 'Hot weather — wear short sleeves, shorts, and stay hydrated.';
    }
    if (cold.test(weather)) {
      return 'Cold weather — wear a down jacket or heavy coat with scarf and gloves.';
    }
    return 'Moderate weather — a light jacket with casual pants and sneakers works well.';
  },
});

// ========== Tool: Translate Text ==========
export const translateTextDef = defineTool({
  name: 'translate_text',
  description: 'Translate text to the specified language.',
  parameters: z.object({
    text: z.string().describe('The text to translate'),
    target_language: z.string().describe('Target language code, e.g. en, ja, fr, ko, de'),
  }),
  execute: async ({ text, target_language }) => {
    // TODO: Replace with real translation API (e.g. DeepL, Google Translate)
    const languageNames: Record<string, string> = {
      en: 'English',
      ja: '日本語',
      fr: 'Français',
      ko: '한국어',
      de: 'Deutsch',
      es: 'Español',
      ru: 'Русский',
    };
    const langName = languageNames[target_language] ?? target_language;
    return `[Mock translation to ${langName}]: ${text}`;
  },
});

// ========== Tool: Text Statistics ==========
export const textStatisticsDef = defineTool({
  name: 'text_statistics',
  description: 'Analyze text and return statistics like character count and word count.',
  parameters: z.object({
    text: z.string().describe('The text to analyze'),
  }),
  execute: async ({ text }) => {
    const charCount = text.length;
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    const lineCount = text.split('\n').length;
    return JSON.stringify({ charCount, wordCount, lineCount });
  },
});

/** Every tool definition, in a stable order. */
export const ALL_TOOL_DEFS = [
  getWeatherDef,
  getClothingAdviceDef,
  translateTextDef,
  textStatisticsDef,
] as const;
