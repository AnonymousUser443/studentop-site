# 理韵墨苑独立字体

本目录两份字体由本机全量 OFL Noto SC 源文件独立子集化。只修改墨苑应用，系统源字体、主页及其他应用的字体保持原样；两个 OFL 许可文件保留。

| 字体 | 字节 | 保留的可变字重 | 当前所需码点 | 缺字 |
| --- | ---: | --- | ---: | ---: |
| noto-sans-sc.woff2 | 134,948 | wght 100–900 | 409 | 0 |
| noto-serif-sc.woff2 | 180,128 | wght 200–900 | 409 | 0 |

原拷贝字体在初始412个必需码点中，各缺73字，包含标题“墨苑”。[首次审计](coverage-before.json)保留每个源文件的实际缺字。全量源仍缺三种工具符号，第一次严格构建因此停止，见[源字体检查](coverage-build-attempt.json)；工具按钮随后改用内联SVG，当前409个文字码点全部覆盖。字体同时保留全部ASCII、HTML正文及辅助标签、JavaScript中的非ASCII字符（含Canvas动态题字与注释，是可见文案的严格超集）。

[构建报告](coverage-built.json)记录字体SHA256、来源文件名及SHA256、源代码快照和逐文件cmap覆盖。[只读复验](coverage-verified.json)在Canvas切换到MoyuanSerif后再次逐文件确认零缺字。字体包含变量字重轴；CSS的font-face需声明对应字重范围，Canvas使用`MoyuanSerif`并在生成贴图前等待字体加载。

从仓库根重新构建（需要已安装的fontTools和Brotli；浏览应用不需要Python）：

```text
python apps/liyun-moyuan/tools/build-fonts.py --sans C:/Windows/Fonts/NotoSansSC-VF.ttf --serif C:/Windows/Fonts/NotoSerifSC-VF.ttf --report apps/liyun-moyuan/public/fonts/<新的报告>.json
```

只读核验当前全部文字：

```text
python apps/liyun-moyuan/tools/build-fonts.py --check
```

脚本不覆盖指定的历史报告，源字体存在缺字或两份新子集未全部通过时，不替换现有应用字体。当前环境的受限临时目录曾拒绝WOFF2写入；实际重建在获授权的本地执行环境完成，没有更改字体生成选项、跳过缺字或安装字体。
