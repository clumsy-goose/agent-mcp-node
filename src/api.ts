/**
 * Backend API (EdgeOne Makers)
 *
 * Route mapping (file → route):
 *   agents/chat/index.ts                         → POST /chat                  Main chat endpoint (SSE)
 *   agents/stop/index.ts                         → POST /stop                  Abort the active agent run
 *   agents/whoami/index.ts                       → POST /whoami                Auth probe (SSE)
 *   cloud-functions/history/index.ts             → POST /history               Get conversation history
 *   cloud-functions/conversations/index.ts       → POST /conversations         List conversations for a user
 *   cloud-functions/clear-history/index.ts       → POST /clear-history         Clear messages of one conversation
 *   cloud-functions/delete-conversation/index.ts → POST /delete-conversation   Permanently delete a conversation
 *
 * This file defines all API paths and request wrappers.
 */

import type {
  Message,
  ListConversationsParams,
  ListConversationsResponse,
} from './types';

export const API = {
  chat: '/chat',
  chatStop: '/stop',                        // Abort the active agent run
  whoami: '/whoami',                        // Auth probe — echoes the platform identity
  history: '/history',                      // Get conversation history
  clearHistory: '/clear-history',           // Clear messages in a conversation
  conversations: '/conversations',          // List conversations for a user
  deleteConversation: '/delete-conversation', // Permanently delete a conversation
} as const;

// ── 鉴权（agents.auth）─────────────────────────────────────────────────
//
// `edgeone.json` 配了 `agents.auth` 后，`agents/*` 路由由中控（边缘层）验签 JWT，
// 验通后注入身份，agent runtime 再映射成业务可见的 `makers-user-id` 请求头。
// 前端要做的只有一件事：把 JWT 放进 `Authorization: Bearer <token>`。
//
// 真实产品里 token 由认证服务在用户登录后下发；这个模板没有登录流程，
// 所以提供一个手工粘贴入口（见 AuthPanel），存在 localStorage 里。

const AUTH_TOKEN_STORAGE_KEY = 'eo-jwt-token';

/** 读取当前保存的 JWT；未设置时返回空串。 */
export function getAuthToken(): string {
  try {
    return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

/** 保存 JWT；传空串即清除。 */
export function setAuthToken(token: string): void {
  try {
    const trimmed = token.trim();
    if (trimmed) localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, trimmed);
    else localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    /* 隐私模式下 localStorage 可能不可用，忽略 */
  }
}

/**
 * 构造请求头，已保存 token 时自动附加 Authorization。
 *
 * 注意：绝不在这里塞 `makers-user-id` —— 那是平台注入的身份字段，
 * 客户端传值会被 agent runtime 无条件丢弃（防伪造）。
 */
export function withAuthHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extra };
  const token = getAuthToken();
  if (token) headers['authorization'] = `Bearer ${token}`;
  return headers;
}

/** /whoami 探针的返回结构，与 agents/whoami/index.ts 的 payload 对应。 */
export interface WhoamiResult {
  authenticated: boolean;
  userId: string | null;
  conversationId: string | null;
  runId: string | null;
  /** 内部信道名是否泄漏到业务侧；正常必须为 null。 */
  leakedInnerHeader: string | null;
  authorizationPresent: boolean;
  requestId: string | null;
  echo?: string;
}

/** 探针响应可能是 SSE 正常返回，也可能被中控挡在 SCF 之前（非 200）。 */
export interface WhoamiResponse {
  status: number;
  ok: boolean;
  result: WhoamiResult | null;
  /** 解析失败或被拒时的原始响应，便于排查。 */
  raw: string;
}

/**
 * 从 agent 私有 SSE 文本里抽出 text_delta 的 delta 并拼接。
 *
 * /whoami 走 SSE 而非 JSON，是为了让同一个路由既能被 HTTP 直连调用、
 * 也能作为 MCP tool 被调用（MCP adapter 只聚合 text_delta 帧）。
 */
