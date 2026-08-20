import { useT, MessageKeys } from '../i18n';
import AgentRoutes from './AgentRoutes';
import McpPanel from './McpPanel';
import styles from './InfoPanel.module.css';

export type InfoTab = 'routes' | 'mcp';

interface Props {
  tab: InfoTab;
  onTabChange: (tab: InfoTab) => void;
}

const TABS: { id: InfoTab; labelKey: MessageKeys; icon: string }[] = [
  { id: 'routes', labelKey: 'panel.tab.routes', icon: '🧭' },
  { id: 'mcp',    labelKey: 'panel.tab.mcp',    icon: '🔌' },
];

export default function InfoPanel({ tab, onTabChange }: Props) {
  const { t } = useT();

  return (
    <div className={styles.panel}>
      <div className={styles.tabBar} role="tablist" aria-label={t('panel.label')}>
        {TABS.map(item => {
          const isActive = item.id === tab;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`info-tab-${item.id}`}
              aria-selected={isActive}
              aria-controls={`info-panel-${item.id}`}
              className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
              onClick={() => onTabChange(item.id)}
            >
              <span className={styles.tabIcon} aria-hidden="true">{item.icon}</span>
              <span className={styles.tabLabel}>{t(item.labelKey)}</span>
            </button>
          );
        })}
      </div>

      <div
        className={styles.body}
        role="tabpanel"
        id={`info-panel-${tab}`}
        aria-labelledby={`info-tab-${tab}`}
        tabIndex={0}
      >
        {tab === 'routes' ? <AgentRoutes /> : <McpPanel />}
      </div>
    </div>
  );
}
