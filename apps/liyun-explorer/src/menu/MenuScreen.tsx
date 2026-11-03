import { useRef, type JSX } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import type { AccountUser } from '../types';
import { Icon } from '../hud/Icon';
import { useMotionPreferences } from '../motion/useMotionPreferences';
import { tween } from '../motion/transitions';
import { useModalFocus } from './modalFocus';
import MenuRail from './MenuRail';
import MenuGrid from './MenuGrid';
import './menu.css';

export type MenuTarget = 'collection' | 'activities' | 'settings' | 'about';
export interface MenuScreenProps { open?: boolean; onClose: () => void; onNavigate: (target: MenuTarget) => void; onLoginPrompt?: () => void; returnFocus?: HTMLElement | null; account: AccountUser | null; progress: number; collected: number; total: number; }

export default function MenuScreen({ open = true, onClose, onNavigate, onLoginPrompt, returnFocus, account, progress, collected, total }: MenuScreenProps): JSX.Element {
  const { reducedMotion } = useMotionPreferences();
  const closeRef = useRef<HTMLButtonElement>(null);
  const focus = useModalFocus(closeRef, false, returnFocus, '.hud-brand-badge');
  const percent = Math.round(Math.max(0, Math.min(100, progress)));
  const rank = Math.min(10, Math.floor(percent / 10) + 1);
  return (
    <Dialog.Root open={open} onOpenChange={next => { if (!next) onClose(); }}>
      <AnimatePresence>
        {open && <Dialog.Portal forceMount>
          <Dialog.Overlay forceMount asChild><motion.div className="menu-world-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={tween.fast} /></Dialog.Overlay>
          <Dialog.Content forceMount asChild {...focus} onEscapeKeyDown={event => { event.stopPropagation(); }}>
            <motion.section className="menu-screen" initial={reducedMotion ? { opacity: 0 } : { x: '-102%', opacity: 0.5 }} animate={{ x: 0, opacity: 1 }} exit={reducedMotion ? { opacity: 0 } : { x: '-102%', opacity: 0 }} transition={reducedMotion ? tween.tap : tween.page}>
              <Dialog.Title className="menu-sr-only">旅途菜单</Dialog.Title>
              <Dialog.Description className="menu-sr-only">查看旅途进度，进入图鉴、活动和设置。按 Escape 或点击右侧校园返回。</Dialog.Description>
              <button ref={closeRef} type="button" className="menu-close" aria-label="返回地图" onClick={onClose}><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="m13 9-7 7 7 7M6 16h11a8 8 0 1 1 0 16" transform="translate(0 -4)" /></svg></button>
              <MenuRail onNavigate={onNavigate} onClose={onClose} />
              <div className="menu-paper">
                <div className="menu-scroll">
                  <section className={`menu-card${!account && onLoginPrompt ? ' has-login' : ''}`} aria-label="个人信息">
                    <svg className="menu-card-art" viewBox="0 0 600 300" fill="none" aria-hidden="true" preserveAspectRatio="xMidYMid slice"><path d="M-30 245C52 73 156 352 267 154S447 153 630-11M-42 274C69 105 168 390 285 185S460 185 643 18M-20 52c156-98 200 176 387 30S530-49 634 85M-9 77c156-98 200 176 387 30S541-24 645 110" /><circle cx="430" cy="151" r="103" /><circle cx="430" cy="151" r="86" /><path d="M337 230v-59h188v59m-200-60h211l-30-26H355zm47-27v-23h77v23m-49 86v-46h27v46M345 230h175m-133-87v-25m90 25v-25" /></svg>
                    <div className="menu-card-topline"><span>理韵寻踪</span><span>旅途手札</span></div>
                    <div className="menu-identity"><div className="menu-avatar" aria-hidden="true"><Icon name="gate" /><span>理</span></div><div className="menu-identity-text"><h1 className="menu-nickname">{account?.nickname ?? '校园旅人'}</h1><p className="menu-signature">循理韵而行，把校园写进旅途。</p><span className="menu-account-state">{account ? '云端账号' : '游客 · 本机存档'}</span></div></div>
                    <div className="menu-rank"><span>寻踪阶</span><strong>{rank.toString().padStart(2, '0')}</strong><span className="menu-rank-count">已点亮 <b>{collected}</b> / {total} 处地标</span></div>
                    <div className="menu-progress" role="progressbar" aria-label="探索度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span className="menu-progress-fill" style={{ width: `${percent}%` }} /></div>
                    <div className="menu-meta"><span>{account ? `UID ${account.uid}` : '良乡校区 · 自在寻踪'}</span><span>探索度 {percent}%</span></div>
                    {!account && onLoginPrompt && <button type="button" className="menu-login" aria-label="登录并同步旅途" onClick={onLoginPrompt}><Icon name="people" /><span>登录</span></button>}
                  </section>
                  <div className="menu-content"><div className="menu-section-title"><span>旅途之中</span><span aria-hidden="true">◆</span></div><MenuGrid onNavigate={onNavigate} /><div className="menu-footnote"><Icon name="leaf" /><p>眼前一景，足下一程。<br /><span>未开放的篇章，会在以后的旅途中相见。</span></p></div></div>
                </div>
                <footer className="menu-footer"><span>一纸良乡 · 步履成诗</span><span><kbd>Esc</kbd> 返回校园</span></footer>
              </div>
            </motion.section>
          </Dialog.Content>
        </Dialog.Portal>}
      </AnimatePresence>
    </Dialog.Root>
  );
}
