import type { ComponentType } from "react";
import { P5_01, P5_02, P5_03, P5_04, P5_05 } from "./P501_05";
import { P5_06, P5_07, P5_08, P5_09 } from "./P506_09";
import { P5_10, P5_11, P5_12, P5_13, P5_14, P5_15 } from "./P510_15";
import { P5_16, P5_17, P5_18, P5_19, P5_20 } from "./P516_20";

export type SlideLayer = "MAIN" | "FLEX" | "HOLD";

export interface SlideDef {
  id: string;
  Component: ComponentType<{ onDone?: () => void }>;
  /** 提词器备注 */
  note?: string;
  layer?: SlideLayer;
  /** 预估停留秒数 */
  dur?: number;
  /** 该页是否有需要等待的入场动画（禁止过快跳过） */
  lock?: boolean;
}

export const P5_SLIDES: SlideDef[] = [
  {
    id: "P5-01",
    Component: P5_01,
    note: "换画风。没有光晕，只有数据雨。让「界义」两个字从点里长出来。",
    dur: 10,
    lock: true,
  },
  {
    id: "P5-02",
    Component: P5_02,
    note: "「接下来，我们换一个画风。」——轻，慢。",
    dur: 8,
  },
  {
    id: "P5-03",
    Component: P5_03,
    note: "「人工智能。」停顿。这一声低频要等现场安静下来。",
    dur: 10,
  },
  {
    id: "P5-04",
    Component: P5_04,
    note: "有人写代码，有人整理资料，有人偶尔问问。",
    layer: "FLEX",
    dur: 14,
  },
  {
    id: "P5-05",
    Component: P5_05,
    note: "刚上大学时让 AI 做电路分析题，它一本正经地推导错了。",
    dur: 10,
  },
  {
    id: "P5-06",
    Component: P5_06,
    note: "Token。「我是山里灵活的狗」。这一页要等它自己演化完，别急。",
    dur: 12,
    lock: true,
  },
  {
    id: "P5-07",
    Component: P5_07,
    note: "注意力。「山里」「灵活」→「神里绫华」。线宽=权重。",
    dur: 14,
    lock: true,
  },
  {
    id: "P5-08",
    Component: P5_08,
    note: "Transformer，2017。（变形金刚。）这里可以笑一下。",
    dur: 12,
  },
  {
    id: "P5-09",
    Component: P5_09,
    note: "疯狂星期四 → V我50。停一秒再往下。",
    dur: 12,
  },
  {
    id: "P5-10",
    Component: P5_10,
    note: "语法、语义、知识关联、复杂规律。",
    dur: 16,
  },
  {
    id: "P5-11",
    Component: P5_11,
    note: "训练目标之一：生成符合上下文的内容。",
    dur: 10,
  },
  {
    id: "P5-12",
    Component: P5_12,
    note: "那么问题来了——它生成的就一定是真的吗？",
    dur: 12,
  },
  {
    id: "P5-13",
    Component: P5_13,
    note: "流畅 ≠ 正确。四个字，停住。",
    dur: 12,
  },
  {
    id: "P5-14",
    Component: P5_14,
    note: "强大的学习助手，但流畅不天然等于正确。",
    layer: "FLEX",
    dur: 12,
  },
  {
    id: "P5-15",
    Component: P5_15,
    note: "在这样的时代，我们究竟应该怎样学习？",
    dur: 10,
  },
  {
    id: "P5-16",
    Component: P5_16,
    note: "如果有一天，越来越多的事可以在 AI 辅助下迅速完成……",
    dur: 12,
  },
  {
    id: "P5-17",
    Component: P5_17,
    note: "那我们省下来的时间，去做什么？——长停顿。",
    dur: 12,
  },
  {
    id: "P5-18",
    Component: P5_18,
    note: "社会必要劳动时间减少了！（彩蛋：盖歪的章，别念出来）",
    dur: 14,
  },
  {
    id: "P5-19",
    Component: P5_19,
    note: "数据流汇聚成问号。什么都别说，让它自己完成。",
    dur: 6,
    lock: true,
  },
  {
    id: "P5-20",
    Component: P5_20,
    note: "炸开 → 钤印「界义」→ 熄灯，进 P6。",
    dur: 6,
  },
];
