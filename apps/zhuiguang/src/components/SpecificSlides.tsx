import type { ReactNode } from 'react';
import type { Slide } from '../core/deck';
import '../design/specific.css';

type SpecificSlideProps = { slide: Slide };

function RevealText({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`specific-reveal ${className}`}><span data-reveal>{children}</span></span>;
}

function SchoolComparison() {
  const columns = [
    { title: '高中', rows: ['一条主线', '时间被安排', '题目有人出', '和同一群人'] },
    { title: '大学', rows: ['很多条主线', '时间要自己安排', '问题要自己找', '和完全不同的人'] },
  ];
  return <div className="specific-slide school-comparison">
    <div className="comparison-divider" data-line />
    {columns.map((column, i) => <div className={`comparison-column column-${i}`} key={column.title}>
      <h2><RevealText>{column.title}</RevealText></h2>
      <div className="comparison-rows">{column.rows.map(row => <p key={row}><RevealText>{row}</RevealText></p>)}</div>
    </div>)}
  </div>;
}

function PracticeComparison() {
  return <div className="specific-slide practice-comparison">
    <div className="practice-column behind-scenes">
      <span className="eyebrow" data-detail>01 / 从一个人的屏幕</span>
      <h2><RevealText>幕后</RevealText></h2>
      {['设计宣传物料', '做海报、做视频', '一个人做'].map(line => <p key={line}><RevealText>{line}</RevealText></p>)}
    </div>
    <div className="practice-path" data-line><i data-practice-light /></div>
    <div className="practice-column on-stage">
      <span className="eyebrow" data-detail>02 / 到人与人的相遇</span>
      <h2><RevealText>台前</RevealText></h2>
      {['走进高中校园', '和学弟学妹面对面', '带着团队做'].map(line => <p key={line}><RevealText>{line}</RevealText></p>)}
    </div>
  </div>;
}

function Opportunities({ slide }: SpecificSlideProps) {
  const lines = slide.content[0].split('\n');
  return <div className="specific-slide opportunities">
    {lines.map((line, i) => <p className={`opportunity-line opportunity-${i}`} key={line}><RevealText>{line}</RevealText></p>)}
  </div>;
}

function FirstStep({ slide }: SpecificSlideProps) {
  return <div className="specific-slide first-step">
    <h1>{slide.content[0].split('\n').map(line => <RevealText key={line}>{line}</RevealText>)}</h1>
    <div className="first-step-line gold-line" data-line />
    <div className="first-step-possibilities" data-detail>
      {['报名', '参加', '认识', '尝试'].map((word, i) => <span key={word}>{i > 0 && <i aria-hidden="true">·</i>}{word}</span>)}
    </div>
  </div>;
}

const illustrativeCourses = [
  ['电路分析基础', '4.0', '第2学期', '考试'],
  ['程序设计基础', '3.0', '第1学期', '考试'],
  ['高等数学', '5.0', '第1学期', '考试'],
  ['大学物理', '4.0', '第2学期', '考试'],
  ['模拟电子技术', '3.0', '第3学期', '考试'],
  ['数字电子技术', '3.0', '第3学期', '考试'],
  ['自动控制原理', '4.0', '第4学期', '考试'],
  ['课程设计与实践', '2.0', '第4学期', '考查'],
];

function CurriculumPaper({ hidden = false }: { hidden?: boolean }) {
  return <div className="curriculum-document" aria-hidden={hidden || undefined}>
    <div className="curriculum-document-top"><span>自动化 / 本科课程结构示意</span><span>PLAN · 01</span></div>
    <h2>培养方案</h2>
    <table>
      <caption>用于演讲叙事的课程表示意，并非正式培养方案。</caption>
      <thead><tr>{['课程名称', '学分', '学期', '考核方式'].map(item => <th key={item} scope="col">{item}</th>)}</tr></thead>
      <tbody>{illustrativeCourses.map(row => <tr key={row[0]}>{row.map((cell, i) => i === 0 ? <th key={i} scope="row">{cell}</th> : <td key={i}>{cell}</td>)}</tr>)}</tbody>
    </table>
    <div className="curriculum-footer"><span>课程 · 学分 · 学期 · 考核</span><span>···</span></div>
  </div>;
}

function Curriculum() {
  return <div className="specific-slide curriculum-scene">
    <div className="curriculum-sheet">
      <div className="curriculum-half curriculum-left" data-depth><CurriculumPaper /></div>
      <div className="curriculum-half curriculum-right" data-depth><CurriculumPaper hidden /></div>
      <div className="curriculum-seam-light" data-curriculum-light />
      <svg className="curriculum-crack" viewBox="0 0 620 877" aria-hidden="true"><path data-draw d="M310 0L299 40L321 80L301 120L319 160L296 200L312 240L300 280L324 320L306 360L320 400L298 440L315 480L301 520L321 560L296 600L314 640L303 680L321 720L300 760L315 800L304 840L310 877" /></svg>
    </div>
    <div className="curriculum-open-space"><span className="eyebrow" data-detail>培养方案之外</span><p><RevealText>还有什么？</RevealText></p><i className="gold-line" data-line /></div>
  </div>;
}

