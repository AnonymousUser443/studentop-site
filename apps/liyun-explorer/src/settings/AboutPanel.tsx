import { Icon } from '../hud/Icon';
import SettingRow from './ui/SettingRow';

export default function AboutPanel() {
  return <>
    <article className="settings-about">
      <Icon name="gate" />
      <div><p className="settings-about-eyebrow">北京理工大学 · 良乡校区</p><h3>理韵寻踪</h3><p>跟随地图走进校园，在熟悉的建筑与风景之间，收集属于自己的校园记忆。</p><span className="settings-version">探索版 · v1.0.0</span></div>
    </article>
    <div className="settings-rows">
      <SettingRow label="界面语言" hint="当前提供简体中文" control={<span className="settings-value">简体中文</span>} />
      <SettingRow label="探索与存档" hint="定位与朝向只用于当前探索；游客存档保存在本机，登录后可同步旅途。" control={<Icon name="compass" />} />
    </div>
    <section className="settings-license" aria-labelledby="settings-license-title">
      <h3 id="settings-license-title">字体与开源许可</h3>
      <p>界面使用 Noto Serif SC，书法标题使用 Ma Shan Zheng。两套字体均以 SIL Open Font License 1.1 授权，许可随应用分发。</p>
      <div className="settings-license-links"><a href="/assets/fonts/NotoSerifSC-OFL.txt" target="_blank" rel="noreferrer">Noto Serif SC 许可 <span aria-hidden="true">↗</span></a><a href="/assets/fonts/MaShanZheng-OFL.txt" target="_blank" rel="noreferrer">Ma Shan Zheng 许可 <span aria-hidden="true">↗</span></a><a href="/assets/fonts/DejaVu-LICENSE.txt" target="_blank" rel="noreferrer" title="UI symbols · Bitstream Vera / Arev license">DejaVu Sans 许可 <span aria-hidden="true">↗</span></a></div>
      <p className="settings-note">旅途档案、寻踪成就与地标小故事仍在准备中，菜单会标明开放状态。</p>
    </section>
  </>;
}
