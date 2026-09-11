#!/usr/bin/env node
/**
 * agents.auth 鉴权链路验证 —— 针对 /whoami 探针跑一组场景并断言。
 *
 * 用法：
 *   node scripts/test-auth.js                          # 本地 dev（localhost:8088）
 *   node scripts/test-auth.js http://localhost:8088    # 显式指定
 *   node scripts/test-auth.js https://your-domain.com  # 线上
 *
 * 两种模式会自动切换，因为两者的身份注入方式根本不同：
 *
 *   本地 dev —— 没有中控，没人验签，JWT 传了也不会被处理。
 *               只能直接塞中控的「输出」edge-inner-user-id 来模拟已验签状态。
 *               可验证：身份映射、防伪造、无身份判定。
 *
 *   线上    —— 中控用 edgeone.json 的 verificationKeys 验签 JWT，
 *               验通后注入 edge-inner-user-id，runtime 再映射成 makers-user-id。
 *               可额外验证：签名校验本身、过期拒绝、篡改拒绝。
 *
 * 私钥路径同 sign-test-jwt.js：MAKERS_JWT_KEY > ~/.makers-test-keys/ > /tmp/。
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const USER_ID = 'corbinlin';
const FAKE_USER_ID = 'victim-999';

const target = process.argv[2] || 'http://localhost:8088';
const baseUrl = target.replace(/\/+$/, '');
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/.test(baseUrl);

// ── JWT 签发（线上模式才需要）──────────────────────────────────────────

function resolveKeyPath() {
  const candidates = [
    process.env.MAKERS_JWT_KEY,
    path.join(os.homedir(), '.makers-test-keys', 'makers-jwt-test.key'),
    '/tmp/makers-jwt-test.key',
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p));
}

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

/** 用私钥签一个 JWT。ttl 为负数即可签出已过期的 token。 */
function signJwt(keyPath, { sub, ttl }) {
  const now = Math.floor(Date.now() / 1000);
  const signingInput = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ sub, iat: now, exp: now + ttl })}`;
  const signature = crypto
    .sign('RSA-SHA256', Buffer.from(signingInput), fs.readFileSync(keyPath))
    .toString('base64url');
  return `${signingInput}.${signature}`;
}

/** 篡改 payload 但保留原签名 —— 模拟攻击者改 sub 提权。 */
function tamperJwt(token, newSub) {
  const [header, , signature] = token.split('.');
  return `${header}.${b64({ sub: newSub, exp: Math.floor(Date.now() / 1000) + 3600 })}.${signature}`;
}

// ── 请求与 SSE 解析 ────────────────────────────────────────────────────

/**
 * /whoami 返回的是 SSE（MCP adapter 只认 text_delta，见 handler 注释），
 * 所以要把 data: 行里的 delta 拼起来再 JSON.parse。
 */
function parseSse(raw) {
  let text = '';
  for (const block of raw.split(/\n\n/)) {
    if (!block.trim()) continue;
    let eventName = '';
    const dataLines = [];
    for (const line of block.split(/\n/)) {
      if (line.startsWith('event:')) eventName = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    if (eventName !== 'text_delta' || dataLines.length === 0) continue;
    try {
      const parsed = JSON.parse(dataLines.join('\n'));
      if (typeof parsed?.delta === 'string') text += parsed.delta;
    } catch {
      /* 非 JSON 帧忽略 */
    }
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * 会话 ID —— 与前端同一语义：一次运行内复用同一个，而非每个请求新建。
 *
 * 前端由 getOrCreateConversationId() 在 localStorage 里持久化；脚本没有
 * localStorage，等价做法是进程启动时生成一次并在所有场景间复用。
 * agent runtime 强制要求 makers-conversation-id，缺失会直接
 * 400 AGENT_CONVERSATION_ID_REQUIRED。
 */
const CONVERSATION_ID = crypto.randomUUID();

async function callWhoami(headers) {
  const res = await fetch(`${baseUrl}/whoami`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'makers-conversation-id': CONVERSATION_ID,
      ...headers,
    },
    body: JSON.stringify({ echo: 'probe' }),
  });
  const raw = await res.text();
  return { status: res.status, body: parseSse(raw), raw };
}

// ── 断言与执行 ─────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function scenario(name, headers, check) {
  let result;
  try {
    result = await callWhoami(headers);
  } catch (e) {
    console.log(`  ✗ ${name}\n      请求失败: ${e.message}`);
    failed += 1;
    return;
  }
  const problem = check(result);
  if (problem) {
    console.log(`  ✗ ${name}`);
    console.log(`      ${problem}`);
    console.log(`      实际: status=${result.status} body=${JSON.stringify(result.body)}`);
    failed += 1;
  } else {
    const who = result.body?.userId ?? '-';
    console.log(`  ✓ ${name}  (status=${result.status}, userId=${who})`);
    passed += 1;
  }
}

/** 已鉴权：身份正确，且内部信道名未泄漏给业务。 */
const expectAuthed = (sub) => (r) => {
  if (r.status !== 200) return `期望 200，实际 ${r.status}`;
  if (!r.body) return '响应无法解析为 JSON';
  if (r.body.authenticated !== true) return '期望 authenticated=true';
  if (r.body.userId !== sub) return `期望 userId="${sub}"，实际 "${r.body.userId}"`;
  if (r.body.leakedInnerHeader !== null) {
    return `安全问题：内部头 edge-inner-user-id 泄漏到业务侧（值 "${r.body.leakedInnerHeader}"）`;
  }
  return null;
};

/** 未鉴权：200 但无身份（公开模式下 handler 自行决定如何处理）。 */
const expectAnonymous = (r) => {
  if (r.status !== 200) return `期望 200，实际 ${r.status}`;
  if (!r.body) return '响应无法解析为 JSON';
  if (r.body.authenticated !== false) return '期望 authenticated=false';
  if (r.body.userId !== null) return `期望 userId=null，实际 "${r.body.userId}"`;
  return null;
};

/** 被中控拦截：请求不应到达 SCF。 */
const expectRejected = (r) => {
  if (r.status === 200) {
    return `安全问题：期望被中控拒绝（401/403），实际 200 且 userId="${r.body?.userId}"`;
  }
  return null;
};

async function runLocal() {
  console.log(`本地 dev 模式 — ${baseUrl}`);
  console.log('（无中控，直接注入 edge-inner-user-id 模拟已验签状态；JWT 在此模式下无意义）\n');

  await scenario('不带任何身份头 → 无身份', {}, expectAnonymous);

  await scenario(
    '注入 edge-inner-user-id → 映射为 makers-user-id',
    { 'edge-inner-user-id': USER_ID },
    expectAuthed(USER_ID),
  );

  await scenario(
    '★ 伪造 makers-user-id → 必须被丢弃',
    { 'makers-user-id': FAKE_USER_ID },
    expectAnonymous,
  );

  await scenario(
    '★ 伪造 + 合法身份并存 → 合法身份胜出',
    { 'makers-user-id': FAKE_USER_ID, 'edge-inner-user-id': USER_ID },
    expectAuthed(USER_ID),
  );

  await scenario(
    'header 名大小写不敏感',
    { 'Edge-Inner-User-Id': USER_ID },
    expectAuthed(USER_ID),
  );
}

async function runRemote() {
  console.log(`线上模式 — ${baseUrl}`);
  console.log('（中控验签 JWT → 注入身份 → runtime 映射为 makers-user-id）\n');

  const keyPath = resolveKeyPath();
  if (!keyPath) {
    console.error('找不到签名私钥，无法签发测试 token。');
    console.error('设置 MAKERS_JWT_KEY 或放到 ~/.makers-test-keys/makers-jwt-test.key');
    process.exit(1);
  }
  console.log(`签名私钥: ${keyPath}\n`);

  const validToken = signJwt(keyPath, { sub: USER_ID, ttl: 3600 });

  await scenario('不带 token → 被中控拒绝', {}, expectRejected);

  await scenario(
    '合法 JWT → 身份为 token 的 sub',
    { authorization: `Bearer ${validToken}` },
    expectAuthed(USER_ID),
  );

  await scenario(
    '★ 合法 JWT + 伪造 makers-user-id → 以 token 身份为准',
    { authorization: `Bearer ${validToken}`, 'makers-user-id': FAKE_USER_ID },
    expectAuthed(USER_ID),
  );

  await scenario(
    '★ 篡改 payload（提权为 admin）→ 签名失效被拒',
    { authorization: `Bearer ${tamperJwt(validToken, 'admin')}` },
    expectRejected,
  );

  await scenario(
    '已过期 JWT → 被拒',
    { authorization: `Bearer ${signJwt(keyPath, { sub: USER_ID, ttl: -3600 })}` },
    expectRejected,
  );

  // 用一把未登记的私钥签名：验证 verificationKeys 真的在起作用。
  const strayKey = path.join(os.tmpdir(), `stray-jwt-${process.pid}.key`);
  fs.writeFileSync(
    strayKey,
    crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
      .privateKey.export({ type: 'pkcs8', format: 'pem' }),
  );
  try {
    await scenario(
      '★ 未登记私钥签的 JWT → 被拒',
      { authorization: `Bearer ${signJwt(strayKey, { sub: USER_ID, ttl: 3600 })}` },
      expectRejected,
    );
  } finally {
    fs.rmSync(strayKey, { force: true });
  }
}

console.log('');
if (isLocal) {
  await runLocal();
} else {
  await runRemote();
}

console.log(`\n通过 ${passed} / 失败 ${failed}`);
if (failed > 0) {
  console.log('标 ★ 的场景属安全断言，失败意味着存在可被利用的身份伪造路径。');
  process.exit(1);
}
