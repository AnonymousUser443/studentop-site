import { Icon } from './Icon';
import HudButton from './HudButton';

export interface StatusBarProps {
  collected: number;
  total: number;
  accountName: string | null;
  isFullscreen: boolean;
  onOpenCollection: () => void;
  onOpenProfile: () => void;
  onToggleFullscreen: () => void;
}

/**
 * 状态带：收录降权为"图标 + 数字"，账号保留昵称但截断。
 * 与操作坞区分权重——这里是状态，那里是操作。
 */
export default function StatusBar({
  collected, total, accountName, isFullscreen,
  onOpenCollection, onOpenProfile, onToggleFullscreen,
}: StatusBarProps) {
  return (
    <div className="hud-status">
      <HudButton
        type="button"
        className="hud-pill"
        onClick={onOpenCollection}
        aria-label={`已收录 ${collected} / ${total} 处地标，打开收集图鉴`}
      >
        <Icon name="book" />
        <strong className="tabular">
          {collected}<span>/{total}</span>
        </strong>
      </HudButton>

      <HudButton
        type="button"
        className="hud-pill"
        onClick={onOpenProfile}
        aria-label={accountName ? `${accountName}，已登录，打开旅途菜单` : '游客模式，打开旅途菜单'}
      >
        <Icon name="people" />
        <span className="hud-pill-name">{accountName ?? '游客'}</span>
      </HudButton>

      <HudButton
        type="button"
        className="hud-icon-button"
        onClick={onToggleFullscreen}
        aria-label={isFullscreen ? '退出全屏' : '进入全屏'}
        title={isFullscreen ? '退出全屏' : '进入全屏'}
      >
        <Icon name="fullscreen" />
      </HudButton>
    </div>
  );
}
