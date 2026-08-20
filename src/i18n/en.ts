const en = {
  // Header
  "app.title": "OpenAI Agents Starter",
  "app.subtitle": "Running on EdgeOne Makers with session memory & Agent Tools",

  // Empty state
  "empty.title": "OpenAI Agents Starter",
  "empty.hint": "I'm an OpenAI Agent running on EdgeOne with custom tools and session memory. I can help with weather, clothing advice, translation, and text statistics.",
  "empty.features": "EdgeOne Store · Session Memory · Agent Tools",

  // Chat input
  "chat.placeholder": "Type a message...  ⏎ Send · Shift+⏎ Newline",
  "chat.hint": "Powered by OpenAI Agents SDK + EdgeOne Makers · Demo only",

  // Preset questions
  "preset.1": "What is the weather like in Beijing now? Any clothing suggestions?",
  "preset.2": "Translate \"Hello, welcome to Beijing!\" into Chinese and count the characters.",

  // Tool indicators
  "tool.weather": "Weather",
  "tool.clothing": "Clothing",
  "tool.translate": "Translate",
  "tool.statistics": "Statistics",

  // Status & errors
  "status.error": "Request failed. Please check if the backend service is running.",
  "status.stopped": "⏹ *Generation stopped*",
  "status.backendError": "Backend abort request failed. The server may still be running.",

  // Conversation sidebar
  "sidebar.label": "Conversation list",
  "sidebar.title": "Chats",
  "sidebar.newChat": "New chat",
  "sidebar.loading": "Loading conversations...",
  "sidebar.loadMore": "Load more",
  "sidebar.loadingMore": "Loading...",
  "sidebar.emptyTitle": "No conversations yet",
  "sidebar.emptyHint": "Click \"New chat\" to start your first conversation.",
  "sidebar.delete": "Delete conversation",
  "sidebar.deleteConfirm": "Permanently delete this conversation? This cannot be undone.",

  // Right info panel tabs
  "panel.label": "Project info panel",
  "panel.tab.routes": "Agent Routes",
  "panel.tab.mcp": "MCP Config",

  // Agent routes section
  "routes.title": "Agent Routes",
  "routes.subtitle": "The Agent routes under this project's agents/ directory. The directory name becomes the route, index is the default entry, and files prefixed with _ stay private and are never exposed.",
  "routes.countSuffix": " Agent routes, each auto-registered as an MCP tool by the runtime",
  "routes.mcpTool": "MCP tool",
  "routes.params": "HTTP params",
  "routes.group.core": "Core chat routes",
  "routes.group.coreHint": "The two routes powering the chat UI on this page — starting and aborting an Agent run.",
  "routes.group.tool": "Tool routes (MCP auto-registration check)",
  "routes.group.toolHint": "These 4 routes were split out of the tools previously inlined in _tools.ts. They contain no MCP-specific code at all — the agents.mcp switch in edgeone.json alone is enough for the runtime to register each as an MCP tool, now verified against a live deployment. Note the runtime gives every route the same MCP schema, { message, session_id }, so the params listed below are the structured ones for direct HTTP calls.",
  "routes.note": "These routes are hosted by the Agent runtime, which injects conversation_id, the AbortSignal and context.store automatically. The endpoints under cloud-functions/ (/history, /conversations, etc.) are plain edge functions this demo uses for persistence — not Agent routes — so they are intentionally excluded here.",

  "route.chat.title": "Main chat entry (streaming)",
  "route.chat.desc": "Creates the OpenAI Agent with 4 custom tools plus EdgeOne Store session memory, then streams text_delta and tool_called events over SSE.",
  "route.stop.title": "Abort the active run",
  "route.stop.desc": "Calls abortActiveRun for the given conversation_id, interrupting the in-flight Agent run and releasing the upstream LLM connection.",
  "route.getWeather.title": "Get city weather",
  "route.getWeather.desc": "Exposes the get_weather tool standalone, returning condition, temperature range and wind for a city.",
  "route.getClothingAdvice.title": "Generate clothing advice",
  "route.getClothingAdvice.desc": "Exposes the get_clothing_advice tool standalone, distinguishing hot, cold and moderate conditions from a weather description.",
  "route.translateText.title": "Translate text",
  "route.translateText.desc": "Exposes the translate_text tool standalone, translating text into a target language such as en / ja / fr / ko / de.",
  "route.textStatistics.title": "Text statistics",
  "route.textStatistics.desc": "Exposes the text_statistics tool standalone, returning character, word and line counts for a text.",

  // MCP section
  "mcp.title": "MCP Config",
  "mcp.subtitle": "The Agent MCP Servers configuration for this deployment, used to connect external Model Context Protocol clients.",
  "mcp.copy": "Copy",
  "mcp.copied": "Copied",
  "mcp.expand": "Expand tool list",
  "mcp.collapse": "Collapse tool list",
  "mcp.scopeUser": "User",
  "mcp.connected": "Connected",
  "mcp.authPassthrough": "auth: passthrough",
  "mcp.autoRegistered": "Auto-registered",

  "mcp.tool.chat": "Maps to the agents/chat route — sends one message to the Agent and returns the aggregated full reply.",
  "mcp.tool.cancelRun": "Maps to the agents/stop route — aborts an in-flight Agent run by session_id.",
  "mcp.agentTool.weather": "Gets a city's weather. Params: city",
  "mcp.agentTool.clothing": "Suggests what to wear from a weather description. Params: weather",
  "mcp.agentTool.translate": "Translates text into a target language. Params: text, target_language",
  "mcp.agentTool.statistics": "Counts characters, words and lines. Params: text",

  "mcp.verify.title": "Verify auto-registration",
  "mcp.verify.subtitle": "The 4 tools marked \"Auto-registered\" are exposed by the runtime purely because each was split into its own Agent route. Verified against a live deployment: they really do show up in tools/list.",
  "mcp.verify.note": "An important detail found while verifying: the runtime advertises a FIXED MCP inputSchema — { message, session_id } — for every Agent route, and does not read the zod schema inside the handler. Sending plain text in message therefore fails validation; today a tool can be called either by POSTing structured arguments directly over HTTP, or by placing a JSON string inside message. Also note Agent routes must reply over SSE: the MCP adapter only aggregates the SSE stream into content.text, so a plain JSON response is parsed as empty.",

  // Aria labels (button hover/screen-reader)
  "aria.send": "Send",
  "aria.clearHistory": "Clear history",
  "aria.stopGeneration": "Stop generation",

  // Language toggle
  "lang.switch": "中文",
} as const;

export default en;
