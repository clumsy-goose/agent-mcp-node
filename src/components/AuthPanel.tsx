/**
 * Auth panel — agents.auth（JWT 鉴权）验证面板。
 *
 * 这个面板存在的意义是把「鉴权链路」变成可点击、可观察的东西：
 * 粘贴 JWT → 调 /whoami → 看 runtime 到底解析出了什么身份。
 *
 * 身份是怎么流动的
 * ----------------
 *   浏览器  ──Authorization: Bearer <JWT>──►  中控（边缘层）
 *                                               │ 用 edgeone.json 的
 *                                               │ verificationKeys 验签
 *                                               │ 验通后 delete + set
 *                                               │ edge-inner-user-id
 *                                               ▼
 *                                             agent runtime
 *                                               │ 映射为 makers-user-id
 *                                               │ 并丢弃客户端传的同名头
 *                                               ▼
 *                                             agents/whoami/index.ts
 *
 * 本地 dev 与线上的关键差异
 * ------------------------
 * 本地 dev **没有中控**，没人验签 JWT，所以粘贴 token 不会有任何效果。
 * 此时只能直接注入中控的「输出」edge-inner-user-id 来模拟已鉴权状态，
 * 这也正是「模拟中控」那一组按钮的用途。
 *
 * 面板里的安全断言
 * ----------------
 *   1. 伪造 makers-user-id 必须被丢弃 —— 否则任何人都能冒充任意用户；
 *   2. leakedInnerHeader 必须为 null —— 内部信道名不应透给业务层。
 * 两条任一失败都会红色高亮，属可被利用的缺陷。
 */

import { useCallback, useEffect, useState } from 'react';
import { fetchWhoami, getAuthToken, setAuthToken, type WhoamiResponse } from '../api';
import { useT } from '../i18n';
import styles from './AuthPanel.module.css';

/** 本地 dev 模拟中控注入身份时使用的用户名。 */
const SIMULATED_USER_ID = 'corbinlin';
/** 伪造测试用的受害者 ID —— 出现在结果里即代表防伪造失效。 */
const FORGED_USER_ID = 'victim-999';

type ProbeKind = 'plain' | 'simulated' | 'forged';

interface Props {
  /**
   * 当前活跃会话 ID，与 /chat、/stop 同源（App.tsx 的 activeConversationId，
   * 由 getOrCreateConversationId() 持久化在 localStorage）。
   * agent runtime 强制要求 makers-conversation-id，缺失会直接 400。
   */
  conversationId: string;
}

interface ProbeState {
  kind: ProbeKind;
  loading: boolean;
  response: WhoamiResponse | null;
}

