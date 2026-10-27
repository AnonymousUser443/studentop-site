# HUD 样式与字体交接

- `src/hud/hud.css` 对应现有 `Hud.tsx`、`Ornaments.tsx` 和 `Icon.tsx` 的完整样式；没有修改交互接口。
- 视觉使用深玉绿、奶油金、赭金活动按钮、清晰剪纸轮廓和细金边；参考已目视检查：`游戏内主地图示意参考1.png`、`原神参考图1.png`。
- 图层：边饰 7、HUD 10、面板 30、提示 35、首次入口 40。HUD 容器不阻挡地图，按钮恢复点击；未进入时由 `inert` 和入口遮罩阻挡操作。
- 桌面菜单约占宽度 20%；移动横屏在高度 560px 或宽度 1000px 以下压缩，五个菜单保持 44px 点击高度，隐藏副标题；667×375、844×390 的工具区与菜单按各自固定区域布局。所有弹层内容可滚动。
- 首次入口为中央小卡片，底层仍显示真实地图，遮罩仅压暗；主按钮保持至少 46px 高度。
- 正文/UI：Noto Serif SC 变量字体；书法标题：Ma Shan Zheng。两者为本地 WOFF2 子集，完整许可见 `public/assets/fonts/*-OFL.txt`，没有外部字体请求。
- 修改 UI 文案后，在 Windows PowerShell 运行 `powershell -ExecutionPolicy Bypass -File scripts/fonts-build.ps1` 重新生成字符子集。脚本需要 `fontTools` 的 `pyftsubset` 命令和 Brotli 支持；Noto 源字体默认位于 `C:/Windows/Fonts/NotoSerifSC-VF.ttf`，可通过 `-SerifSource` 指定其他位置。Ma Shan Zheng 源字体已在资产目录。
- 本分工未启动开发服务器、未操作浏览器。最终截图、各尺寸碰撞检查与端到端交互由集成分工验证；本记录不代表已完成浏览器验收。
