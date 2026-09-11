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

export default function AuthPanel({ conversationId }: Props) {
  const { t } = useT();
  const local = isLocalHost();

  const [token, setToken] = useState(() => getAuthToken());
  const [saved, setSaved] = useState(() => getAuthToken());
  const [probe, setProbe] = useState<ProbeState | null>(null);

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
  }, []);

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
