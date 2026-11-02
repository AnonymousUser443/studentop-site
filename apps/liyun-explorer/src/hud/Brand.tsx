import { BrandGate } from './Ornaments';
import HudButton from './HudButton';

export interface BrandProps {
  /** 点击徽章 → 个人主页/菜单 */
  onOpenMenu: () => void;
  /** 点击标题 → 回中 */
  onCenter: () => void;
  /** 节气/时段文案，如 "良乡 · 秋" */
  season?: string;
}

/** 品牌身份带：徽章与标题拆成两个独立命中区 */
export default function Brand({ onOpenMenu, onCenter, season = '良乡 · 秋' }: BrandProps) {
  return (
    <div className="hud-brand">
      <HudButton
        type="button"
        className="hud-brand-badge"
        onClick={onOpenMenu}
        aria-label="打开旅途菜单"
        title="旅途菜单"
      >
        <BrandGate />
      </HudButton>
      <HudButton
        type="button"
        className="hud-brand-copy"
        onClick={onCenter}
        aria-label="理韵寻踪，回到校园中心"
        title="回到校园中心"
      >
        <span className="hud-brand-title">理韵寻踪</span>
        <span className="hud-brand-sub">— 北理校园探索 —</span>
        <span className="hud-brand-season">{season}</span>
      </HudButton>
    </div>
  );
}
