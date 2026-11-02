import { Icon } from './Icon';
import type { IconName } from '../types';
import HudButton from './HudButton';

export interface DockAction {
  id: string;
  label: string;
  icon: IconName;
  /** 桌面端快捷键角标，如 'A' */
  key?: string;
  /** 是否为主操作（更亮一档） */
  emphasis?: boolean;
  onClick: () => void;
}

export interface ActionDockProps {
  actions: DockAction[];
}

/** 操作坞：切角纸片按钮，与状态带形成权重对比 */
export default function ActionDock({ actions }: ActionDockProps) {
  return (
    <div className="hud-dock">
      {actions.map((action) => (
        <HudButton
          key={action.id}
          type="button"
          className="hud-dock-button"
          data-emphasis={action.emphasis ? 'true' : 'false'}
          onClick={action.onClick}
          aria-label={action.label}
          data-testid={action.id === 'activities' ? 'activity-entry' : `dock-${action.id}`}
          aria-keyshortcuts={action.key}
        >
          <Icon name={action.icon} />
          <span data-testid={action.id === 'activities' ? 'dock-activities' : undefined}>{action.label}</span>
          {action.key && <span className="hud-dock-key" aria-hidden="true">{action.key}</span>}
        </HudButton>
      ))}
    </div>
  );
}
