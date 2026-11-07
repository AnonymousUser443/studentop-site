import { P5_SLIDES } from '../ti/slides';
import { reducedMotion, type Slide } from '../core/deck';
import { Seal } from '../components/Seal';
import { Composition, ProductionCover } from './Composition';

let webGLAvailable: boolean | undefined;
function hasWebGL() {
  if (webGLAvailable !== undefined) return webGLAvailable;
  try {
    const context = document.createElement('canvas').getContext('webgl2');
    webGLAvailable = Boolean(context);
    context?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch { webGLAvailable = false; }
  return webGLAvailable;
}

function StaticTokens({ slide }: { slide: Slide }) {
  const attention = slide.id === 'P5-07';
  const tokens = attention ? slide.content.slice(0, 6) : slide.content.slice(1);
  return <div className="ti-token-plate">
    <div className="ti-token-title">{attention ? 'Attention · 上下文中的关联' : 'Token · 我是山里灵活的狗'}</div>
    <div className="ti-token-row">{tokens.map((token, index) => <div key={index}>{token}</div>)}</div>
    {attention && <><svg viewBox="0 0 1480 270" className="ti-link-map" aria-hidden="true">{tokens.map((_, index) => <path key={index} d={`M${105 + index * 254} 5 Q${270 + index * 185} 182 740 257`} strokeWidth={index === 2 || index === 3 ? 6 : 2} opacity={index === 2 || index === 3 ? .94 : .25} />)}</svg><div className="ti-token-output">神里绫华</div></>}
  </div>;
}

function TiCoda({ slide, moving }: { slide: Slide; moving: boolean }) {
  return <div className="ti-coda">
    {moving && <div className="ti-coda-energy" aria-hidden="true">
      <div className="ti-coda-core"/>
      {Array.from({ length: 22 }, (_, index) => {
        const angle = index * 2.399963;
        const spread = 205 + (index * 101) % 370;
        return <i key={index} style={{left: 960 + Math.cos(angle) * spread, top: 520 + Math.sin(angle) * spread * .65, animationDelay: `${(index % 6) * 26}ms`}}/>;
      })}
    </div>}
    <span className="ti-coda-code">Ti · INTROVERTED THINKING</span>
    <div className="ti-coda-seal" data-stamp><Seal text={slide.content[0]} chapter={5} size={325}/></div>
    <p className="ti-coda-copy" data-production-text>{slide.content[1]}</p>
  </div>;
}

export function TiScene({ slide, quiet }: { slide: Slide; quiet: boolean }) {
  const Original = P5_SLIDES.find(({ id }) => id === slide.id)?.Component;
  const needsGPU = ['P5-01', 'P5-06', 'P5-19'].includes(slide.id);
  const still = quiet || !Original || (needsGPU && !hasWebGL());
  return <div className={`ti-scene ${still ? 'ti-scene-still' : 'ti-scene-live'}`} data-ti-mode={still ? 'still' : 'live'}>
    {slide.id === 'P5-20' ? <TiCoda slide={slide} moving={!quiet && !reducedMotion}/>
      : still ? slide.id === 'P5-06' || slide.id === 'P5-07' ? <StaticTokens slide={slide}/>
      : slide.id === 'P5-01' ? <ProductionCover slide={slide}/>
      : <Composition slide={slide}/> : <Original/>}
    {slide.id === 'P5-01' && !quiet && !reducedMotion && <div className="ti-cover-afterglow" aria-hidden="true"/>}
  </div>;
}
