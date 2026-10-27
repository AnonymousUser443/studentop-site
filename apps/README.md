# apps/ · 两个项目源码

| 目录 | 项目 | 部署地址 | 构建 |
| --- | --- | --- | --- |
| `liyun-explorer/` | 理韵寻踪 · 北理校园探索 HUD | <https://liyun.studentop.cn:14355/> | `npm ci && npm run build`（`base` 保持 `/`） |
| `genshin-start/` | 原神启动（3D 开场，开门后进理韵寻踪） | <https://genshin.studentop.cn:14355/> | `npm ci && npm run build` |

两者都是**子域名根目录**部署，所以 Vite 的 `base` 用默认值即可，源码里 `/assets/...` 这类根绝对路径不用改。

## 版权

- `liyun-explorer/`：课程项目源码，保留原作者权利；音频、字体、美术素材的授权请使用前自行确认
- `genshin-start/`：上游 [www-genshin](https://www.bilibili.com/video/BV1E8411v7xy)（作者 TEAM.x.y.z），MIT（见目录内 LICENSE），本仓库存放的是按「开门 → 理韵寻踪」改造后的副本；《原神》相关素材版权归米哈游，仅作技术演示
