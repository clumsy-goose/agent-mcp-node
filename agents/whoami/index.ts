/**
 * whoami — 平台鉴权链路探针（agents/whoami/index.ts → POST /whoami）
 * ================================================================
 *
 * 回显 agent runtime 解析出的平台身份，用来验证鉴权链路的每一环。
 * 不含任何业务逻辑，纯粹是可观测的断言点。
 *
 * 身份是怎么来的
 * --------------
 * 1. 中控（边缘层）用 `edgeone.json` 的 `agents.auth.verificationKeys` 验签 JWT；
 * 2. 验签通过后，中控无条件 delete + set 内部头 `edge-inner-user-id`；
 * 3. agent runtime 把它映射成业务可见的 `makers-user-id`，同时**无条件丢弃**
 *    客户端自己传的 `makers-user-id`（防伪造）。
 *
 * 所以业务只认 `makers-user-id`，不感知中控↔下游的内部信道名。
 * 未配置 `agents.auth`（公开模式）时该头不存在 —— 业务据此判断「无身份」。
 *
 * 注意 context.request.headers 是普通对象，不是 Web Headers，
 * 只能用下标取值，没有 `.get()`。
 *
 * 调用约定
 * --------
 * 所有 agent 路由都必须带 `makers-conversation-id` 请求头 —— runtime 不会自动
 * 生成会话 ID，缺失时在进入 handler 之前就返回 400 AGENT_CONVERSATION_ID_REQUIRED。
 * 前端复用与 /chat 相同的会话 ID（App.tsx 的 activeConversationId）。
 *
 * 响应为什么是 SSE
 * ----------------
 * MCP adapter 只聚合 agent SSE 流里的 `text_delta` 帧；直接 `Response.json(...)`
 * 会被解析成空的 tool result。走 SSE 才能同时被 curl 和 MCP 客户端读到。
 *
 * @mcp_description Return the authenticated platform user identity (auth probe).
 * @mcp_parameters
 *   echo: { "type": "string", "description": "Optional string echoed back, to correlate a call with its response" }
 */

import { createLogger } from '../_logger';
import { sseResponse } from '../_sse';

const logger = createLogger('whoami');

/** 业务可见的平台身份头（中控验签后由 runtime 注入）。 */
const MAKERS_USER_ID_HEADER = 'makers-user-id';
/** 中控↔下游内部信道，绝不应出现在业务侧 —— 出现即为信息泄漏。 */
const EDGE_INNER_USER_ID_HEADER = 'edge-inner-user-id';

export async function onRequest(context: any): Promise<Response> {
  const headers = (context.request?.headers ?? {}) as Record<string, string>;
  const body = (context.request?.body ?? {}) as Record<string, unknown>;

  const userId = headers[MAKERS_USER_ID_HEADER] ?? null;
  // 内部信道名必须已被 runtime 剥离；非 null 说明归一化逻辑漏了。
  const leakedInnerHeader = headers[EDGE_INNER_USER_ID_HEADER] ?? null;

  const payload = {
    authenticated: Boolean(userId),
    userId,
    conversationId: headers['makers-conversation-id'] ?? null,
    runId: context.runId ?? null,
    // 安全断言：内部信道名不应透给业务，**必须为 null**。
    leakedInnerHeader,
    // 注意这里两条路径行为不同，不是统一的安全断言：
    //   HTTP 直连 /whoami → authorization 会原样透传到业务（runtime 不剥离）
    //   经 MCP tool 调用 → 不转发，恒为 null
    // 业务不应依赖它做鉴权，身份一律只认 makers-user-id。
    authorizationPresent: Boolean(headers['authorization']),
    requestId: headers['functions-request-id'] ?? null,
    ...(typeof body.echo === 'string' ? { echo: body.echo } : {}),
  };

  logger.log(`[probe] ${JSON.stringify(payload)}`);

  return sseResponse(
    async function* () {
      yield { event: 'text_delta', data: { delta: JSON.stringify(payload, null, 2) } };
    },
    { signal: context.request?.signal, logger },
  );
}
