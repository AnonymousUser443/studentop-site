import { useRef, useState } from 'react';

export function StageFilm({ src, poster, compact, controls, muted }: {
  src: string; poster: string; compact?: boolean; controls?: boolean; muted?: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  return <div className="stage-film">
    <img src={poster} alt={compact || failed ? '影片封面' : ''} />
    {!compact && <video ref={video} src={src} poster={poster} controls={controls} muted={muted} playsInline
      webkit-playsinline="" x5-video-player-type="h5-page"
      disablePictureInPicture preload="metadata" onError={() => setFailed(true)} onLoadedData={() => setFailed(false)} />}
    {failed && controls && <button type="button" className="stage-film-retry" onClick={() => { setFailed(false); video.current?.load(); }}>
      视频暂时无法播放 · 重试
    </button>}
  </div>;
}
