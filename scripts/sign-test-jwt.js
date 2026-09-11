#!/usr/bin/env node
/**
 * 签发测试用 JWT —— 仅用于本地/预发验证 agents.auth 鉴权链路。
 *
 * 用法：
 *   node scripts/sign-test-jwt.js                 # sub=user-123，有效期 1h
 *   node scripts/sign-test-jwt.js alice           # 指定 sub
 *   node scripts/sign-test-jwt.js alice 60        # 指定 sub 与有效期（秒）
 *
 * 私钥路径可用 MAKERS_JWT_KEY 覆盖，默认 ~/.makers-test-keys/makers-jwt-test.key，
 * 回退到 /tmp/makers-jwt-test.key。
 *
 * ⚠️ 这把密钥是自签测试密钥，不代表任何真实身份体系。
 *    生产环境的 token 必须由真实签发方（认证服务 / IdP）签发。
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CANDIDATE_KEYS = [
  process.env.MAKERS_JWT_KEY,
  path.join(os.homedir(), '.makers-test-keys', 'makers-jwt-test.key'),
  '/tmp/makers-jwt-test.key',
].filter(Boolean);

const keyPath = CANDIDATE_KEYS.find((p) => fs.existsSync(p));
if (!keyPath) {
  console.error(`找不到私钥，尝试过：\n  ${CANDIDATE_KEYS.join('\n  ')}`);
  console.error('\n重新生成：');
  console.error('  mkdir -p ~/.makers-test-keys && chmod 700 ~/.makers-test-keys');
  console.error('  openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 \\');
  console.error('    -out ~/.makers-test-keys/makers-jwt-test.key');
  console.error('  openssl rsa -in ~/.makers-test-keys/makers-jwt-test.key \\');
  console.error('    -pubout -out ~/.makers-test-keys/makers-jwt-test.pub');
  process.exit(1);
}

const sub = process.argv[2] || 'user-123';
const ttl = Number(process.argv[3] || 3600);
const now = Math.floor(Date.now() / 1000);

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const payload = { sub, iat: now, exp: now + ttl };
const signingInput = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64(payload)}`;
const signature = crypto
  .sign('RSA-SHA256', Buffer.from(signingInput), fs.readFileSync(keyPath))
  .toString('base64url');
const token = `${signingInput}.${signature}`;

// 自检：用 edgeone.json 里配置的公钥验一遍，避免签出来的 token 根本验不通。
const confPath = path.resolve(__dirname, '..', 'edgeone.json');
let selfCheck = 'skipped (edgeone.json not found)';
if (fs.existsSync(confPath)) {
  const keys = JSON.parse(fs.readFileSync(confPath, 'utf-8'))?.agents?.auth?.verificationKeys || [];
  const ok = keys.some((pem) => {
    try {
      return crypto.verify('RSA-SHA256', Buffer.from(signingInput), pem, Buffer.from(signature, 'base64url'));
    } catch {
      return false;
    }
  });
  selfCheck = ok
    ? 'OK — 可被 edgeone.json 的 verificationKeys 验通'
    : 'FAILED — 私钥与 edgeone.json 里的公钥不配对！';
}

console.error(`key:       ${keyPath}`);
console.error(`payload:   ${JSON.stringify(payload)}`);
console.error(`selfCheck: ${selfCheck}`);
console.error('');
// token 走 stdout，方便 $(node scripts/sign-test-jwt.js) 直接取用
console.log(token);