function extractSseText(raw: string): string {
  let text = '';
  for (const block of raw.split(/\n\n/)) {
    if (!block.trim()) continue;
    let eventName = '';
    const dataLines: string[] = [];
    for (const line of block.split(/\n/)) {
      if (line.startsWith('event:')) eventName = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    if (eventName !== 'text_delta' || dataLines.length === 0) continue;
    try {
      const parsed = JSON.parse(dataLines.join('\n'));
      if (typeof parsed?.delta === 'string') text += parsed.delta;
    } catch {
      /* 非 JSON 帧跳过 */
    }
  }
  return text;
}

/**
 * 调用 /whoami 探针，返回 runtime 解析出的平台身份。
 *
 * `identityHeader` 仅用于本地 dev：dev 模式没有中控，没人验签 JWT，
 * 只能直接注入中控的「输出」`edge-inner-user-id` 来模拟已鉴权状态。
 * 线上传这个头没用（中控会无条件重写），线上靠 Authorization。
 *
 * `forgedUserIdHeader` 用于**安全验证**：直接伪造业务可见的 `makers-user-id`。
 * agent runtime 必须无条件丢弃它 —— 若探针回显了这个值，说明存在可被利用的
 * 身份伪造路径（任何人都能冒充任意用户）。
 *
 * `conversationId` 与 /chat、/stop 同一来源：由调用方（App.tsx）传入当前活跃会话 ID，
 * 它由 getOrCreateConversationId() 生成并持久化在 localStorage。runtime 不会自动
 * 生成会话 ID，缺失时直接返回 400 AGENT_CONVERSATION_ID_REQUIRED。
 */
export async function fetchWhoami(
  options: {
    identityHeader?: string;
    forgedUserIdHeader?: string;
    echo?: string;
    conversationId?: string;
  } = {},
): Promise<WhoamiResponse> {
  const extra: Record<string, string> = {};
  if (options.conversationId) {
    extra['makers-conversation-id'] = options.conversationId;
  }
  if (options.identityHeader) {
    extra['edge-inner-user-id'] = options.identityHeader;
  }
  if (options.forgedUserIdHeader) {
    extra['makers-user-id'] = options.forgedUserIdHeader;
  }

  try {
    const res = await fetch(API.whoami, {
      method: 'POST',
      headers: withAuthHeaders(extra),
      body: JSON.stringify(options.echo ? { echo: options.echo } : {}),
    });
    const raw = await res.text();
    if (!res.ok) {
      return { status: res.status, ok: false, result: null, raw };
    }
    const text = extractSseText(raw);
    try {
      return { status: res.status, ok: true, result: JSON.parse(text) as WhoamiResult, raw };
    } catch {
      return { status: res.status, ok: false, result: null, raw };
    }
  } catch (e) {
    return {
      status: 0,
      ok: false,
      result: null,
      raw: e instanceof Error ? e.message : String(e),
    };
  }
}

export interface RawSseEvent {
  eventType: string;
  data: unknown;
  raw: string;
  timestamp: number;
}

export interface StreamCallbacks {
  onTextDelta: (delta: string) => void;
  onToolCalled: (toolName: string) => void;
  onDone: () => void;
  onError: (err: Error) => void;
  onRawEvent?: (event: RawSseEvent) => void;
}

/** Get conversation history for restoring the chat window after page refresh. */
export async function fetchConversationHistory(
  conversationId: string,
  userId?: string,
): Promise<Message[]> {
  const startTime = Date.now();
  console.log(`[History] Request start time: ${new Date(startTime).toLocaleString()}`);

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(API.history, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ conversation_id: conversationId, user_id: userId }),
      });

      // 409 = Active request on same conversation (React StrictMode double-render), retry shortly
      if (res.status === 409) {
        await new Promise(r => setTimeout(r, 500));
        continue;
      }

      if (!res.ok) {
        const endTime = Date.now();
        console.log(`[History] Request end time: ${new Date(endTime).toLocaleString()}`);
        console.log(`[History] Total time: ${endTime - startTime}ms`);
        return [];
      }

      const data = await res.json().catch(() => null) as { messages?: Message[] } | null;
      const endTime = Date.now();
      console.log(`[History] Request end time: ${new Date(endTime).toLocaleString()}`);
      console.log(`[History] Total time: ${endTime - startTime}ms`);
      return Array.isArray(data?.messages) ? data.messages : [];
    } catch {
      const endTime = Date.now();
      console.log(`[History] Request end time: ${new Date(endTime).toLocaleString()}`);
      console.log(`[History] Total time: ${endTime - startTime}ms (aborted with error)`);
      return [];
    }
  }

  const endTime = Date.now();
  console.log(`[History] Request end time: ${new Date(endTime).toLocaleString()}`);
  console.log(`[History] Total time: ${endTime - startTime}ms (retries exhausted)`);
  return [];
}

/**
 * Stream POST /chat via SSE
 * Backend pushes events: text_delta / tool_called / done / error
 *
 * Returns an AbortController the caller can use to abort (or pair with /chat/stop for graceful abort).
 */
export function sendMessageStream(
  message: string,
  callbacks: StreamCallbacks,
  conversationId?: string,
  options?: { userId?: string; userMsgId?: string; botMsgId?: string },
): AbortController {
  const ctrl = new AbortController();

  (async () => {
    try {
      // /chat 属 agents/ 路由，受 agents.auth 保护 —— 带上 JWT（若已设置）。
      const headers: Record<string, string> = withAuthHeaders();
      if (conversationId) {
        headers['makers-conversation-id'] = conversationId;
      }

      const res = await fetch(API.chat, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message,
          // userId is camelCase here for parity with claude-agent-starter's
          // chat handler convention. The backend reads body.userId ?? body.user_id
          // to be tolerant of both.
          userId: options?.userId,
          userMsgId: options?.userMsgId,
          botMsgId: options?.botMsgId,
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        callbacks.onError(new Error(`HTTP ${res.status}: ${await res.text().catch(() => '')}`));
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        callbacks.onError(new Error('ReadableStream not supported'));
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let doneReceived = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE format: events separated by \n\n
        const parts = buffer.split('\n\n');
        // Last segment may be incomplete — keep in buffer
        buffer = parts.pop() || '';

        for (const part of parts) {
          if (!part.trim()) continue;
          dispatchSseChunk(part, callbacks, () => { doneReceived = true; });
        }
      }

      // Fallback: trigger done only if backend did not send done event
      if (!doneReceived) {
        callbacks.onDone();
      }
    } catch (err) {
      // AbortError does not trigger error callback
      if (err instanceof DOMException && err.name === 'AbortError') return;
      callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    }
  })();

  return ctrl;
}

