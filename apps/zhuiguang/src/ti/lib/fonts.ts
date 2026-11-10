/**
 * 字体与字形采样
 * ------------------------------------------------------------
 * 点云成字（P5-01 / P5-19）与 Token 流（P5-06）都依赖这个：
 * 把文字渲染到离屏 canvas，再按步长采样 alpha 通道，
 * 得到"字的形状"的点集。
 */

export const FONT_DISPLAY = '"Noto Serif SC", "Source Han Serif SC", "Songti SC", SimSun, serif';
export const FONT_BODY = '"Noto Sans SC", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';
export const FONT_MONO = '"JetBrains Mono", "IBM Plex Mono", Consolas, monospace';

/** 等待所需字体真正可用（否则采样到的是后备字形） */
export async function ensureFonts(texts: string[]): Promise<void> {
  if (!document.fonts) return;
  const specs = [
    '900 200px "Noto Serif SC"',
    '700 200px "Noto Serif SC"',
    '500 200px "Noto Sans SC"',
    '400 200px "Noto Sans SC"',
  ];
  await Promise.all(
    specs.map((spec) => document.fonts.load(spec, texts.join("")).catch(() => null))
  );
  await document.fonts.ready;
}

export interface SampleOptions {
  font?: string;
  /** 采样步长（px）。越小点越密 */
  step?: number;
  /** 阈值，用于剔除抗锯齿边缘 */
  threshold?: number;
}

export interface SampleResult {
  /** 画布坐标系下的点（左上原点） */
  points: Float32Array;
  count: number;
  /** 采样点的真实重心（画布坐标）——居中时应该用它，而不是画布中心 */
  centroid: { x: number; y: number };
  canvasW: number;
  canvasH: number;
}

/**
 * 采样一段文字的像素点。
 * 返回画布坐标系（左上角原点），调用方负责换算到世界坐标。
 */
export function sampleText(
  text: string,
  fontSize: number,
  options: SampleOptions = {}
): SampleResult {
  const { font = FONT_DISPLAY, step = 3, threshold = 128 } = options;
  const weight = 900;

  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = `${weight} ${fontSize}px ${font}`;
  const metrics = measure.measureText(text);
  const pad = fontSize * 0.18;
  const w = Math.ceil(metrics.width + pad * 2);
  const h = Math.ceil(fontSize * 1.45 + pad * 2);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.font = `${weight} ${fontSize}px ${font}`;
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText(text, w / 2, h / 2);

  const data = ctx.getImageData(0, 0, w, h).data;
  const pts: number[] = [];
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const a = data[(y * w + x) * 4 + 3];
      if (a > threshold) pts.push(x, y);
    }
  }

  // 真实重心：字形的实际几何中心，与画布中心并不一致（因为测宽包含留白）
  let cx = 0;
  let cy = 0;
  const n = pts.length / 2;
  for (let i = 0; i < pts.length; i += 2) {
    cx += pts[i];
    cy += pts[i + 1];
  }
  cx = n ? cx / n : w / 2;
  cy = n ? cy / n : h / 2;

  return {
    points: new Float32Array(pts),
    count: n,
    centroid: { x: cx, y: cy },
    canvasW: w,
    canvasH: h,
  };
}

/** 把采样点从画布坐标转成"以 (cx, cy) 为中心"的世界坐标（Y 轴向上） */
export function toWorld(
  points: Float32Array,
  canvasW: number,
  canvasH: number,
  targetX: number,
  targetY: number
): Float32Array {
  const out = new Float32Array(points.length);
  for (let i = 0; i < points.length; i += 2) {
    out[i] = points[i] - canvasW / 2 + targetX;
    out[i + 1] = canvasH / 2 - points[i + 1] + targetY;
  }
  return out;
}

/** 文字采样时的画布尺寸（与 sampleText 内部保持一致，供 toWorld 使用） */
export function textCanvasSize(text: string, fontSize: number, font = FONT_DISPLAY) {
  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = `900 ${fontSize}px ${font}`;
  const metrics = measure.measureText(text);
  const pad = fontSize * 0.18;
  return {
    w: Math.ceil(metrics.width + pad * 2),
    h: Math.ceil(fontSize * 1.45 + pad * 2),
  };
}
