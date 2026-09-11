import { useT, MessageKeys } from '../i18n';
import styles from './AgentRoutes.module.css';

/**
 * Agent route catalogue.
 *
 * Only routes under `agents/` belong here — those are the ones the EdgeOne
 * Makers agent runtime owns (it injects `conversation_id`, the AbortSignal and
 * `context.store`, and — because `edgeone.json` sets `agents.mcp.enabled` —
 * also re-exposes each of them as an MCP tool).
 *
 * The `cloud-functions/` endpoints (/history, /conversations, /clear-history,
 * /delete-conversation) are deliberately NOT listed: they are plain edge
 * functions used by this demo UI for persistence, not agent routes.
 *
 * Routing convention: directory name = route, `index` = default entry, and
 * files prefixed with `_` (e.g. `_tools.ts`, `_sse.ts`) stay private.
 */
interface RouteItem {
  method: 'POST';
  path: string;
  file: string;
  /** Tool name this route is exposed as over MCP. */
  mcpTool: string;
  /** Request body fields, for tool routes. */
  params?: string;
  streaming?: boolean;
  /** Tool routes are the ones split out purely to prove MCP auto-registration. */
  group: 'core' | 'tool';
  icon: string;
  titleKey: MessageKeys;
  descKey: MessageKeys;
}

const ROUTES: RouteItem[] = [
  {
    method: 'POST',
    path: '/chat',
    file: 'agents/chat/index.ts',
    mcpTool: 'chat',
    streaming: true,
    group: 'core',
    icon: '💬',
    titleKey: 'route.chat.title',
    descKey: 'route.chat.desc',
  },
  {
    method: 'POST',
    path: '/stop',
    file: 'agents/stop/index.ts',
    mcpTool: 'cancel_run',
    group: 'core',
    icon: '⏹',
    titleKey: 'route.stop.title',
    descKey: 'route.stop.desc',
  },
  {
    method: 'POST',
    path: '/whoami',
    file: 'agents/whoami/index.ts',
    mcpTool: 'whoami',
    params: 'echo (optional)',
    streaming: true,
    group: 'core',
    icon: '🔐',
    titleKey: 'route.whoami.title',
    descKey: 'route.whoami.desc',
  },
  {
    method: 'POST',
    path: '/get_weather',
    file: 'agents/get_weather/index.ts',
    mcpTool: 'get_weather',
    params: 'city',
    streaming: true,
    group: 'tool',
    icon: '☀️',
    titleKey: 'route.getWeather.title',
    descKey: 'route.getWeather.desc',
  },
  {
    method: 'POST',
    path: '/get_clothing_advice',
    file: 'agents/get_clothing_advice/index.ts',
    mcpTool: 'get_clothing_advice',
    params: 'weather',
    streaming: true,
    group: 'tool',
    icon: '👔',
    titleKey: 'route.getClothingAdvice.title',
    descKey: 'route.getClothingAdvice.desc',
  },
  {
    method: 'POST',
    path: '/translate_text',
    file: 'agents/translate_text/index.ts',
    mcpTool: 'translate_text',
    params: 'text, target_language',
    streaming: true,
    group: 'tool',
    icon: '🌐',
    titleKey: 'route.translateText.title',
    descKey: 'route.translateText.desc',
  },
  {
    method: 'POST',
    path: '/text_statistics',
    file: 'agents/text_statistics/index.ts',
    mcpTool: 'text_statistics',
    params: 'text',
    streaming: true,
    group: 'tool',
    icon: '📊',
    titleKey: 'route.textStatistics.title',
    descKey: 'route.textStatistics.desc',
  },
];

const GROUPS: { id: RouteItem['group']; titleKey: MessageKeys; hintKey: MessageKeys }[] = [
  { id: 'core', titleKey: 'routes.group.core', hintKey: 'routes.group.coreHint' },
  { id: 'tool', titleKey: 'routes.group.tool', hintKey: 'routes.group.toolHint' },
];

export default function AgentRoutes() {
  const { t } = useT();

  return (
    <section className={styles.section} aria-labelledby="agent-routes-heading">
      <header className={styles.head}>
        <h2 id="agent-routes-heading" className={styles.title}>
          {t('routes.title')}
        </h2>
        <p className={styles.subtitle}>{t('routes.subtitle')}</p>
        <p className={styles.countBar}>
          <strong>{ROUTES.length}</strong>
          {t('routes.countSuffix')}
        </p>
      </header>

      {GROUPS.map(group => {
        const items = ROUTES.filter(r => r.group === group.id);
        return (
          <div key={group.id} className={styles.group}>
            <div className={styles.groupHead}>
              <h3 className={styles.groupTitle}>{t(group.titleKey)}</h3>
              <span className={styles.groupCount}>{items.length}</span>
            </div>
            <p className={styles.groupHint}>{t(group.hintKey)}</p>

            <ul className={styles.list}>
              {items.map(route => (
                <li key={route.path} className={styles.card}>
                  <div className={styles.cardHead}>
                    <span className={styles.icon} aria-hidden="true">{route.icon}</span>
                    <div className={styles.cardHeadText}>
                      <div className={styles.pathRow}>
                        <span className={styles.method}>{route.method}</span>
                        <code className={styles.path}>{route.path}</code>
                        {route.streaming && <span className={styles.sseTag}>SSE</span>}
                      </div>
                      <p className={styles.cardTitle}>{t(route.titleKey)}</p>
                    </div>
                  </div>

                  <p className={styles.desc}>{t(route.descKey)}</p>

                  <div className={styles.metaRow}>
                    <code className={styles.file}>{route.file}</code>
                    <span className={styles.mcpTag}>
                      {t('routes.mcpTool')}
                      <code>{route.mcpTool}</code>
                    </span>
                    {route.params && (
                      <span className={styles.paramTag}>
                        {t('routes.params')}
                        <code>{route.params}</code>
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      <p className={styles.note}>{t('routes.note')}</p>
    </section>
  );
}