function StorageDepth() {
  const levels = [
    { key: 'cabinet', label: '柜子', width: 1400, height: 780 },
    { key: 'shelf', label: '第 3 层', width: 1100, height: 600 },
    { key: 'box', label: '03 号盒', width: 800, height: 440 },
  ];
  return <div className="specific-slide storage-depth">
    {levels.map(level => <div className={`storage-level storage-${level.key}`} data-depth key={level.key} style={{ width: level.width, height: level.height, left: 960 - level.width / 2, top: 540 - level.height / 2 }}>
      <svg viewBox={`0 0 ${level.width} ${level.height}`} aria-hidden="true"><rect x=".5" y=".5" width={level.width - 1} height={level.height - 1} data-draw /></svg>
      <span className="storage-label eyebrow" data-detail>{level.label}</span>
      {level.key === 'box' && <p><RevealText>电阻 · 电容 · 二极管</RevealText></p>}
    </div>)}
  </div>;
}

function EvaluationComposition() {
  const labels = ['课程学习', '竞赛', '社会实践', '志愿服务', '学生工作'];
  const lengths = [1080, 821, 562, 367, 238];
  return <div className="specific-slide evaluation-composition">
    <h2><RevealText>评价体系</RevealText></h2>
    <div className="evaluation-rule" data-line />
    <div className="evaluation-list">{labels.map((label, i) => <div className="evaluation-row" key={label}>
      <span><RevealText>{label}</RevealText></span>
      <div className="evaluation-bar" style={{ width: lengths[i] }} data-line />
    </div>)}</div>
    <p className="evaluation-note" data-detail>构成示意 · 各项认定，以学院当年文件为准</p>
  </div>;
}

function SystemFailure() {
  return <div className="specific-slide system-failure" data-fault-scene>
    <div className="fault-copy">{['硬件单独测试正常，', '程序单独运行正常，', '接在一起——'].map(line => <p key={line}><RevealText>{line}</RevealText></p>)}</div>
    <div className="fault-modules">{['硬件电路', '程序控制', '测试调试'].map((title, i) => <div className="fault-module" data-depth data-fault-node key={title}>
      <span>{title}</span>
      {i < 2 && <svg className="fault-wire" viewBox="0 0 100 160" aria-hidden="true"><path d="M0 80H30M70 80H100" data-draw data-fault-wire /><path className="fault-wire-gap" d="M30 80L38 71M70 80L62 89" /><circle cx="30" cy="80" r="2" /><circle cx="70" cy="80" r="2" /></svg>}
    </div>)}</div>
    <div className="fault-result" data-glitch><span data-reveal>系统寄了。</span></div>
  </div>;
}

function Poetry({ slide }: SpecificSlideProps) {
  const isRain = slide.id === 'P8-14';
  const text = slide.content[0].split('\n');
  return <div className={`specific-slide specific-poem ${isRain ? 'specific-poem-rain' : 'specific-poem-mountain'}`}>
    <div className="specific-poem-lines">{text.map(line => <div className={line === '谁怕？' ? 'poem-question' : ''} key={line}><span data-ink>{line}</span></div>)}</div>
    <span className="specific-poem-credit" data-detail>{isRain ? '苏轼 ·《定风波》' : '苏轼 ·《题西林壁》'}</span>
  </div>;
}

function DoorJoke() {
  return <div className="specific-slide door-joke">
    <div className="door-copy"><p><RevealText>创意负责把门打开，</RevealText></p><div className="door-copy-pause" /><p><RevealText>服务器负责告诉你，</RevealText></p><p><RevealText>这扇门到底能不能进。</RevealText></p></div>
    <div className="joke-door-frame" data-door-frame>
      <div className="joke-door-wall" data-door-wall />
      <div className="joke-door-panel" data-door><svg viewBox="0 0 200 320" aria-hidden="true"><rect x=".5" y=".5" width="199" height="319" /><path d="M166 151V171M166 160H180" /></svg></div>
    </div>
  </div>;
}

/** Static, poster-ready compositions. The stage owns all animation timelines. */
export function SpecificSlide({ slide }: SpecificSlideProps): ReactNode | null {
  switch (slide.id) {
    case 'P1-04': return <SchoolComparison />;
    case 'P1-10': return <PracticeComparison />;
    case 'P1-13': return <Opportunities slide={slide} />;
    case 'P1-14': return <FirstStep slide={slide} />;
    case 'P2-03': return <Curriculum />;
    case 'P3-11': return <StorageDepth />;
    case 'P4-06': return <EvaluationComposition />;
    case 'P4-14': return <SystemFailure />;
    case 'P7-03':
    case 'P8-14': return <Poetry slide={slide} />;
    case 'P6-17': return <DoorJoke />;
    default: return null;
  }
}
