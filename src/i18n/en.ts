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
  "panel.tab.auth": "Auth Check",

  // Auth panel (agents.auth / JWT)
  "auth.title": "Agent Auth Verification",
  "auth.subtitle": "Once edgeone.json declares agents.auth, the edge controller verifies the JWT for every agents/* route and injects the verified identity as the makers-user-id header. This panel calls the /whoami probe so you can see exactly what identity the runtime resolved.",

  "auth.env.local": "Local dev",
  "auth.env.localHint": "There is no edge controller locally, so JWTs are never verified — pasting a token has no effect. Use \"Simulate controller\" to inject edge-inner-user-id directly, which is equivalent to the post-verification state.",
  "auth.env.remote": "Deployed",
  "auth.env.remoteHint": "Requests pass through the edge controller first. Once a JWT is saved below, every agent route request carries the Authorization header.",

  "auth.token.title": "JWT Token",
  "auth.token.set": "Set",
  "auth.token.unset": "Not set",
  "auth.token.hint": "In a real product the token is issued by your auth service after login. This template has no login flow, so sign a test token with npm run auth:token and paste it here (stored in localStorage).",
  "auth.token.placeholder": "Paste a JWT, e.g. eyJhbGciOi....eyJzdWIi....signature",
  "auth.token.save": "Save",
  "auth.token.clear": "Clear",
  "auth.token.expired": "expired",
  "auth.token.unparsable": "Could not decode this token's payload — it may not be a valid JWT (expected header.payload.signature).",

  "auth.gen.title": "JWT Generator",
  "auth.gen.hint": "Sign a JWT locally in the browser with the private key, so you can verify the auth chain on local dev directly. The key is for local testing only — never expose a private key in a production frontend.",
  "auth.gen.alg": "Algorithm",
  "auth.gen.key": "Private key / secret (PEM)",
  "auth.gen.keyPlaceholder": "-----BEGIN PRIVATE KEY----- … (RS256 needs PKCS8)",
  "auth.gen.keyFromEnv": "Private key read from env var VITE_MAKERS_JWT_PRIVATE_KEY",
  "auth.gen.pkcs8Hint": "RS256 requires a PKCS8 private key (-----BEGIN PRIVATE KEY-----). PKCS1 (RSA PRIVATE KEY) is not supported by browser Web Crypto.",
  "auth.gen.sub": "sub (user id)",
  "auth.gen.exp": "exp (expiry, local time)",
  "auth.gen.generate": "Generate & fill token",
  "auth.gen.error": "Generation failed: ",
  "auth.gen.errorEmptyKey": "private key / secret is empty",
  "auth.gen.errorEmptySub": "sub must not be empty",
  "auth.gen.errorExp": "expiry must be later than now",

  "auth.probe.title": "Identity probe",
  "auth.probe.hint": "Calls /whoami to echo back the platform identity the runtime resolved, and checks two security assertions: a forged makers-user-id must be dropped, and the internal channel header must never leak to business code.",
  "auth.probe.run": "Call /whoami",
  "auth.probe.simulate": "Simulate controller",
  "auth.probe.simulateTitle": "Injects edge-inner-user-id directly to mimic a successful verification (only meaningful locally)",
  "auth.probe.forge": "Forge identity (security test)",
  "auth.probe.forgeTitle": "Sends a forged makers-user-id header to verify the runtime drops it",
  "auth.probe.loading": "Requesting...",
  "auth.probe.netError": "Request failed",
  "auth.probe.empty": "(empty response)",

  "auth.scenario.plain": "current token only",
  "auth.scenario.simulated": "simulated verification",
  "auth.scenario.forged": "forged makers-user-id",

  "auth.field.authenticated": "Authenticated",
  "auth.field.authHeader": "Authorization received",

  "auth.alert.forgeBlocked": "Forgery blocked: the client-supplied makers-user-id was dropped by the runtime and never treated as an identity.",
  "auth.alert.forgeLeaked": "Critical flaw: the forged makers-user-id was accepted as a real identity — anyone could impersonate any user this way.",
  "auth.alert.innerLeaked": "Security issue: the internal header edge-inner-user-id leaked into business code, which should never see that field.",

  "auth.note": "Full CLI verification: npm run auth:test (local) or npm run auth:test <deployed-url>. The deployed mode additionally verifies signature checking, expiry rejection, tamper rejection and unregistered-key rejection.",

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
  "route.whoami.title": "Auth identity probe",
  "route.whoami.desc": "Echoes the platform identity (makers-user-id) resolved by the runtime so the agents.auth chain can be verified, and asserts that forged identity headers were dropped and the internal channel header did not leak.",
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
  "mcp.subtitle": "The Agent MCP Servers configuration for this deployment, used to connect external Model Context Protocol clients. The URL below is derived from the domain you are viewing, so it is ready to copy as-is.",
  "mcp.originHint": "Taken from the current browser address — the real domain of this deployment",
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