function isLocalHost(): boolean {
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

/** 解析 JWT 的 payload 段用于展示 —— 仅 base64，不做验签（验签是中控的事）。 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function formatExpiry(exp: unknown): { text: string; expired: boolean } | null {
  if (typeof exp !== 'number') return null;
  const ms = exp * 1000;
  const expired = ms <= Date.now();
  return { text: new Date(ms).toLocaleString(), expired };
}

/**
 * 私钥来源：构建时由 Vite 注入的 `VITE_MAKERS_JWT_PRIVATE_KEY`。
 * 注意：浏览器端 env 会打进产物，仅适合本地测试；生产前端绝不能放私钥。
 */
const ENV_PRIVATE_KEY =
  (((import.meta as any).env?.VITE_MAKERS_JWT_PRIVATE_KEY as string | undefined) ?? '').trim();

// ── JWT 本地签发（Web Crypto，零依赖）──────────────────────────────────────
// 前端不验签，但「签发」本身也只需 web 标准 API。RS256 用 RSASSA-PKCS1-v1_5，
// HS256 用 HMAC —— 与 edgeone.json 的 agents.auth.algorithm 对应。

function utf8ToB64url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** PEM → bytes。剥离头尾与空白，兼容 \n 与单行。 */
function pemToBytes(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN[^-]*-----/, '')
    .replace(/-----END[^-]*-----/, '')
    .replace(/[\s\r\n]/g, '');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function signJwt(opts: {
  privateKey: string;
  alg: 'RS256' | 'HS256';
  claims: Record<string, unknown>;
}): Promise<string> {
  const headerB64 = utf8ToB64url(JSON.stringify({ alg: opts.alg, typ: 'JWT' }));
  const payloadB64 = utf8ToB64url(JSON.stringify(opts.claims));
  const signingInput = `${headerB64}.${payloadB64}`;
  const data = new TextEncoder().encode(signingInput);

  let signature: ArrayBuffer;
  if (opts.alg === 'RS256') {
    // Web Crypto 仅支持 PKCS8（-----BEGIN PRIVATE KEY-----）。
    const key = await crypto.subtle.importKey(
      'pkcs8',
      pemToBytes(opts.privateKey).buffer as ArrayBuffer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, data);
  } else {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(opts.privateKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    signature = await crypto.subtle.sign('HMAC', key, data);
  }
  return `${signingInput}.${bytesToB64url(new Uint8Array(signature))}`;
}

// ── datetime-local 与 unix 秒 互转（本地时区）──────────────────────────────
function toDatetimeLocal(d: Date): string {
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

function fromDatetimeLocal(v: string): number {
  return Math.floor(new Date(v).getTime() / 1000);
}

export default function AuthPanel({ conversationId }: Props) {
  const { t } = useT();
  const local = isLocalHost();

  const [token, setToken] = useState(() => getAuthToken());
  const [saved, setSaved] = useState(() => getAuthToken());
  const [probe, setProbe] = useState<ProbeState | null>(null);

  // ── JWT 生成器状态 ──
  const [genAlg, setGenAlg] = useState<'RS256' | 'HS256'>('RS256');
  const [genKey, setGenKey] = useState(() => ENV_PRIVATE_KEY);
  const [genSub, setGenSub] = useState('corbinlin');
  const [genExp, setGenExp] = useState(() => toDatetimeLocal(new Date(Date.now() + 3600_000)));
  const [genError, setGenError] = useState<string | null>(null);
  /** 最近一次生成的 token，用于在生成器下方回显。 */
  const [genResult, setGenResult] = useState<{
    token: string;
    sub: string;
    exp: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // token 变更后清掉旧探测结果，避免读者把上一次的结论套到新 token 上。
  useEffect(() => {
    setProbe(null);
  }, [saved]);

  const handleSave = useCallback(() => {
    setAuthToken(token);
    setSaved(token.trim());
  }, [token]);

  const handleClear = useCallback(() => {
    setAuthToken('');
    setToken('');
    setSaved('');
    setGenResult(null);
    setCopied(false);
  }, []);

  // 用私钥本地签发 JWT，并直接填入上方 token 框（保留粘贴能力）。
  const handleGenerate = useCallback(async () => {
    setGenError(null);
    // 先清掉上一次结果，避免失败时仍停留在旧 token 上造成误读。
    setGenResult(null);
    setCopied(false);
    try {
      const key = genKey.trim();
      if (!key) throw new Error(t('auth.gen.errorEmptyKey'));
      const sub = genSub.trim();
      if (!sub) throw new Error(t('auth.gen.errorEmptySub'));

      const now = Math.floor(Date.now() / 1000);
      const exp = fromDatetimeLocal(genExp);
      if (!Number.isFinite(exp) || exp <= now) {
        throw new Error(t('auth.gen.errorExp'));
      }

      const jwt = await signJwt({
        privateKey: key,
        alg: genAlg,
        claims: { sub, iat: now, nbf: now, exp },
      });
      setToken(jwt);
      setAuthToken(jwt);
      setSaved(jwt);
      setGenResult({ token: jwt, sub, exp });
    } catch (e) {
      setGenError(e instanceof Error ? e.message : String(e));
    }
  }, [genKey, genSub, genExp, genAlg, t]);

  // 复制生成的 token（clipboard 仅在安全上下文可用，失败静默处理）。
  const handleCopy = useCallback(async () => {
    if (!genResult) return;
    try {
      await navigator.clipboard.writeText(genResult.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 非安全上下文下 clipboard 不可用，忽略 */
    }
  }, [genResult]);

  const runProbe = useCallback(async (kind: ProbeKind) => {
    setProbe({ kind, loading: true, response: null });
    // conversationId 与 /chat 同源，由 App.tsx 传入。
    const base = { conversationId, echo: kind };
    const response = await fetchWhoami(
      kind === 'simulated'
        ? { ...base, identityHeader: SIMULATED_USER_ID }
        : kind === 'forged'
          // 伪造场景：直接把 makers-user-id 塞进请求头。
          // runtime 必须无条件丢弃它，否则就是可被利用的越权漏洞。
          ? { ...base, forgedUserIdHeader: FORGED_USER_ID }
          : base,
    );
    setProbe({ kind, loading: false, response });
  }, [conversationId]);

  const payload = saved ? decodeJwtPayload(saved) : null;
  const expiry = payload ? formatExpiry(payload.exp) : null;

  const result = probe?.response?.result ?? null;
  const forgeLeaked = probe?.kind === 'forged' && result?.userId === FORGED_USER_ID;
  const innerLeaked = Boolean(result && result.leakedInnerHeader !== null);

  return (
    <section className={styles.section} aria-labelledby="auth-panel-heading">
      <header className={styles.head}>
        <h2 id="auth-panel-heading" className={styles.title}>{t('auth.title')}</h2>
        <p className={styles.subtitle}>{t('auth.subtitle')}</p>
      </header>

      {/* 环境提示：本地 dev 没有中控，这一点最容易造成误判，所以放在最显眼处 */}
      <div className={local ? styles.envLocal : styles.envRemote}>
        <strong className={styles.envTag}>
          {local ? t('auth.env.local') : t('auth.env.remote')}
        </strong>
        <p className={styles.envHint}>
          {local ? t('auth.env.localHint') : t('auth.env.remoteHint')}
        </p>
      </div>

      {/* ── JWT 输入 ── */}
      <div className={styles.block}>
        <div className={styles.blockHead}>
          <h3 className={styles.blockTitle}>{t('auth.token.title')}</h3>
          {saved
            ? <span className={styles.badgeOn}>{t('auth.token.set')}</span>
            : <span className={styles.badgeOff}>{t('auth.token.unset')}</span>}
        </div>
        <p className={styles.blockHint}>{t('auth.token.hint')}</p>

        <textarea
          className={styles.tokenInput}
          value={token}
          onChange={e => setToken(e.target.value)}
          placeholder={t('auth.token.placeholder')}
          spellCheck={false}
          rows={4}
          aria-label={t('auth.token.title')}
        />

        <div className={styles.btnRow}>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={handleSave}
            disabled={!token.trim() || token.trim() === saved}
          >
            {t('auth.token.save')}
          </button>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={handleClear}
            disabled={!saved && !token}
          >
            {t('auth.token.clear')}
          </button>
        </div>

        {payload && (
          <dl className={styles.claims}>
            <div className={styles.claimRow}>
              <dt>sub</dt>
              <dd><code>{String(payload.sub ?? '-')}</code></dd>
            </div>
            {expiry && (
              <div className={styles.claimRow}>
                <dt>exp</dt>
                <dd className={expiry.expired ? styles.claimBad : undefined}>
                  <code>{expiry.text}</code>
                  {expiry.expired && <span className={styles.expiredTag}>{t('auth.token.expired')}</span>}
                </dd>
              </div>
            )}
          </dl>
        )}
        {saved && !payload && (
          <p className={styles.parseWarn}>{t('auth.token.unparsable')}</p>
        )}
      </div>

      {/* ── JWT 生成器 ── */}
      <div className={styles.block}>
        <div className={styles.blockHead}>
          <h3 className={styles.blockTitle}>{t('auth.gen.title')}</h3>
          <code className={styles.routeTag}>RS256 / HS256</code>
        </div>
        <p className={styles.blockHint}>{t('auth.gen.hint')}</p>

        <div className={styles.genForm}>
          <label className={styles.genField}>
            <span className={styles.genLabel}>{t('auth.gen.alg')}</span>
            <select
              className={styles.genInput}
              value={genAlg}
              onChange={e => setGenAlg(e.target.value as 'RS256' | 'HS256')}
              aria-label={t('auth.gen.alg')}
            >
              <option value="RS256">RS256</option>
              <option value="HS256">HS256</option>
            </select>
          </label>

          <label className={styles.genField}>
            <span className={styles.genLabel}>{t('auth.gen.key')}</span>
            <textarea
              className={styles.tokenInput}
              value={genKey}
              onChange={e => setGenKey(e.target.value)}
              placeholder={t('auth.gen.keyPlaceholder')}
              spellCheck={false}
              rows={4}
              aria-label={t('auth.gen.key')}
            />
          </label>
          {ENV_PRIVATE_KEY && (
            <p className={styles.genEnvNote}>{t('auth.gen.keyFromEnv')}</p>
          )}
          {genAlg === 'RS256' && (
            <p className={styles.blockHint}>{t('auth.gen.pkcs8Hint')}</p>
          )}

          <label className={styles.genField}>
            <span className={styles.genLabel}>{t('auth.gen.sub')}</span>
            <input
              className={styles.genInput}
              value={genSub}
              onChange={e => setGenSub(e.target.value)}
              placeholder="corbinlin"
              aria-label={t('auth.gen.sub')}
            />
          </label>

          <label className={styles.genField}>
            <span className={styles.genLabel}>{t('auth.gen.exp')}</span>
            <input
              className={styles.genInput}
              type="datetime-local"
              value={genExp}
              onChange={e => setGenExp(e.target.value)}
              aria-label={t('auth.gen.exp')}
            />
          </label>
        </div>

        <div className={styles.btnRow}>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={handleGenerate}
            disabled={probe?.loading}
          >
            {t('auth.gen.generate')}
          </button>
        </div>

        {genError && (
          <p className={styles.genError}>
            {t('auth.gen.error')}{genError}
          </p>
        )}

        {genResult && !genError && (
          <div className={styles.result}>
            <div className={styles.resultHead}>
              <span className={styles.statusOk}>{t('auth.gen.success')}</span>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={handleCopy}
              >
                {copied ? t('auth.gen.copied') : t('auth.gen.copy')}
              </button>
            </div>

            <pre className={styles.rawBox}>{genResult.token}</pre>

            <dl className={styles.claims}>
              <div className={styles.claimRow}>
                <dt>sub</dt>
                <dd><code>{genResult.sub}</code></dd>
              </div>
              <div className={styles.claimRow}>
                <dt>exp</dt>
                <dd><code>{new Date(genResult.exp * 1000).toLocaleString()}</code></dd>
              </div>
            </dl>

            <p className={styles.blockHint}>{t('auth.gen.filled')}</p>
          </div>
        )}
      </div>

      {/* ── 探测 ── */}
      <div className={styles.block}>
        <div className={styles.blockHead}>
          <h3 className={styles.blockTitle}>{t('auth.probe.title')}</h3>
          <code className={styles.routeTag}>POST /whoami</code>
        </div>
        <p className={styles.blockHint}>{t('auth.probe.hint')}</p>

        <div className={styles.btnRow}>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => runProbe('plain')}
            disabled={probe?.loading}
          >
            {t('auth.probe.run')}
          </button>
          {local && (
            <button
              type="button"
              className={styles.btnGhost}
              onClick={() => runProbe('simulated')}
              disabled={probe?.loading}
              title={t('auth.probe.simulateTitle')}
            >
              {t('auth.probe.simulate')}
            </button>
          )}
          <button
            type="button"
            className={styles.btnDanger}
            onClick={() => runProbe('forged')}
            disabled={probe?.loading}
            title={t('auth.probe.forgeTitle')}
          >
            {t('auth.probe.forge')}
          </button>
        </div>

        {probe?.loading && <p className={styles.pending}>{t('auth.probe.loading')}</p>}

        {probe && !probe.loading && probe.response && (
          <div className={styles.result}>
            <div className={styles.resultHead}>
              <span className={probe.response.ok ? styles.statusOk : styles.statusBad}>
                {probe.response.status === 0 ? t('auth.probe.netError') : `HTTP ${probe.response.status}`}
              </span>
              <span className={styles.scenarioTag}>{t(`auth.scenario.${probe.kind}` as never)}</span>
            </div>

            {result ? (
              <>
                <dl className={styles.fields}>
                  <div className={styles.fieldRow}>
                    <dt>{t('auth.field.authenticated')}</dt>
                    <dd>
                      <span className={result.authenticated ? styles.valOn : styles.valOff}>
                        {String(result.authenticated)}
                      </span>
                    </dd>
                  </div>
                  <div className={styles.fieldRow}>
                    <dt>makers-user-id</dt>
                    <dd><code>{result.userId ?? 'null'}</code></dd>
                  </div>
                  <div className={styles.fieldRow}>
                    <dt>{t('auth.field.authHeader')}</dt>
                    <dd><code>{String(result.authorizationPresent)}</code></dd>
                  </div>
                  <div className={styles.fieldRow}>
                    <dt>conversation-id</dt>
                    <dd><code>{result.conversationId ?? 'null'}</code></dd>
                  </div>
                </dl>

                {/* 安全断言：两条任一失败都是可被利用的缺陷 */}
                {forgeLeaked && (
                  <p className={styles.alertBad}>{t('auth.alert.forgeLeaked')}</p>
                )}
                {probe.kind === 'forged' && !forgeLeaked && (
                  <p className={styles.alertGood}>{t('auth.alert.forgeBlocked')}</p>
                )}
                {innerLeaked && (
                  <p className={styles.alertBad}>{t('auth.alert.innerLeaked')}</p>
                )}
              </>
            ) : (
              <pre className={styles.rawBox}>{probe.response.raw.slice(0, 600) || t('auth.probe.empty')}</pre>
            )}
          </div>
        )}
      </div>

      <p className={styles.note}>{t('auth.note')}</p>
    </section>
  );
}
