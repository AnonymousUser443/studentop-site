# 青玉纸境 · 个人素材与字体

## 用户指定图像
- 头像来自用户指定的 Avatar_New_IEE.jpg。仓库副本 [avatar-aiden.jpg](../site/assets/img/avatar-aiden.jpg) 为原字节复制，550×550，26,674字节；不裁切或重绘原图。SHA-256：`d1d61e32742a1973d01e10b29c31b78e3ec7087ab413a8170f7f47cc6a4e766d`。
- 壁纸来自用户指定的《沉玉谷·岁时祭祀》，原尺寸3840×2160。运行副本 [wall-chenyu.webp](../site/assets/img/wall-chenyu.webp) 为2560×1440、569,302字节；[缩略图](../site/assets/img/thumb-chenyu.webp) 为480×270。仅尺寸/编码优化，不覆盖外部原文件，不移除图像内原署名或标识。
- 用户提供用于本项目的素材不因此自动变成MIT或公共领域内容；头像原作者、游戏壁纸权利仍归原权利人。公开或商业分发需由项目所有者确认权限。本次只做本地开发，无部署。
- 可复现处理脚本：[prepare-personal-assets.py](../tools/prepare-personal-assets.py)，明确传入`--avatar`和`--wallpaper`路径，无隐式全盘搜索。

## 本轮开机标志

新增用户指定的薄荷绿四窗人物标志，运行副本 [boot-logo.webp](<../site/assets/img/boot-logo.webp>)保留1046×1049尺寸、透明通道与原始RGBA逐像素内容，无AI重绘。来源、SHA和无损验证见 [启动素材账本](<boot/asset-manifest.json>)；外部原图未覆盖。

## 字体
- Noto Sans SC用于清晰UI，Noto Serif SC用于纸笺标题。字体从本机已安装源文件提取子集，源文件不改动。
- [字库脚本](../tools/build-theme-fonts.py)扫描限定的网页与入场源码中文，保留变量字重、字形布局与许可元数据，输出WOFF2到两应用自己的公开资源目录，不依赖在线字体。增加文案后应重新执行该脚本；文本输入的任意汉字由系统回退字体承接。
- 所附许可证：[Noto Sans SC OFL](../site/assets/fonts/OFL-NotoSansSC.txt)、[Noto Serif SC OFL](../site/assets/fonts/OFL-NotoSerifSC.txt)。源许可分别来自 [Google Fonts Sans SC](https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosanssc/OFL.txt) 与 [Serif SC](https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notoserifsc/OFL.txt)。
- 正常运行使用已提交的字库；仅重新生成需要fontTools的`pyftsubset`与Brotli，不把这些工具作为网页启动依赖。

2026-10-28 最终文案补集：80个限定源码文件、978个字符。Sans 283,836字节，SHA256 `5be13a8c18632c08882dd96876140c8c4e61be3779a5db3150e93b6d15dc540a`；Serif 369,272字节，SHA256 `e43a8b8e4dd7bf5e1fadce3e5daecb28c434c58284aab472a4e0122f5ff7e6d8`。主页与校园两份公开字库相同，均带OFL许可；此前报告中的字库字节数是上一轮历史值。