/** Parse a single SSE event and dispatch to the corresponding callback */
function dispatchSseChunk(part: string, cb: StreamCallbacks, markDone: () => void): void {
  let eventType = '';
  let data = '';

  for (const line of part.split('\n')) {
    if (line.startsWith('event: ')) {
      eventType = line.slice(7);
    } else if (line.startsWith('data: ')) {
      data = line.slice(6);
    }
  }

  if (!eventType || !data) return;

  try {
    const parsed = JSON.parse(data);

    if (cb.onRawEvent) {
      cb.onRawEvent({
        eventType,
        data: parsed,
        raw: data,
        timestamp: Date.now(),
      });
    }

    switch (eventType) {
      case 'text_delta':
        cb.onTextDelta(parsed.delta);
        break;
      case 'tool_called':
        cb.onToolCalled(parsed.tool);
        break;
      case 'error':
        cb.onError(new Error(parsed.message || 'agent returned error'));
        break;
      case 'done':
        markDone();
        cb.onDone();
        break;
    }
  } catch {
    if (cb.onRawEvent) {
      cb.onRawEvent({
        eventType,
        data: null,
        raw: data,
        timestamp: Date.now(),
      });
    }
  }
}

/**
 * Request the backend to abort the currently running agent
 *
 * Note: the stop request header must NOT carry the same conversation_id as chat,
 * otherwise the runtime will overwrite chat's cancel_event with stop's cancel_event,
 * causing abort_active_run to fail. The target conversation_id is passed only via body.
 */
export async function stopAgent(conversationId?: string): Promise<boolean> {
  try {
    /**
     * EdgeOne agents/ runtime requires Markers-Conversation-Id on every
     * agents/* request (since 2026-06-05 platform upgrade) — without it
     * the runtime returns 400 (`AGENT_CONVERSATION_ID_REQUIRED`) before
     * the handler runs.
     *
     * Earlier comments in this codebase warned that adding the header on
     * /stop would overwrite chat's abort signal slot. The new runtime is
     * expected to no longer have that bug; if you observe stop succeeding
     * but chat not actually aborting, revisit this and use a different
     * cancellation channel.
     */
    // /stop 同属 agents/ 路由，受 agents.auth 保护 —— 带上 JWT（若已设置）。
    const headers: Record<string, string> = withAuthHeaders();
    if (conversationId) {
      headers['makers-conversation-id'] = conversationId;
    }
    const res = await fetch(API.chatStop, {
      method: 'POST',
      headers,
      body: JSON.stringify({ conversation_id: conversationId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Clear backend conversation history for the given conversation ID. */
export async function clearConversationHistory(
  conversationId?: string,
  userId?: string,
): Promise<boolean> {
  if (!conversationId) return false;

  try {
    const res = await fetch(API.clearHistory, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: conversationId, user_id: userId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * List conversations for the given user (eo-uuid).
 * Returns at most `limit` (default 20) conversations ordered by lastMessageAt desc by default.
 */
export async function listConversations(
  params: ListConversationsParams,
): Promise<ListConversationsResponse> {
  const startTime = performance.now();
  console.log(`[conversations] start: ${new Date().toISOString()}`);

  const empty: ListConversationsResponse = { conversations: [] };

  try {
    const res = await fetch(API.conversations, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: params.userId,
        limit: params.limit,
        order: params.order,
        after: params.after,
        before: params.before,
      }),
    });

    if (!res.ok) {
      console.warn(`[conversations] HTTP ${res.status}`);
      console.log(`[conversations] end: ${new Date().toISOString()}, total: ${(performance.now() - startTime).toFixed(2)}ms`);
      return empty;
    }

    const data = (await res.json().catch(() => null)) as ListConversationsResponse | null;
    console.log(`[conversations] end: ${new Date().toISOString()}, total: ${(performance.now() - startTime).toFixed(2)}ms, count=${data?.conversations?.length ?? 0}`);
    if (!data || !Array.isArray(data.conversations)) return empty;
    return {
      conversations: data.conversations,
      nextCursor: data.nextCursor,
      previousCursor: data.previousCursor,
    };
  } catch (e) {
    console.warn('[conversations] request failed:', e);
    return empty;
  }
}

/** Permanently delete a conversation (irreversible). */
export async function deleteConversation(
  conversationId: string,
  userId?: string,
): Promise<boolean> {
  if (!conversationId) return false;

  try {
    const res = await fetch(API.deleteConversation, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: conversationId, user_id: userId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
