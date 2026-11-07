import { appUrl } from "../../core/url";
import { useEffect, useState } from 'react';
import type gsap from 'gsap';
import { Seal } from '../../components/Seal';
import { audio } from '../../core/audio';
import { chapters, reducedMotion, slideById, type Slide } from '../../core/deck';
import { ArtLayers, ProductionCover, productionStyle } from '../Composition';
import { designFor } from '../design';
import type { StoryProps } from './types';
import './story678.css';

const img = (chapter: number, name: string) => appUrl(`/assets/img/p${chapter}/${name}.webp`);
const art = (chapter: number, id: string) => appUrl(`/assets/art/p${chapter}/pages/${id}.webp`);
const prop = (name: string) => appUrl(`/assets/art/story678/${name}.png`);
const lanternShell = appUrl('/assets/art/p0/eight-lamp-frame-v3.png');
const stillFrame = (props: StoryProps) => props.staticMode || props.compact || reducedMotion;
const m = (x = 0, y = 0, scale = 1, alpha = 1, rotate = 0, delay = 0) => ({
  'data-perform': true, 'data-x': x, 'data-y': y, 'data-scale': scale,
  'data-alpha': alpha, 'data-rotate': rotate, 'data-duration': 1.05, 'data-delay': delay,
});

function Copy({ slide, className = '' }: Pick<StoryProps, 'slide'> & { className?: string }) {
  const count = slide.content.join('').length;
  return <div key={slide.id} data-story-copy className={`s678-copy ${count > 80 ? 's678-dense' : count > 45 ? 's678-medium' : ''} ${className}`}>
    {slide.content.filter(Boolean).map((line, i) => <p key={i}>{line}</p>)}
  </div>;
}
function Media({ src, title, className = '' }: { src: string; title?: string; className?: string }) {
  return <figure className={`s678-media ${className}`}><img src={src} alt={title || '真实项目画面'} loading="eager" />{title && <figcaption>{title}</figcaption>}</figure>;
}
function Join({ state, slide }: StoryProps) {
  const [now, setNow] = useState(Date.now());
  const deadline = state?.interaction?.id === 'creative' ? state.interaction.deadline : undefined;
  useEffect(() => {
    if (!deadline) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [deadline]);
  const left = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : slide.interaction?.seconds;
  return <aside className="s678-join"><div>在观众端写下你的脑洞。{left !== undefined && <strong>{left}<small> 秒</small></strong>}</div></aside>;
}

function Combination(props: StoryProps) {
  const { beat: b, slide, messages = [] } = props;
  const gathering = b >= 4;
  const visible = messages.filter(message => message.interactionId === 'creative' && !message.hidden).slice(-6);
  const poses = gathering ? [[860, -310, .46], [502, -310, .49], [192, -310, .47]] : b === 0 ? [[-25, 196, .49], [-302, 183, .54], [-540, 192, .51]] : b === 1 ? [[115, 96, .8], [20, 18, .92], [-105, 84, .83]] : [[0, 0, 1], [0, 0, 1], [0, 0, 1]];
  return <div className={`s678-scene s678-ne-combination s678-ne-beat-${b} ${gathering ? 's678-is-gathering' : ''}`}>
    <svg className="s678-idea-routes" viewBox="0 0 1920 1080" aria-hidden="true" {...m(0, 0, 1, b >= 6 ? .24 : b >= 3 ? 1 : 0)}><path d="M380 630C600 880 1320 210 1550 630M380 630Q960 230 1550 630M960 540V880" /><circle cx="960" cy="650" r="115" /></svg>
    <div className="s678-evaluation" {...m(b >= 1 ? -720 : 0, b >= 1 ? -300 : 0, b >= 1 ? .5 : 1, b >= 1 ? 0 : .85, b >= 1 ? -28 : -8)}>{['考试', '绩点', '标准答案', '作业'].map(word => <span key={word}>{word}</span>)}</div>
    <img className="s678-inspiration" src={prop('ne-lanyan-inspiration')} alt="蓝砚兴致勃勃地把一张纸折成新的形状" {...m(b === 0 ? 0 : 750, b === 0 ? 0 : -65, b === 0 ? 1 : .65, b === 0 ? 1 : 0, b === 0 ? 0 : 14)} data-enter-x="230" data-enter-y="75" />
    <div className="s678-semantic s678-lake" {...m(poses[0][0], poses[0][1], poses[0][2], b >= 2 ? 1 : b === 0 ? .7 : .35, gathering ? -6 : -8)} data-enter-y="160"><Media src={appUrl("/assets/art/approved/north-lake-original.jpg")} title="北湖" /><small>一处真实的地方</small></div>
    <div className="s678-semantic s678-sensor" {...m(poses[1][0], poses[1][1], poses[1][2], b >= 2 ? 1 : b === 0 ? .7 : .35, gathering ? 5 : 7)} data-enter-y="230"><img src={prop('ne-sensor')} alt="" className="s678-sensor-asset" /><span className="s678-prop-title">传感器</span><small>一种感知世界的技术</small></div>
    <div className="s678-semantic s678-poetry" {...m(poses[2][0], poses[2][1], poses[2][2], b >= 2 ? 1 : b === 0 ? .7 : .35, gathering ? -3 : -4)} data-enter-y="140"><img src={prop('ne-poetry')} alt="" className="s678-poetry-asset" /><span className="s678-prop-title">古诗词</span><small>一种表达感受的语言</small></div>
    {!gathering && <Copy slide={slide} className="s678-combination-copy" />}
    {gathering && <><Copy slide={slide} className="s678-ideas-copy" /><div className="s678-live-ideas">
      {visible.length ? visible.map((message, i) => <article key={message.id} className={`s678-live-idea ${message.selected ? 's678-selected' : ''}`} {...m(b === 7 ? (i % 2 ? 350 : -350) : 0, b === 7 ? -70 : 0, b === 7 ? .82 : 1, b === 7 ? .35 : 1, (i % 3 - 1) * 3, i * .08)} data-enter-y="90"><small>现场创意 · {String(i + 1).padStart(2, '0')}</small><p>{message.text}</p></article>) : <div className={b >= 6 ? "s678-script-examples" : "s678-idea-waiting"}>{b >= 6 ? <><small>讲者举例 · 非现场投稿</small><article><span>风速 → 诗句</span><p>根据湖面风速，<br/>自动生成诗句的装置。</p></article><article><span>环境 → 游戏</span><p>一场会随着环境变化的<br/>北湖互动游戏。</p></article></> : <><span>？</span><p>这里，等待一个想法落下。</p></>}</div>}
    </div><span className="s678-live-count">{messages.filter(message => message.interactionId === 'creative' && !message.hidden).length} 个真实想法 · 同一组元素</span>{b === 4 && <Join {...props} />}</>}
  </div>;
}

function CulturalDoor({ beat: b, slide }: StoryProps) {
  const windowPose = [[400, -40, .45, 1, 5], [400, -25, .55, 1, 1], [-510, 202, .36, 1, -2], [0, 0, 1, 1, 0], [165, 182, .35, 0, 0]][b];
  const folioPose = [[135, 118, .43, .35, 11], [65, 175, .61, .9, 8], [0, 0, 1, 1, 0], [650, 190, .7, 0, 9], [730, 210, .5, 0, 9]][b];
  return <div className={`s678-scene s678-cultural-door s678-door-beat-${b}`}>
    <div className="s678-world-window" {...m(windowPose[0], windowPose[1], windowPose[2], windowPose[3], windowPose[4])} data-enter-scale="0.18">
      <Media src={img(6, 'liyun-01')} title="《理韵寻踪》· 真实项目界面" />
      <div className="s678-window-top"><i /><i /><i /><span>理韵寻踪</span></div>
    </div>
    <div className="s678-world-folio" {...m(folioPose[0], folioPose[1], folioPose[2], folioPose[3], folioPose[4])} data-enter-scale="0.65" data-duration="1.4"><img src={prop('ne-world-folio')} alt="折页上生长出琴、灯、屏风和拱桥的想象世界" /></div>
    {b < 3 && <Copy slide={slide} className="s678-door-copy" />}
    {b === 3 && <Copy slide={slide} className="s678-project-title" />}
    {b === 4 && <div className="s678-project-review">
      <Copy slide={slide} className="s678-project-description" />
      <div className="s678-project-contact">
        {[1, 2, 3, 4].map(i => <div className="s678-project-photo" key={i}><Media src={img(6, `liyun-0${i}`)} title={`理韵寻踪 · 0${i}`} /></div>)}
      </div>
    </div>}
  </div>;
}

function Build({ beat: b, slide }: StoryProps) {
  const labels = ['网页技术', 'Three.js', '声音', '交互设计'];
  return <div className={`s678-scene s678-build s678-build-${b}`}>
    {b === 0 && <div className="s678-build-heading"><h2>《理韵寻踪》</h2><p>网页技术 × Three.js × 声音 × 交互设计</p></div>}
    <svg className="s678-build-wires" viewBox="0 0 1920 1080" aria-hidden="true">
      <path d="M375 425H1150V580M495 795H760V580H1150M1225 310V580M1665 640H1150V580" {...m(0, 0, 1, b === 0 ? 1 : 0)} data-enter-y="0" data-enter-scale="1" data-duration=".72" />
      <path className="s678-wires-reconnected" d="M453 478H780V580H1150M453 638H680V580H1150M453 798H680V580M773 899V580H1150" {...m(0, 0, 1, b >= 1 ? 1 : 0)} data-enter-y="0" data-enter-scale="1" data-delay={b === 1 ? '.46' : '0'} data-duration=".92" />
      <path className="s678-wire-later" d="M1400 540H1710V825H1180" {...m(0, 0, 1, b >= 2 ? 1 : 0)} data-enter-y="0" data-enter-scale="1" />
    </svg>
    {labels.map((label, i) => <div className={`s678-build-module s678-build-module-${i}`} key={label} {...m(b >= 1 ? [78, -292, -622, -642][i] : [0, -250, 150, 250][i], b >= 1 ? [53, -7, 413, 224][i] : [0, 150, -75, -35][i], b >= 1 ? .78 : 1, b === 2 ? .52 : 1, b >= 1 ? 0 : (i % 2 ? 4 : -4), i * .12)} data-enter-y="130"><small>0{i + 1}</small><span>{label}</span><i /></div>)}
    <div className="s678-build-product" {...m(0, 0, b === 0 ? .78 : .82, 1)}><Media src={img(6, 'liyun-01')} title="一个传统文化游戏" /></div>
    <div className="s678-server" {...m(b < 2 ? 500 : 0, 0, 1, b >= 2 ? 1 : 0)}><img src={prop('ne-server-gate')} alt="服务器与闭合柜门合成的舞台道具" /><div className="s678-server-lid" data-perform data-x="0" data-y={b === 2 ? 70 : -75} data-alpha="1" data-rotate={b === 2 ? -2 : 0} data-duration=".32"><span>服务器</span></div><small>{b === 2 ? '这扇门，能进吗？' : '网络 · 系统部署'}</small></div>
    <Copy slide={slide} className="s678-build-copy" />
  </div>;
}

function QuestionPaths({ beat: b, slide }: StoryProps) {
  const questions = ['如果，把它和另一个完全不同的领域联系起来呢？', '如果，我们改变它最初的目标呢？', '如果，从人的体验出发呢？', '如果……我们干脆换一个问题呢？'];
  return <div className={`s678-scene s678-question-paths s678-question-phase-${b}`}>
    <svg viewBox="0 0 1920 1080" className="s678-question-network" aria-hidden="true" {...m(0, 0, 1, b === 0 ? .85 : 0)}><path d="M731 329C750 315 751 256 778 254M718 543Q749 501 778 464M671 688Q729 675 778 674M622 842Q696 879 778 884" /></svg>
    <div className="s678-question-origami" {...m(b === 2 ? 85 : b === 1 ? -22 : 0, b === 1 ? 54 : b === 2 ? -20 : 0, b === 1 ? .77 : b === 2 ? .94 : 1, 1, b === 1 ? -9 : 0)} data-enter-scale=".65" data-enter-x="-110">
      <img src={prop('ne-question-origami')} alt="同一个折纸中心长出四条不同方向" /><span aria-hidden="true">？</span>
    </div>
    {questions.map((text, i) => <div key={text} className={`s678-question-branch s678-question-branch-${i}`} {...m(b === 1 ? [140, 20, -100, -230][i] : b === 2 ? 600 : 0, b === 1 ? [210, 80, -40, -170][i] : 0, b === 2 ? .5 : b === 1 ? .70 : 1, b === 2 ? 0 : 1, b === 1 ? (i - 1.5) * 5 : 0, i * .13)}><span>0{i + 1}</span>{text}</div>)}
    <Copy slide={slide} className="s678-question-copy" />
  </div>;
}

function Perspective(props: StoryProps) {
  const { beat: b, slide } = props;
  const ridgePose = [[0, 0, 1.07, 1], [56, -15, 1.13, 1], [-660, 78, .95, 1], [-875, 160, .92, .75]][b];
  return <div className={`s678-scene s678-perspective s678-perspective-${b}${stillFrame(props) ? '' : ' s678-moving'}`}>
    <img className="s678-panorama" src={art(7, 'P7-04')} alt="同一片山谷，从近处到远处" {...m(b < 2 ? -365 : 0, b < 2 ? 126 : 0, b < 2 ? 1.84 : b === 2 ? 1.17 : 1)} data-duration="2.2" />
    <img className="s678-near-ridge" src={prop('ni-ridge')} alt="" {...m(ridgePose[0], ridgePose[1], ridgePose[2], ridgePose[3])} data-enter-x="-120" data-enter-y="0" data-duration="1.72" />
    <div className="s678-perspective-scrim s678-perspective-near" {...m(0, 0, 1, b === 0 ? 1 : 0)} data-enter-y="0" data-enter-scale="1" />
    <div className="s678-perspective-scrim s678-perspective-poetry" {...m(0, 0, 1, b === 1 ? 1 : 0)} data-enter-y="0" data-enter-scale="1" />
    <div className="s678-perspective-scrim s678-perspective-dawn" {...m(0, 0, 1, b === 3 ? 1 : 0)} data-enter-y="0" data-enter-scale="1" />
    <div className="s678-viewpoint" {...m(b >= 2 ? 0 : 500, b >= 2 ? 0 : 240, b >= 2 ? 1 : .2, b >= 2 ? 1 : 0)} data-delay={b === 2 ? '.46' : '0'}><i><b /></i><span>我们在这里</span></div>
    {b !== 2 && <Copy slide={slide} className={b === 1 ? 's678-poem-copy' : 's678-perspective-copy'} />}
  </div>;
}

function Exchange({ beat: b, slide }: StoryProps) {
  return <div className={`s678-scene s678-exchange s678-exchange-${b}`}>
    <div className="s678-ni-pair" {...m(0, b === 0 ? 0 : 180, b === 0 ? 1 : .93, b === 0 ? 1 : 0)} data-enter-y="40" data-duration=".92">
      <img src={prop('ni-review-lanyan-paint')} className="s678-ni-painter" alt="蓝砚举起画笔，分享自己的画板" />
      <img src={prop('ni-review-aether')} className="s678-ni-senior" alt="以旅行者空为形象的学长，拿着电脑向蓝砚交流" />
    </div>
    <div className="s678-discipline s678-engineering" {...m(b >= 1 ? 810 : 0, b >= 2 ? 168 : 0, b >= 2 ? .66 : 1, b === 0 ? 0 : b >= 2 ? .2 : 1, b === 0 ? -6 : 4)}><img src={prop('ni-engineering-notebook')} alt="工程笔记的剪纸插画" /><span>工程视角</span></div>
    <div className="s678-discipline s678-art" {...m(b >= 1 ? -810 : 0, b >= 2 ? 168 : 0, b >= 2 ? .66 : 1, b === 0 ? 0 : b >= 2 ? .2 : 1, b === 0 ? 5 : -4)}><img src={prop('ni-painting-board')} alt="画板与画笔的剪纸插画" /><span>艺术视角</span></div>
    <svg className="s678-exchange-arcs" viewBox="0 0 1920 1080" aria-hidden="true" {...m(0, 0, 1, b >= 1 ? 1 : 0)}><path d="M520 650Q960 240 1400 650M1400 730Q960 1040 520 730" /></svg>
    <div className="s678-answer-stack" {...m(0, b >= 2 ? 0 : 280, 1, b >= 2 ? 1 : 0)}>{['答案', '答案', '答案'].map((text, i) => <span key={i} style={{ left: i * 74, top: i * -24 }}>{text}</span>)}</div>
    <div className="s678-worth-question" {...m(b >= 3 ? -130 : 0, b >= 3 ? -80 : 0, b >= 3 ? 1.5 : 1, b >= 2 ? 1 : 0)}>？<small>值得解决的问题</small></div>
    <Copy slide={slide} className={b < 2 ? 's678-exchange-copy' : 's678-question-value-copy'} />
  </div>;
}

function Change(props: StoryProps) {
  const { beat: b, slide } = props;
  const distant = b === 2;
  const dark = b >= 4;
  const camera = distant ? [0, 0, 1] : dark ? [-190, 65, 1.24] : [-94, 32, 1.12];
  return <div className={`s678-scene s678-change s678-change-${b}${stillFrame(props) ? '' : ' s678-moving'}`}>
    <img src={art(7, 'P7-10')} className="s678-change-art" alt="江水与月光" />
    <div className="s678-moon" {...m(0, 0, 1, b < 2 ? 1 : 0)} />
    <div className="s678-tool-current" {...m(b >= 2 ? -1200 : 0, 0, 1, b === 0 ? 0 : b >= 2 ? 0 : 1)}>{['城市', '数据', '工具'].map((text, i) => <span key={text} {...m(b === 1 ? i * 70 : 0, 0, 1, 1)}>{text}</span>)}</div>
    <div className="s678-human-point" {...m(0, 0, 1, b === 1 ? 1 : 0)}><i /><span>江 · 明月 · 人</span></div>
    <div className="s678-crosscurrent" {...m(camera[0], camera[1], camera[2], b >= 2 ? 1 : 0)} data-enter-y="0" data-enter-scale="1" data-duration="1.65">
      <img src={prop('ni-review-crosscurrent')} alt="一艘小船穿过江面，沿着金色月光找到方向" />
      <svg className="s678-moonwake" viewBox="0 0 1920 1080" aria-hidden="true" {...m(0, 0, 1, b === 2 || b === 3 ? 1 : 0)} data-enter-y="0" data-enter-scale="1">
        <path d="M1264 982C1330 857 1575 841 1426 748S1164 705 1425 647 1235 592 1392 551 1513 522 1433 492" pathLength="1" />
      </svg>
      <div className="s678-crosscurrent-veil" {...m(0, 0, 1, dark ? 1 : 0)} data-enter-y="0" data-enter-scale="1" data-duration="1.68" />
      <i className="s678-boat-light" {...m(0, 0, 1, dark ? 1 : 0)} data-enter-y="0" data-enter-scale="1" data-duration="1.68" />
    </div>
    {b < 2 && <Copy slide={slide} className={b === 0 ? 's678-change-poem' : 's678-change-labels'} />}
    {[2, 3].map(i => <div key={i} className={`s678-change-line s678-change-line-${i}`} aria-hidden={b !== i} {...m(b === i ? 0 : -22, b === i ? 0 : 22, 1, b === i ? 1 : 0)} data-duration=".78" data-delay={b === i ? '.38' : '0'}>
      {slideById(`P7-1${i}`).content.map(line => <p key={line}>{line}</p>)}
    </div>)}
    {b === 5 && <div className="s678-ni-seal" data-stamp data-review-impact data-impact-delay={.61}><Seal text="悟势" chapter={7} size={264} /></div>}
  </div>;
}

function FiCover({ slide }: StoryProps) {
  const design = designFor(slide);
  return <div className="s678-scene s678-fi-cover production-slide production-cover" data-tone={design.tone} data-scene-ink="light" style={productionStyle(slide)}>
    <ArtLayers slide={slide} />
    <div className="s678-fi-cover-veil" aria-hidden="true" />
    <div className="slide-body"><ProductionCover slide={slide} /></div>
  </div>;
}

function Inner({ beat: b, slide }: StoryProps) {
  const measures = ['绩点', '排名', '奖学金', '评优', '竞赛'];
  const angles = measures.map((_, i) => (-120 + i * 60) * Math.PI / 180);
  return <div className={`s678-scene s678-inner s678-inner-${b}`}>
    <div className="s678-inner-halo" {...m(0, 0, b >= 2 ? .6 : 1, b === 3 ? .16 : .55)} />
    <img className="s678-listening" src={appUrl("/assets/art/approved/lanyan-listen.png")} alt="蓝砚闭眼合十，聆听内心" {...m(b >= 4 ? 520 : 0, b >= 4 ? 100 : 0, b === 0 ? .66 : b === 3 ? .85 : b >= 4 ? .72 : 1, b === 3 ? .12 : b >= 4 ? .5 : 1)} />
    {measures.map((word, i) => <div key={word} className="s678-measure" style={{ left: 960 + Math.cos(angles[i]) * 540 - 100, top: 530 + Math.sin(angles[i]) * 330 - 42 }} {...m(b >= 2 ? Math.cos(angles[i]) * 650 : 0, b >= 2 ? Math.sin(angles[i]) * 400 : 0, b >= 2 ? .75 : 1, b >= 2 ? 0 : .85, (i - 2) * 8, i * .11)}>{word}<i /></div>)}
    <div className="s678-own-light" {...m(b >= 4 ? 280 : 0, b >= 4 ? 160 : 0, b >= 4 ? 2.2 : 1, b >= 2 ? 1 : 0)} />
    <Copy slide={slide} className={b < 2 ? 's678-inner-return-copy' : b === 2 ? 's678-inner-remove-copy' : b === 3 ? 's678-inner-question' : b === 4 ? 's678-inner-thoughts' : 's678-inner-value'} />
  </div>;
}

function Lamp({ beat: b, slide }: StoryProps) {
  const projects = [
    { title: '思源实践', src: img(1, 'siyuan-01'), text: '把曾经得到的帮助，传递给下一届。' },
    { title: '805 实验室', src: img(3, 'lab-805-ui'), text: '让后来的人，少走一点相同的弯路。' },
    { title: '理韵寻踪', src: img(6, 'liyun-01'), text: '用新的技术，让流传很久的文化\n走进年轻人的生活。' },
  ];
  return <div className={`s678-scene s678-lamp s678-lamp-${b}`}>
    <img className="s678-lamp-art" src={appUrl("/assets/art/p8/lamp-lit.webp")} alt="同一盏灯照亮过去与未来" {...m(b === 5 ? 430 : 0, b === 5 ? -100 : 0, b === 5 ? 1.18 : b === 2 ? 1.08 : 1, b === 2 ? .27 : b === 3 ? .55 : 1)} />
    <div className="s678-lamp-flame" {...m(0, 0, b === 0 ? 1 : 1.25, b === 0 || b === 4 ? .42 : .08)} data-enter-scale=".05" data-duration="2.3" />
    <div className="s678-filmstrip" {...m(b >= 3 ? -1150 : 0, b >= 3 ? -170 : 0, b >= 3 ? .66 : 1, b === 2 ? 1 : b === 3 ? .22 : 0)}>{[1, 2, 3, 4, 5].map((i) => <div key={i} className={`s678-film-frame s678-film-frame-${i}`} {...m(0, b === 2 ? [50, -40, 20, -30, 40][i - 1] : 0, 1, 1, (i - 3) * 2, (i - 1) * .15)}><Media src={img(8, `dengweiwang-0${i}`)} title={['灯笼', '雨', '巷', '手', '结尾'][i - 1]} /></div>)}</div>
    {b === 1 && <Copy slide={slide} className="s678-lamp-title" />}
    {(b === 3 || b === 4) && <Copy slide={slide} className={b === 4 ? 's678-lamp-future' : 's678-lamp-past'} />}
    <div className="s678-inheritance" {...m(0, b === 5 ? 0 : 290, 1, b === 5 ? 1 : 0)}>{projects.map((project, i) => <article key={project.title} className={`s678-inherit-project s678-inherit-${i}`} data-enter-y="160" {...m(0, 0, 1, 1, 0, i * .16)}><Media src={project.src} title={project.title} /><p>{project.text}</p><i /></article>)}</div>
  </div>;
}

function ChoiceMap({ beat: b, slide }: StoryProps) {
  return <div className={`s678-scene s678-choice-map s678-choice-${b}`}>
    <div className="s678-choice-folio" {...m(0, b === 1 ? 115 : 0, b === 1 ? .78 : 1, b === 1 ? .16 : 1)} data-enter-y="150" data-enter-scale=".84" data-duration="1.34"><img src={prop('fi-route-folio')} alt="同一个起点延伸出金色台阶和曲折的青绿小径" /></div>
    <div className="s678-choice-origin" {...m(b === 1 ? 540 : 0, b === 1 ? -283 : 0, b === 1 ? 2 : 1, b === 1 ? 1 : 0)} data-delay=".26"><i /></div>
    <Copy slide={slide} className={b === 0 ? 's678-choice-copy' : 's678-choice-heart'} />
  </div>;
}

function RainToDay(props: StoryProps) {
  const { beat: b } = props;
  const [verse, source] = slideById('P8-14').content;
  const [answer] = slideById('P8-15').content;
  return <div className={`s678-scene s678-rain-scene${stillFrame(props) ? '' : ' s678-moving'}`}>
    <img className="s678-rain-art" src={appUrl("/assets/art/p8/rain-lane.webp")} alt="细雨中的竹径" {...m(b ? -25 : 0, 0, b ? 1.04 : 1, 1)} data-enter-y="0" data-enter-scale="1" data-duration="1.45" />
    <div className="s678-rain-streaks" aria-hidden="true" {...m(0, 0, 1, b ? 0 : .6)} data-enter-y="0" data-enter-scale="1" data-duration="1.15"><i /><i /></div>
    <img className="s678-day-art" src={art(8, 'P8-15')} alt="" {...m(0, 0, 1, b ? 1 : 0)} data-enter-y="0" data-enter-scale="1" data-duration="1.42" />
    <div className="s678-rain-verse" aria-hidden={!!b} {...m(0, b ? -18 : 0, 1, b ? 0 : 1)} data-duration=".73" data-delay={b ? '0' : '.52'}>
      {verse.split('\n').map(line => <p key={line}>{line}</p>)}<small>{source}</small>
    </div>
    <div className="s678-rain-answer" aria-hidden={!b} {...m(0, b ? 0 : 24, 1, b ? 1 : 0)} data-duration=".91" data-delay={b ? '.63' : '0'}><p>{answer}</p></div>
  </div>;
}

function EightLights(props: StoryProps) {
  const { slide } = props;
  return <div className={`s678-scene s678-eight-lights${stillFrame(props) ? '' : ' s678-moving'}`}>
    <img className="s678-eight-art" src={art(8, 'P8-16')} alt="" />
    <div className="s678-eight-halo" aria-hidden="true" />
    <div className="s678-eight-ring" aria-hidden="true" />
    {chapters.filter(c => c.id > 0).map((c, i) => {
      const a = (-90 + 45 * i) * Math.PI / 180;
      const x = Math.cos(a) * 584;
      const y = Math.sin(a) * 360;
      return <div key={c.id} className="s678-returned-lantern" {...m(x, y, 1, 1, 0, i * .11)} data-duration="1.55" data-enter-x={x * .62} data-enter-y={y * .45} data-enter-scale=".62">
        <div className="s678-lantern-glass" style={{ '--lamp-accent': c.accent } as React.CSSProperties}><span>{c.code}</span></div>
        <img className="s678-lantern-shell" src={lanternShell} alt="" />
        <strong>{c.name}</strong>
      </div>;
    })}
    <div className="s678-eight-copy" {...m(0, 0, 1, 1, 0, .86)} data-duration="1.45" data-enter-scale=".94">
      {slide.content.map(line => <p key={line}>{line}</p>)}
    </div>
  </div>;
}

function Farewell(props: StoryProps) {
  const { slide } = props;
  const quiet = stillFrame(props);
  return <div className={`s678-scene s678-farewell${quiet ? '' : ' s678-moving'}`}>
    <img className="s678-farewell-art" src={art(8, 'P8-19')} alt="" />
    <div className="s678-farewell-light" aria-hidden="true" />
    {!quiet && <>
      <div className="s678-farewell-sparks" aria-hidden="true">{chapters.filter(c => c.id > 0).map(c => <i key={c.id} style={{ left: 148 + Math.sin(c.id * Math.PI / 4) * 140, top: 148 - Math.cos(c.id * Math.PI / 4) * 140 }} />)}</div>
      <p className="s678-farewell-wish">{slide.content[1]}</p>
    </>}
    <div className="s678-farewell-title">
      <small>{slide.content[2]}</small><h1>{slide.content[0]}</h1>
      <p><span>主讲</span> 胡文昊</p>
    </div>
    <img className="s678-farewell-lanyan" src={prop('fi-review-lanyan-farewell')} alt="蓝砚捧一盏灯，向观众致意" />
  </div>;
}

function PostshowLetter({ slide, state, audienceUrl, compact }: StoryProps) {
  const count = state?.interaction?.id === slide.interaction?.id ? state?.privateCount : undefined;
  return <div className="s678-scene s678-postshow">
    <div className="s678-postshow-paper" data-perform data-enter-x="-110" data-enter-y="0" data-duration="1.1"/>
    <div className="s678-postshow-copy" data-story-copy>
      <small>散场前的一封信</small>
      <h2>想对学长说些<br/>什么的吗？</h2>
      <p>可以随便写一写哦</p>
      <div className="s678-postshow-invite">请在观众端填写 <span>·</span> 只给学长</div>
      {audienceUrl && !compact && <a href={audienceUrl} target="_blank" rel="noreferrer">打开观众端 ↗</a>}
      {!!count && <div className="s678-postshow-count">已收到 {count} 封</div>}
    </div>
    <img className="s678-postshow-lanyan" src={prop('fi-postshow-lanyan')} alt="蓝砚捧着信封，伸手邀请大家来写一写" data-perform data-enter-x="96" data-enter-y="26" data-duration="1.35" data-delay=".15"/>
  </div>;
}

export function Story678(props: StoryProps) {
  switch (props.scene.id) {
    case 'ne-combination': return <Combination {...props} />;
    case 'ne-cultural-door': return <CulturalDoor {...props} />;
    case 'ne-build': return <Build {...props} />;
    case 'ne-question-paths': return <QuestionPaths {...props} />;
    case 'ni-perspective': return <Perspective {...props} />;
    case 'ni-exchange': return <Exchange {...props} />;
    case 'ni-change': return <Change {...props} />;
    case 'fi-intro': return <FiCover {...props} />;
    case 'fi-inner': return <Inner {...props} />;
    case 'fi-lamp': return <Lamp {...props} />;
    case 'fi-rain-to-day': return <RainToDay {...props} />;
    case 'fi-eight-lights': return <EightLights {...props} />;
    case 'fi-choice-map': return <ChoiceMap {...props} />;
    case 'fi-postshow-letter': return <PostshowLetter {...props} />;
    case 'fi-farewell': return <Farewell {...props} />;
    default: return null;
  }
}

/** Finite semantic accents; the main director owns cancellation and readiness. */
export function animate678(tl: gsap.core.Timeline, root: HTMLElement, slide: Slide, previousId?: string) {
  const folio = root.querySelector<HTMLElement>('.s678-world-folio img');
  folio?.style.removeProperty('clip-path');
  if (folio && slide.id === 'P6-12' && previousId === 'P6-11') {
    tl.fromTo(folio, { clipPath: 'polygon(0 58%, 50% 35%, 100% 22%, 100% 100%, 0 100%)' }, { clipPath: 'polygon(0 0, 50% 0, 100% 0, 100% 100%, 0 100%)', duration: 1.35, ease: 'power2.inOut', clearProps: 'clipPath' }, .04);
  }
  if (slide.id === 'P6-14') {
    const grid = root.querySelector<HTMLElement>('.s678-project-contact');
    const tiles = grid ? [...grid.querySelectorAll<HTMLElement>('.s678-project-photo')] : [];
    if (grid && tiles.length) {
      tl.set(tiles, { opacity: 0 }, 0);
      tiles.forEach((tile, i) => {
        const at = .18 + i * 1.25;
        const cx = grid.offsetLeft + tile.offsetLeft + tile.offsetWidth / 2;
        const cy = grid.offsetTop + tile.offsetTop + tile.offsetHeight / 2;
        tl.set(tile, { x: 1258 - cx, y: 530 - cy, scale: 2.05, zIndex: 12 }, at);
        tl.to(tile, { opacity: 1, duration: .22, ease: 'power2.out' }, at);
        tl.to(tile, { x: 0, y: 0, scale: 1, duration: .48, ease: 'power3.inOut' }, at + .68);
        tl.set(tile, { zIndex: 'auto' }, at + 1.16);
      });
    }
  }
  if (slide.id === 'P6-16') {
    const wire = root.querySelector('.s678-wires-reconnected');
    if (wire) tl.fromTo(wire, { strokeDashoffset: 38 }, { strokeDashoffset: 0, duration: 1.45, ease: 'power2.out' }, .37);
  }
  if (slide.id === 'P6-17') {
    const lid = root.querySelector('.s678-server-lid');
    if (lid) {
      tl.to(lid, { x: -7, y: 78, rotation: -4, duration: .1, ease: 'power2.in' }, .95);
      tl.to(lid, { x: 4, y: 62, rotation: 1, duration: .13, ease: 'power2.out' }, 1.05);
      tl.to(lid, { x: 0, y: 70, rotation: -2, duration: .26, ease: 'back.out(1.4)' }, 1.18);
    }
  }
  if (slide.id === 'P8-08' && previousId !== 'P8-08') {
    const lamp = root.querySelector('.s678-lamp-art');
    if (lamp) tl.fromTo(lamp, { filter: 'brightness(.08)' }, { filter: 'brightness(1)', duration: 2.4, ease: 'power2.inOut' }, 0);
  }
  if (slide.id === 'P7-07') {
    tl.fromTo(root.querySelectorAll('.s678-exchange-copy p'), { opacity: 0, x: -15 }, { opacity: 1, x: 0, duration: .64, stagger: .75, ease: 'power2.out' }, .22);
  }
  if (slide.id === 'P7-12') {
    tl.fromTo(root.querySelectorAll('.s678-change-line-2 p'), { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: .95, ease: 'power3.inOut' }, .39);
  }
  if (slide.id === 'P7-15') {
    const seal = root.querySelector('.s678-ni-seal');
    if (seal) {
      tl.fromTo(seal, { scale: 1.24, y: -26, opacity: 0 }, { scale: .95, y: 0, opacity: 1, duration: .36, ease: 'power3.in' }, .25);
      tl.to(seal, { scale: 1, duration: .22, ease: 'back.out(1.4)' }, .61);
    }
  }
  if (slide.id === 'P8-01') {
    tl.fromTo(root.querySelector('.s678-fi-cover-veil'), { opacity: .66 }, { opacity: 0, duration: 2.26, ease: 'sine.inOut' }, 0);
    tl.fromTo(root.querySelector('.s678-fi-cover .prod-companion'), { opacity: .12, y: 15 }, { opacity: 1, y: 0, duration: 1.92, ease: 'sine.inOut' }, .17);
    tl.fromTo(root.querySelectorAll('.s678-fi-cover [data-detail],.s678-fi-cover [data-chapter-title]'), { opacity: 0, y: 14 }, { opacity: 1, y: 0, stagger: .12, duration: .96, ease: 'sine.out' }, .6);
    tl.call(() => audio.play('match'), [], .48);
  }
  if (slide.id === 'P8-14') {
    tl.call(() => audio.play('rain'), [], .13);
  }
  if (slide.id === 'P8-16') {
    for (let i = 0; i < 8; i++) tl.call(() => audio.play('seal-stamp', 1 + i * .015), [], 1.55 + i * .11);
    tl.call(() => audio.play('chime'), [], 2.43);
  }
  if (slide.id === 'P8-19') {
    tl.fromTo(root.querySelector('.s678-farewell-sparks'), { scale: 1, opacity: 1 }, { scale: .045, opacity: .3, duration: 1.55, ease: 'sine.inOut' }, .05);
    tl.to(root.querySelector('.s678-farewell-sparks'), { opacity: 0, duration: .45 }, 1.6);
    tl.fromTo(root.querySelector('.s678-farewell-wish'), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: .65, ease: 'sine.out' }, 1.42);
    tl.to(root.querySelector('.s678-farewell-wish'), { opacity: 0, duration: .55 }, 3.4);
    tl.fromTo(root.querySelector('.s678-farewell-title'), { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 1.36, ease: 'sine.out' }, 3.82);
    tl.fromTo(root.querySelector('.s678-farewell-lanyan'), { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 1.3, ease: 'sine.out' }, 4.12);
    tl.fromTo(root.querySelector('.s678-farewell-light'), { opacity: .16 }, { opacity: 1, duration: 1.4, ease: 'sine.out' }, 4.1);
  }
}
