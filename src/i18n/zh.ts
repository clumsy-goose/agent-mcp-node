const zh = {
  // Header
  "app.title": "OpenAI Agents Starter",
  "app.subtitle": "基于 EdgeOne Makers 运行，支持会话记忆和 Agent 工具",

  // Empty state
  "empty.title": "OpenAI Agents Starter",
  "empty.hint": "我是运行在 EdgeOne 上的 OpenAI Agent，拥有自定义工具和会话记忆。我可以帮助你查询天气、穿衣建议、翻译和文本统计。",
  "empty.features": "EdgeOne Store · 会话记忆 · Agent 工具",

  // Chat input
  "chat.placeholder": "输入消息...  ⏎ 发送 · Shift+⏎ 换行",
  "chat.hint": "由 OpenAI Agents SDK + EdgeOne Makers 驱动 · 仅供演示",

  // Preset questions
  "preset.1": "北京现在天气怎么样？有什么穿衣建议？",
  "preset.2": "将「你好，欢迎来到北京！」翻译成英文并统计字符数。",

  // Tool indicators
  "tool.weather": "天气",
  "tool.clothing": "穿搭",
  "tool.translate": "翻译",
  "tool.statistics": "统计",

  // Status & errors
  "status.error": "请求失败，请检查后端服务是否正常运行。",
  "status.stopped": "⏹ *已停止生成*",
  "status.backendError": "后端中止请求失败，服务器可能仍在运行。",

  // Conversation sidebar
  "sidebar.label": "会话列表",
  "sidebar.title": "会话",
  "sidebar.newChat": "新建聊天",
  "sidebar.loading": "正在加载会话...",
  "sidebar.loadMore": "加载更多",
  "sidebar.loadingMore": "加载中...",
  "sidebar.emptyTitle": "暂无会话",
  "sidebar.emptyHint": "点击「新建聊天」开始第一段对话。",
  "sidebar.delete": "删除会话",
  "sidebar.deleteConfirm": "确定要永久删除这个会话吗？此操作不可恢复。",

  // Right info panel tabs
  "panel.label": "项目信息面板",
  "panel.tab.routes": "Agent 路由",
  "panel.tab.mcp": "MCP 配置",

  // Agent routes section
  "routes.title": "Agent 路由",
  "routes.subtitle": "本项目 agents/ 目录下的 Agent 路由。目录名即路由名，index 为默认入口，以 _ 开头的文件为私有模块，不会映射为公开路由。",
  "routes.countSuffix": " 条 Agent 路由，均由运行时自动注册为 MCP tool",
  "routes.mcpTool": "MCP tool",
  "routes.params": "HTTP 参数",
  "routes.group.core": "核心对话路由",
  "routes.group.coreHint": "驱动本页聊天界面的两条路由，负责发起与中止 Agent 运行。",
  "routes.group.tool": "工具路由（用于验证 MCP 自动注册）",
  "routes.group.toolHint": "这 4 条路由是把原先内联在 _tools.ts 中的工具拆分出来的独立 Agent 路由。它们内部没有任何 MCP 相关代码，仅靠 edgeone.json 的 agents.mcp 开关即被运行时自动注册为 MCP tool——已实测验证通过。注意运行时给每条路由生成的 MCP schema 统一为 { message, session_id }，故下方标注的是直接 HTTP 调用时的结构化参数。",
  "routes.note": "以上路由由 Agent 运行时托管，会自动注入 conversation_id、AbortSignal 与 context.store。项目中 cloud-functions/ 目录下的接口（/history、/conversations 等）是本 Demo 用于持久化的普通边缘函数，不属于 Agent 路由，故不在此列出。",

  "route.chat.title": "主对话入口（流式）",
  "route.chat.desc": "创建 OpenAI Agent 并注入 4 个自定义工具与 EdgeOne Store 会话记忆，通过 SSE 逐字推送 text_delta 与 tool_called 事件。",
  "route.stop.title": "中止当前运行",
  "route.stop.desc": "根据 conversation_id 触发 abortActiveRun，中断正在进行的 Agent 运行并释放上游 LLM 连接。",
  "route.getWeather.title": "查询城市天气",
  "route.getWeather.desc": "独立暴露 get_weather 工具，返回指定城市的天气状况、温度区间与风力。",
  "route.getClothingAdvice.title": "生成穿衣建议",
  "route.getClothingAdvice.desc": "独立暴露 get_clothing_advice 工具，根据天气描述区分炎热、寒冷与温和天气并给出穿搭建议。",
  "route.translateText.title": "文本翻译",
  "route.translateText.desc": "独立暴露 translate_text 工具，将文本翻译为目标语言，支持 en / ja / fr / ko / de 等语言代码。",
  "route.textStatistics.title": "文本统计分析",
  "route.textStatistics.desc": "独立暴露 text_statistics 工具，返回文本的字符数、单词数与行数。",

  // MCP section
  "mcp.title": "MCP 配置",
  "mcp.subtitle": "当前部署的 Agent MCP Servers 配置，用于连接外部模型上下文服务。",
  "mcp.copy": "复制",
  "mcp.copied": "已复制",
  "mcp.expand": "展开工具列表",
  "mcp.collapse": "收起工具列表",
  "mcp.scopeUser": "用户",
  "mcp.connected": "已连接",
  "mcp.authPassthrough": "auth: passthrough",
  "mcp.autoRegistered": "自动注册",

  "mcp.tool.chat": "对应 agents/chat 路由，向 Agent 发送一条消息并返回聚合后的完整回复。",
  "mcp.tool.cancelRun": "对应 agents/stop 路由，按 session_id 中止一个正在进行的 Agent 运行。",
  "mcp.agentTool.weather": "查询城市天气。参数：city",
  "mcp.agentTool.clothing": "根据天气描述给出穿衣建议。参数：weather",
  "mcp.agentTool.translate": "翻译文本为目标语言。参数：text、target_language",
  "mcp.agentTool.statistics": "统计文本字符数、单词数与行数。参数：text",

  "mcp.verify.title": "验证自动注册",
  "mcp.verify.subtitle": "标记为「自动注册」的 4 个 tool，是把工具拆成独立 Agent 路由后由运行时自动暴露的。已实测确认它们确实出现在 tools/list 中。",
  "mcp.verify.note": "实测发现的重要细节：运行时为每条 Agent 路由生成的 MCP inputSchema 是固定的 { message, session_id }，并不会读取 handler 里的 zod schema。因此按该 schema 直接传 message 纯文本会校验失败；当前可用两种方式调用——直接 HTTP POST 结构化参数，或在 message 中放入 JSON 字符串。另外 Agent 路由必须以 SSE 返回结果，MCP adapter 只聚合 SSE 流为 content.text，返回普通 JSON 会被解析为空。",

  // Aria labels (button hover/screen-reader)
  "aria.send": "发送",
  "aria.clearHistory": "清除历史",
  "aria.stopGeneration": "停止生成",

  // Language toggle
  "lang.switch": "English",
} as const;

export default zh;
