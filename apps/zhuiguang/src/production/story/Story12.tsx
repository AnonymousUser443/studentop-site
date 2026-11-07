import { StageFilm } from '../../components/StageFilm';
import { appUrl } from "../../core/url";
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import gsap from 'gsap';
import type { StoryProps } from './types';
import { PhotoArchive, type ArchivePhoto } from './PhotoArchive';
import { Seal } from '../../components/Seal';
import './story12.css';

const art = (name: string) => appUrl(`/assets/art/story12/${name}.png`);
const media = (chapter: number, name: string) => appUrl(`/assets/img/p${chapter}/${name}.webp`);
type Pose = { x?: number; y?: number; rotate?: number; scale?: number; alpha?: number; blur?: number; duration?: number; delay?: number; enterX?: number; enterY?: number; enterScale?: number };
function motion(id: string, p: Pose = {}) {
  return { 'data-perform': id, 'data-x': p.x ?? 0, 'data-y': p.y ?? 0, 'data-rotate': p.rotate ?? 0,
    'data-scale': p.scale ?? 1, 'data-alpha': p.alpha ?? 1, 'data-blur': p.blur ?? 0,
    'data-duration': p.duration ?? .9, 'data-delay': p.delay ?? 0,
    'data-enter-x': p.enterX ?? 0, 'data-enter-y': p.enterY ?? 40, 'data-enter-scale': p.enterScale ?? .97 };
}
function Copy({ props, className = '', lines, children }: { props: StoryProps; className?: string; lines?: string[]; children?: ReactNode }) {
  return <div className={`s12-copy ${className}`} key={props.slide.id} data-story-copy>
    {children || (lines || props.slide.content).map((line, i) => <p key={i}>{line}</p>)}
  </div>;
}
function Label({ children }: { children: ReactNode }) { return <span className="s12-label">{children}</span>; }
function Framed({ src, caption, className = '', fit = 'contain', style }: { src: string; caption?: string; className?: string; fit?: CSSProperties['objectFit']; style?: CSSProperties }) {
  return <figure className={`s12-photo ${className}`} style={style}><div><img src={src} alt={caption || '校园真实记录'} style={{ objectFit: fit }} loading="eager" /></div>{caption && <figcaption>{caption}</figcaption>}</figure>;
}
function Join({ props, id, seconds, privateMode = false }: { props: StoryProps; id: string; seconds: number; privateMode?: boolean }) {
  const [now, setNow] = useState(Date.now());
  const deadline = props.state?.interaction?.id === id ? props.state.interaction.deadline : undefined;
  useEffect(() => {
    if (!deadline) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [deadline]);
  const left = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;
  return <aside className={`s12-join ${privateMode ? 'is-private' : ''}`}>
    <div><Label>在观众端参与</Label><span>{privateMode ? '这封信只交给讲者' : '请留在当前观众页面'}</span></div>
    <strong>{left ?? seconds}<small> 秒</small></strong>
  </aside>;
}

function LetterArrivals({ count, round, animate }: { count: number; round?: number; animate: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const previous = useRef({ count, round });
  const pending = useRef<gsap.core.Timeline[]>([]);
  const cursor = useRef(0);
  useLayoutEffect(() => () => pending.current.forEach(timeline => timeline.kill()), []);
  useLayoutEffect(() => {
    const last = previous.current;
    previous.current = { count, round };
    if (!root.current) return;
    const papers = [...root.current.querySelectorAll<HTMLElement>('i')];
    const envelope = root.current.parentElement?.querySelector('.s12-envelope img');
    if (last.round !== round || count < last.count || !animate) {
      pending.current.forEach(timeline => timeline.kill());
      pending.current = [];
      gsap.set(papers, { opacity: 0 });
      if (envelope) gsap.set(envelope, { clearProps: 'filter' });
      return;
    }
    const landed = round === undefined ? 0 : Math.min(papers.length, count - last.count);
    for (let index = 0; index < landed; index++) {
      const n = cursor.current++;
      const paper = papers[n % papers.length];
      const fromLeft = n % 2 === 0;
      gsap.killTweensOf(paper);
      const timeline = gsap.timeline({ delay: index * .07, onComplete: () => {
        pending.current = pending.current.filter(item => item !== timeline);
      } });
      pending.current.push(timeline);
      timeline.fromTo(paper,
        { x: fromLeft ? -1510 : 760, y: fromLeft ? 460 : -440, rotation: fromLeft ? -27 : 38, scale: 1.15, opacity: 1 },
        { x: -105, y: 55, rotation: fromLeft ? 11 : -12, scale: .23, opacity: 0, duration: .8, ease: 'power2.in', immediateRender: false }, 0);
      if (envelope) timeline.fromTo(envelope,
        { filter: 'drop-shadow(0 0 31px #f1c965)' },
        { filter: 'drop-shadow(0 25px 28px #503b2820)', duration: .6, ease: 'power2.out', immediateRender: false, overwrite: 'auto', clearProps: 'filter' }, .69);
    }
  }, [count, round, animate]);
  return <div className="s12-letter-flights" ref={root} aria-hidden="true">{Array.from({ length: 10 }, (_, index) => <i key={index} />)}</div>;
}

function Letter(props: StoryProps) {
  const writing = props.beat === 1;
  const count = props.state?.privateCount ?? 0;
  const round = props.state?.interaction?.id === 'private-letter' ? props.state.interaction.deadline : undefined;
  return <div className="s12-scene s12-fe-letter">
    <svg className="s12-seat-route" viewBox="0 0 1920 1080" aria-hidden="true" {...motion('seat-route', { alpha: writing ? 0 : 1 })}><path d="M265 786C512 811 790 697 1186 582" /></svg>
    <div className="s12-neighbour-seats" {...motion('neighbour-seats', { x: writing ? -110 : 0, rotate: writing ? -5 : 0, alpha: writing ? 0 : 1 })}>
      <img src={art('fe-seats-review')} alt="两把相邻的座椅" /><span>自己</span><span>身边的人</span>
    </div>
    <div className="s12-letter-character" {...motion('companion', { x: writing ? 210 : 0, scale: writing ? .79 : 1, alpha: writing ? 0 : 1, enterX: 130, duration: .95 })}><img src={art('lanyan-envelope-v2')} alt="蓝砚向身边同学递出一封未拆的信" /></div>
    <div className="s12-envelope" {...motion('envelope', { x: writing ? 0 : -105, y: writing ? 0 : 238, rotate: writing ? -4 : 11, scale: writing ? 1 : .3, alpha: writing ? 1 : 0, duration: 1.18 })}><img src={art('private-envelope-v2')} alt="未打开的私密信封" /></div>
    <Copy props={props} className={writing ? 'letter-writing' : 'letter-question'} />
    {writing && <><LetterArrivals count={count} round={round} animate={!props.staticMode && !props.compact} /><div className="s12-letter-count"><strong>{count}</strong><span>封来信，已收到</span></div><Join props={props} id="private-letter" seconds={50} privateMode /></>}
  </div>;
}

function Threads(props: StoryProps) {
  const courses = props.beat > 0;
  const gathered = props.beat === 2;
  const messages = (props.messages || []).filter(m => m.interactionId === 'course-memory' && !m.hidden).slice(-5);
  const animate = !props.staticMode && !props.compact;
  return <div className="s12-scene s12-fe-threads">
    <div className="s12-thread-ribbons" {...motion('threads', { x: gathered ? 270 : courses ? 105 : 0, y: gathered ? 20 : courses ? -155 : 0, scale: gathered ? .88 : courses ? 1.03 : 1, alpha: gathered ? .31 : courses ? .5 : .92, enterX: -160, duration: 1.28 })}><img className={animate && !courses ? 's12-thread-reveal' : undefined} src={art('fe-threads-ribbons-v2')} alt="一条笔直的纸带向右展开成多条不同方向的路线" /></div>
    <div className="s12-origin" {...motion('origin', { scale: courses ? .78 : 1, x: courses ? -40 : 0, alpha: courses ? 0 : 1, y: courses ? 165 : 0 })}><span>高中</span><i /><b>一条主线</b></div>
    <div className="s12-thread-school" {...motion('school-copy', { alpha: courses ? 0 : 1, y: courses ? -100 : 0 })}>{props.beat === 0 && props.slide.content[0].split('\n').slice(2).map(t => <span key={t}>{t}</span>)}</div>
    <div className="s12-thread-university" {...motion('university-copy', { alpha: courses ? 0 : 1, enterY: 54, duration: 1.05, delay: courses ? 0 : 2.35 })}>{props.beat === 0 && props.slide.content[1].split('\n').map((t, i) => i < 2 ? <strong key={t}>{t}</strong> : <span key={t}>{t}</span>)}</div>
    {courses && <Copy props={props} className={`threads-heading ${gathered ? 'gathered' : ''}`} lines={[props.slide.content[0]]} />}
    <div className="s12-course-character" {...motion('course-wonder', { alpha: gathered ? 1 : 0, y: gathered ? 0 : 105, scale: gathered ? 1 : .86, delay: gathered ? .22 : 0, enterX: 105 })}>
      <img src={art('lanyan-course-wonder-review')} alt="蓝砚捧着笔记回想一门有趣的课程" />
    </div>
    <div className="s12-course-messages">
      {courses && (messages.length ? messages.map((m, i) => <div className="s12-course-note" key={m.id} style={{
        left: gathered ? 955 + i % 3 * 270 : 1110 + i % 2 * 350,
        top: gathered ? 175 + Math.floor(i / 3) * 216 : 180 + Math.floor(i / 2) * 242,
        transform: `rotate(${(i % 2 ? 1 : -1) * (gathered ? 3 : 5)}deg) scale(${gathered ? .8 : .94})`,
      }}><div className={`s12-course-paper ${animate && !gathered ? 's12-course-drop' : ''}`}><span>来自现场</span><p>{m.emoji} {m.text}</p></div></div>) : !gathered && <div className="s12-course-wait"><span>这条路线，等课名落下。</span><b>0</b><small>条现场留言</small></div>)}
    </div>
    {props.beat === 1 && <><p className="s12-public-note">{props.slide.content[1]}</p><Join props={props} id="course-memory" seconds={40} /></>}
    {gathered && messages.length > 0 && <span className="s12-course-total">刚刚落下的课程留言</span>}
  </div>;
}

function Duet(props: StoryProps) {
  const encounter = props.beat === 1;
  return <div className="s12-scene s12-fe-duet">
    <div className="s12-film-window" {...motion('film', { x: encounter ? 0 : 0, y: encounter ? 90 : 0, scale: encounter ? .92 : 1, rotate: encounter ? -3 : 0 })}><Framed src={media(1, 'campus-film-poster')} caption="校园宣传片 · 学生作品" /><div className="s12-film-perfs">{Array.from({ length: 11 }, (_, i) => <i key={i} />)}</div></div>
    <div className="s12-duet-track track-picture" {...motion('picture-track', { x: encounter ? -170 : 0, y: encounter ? 180 : 0, rotate: encounter ? -8 : -3, alpha: encounter ? 0 : 1 })}><Label>画面 / 剪辑</Label><strong>我</strong><div className="s12-frame-track">{Array.from({ length: 7 }, (_, i) => <i key={i} />)}</div></div>
    <div className="s12-duet-track track-voice" {...motion('voice-track', { x: encounter ? -220 : 0, y: encounter ? -160 : 0, rotate: encounter ? 8 : 2, alpha: encounter ? 0 : 1 })}><Label>配音</Label><strong>学长</strong><div className="s12-waveform">{Array.from({ length: 31 }, (_, i) => <i key={i} style={{ height: 10 + (i * 17) % 68 }} />)}</div></div>
    <div className="s12-join-knot" {...motion('join-knot', { scale: encounter ? 1.4 : 1, alpha: encounter ? 0 : .65 })}>＋</div>
    <div className="s12-film-smile" {...motion('film-smile', { alpha: encounter ? 1 : 0, x: encounter ? 0 : 125, y: encounter ? 0 : 50, delay: encounter ? .42 : 0, enterY: 85 })}><img src={art('lanyan-film-smile-review')} alt="蓝砚在影片一旁欣慰地微笑" /></div>
    <Copy props={props} className={encounter ? 'duet-encounter' : 'duet-copy'} lines={encounter ? props.slide.content.map(t => t.replace('藏在没有预料到的相遇里。','藏在没有预料到的\n相遇里。')) : undefined} />
  </div>;
}

function Radius(props: StoryProps) {
  const b = props.beat;
  const srcs = ['siyuan-01', 'xuanjiang-01', 'siyuan-02', 'siyuan-03', 'siyuan-04', 'siyuan-05'];
  const galleryTiles = [[165, 220, -7], [710, 200, 3], [1310, 250, 7], [220, 660, 5], [835, 650, -4], [1440, 690, -6]];
  const positions = b === 0 ? [[210, 420], [960, 275], [1800, 350], [1800, 500], [1800, 700], [1800, 900]] : b === 1 ? galleryTiles : b === 2 ? [[150, 300], [690, 300], [1230, 300], [1800, 700], [1800, 700], [1800, 700]] : [[1150, 200], [1400, 340], [1110, 570], [1470, 680], [1800, 700], [1800, 700]];
  return <div className={`s12-scene s12-fe-radius radius-beat-${b}`}>
    <svg className="s12-radius-map" viewBox="0 0 1920 1080" aria-hidden="true"><circle cx="930" cy="610" r="210" {...motion('radius-small', { scale: b >= 2 ? 1.25 : .4, alpha: b >= 2 ? .55 : 0 })} /><circle cx="930" cy="610" r="390" {...motion('radius-big', { scale: b >= 2 ? 1.2 : .7, alpha: b >= 2 ? .45 : 0 })} /><path d="M300 580C600 220 1030 240 1590 650" /></svg>
    {srcs.map((src, i) => <div className={`s12-radius-photo radius-photo-${i}`} key={src} style={{ left: 0, top: 0 }} {...motion(`radius-photo-${i}`, { x: positions[i][0], y: positions[i][1], rotate: b === 1 ? galleryTiles[i][2] : b === 3 ? [-6, 5, 3, -3, 0, 0][i] : i === 0 ? -4 : 3, scale: b === 0 ? i === 0 ? .9 : 1.18 : b === 1 ? .76 : b === 2 ? .85 : .58, alpha: b === 0 ? i < 2 ? 1 : 0 : b === 3 ? i < 4 ? 1 : 0 : b === 2 ? i < 3 ? 1 : 0 : 1, delay: i * .055, duration: 1.1 })}><Framed src={media(1, src)} caption={b === 1 ? '思源实践 · 真实记录' : undefined} /></div>)}
    {b === 1 && !props.staticMode && !props.compact && <div className="s12-radius-focus" aria-hidden="true">
      <div className="s12-radius-focus-scrim" />
      {srcs.map((src, index) => {
        const [x, y, angle] = galleryTiles[index];
        const radians = angle * Math.PI / 180;
        const [halfW, halfH] = [520 * .38, 370 * .38];
        const style = {
          animationDelay: `${.66 + index * 1.47}s`,
          '--s12-tile-x': `${x + halfW * Math.cos(radians) - halfH * Math.sin(radians) - 960}px`,
          '--s12-tile-y': `${y + halfW * Math.sin(radians) + halfH * Math.cos(radians) - 522}px`,
          '--s12-tile-angle': `${angle}deg`,
        } as CSSProperties;
        return <div key={src} className="s12-radius-focus-photo" style={style}><Framed src={media(1, src)} caption={`思源实践 · 真实记录 ${String(index + 1).padStart(2, '0')} / 06`} /></div>;
      })}
    </div>}
    <div className="s12-radius-character" {...motion('radius-reflect-character', { alpha: b === 3 ? 1 : 0, x: b === 3 ? 0 : -110, y: b === 3 ? 0 : 80, scale: b === 3 ? 1 : .84, delay: b === 3 ? .25 : 0 })}><img src={art('lanyan-radius-reflect-review')} alt="蓝砚带着实践笔记，回想和同学们一起工作" /></div>
    {b === 0 ? <div key={props.slide.id} data-story-copy className="s12-radius-roles">{props.slide.content.map((t, i) => <div key={t}><strong>{t.split('\n')[0]}</strong>{t.split('\n').slice(1).map(s => <span key={s}>{s}</span>)}<b>{i === 0 ? '→' : '↗'}</b></div>)}</div> : b === 2 ? <div key={props.slide.id} className="s12-radius-stations" data-story-copy>{props.slide.content.map((t, i) => <div key={t}><b>0{i + 1}</b><span>{t}</span></div>)}</div> : <Copy props={props} className={b === 1 ? 'radius-gallery-copy' : 'radius-reflection'} lines={b === 3 ? props.slide.content.map(line => line.replace('这么多分享的机会。', '\n这么多分享的机会。')) : undefined} />}
  </div>;
}

function FirstStep(props: StoryProps) {
  const b = props.beat;
  const actions = ['signup', 'practice', 'meet', 'try'];
  const captions = b === 1 ? props.slide.content.map((line, index) => index === 2 ? line.replace('一个','\n一个') : index === 3 ? line.replace('没有', '\n没有') : line) : [];
  const stamp = b === 2;
  return <div className="s12-scene s12-fe-first-step">
    <div className="s12-step-ribbon" {...motion('step-route', { x: b === 0 ? -55 : 0, y: b === 0 ? 90 : stamp ? 30 : 160, scale: b === 0 ? 1.08 : stamp ? .58 : 1.06, alpha: b === 0 ? .66 : stamp ? .17 : .38, duration: 1.15 })}><img src={art('fe-first-step-route-v2')} alt="" /></div>
    <div className="s12-first-foot" {...motion('first-foot', { x: b === 0 ? 214 : 735, y: b === 0 ? 698 : 585, scale: b === 0 ? .58 : .4, alpha: b === 0 ? 1 : 0, rotate: 37, enterY: 160 })}><i /><b /></div>
    <div className="s12-step-stop" style={{ left: 365, top: 704 }} {...motion('step-sign', { alpha: b === 0 ? 1 : 0, y: b === 0 ? 30 : 140 })}><b>01</b><span>报名</span></div>
    {actions.map((action, index) => <figure className="s12-step-character" key={action} style={{ left: 117 + 428 * index }}
      {...motion('first-step-' + action, { alpha: b === 1 ? 1 : 0, y: b === 1 ? 0 : stamp ? 120 : 64, scale: b === 1 ? 1 : .91, enterY: 112, delay: b === 1 ? index * .22 : 0, duration: .79 })}>
      <img src={art(`lanyan-${action}-review`)} alt="" />
      {b === 1 && <figcaption><b>0{index + 1}</b><span>{captions[index]}</span></figcaption>}
    </figure>)}
    <div className="s12-step-photo" {...motion('step-photo', { alpha: b === 0 ? 1 : 0, x: b === 1 ? 220 : 0, scale: b === 1 ? .8 : 1 })}><Framed src={media(1, 'xuanjiang-01')} caption="迈出的那一步，走向真实的人。" /></div>
    {b === 0 && <Copy props={props} className="first-step-copy" />}
    <div className="s12-chapter-seal" {...motion('fe-seal', { alpha: stamp ? 1 : 0, scale: stamp ? 1 : 1.72, y: stamp ? 0 : -95, enterY: -95, enterScale: 1.72, delay: stamp ? .08 : 0, duration: .52 })} data-review-impact={stamp ? 'seal' : undefined} data-impact-delay=".60"><Seal text="合情" chapter={1} size={290} /><span>人与人之间的连接</span></div>
  </div>;
}

const syllabus = [
  ['工科数学分析I', '6', '第一学期', '考试'],
  ['工科数学分析II', '6', '第二学期', '考试'],
  ['学术用途英语一级', '3', '第一学期', '考试'],
  ['学术用途英语二级', '3', '第二学期', '考试'],
  ['线性代数B', '3', '第一学期', '考试'],
  ['程序设计基础', '3', '第二学期', '考试'],
  ['工程制图C', '2', '第一学期', '考试'],
  ['电路分析基础', '4', '第二学期', '考试'],
  ['大学物理AI', '4', '第二学期', '考试'],
  ['复变函数与积分变换', '2', '第三学期', '考试'],
  ['概率与数理统计', '3', '第三学期', '考试'],
  ['数字电子技术基础A', '3.5', '第三学期', '考试'],
];

function OpenSyllabus(props: StoryProps) {
  const b = props.beat;
  return <div className={`s12-scene s12-se-open syllabus-beat-${b}`}>
    <div className="s12-fair-fold" {...motion('fair-world', { x: b === 0 || b === 3 ? 0 : 160, y: b === 3 ? 22 : 0, scale: b === 0 ? 1 : b === 3 ? 1.07 : 1.19, alpha: b === 2 ? .26 : b === 3 ? .84 : 1, duration: 1.3 })}><img src={art('se-campus-unfold-v2')} alt="秋日下午的校园游园，学生在茶席和绘画摊前相聚" /></div>
    <div className="s12-syllabus" {...motion('syllabus', { x: b === 0 ? -1050 : b === 3 ? -690 : 0, y: b === 0 ? 150 : b === 3 ? 70 : 0, rotate: b === 0 ? -13 : b === 3 ? -14 : -3, scale: b === 2 ? 1.06 : b === 3 ? .72 : 1, alpha: b === 0 ? 0 : b === 3 ? .55 : 1, duration: 1.2 })}>
      <div className="s12-syllabus-heading"><Label>培养方案</Label><span>自动化 · 课程节选</span></div>
      <table className={b === 1 && !props.staticMode && !props.compact ? 's12-syllabus-reveal' : undefined}>
        <thead><tr>{['课程名称', '学分', '学期', '考核方式'].map(label => <th scope="col" key={label}><span>{label}</span></th>)}</tr></thead>
        <tbody>{syllabus.map(([name, credit, term, exam], index) => <tr key={name} className={b === 2 && name === '电路分析基础' ? 's12-syllabus-selected' : undefined} style={{ '--s12-row': index } as CSSProperties}>
          {[name, credit, term, exam].map((value, column) => <td key={column}><span>{value}</span></td>)}
        </tr>)}</tbody>
      </table>
    </div>
    <div className="s12-syllabus-outside" {...motion('outside-photo', { alpha: b === 3 ? 1 : 0, x: b === 3 ? 0 : 320, rotate: 7 })}><Framed src={media(2, 'hanfu-03')} caption="校园里的另一种体验" /></div>
    <Copy props={props} className={b === 0 ? 'se-title' : b === 1 ? 'syllabus-question' : b === 2 ? 'syllabus-focus' : 'syllabus-answer'} lines={b === 0 ? ['Se', '拥实', '丰富多彩的校园体验'] : b === 2 ? [] : b === 1 ? [props.slide.content[0].replace('按培养方案','按\n培养方案')] : props.slide.content} />
  </div>;
}

const hanfuPortrait: ArchivePhoto[] = [{
  src: media(2, 'hanfu-01'),
  caption: '理韵文化协会 · 真实活动记录',
  description: '身着汉服的活动照片，参与者的脸上保留了遮挡贴纸',
  left: 574,
  top: 248,
  width: 772,
}];

function Shell(props: StoryProps) {
  const b = props.beat;
  return <div className="s12-scene s12-se-shell">
    {b > 0 && <PhotoArchive key={b} photos={hanfuPortrait} tone="night" animate={b === 1} />}
    {(['left','right'] as const).map((side, i) => <div key={side} className={'s12-shell-panel shell-'+side} {...motion('shell-'+side, { x: (i ? 1 : -1) * (b === 2 ? 690 : b === 1 ? 137 : 0), y: b === 1 ? 57 : 0, rotate: (i ? 1 : -1) * (b === 2 ? 12 : b === 1 ? 2 : 0), alpha: b === 2 ? .78 : 1, duration: 1.38 })}>
      <div className="s12-shell-surface"><img src={art('se-technical-shell-v2')} alt="" /></div>
      <Framed src={media(2, i ? 'code' : 'circuit')} caption={i ? '编程 · 真实记录' : '电路 · 控制 · 真实记录'} />
    </div>)}
    <div className="s12-shell-seam" {...motion('shell-seam', { alpha: b === 1 ? .78 : 0, scale: b === 1 ? 1 : .54 })} />
    <Copy props={props} className={b === 2 ? 'shell-after-copy' : 'shell-before-copy'} />
  </div>;
}

function RecruitmentScroll({ compact, animate }: { compact?: boolean; animate: boolean }) {
  const [open, setOpen] = useState(true);
  const [manual, setManual] = useState(false);
  const panelId = useId();
  return <>
    {!compact && <button className="s12-recruit-tab" type="button" aria-expanded={open} aria-controls={panelId} onClick={() => { setManual(true); setOpen(value => !value); }}>
      {open ? '收起招新画卷 ↑' : '展开招新画卷 ↓'}
    </button>}
    {open && <aside id={panelId} className={`s12-recruit-scroll ${animate ? 's12-recruit-drop' : ''}`} style={manual ? { animationDelay: '0s' } : undefined}>
      <div className="s12-recruit-welcome">
        <img src={art('lanyan-club-welcome-review')} alt="蓝砚张开一只手，欢迎大家加入理韵" />
        <div><Label>招新邀请</Label><h2>来理韵，<br />一起试试。</h2></div>
      </div>
      <img className="s12-recruit-code" src={art('liyunculture-wechat-qr')} alt="校级组织理韵文化协会第四届大群微信二维码，原图注明 11 月 13 日前有效" />
    </aside>}
  </>;
}

function Arts(props: StoryProps) {
  const all = props.beat === 1;
  return <div className="s12-scene s12-se-arts">
    <div className="s12-arts-photo" {...motion('arts-photo', { x: all ? -660 : 0, y: all ? 110 : 0, scale: all ? .65 : 1, rotate: all ? -9 : -4, alpha: all ? 0 : 1 })}><Framed src={media(2, 'hanfu-02')} caption="理韵文化协会 · 真实记录" /></div>
    {!all && <Copy props={props} className="arts-intro" />}
    <div className="s12-arts-illustration" {...motion('arts-table', { x: all ? 0 : 526, y: all ? 0 : 142, scale: all ? 1 : .43, alpha: 1, duration: 1.2 })}><img src={art('se-seven-arts-v2')} alt="同一张竹案摆着空白诗卷、琴、花鸟画、笔墨纸、茶具、花瓶与香炉" /></div>
    {'诗乐画书茶花香'.split('').map((name, i) => <div className="s12-art-object" key={name} style={{ left: [231, 456, 672, 914, 1193, 1395, 1594][i] }} {...motion('art-'+name, { y: all ? 0 : 40, scale: all ? 1 : .68, alpha: all ? 1 : 0, duration: .76, delay: i * .105 })}><h2>{name}</h2><i /></div>)}
    {all && <div className="s12-arts-title" key={props.slide.id} data-story-copy><p>霜降雅集</p></div>}
    {!all && <RecruitmentScroll compact={props.compact} animate={!props.staticMode && !props.compact} />}
  </div>;
}

function Game(props: StoryProps) {
  const b = props.beat;
  return <div className={`s12-scene s12-se-game game-beat-${b}`}>
    <div className="s12-game-screen" {...motion('game-screen', { x: b === 0 ? 0 : b === 1 ? -60 : -80, y: b === 2 ? 75 : 0, scale: b === 0 ? .88 : b === 1 ? .63 : .53, rotate: b === 0 ? -2 : -5, duration: 1.25 })}>
      <img className="s12-game-peek" src={art('lanyan-game-peek-review')} alt="蓝砚从游戏画框背后探头" {...motion('peek', { alpha: b === 2 ? 1 : 0, y: b === 2 ? 0 : 305, enterY: 305, duration: .76, delay: b === 2 ? 1.05 : 0 })} />
      <Framed src={media(2, 'frost-ui-01')} caption="一笺霜信 · 北湖雅集 / 真实项目界面" />
    </div>
    <div className="s12-game-second" {...motion('game-second', { alpha: b === 1 ? 1 : b === 2 ? .55 : 0, x: b === 0 ? 300 : 0, rotate: 5, scale: b === 2 ? .8 : 1, y: b === 2 ? 120 : 0 })}><Framed src={media(2, 'frost-ui-02')} caption="实际探索界面" /></div>
    <svg className="s12-game-route" viewBox="0 0 1920 1080" aria-hidden="true" {...motion('game-route', { alpha: b === 0 ? 0 : 1 })}><path d="M925 900H1715" /></svg>
    {['关卡', '印章', '纪念卡'].map((word, i) => <div key={word} className={`s12-game-node game-node-${i}`} {...motion(`game-node-${i}`, { alpha: b === 0 ? 0 : 1, scale: b === 2 ? .85 : 1, y: 0, duration: .8, delay: i * .22 })}><span>{i === 0 ? '01' : i === 1 ? '印' : '✓'}</span><strong>{word}</strong></div>)}
    <Copy props={props} className={b === 0 ? 'game-title' : b === 1 ? 'game-question' : 'game-conclusion'} lines={b === 1 ? [props.slide.content[0]] : props.slide.content} />
    <div className="s12-technical-connection" {...motion('technical-connection', { alpha: b === 2 ? 1 : 0, y: b === 2 ? 0 : 120, scale: b === 2 ? 1 : .8 })}><span>专业知识</span><b>×</b><span>体验生活</span></div>
  </div>;
}

const clubFilm = appUrl('/assets/video/liyunculture-club.mp4');
const clubPoster = media(2, 'liyunculture-film-poster');

function ClubFilm(props: StoryProps) {
  return <div className="s12-scene s12-club-film">
    <div className="s12-club-film-label"><Label>真实影像 · 校园生活</Label><h2>校园生活的另一种打开方式</h2></div>
    <div className="s12-club-film-frame">
      <StageFilm src={clubFilm} poster={clubPoster} compact={props.compact} controls={!props.staticMode && !props.spectator} muted={props.spectator} />
      <img className="prod-media-frame" src={appUrl("/assets/art/approved/media-frame-16x9.png")} alt="" />
      {!props.staticMode && !props.compact && <div className="s12-film-shutter" aria-hidden="true" data-film-shutter/>}
    </div>
  </div>;
}

function Afternoon(props: StoryProps) {
  const b = props.beat;
  const poll = b === 3;
  const data = props.results?.['free-afternoon'] || { total: 0, counts: [] };
  const options = props.slide.interaction?.options || ['图书馆卷', '艺术创作', '社团探索', '技术整活', '自由放空'];
  const coords = [[90, 702], [414, 780], [810, 710], [1180, 735], [1540, 780]];
  const associations = b === 0 ? props.slide.content : ['心理协会\n听别人说话', '校园新媒体\n把话讲给更多人听', '还有更多'];
  return <div className={'s12-scene s12-se-afternoon afternoon-beat-'+b}>
    <div className="s12-association-art" {...motion('association-art', { alpha: [1, .53, 0, 0, 0][b], x: b === 1 ? 466 : b > 1 ? 550 : 0, y: b === 1 ? 68 : 0, scale: b === 1 ? .81 : 1, duration: 1.25 })}><img src={art('se-listen-share-v2')} alt="校园生活的三个方向：同学在树下交谈，校园媒体在采访，另一条小路通向敞开的门" /></div>
    <div className="s12-afternoon-fair" {...motion('afternoon-fair', { alpha: [0, 0, 1, .34, 0][b], x: b === 1 ? 280 : 0, y: 0, scale: b === 3 ? 1.07 : 1, duration: 1.3 })}>
      <img src={art('se-afternoon-map-v2')} alt="自由下午的校园概念地图，串联阅读、绘画、社团、制作和湖边" />
      <img className="s12-afternoon-books" src={art('se-library-counter-review')} alt="" />
    </div>
    <div className="s12-afternoon-scrim" {...motion('afternoon-scrim', { alpha: b === 2 ? .88 : poll ? .65 : 0 })} aria-hidden="true"/>
    {b === 2 && !props.staticMode && !props.compact && <svg className="s12-afternoon-route" viewBox="0 0 1920 1080" aria-hidden="true">
      <path pathLength="1000" d="M303 646C246 648 159 672 139 717C162 751 275 750 421 785C530 816 683 827 754 788C823 751 807 704 903 687C1013 666 1080 683 1145 713C1210 743 1305 773 1428 766C1520 762 1625 733 1613 698C1604 674 1637 651 1699 645" />
    </svg>}
    {associations.map((line, i) => {
      const [name, caption] = line.split('\n');
      return <div key={i} className={'s12-association-label association-label-'+i} {...motion('association-label-'+i, { alpha: b === 0 ? 1 : 0, y: b === 0 ? 0 : 80, delay: .14*i, duration: .75 })}><h3>{name}</h3>{caption && <p>{caption}</p>}</div>;
    })}
    {options.map((word, i) => {
      const percent = data.total ? Math.round((data.counts[i] || 0) / data.total * 100) : 0;
      const [left, top] = coords[i] || [1500, 740];
      return <div className="s12-afternoon-place" key={word} style={{ left, top }} {...motion('afternoon-place-'+i, { x: poll ? 140 + i * 325 - left : 0, y: poll ? 375 - top : b === 4 ? -85 : 0, scale: b === 4 ? .45 : poll ? 1 : .96, alpha: b === 2 || poll ? 1 : 0, duration: 1.1, delay: i * .07 })}>
        <div className="s12-place-caption"><b>{String(i + 1).padStart(2,'0')}</b><h3>{word}</h3></div>
        {poll && <><div className="s12-vote-fill" aria-hidden="true"><i style={{ height: percent + '%' }} /></div><b className="s12-vote-percent">{percent}<small>%</small></b><span className="s12-vote-count">{data.counts[i] || 0} 票</span></>}
      </div>;
    })}
    {b > 0 && b < 4 && <Copy props={props} className={poll ? 'afternoon-poll-copy' : b === 1 ? 'afternoon-doubt' : 'afternoon-invite'} lines={b === 2 ? props.slide.content.map(line => line.replace(/\n/g, '')) : undefined} />}
    {poll && <><Join props={props} id="free-afternoon" seconds={60} /><div className="s12-poll-total">{data.total} 人已选择</div></>}
    <div className="s12-chapter-seal" {...motion('se-seal', { alpha: b === 4 ? 1 : 0, scale: b === 4 ? 1 : 1.72, y: b === 4 ? 0 : -95, enterY: -95, enterScale: 1.72, delay: b === 4 ? .08 : 0, duration: .52 })} data-review-impact={b === 4 ? 'seal' : undefined} data-impact-delay=".60"><Seal text="拥实" chapter={2} size={290} /><span>丰富多彩的校园体验</span></div>
  </div>;
}

export function Story12(props: StoryProps) {
  switch (props.scene.id) {
    case 'fe-letter': return <Letter {...props} />;
    case 'fe-threads': return <Threads {...props} />;
    case 'fe-duet': return <Duet {...props} />;
    case 'fe-radius': return <Radius {...props} />;
    case 'fe-first-step': return <FirstStep {...props} />;
    case 'se-open': return <OpenSyllabus {...props} />;
    case 'se-shell': return <Shell {...props} />;
    case 'se-arts': return <Arts {...props} />;
    case 'se-game': return <Game {...props} />;
    case 'se-club-film': return <ClubFilm {...props} />;
    case 'se-afternoon': return <Afternoon {...props} />;
    default: return null;
  }
}
