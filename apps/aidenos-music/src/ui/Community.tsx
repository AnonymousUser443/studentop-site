import { useEffect, useRef, useState } from "react";
import type { CommentPage, Track, TrackComment } from "../domain";
import type { PageProps } from "./pages";
import { TrackTable } from "./TrackTable";
import { Cover, Dialog, EmptyState, ErrorState, Loading, SectionTitle } from "./shared";
import { Icon } from "./icons";
import { useResource } from "./hooks";
import s from "./music.module.css";
import c from "./Community.module.css";
import { useListEntrance } from "./ListEntrance";

export function CloudPage(props: PageProps) {
  const entrance = useRef<HTMLDivElement>(null);
  useListEntrance(entrance, { key: `cloud-shell:${props.session.user?.id}`, active: props.visible });
  const [offset, setOffset] = useState(0), [tracks, setTracks] = useState<Track[]>([]);
  const resource = useResource(
    (signal) => props.service.cloud(offset, signal),
    `cloud:${props.session.user?.id}:${props.revision}:${offset}`,
    props.visible && props.session.authenticated,
  );
  useEffect(() => {
    if (!resource.value) return;
    const page = resource.value;
    setTracks((old) => page.offset === 0 ? page.items : [...old, ...page.items.filter((item) => !old.some((track) => track.id === item.id))]);
  }, [resource.value]);
  if (!props.session.authenticated) return <EmptyState title="你的云盘，随音乐一起抵达" body="扫码登录后，读取你在网易云音乐上传的歌曲。" action={<button type="button" className={s.primaryButton} onClick={props.login}>扫码登录</button>} icon="library" />;
  return <div className={c.cloudPage} ref={entrance}>
    <div className={c.cloudHeader} data-list-item data-list-key="cloud-heading">
      <span className={s.eyebrow}>MY CLOUD / 私藏的声音</span>
      <SectionTitle title="我的云盘" action={<span>{resource.value?.total ?? tracks.length} 首</span>} />
      <p>从网易云音乐云盘接续你的收藏。</p>
      <button className={s.primaryButton} disabled={!tracks.length} onClick={() => props.actions.play(tracks, 0)} type="button"><Icon name="play" size={17} />播放已加载歌曲</button>
    </div>
    {resource.loading && !tracks.length ? <Loading /> : resource.error && !tracks.length ? <ErrorState error={resource.error} retry={resource.retry} /> : !tracks.length ? <EmptyState title="云盘里还没有歌曲" body="在网易云音乐上传后，再回到这里刷新。" icon="library" /> : <TrackTable entranceKey={`cloud:${props.session.user?.id}`} tracks={tracks} runtime={props.runtime} actions={props.actions} likedIds={props.likedIds} hasMore={resource.value?.hasMore} loadingMore={resource.loading} onMore={() => { if (resource.value) setOffset(resource.value.offset + resource.value.limit); }} />}
    {resource.error && tracks.length > 0 && <ErrorState error={resource.error} retry={resource.retry} />}
  </div>;
}

export function CommentsDialog({ track, service, visible, authenticated, login, onClose }: {
  track: Track; service: PageProps["service"]; visible: boolean;
  authenticated: boolean; login: () => void; onClose: () => void;
}) {
  const [offset, setOffset] = useState(0), [revision, setRevision] = useState(0);
  const [content, setContent] = useState(""), [reply, setReply] = useState<TrackComment | null>(null);
  const [busy, setBusy] = useState(false), [pendingLikes, setPendingLikes] = useState<Set<string>>(new Set());
  const [error, setError] = useState(""), [message, setMessage] = useState("");
  const [page, setPage] = useState<CommentPage | null>(null);
  const alive = useRef(true), textarea = useRef<HTMLTextAreaElement>(null), list = useRef<HTMLDivElement>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useListEntrance(list, { key: `comments:${track.id}:${offset}:${revision}`, active: visible, phase: 90 });
  const resource = useResource((signal) => service.comments(track.id, offset, signal), `comments:${track.id}:${offset}:${revision}`, visible);
  useEffect(() => { if (resource.value) setPage(resource.value); }, [resource.value]);
  const submit = async () => {
    if (!authenticated) { login(); return; }
    if (busy || pendingLikes.size > 0 || !content.trim()) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await service.sendComment(track.id, content.trim(), reply?.id);
      if (!alive.current) return;
      setContent(""); setReply(null); setOffset(0); setRevision((v) => v + 1);
      setMessage("评论已发送，列表已刷新。");
    } catch (err) { if (alive.current) setError(err instanceof Error ? err.message : "发送失败，请稍后重试。"); }
    finally { if (alive.current) setBusy(false); }
  };
  const like = async (item: TrackComment) => {
    if (!authenticated) { login(); return; }
    if (busy || pendingLikes.has(item.id)) return;
    setPendingLikes((old) => new Set(old).add(item.id)); setError("");
    try {
      await service.setCommentLike(track.id, item.id, !item.liked);
      if (!alive.current) return;
      const update = (entry: TrackComment) => entry.id === item.id ? { ...entry, liked: !item.liked, likeCount: Math.max(0, entry.likeCount + (item.liked ? -1 : 1)) } : entry;
      setPage((old) => old ? { ...old, items: old.items.map(update), hot: old.hot.map(update) } : old);
    } catch (err) { if (alive.current) setError(err instanceof Error ? err.message : "点赞失败。"); }
    finally { if (alive.current) setPendingLikes((old) => { const next = new Set(old); next.delete(item.id); return next; }); }
  };
  const renderComment = (item: TrackComment, hot = false) => <article className={c.comment} key={`${hot ? "hot" : "new"}:${item.id}`} data-list-item data-list-key={`${hot ? "hot" : "new"}:${item.id}`}>
    <Cover src={item.user.avatarUrl} className={c.avatar} />
    <div className={c.commentBody}>
      <header><strong>{item.user.name}</strong>{Number.isFinite(item.createdAt) && item.createdAt > 0 && item.createdAt <= 8640000000000000 && <time dateTime={new Date(item.createdAt).toISOString()}>{new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(item.createdAt)}</time>}</header>
      <p>{item.content}</p>
      {item.replies.map((quote, i) => <blockquote key={`${quote.id}:${i}`}><strong>{quote.user.name}</strong><span>{quote.content}</span></blockquote>)}
      <footer><button type="button" aria-pressed={item.liked} disabled={busy || pendingLikes.has(item.id)} onClick={() => void like(item)}><Icon name="heart" size={15} />{item.likeCount || "赞"}</button><button type="button" disabled={busy} onClick={() => { if (!authenticated) { login(); return; } setReply(item); textarea.current?.focus(); }}>回复</button></footer>
    </div>
  </article>;
  return <Dialog title="声音之外 · 评论" onClose={onClose} wide className={c.commentsDialog}>
    <div className={c.summary}><Cover src={track.coverUrl} /><div><strong>{track.title}</strong><span>{track.artists.map((artist) => artist.name).join(" / ")}</span></div><span>{page?.total ?? "—"} 条评论</span></div>
    <form className={c.composer} onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      {reply && <div className={c.replyTarget}><span>回复 {reply.user.name}：{reply.content}</span><button type="button" onClick={() => setReply(null)} aria-label="取消回复"><Icon name="close" size={14} /></button></div>}
      <textarea ref={textarea} value={content} onChange={(event) => setContent(event.currentTarget.value)} maxLength={500} rows={3} aria-label={reply ? `回复 ${reply.user.name}` : "写下评论"} placeholder={authenticated ? "写下这一刻的感受…" : "登录后参与评论"} disabled={busy || !authenticated} />
      <div><small>{content.length} / 500</small>{authenticated ? <button type="submit" className={s.primaryButton} disabled={!content.trim() || busy || pendingLikes.size > 0}>{busy ? "发送中…" : reply ? "发送回复" : "发布评论"}<Icon name="forward" size={14} /></button> : <button type="button" className={s.primaryButton} onClick={login}>扫码登录</button>}</div>
    </form>
    {error && <p className={s.formError} role="alert">{error}</p>}{message && <p className={c.feedback} role="status">{message}</p>}
    <div className={c.comments} ref={list} aria-busy={resource.loading}>
      {resource.loading ? <Loading /> : resource.error ? <ErrorState error={resource.error} retry={resource.retry} /> : page && <>
        {offset === 0 && page.hot.length > 0 && <section><h3>精彩评论</h3>{page.hot.map((item) => renderComment(item, true))}</section>}
        <section><h3>最新评论 <small>{page.total}</small></h3>{page.items.length ? page.items.map((item) => renderComment(item)) : <EmptyState title="还没有评论" body="听完这首歌，留下你的感受。" icon="lyrics" />}</section>
      </>}
    </div>
    <div className={c.pagination}><button type="button" className={s.secondaryButton} disabled={!offset || resource.loading || busy || pendingLikes.size > 0} onClick={() => setOffset(Math.max(0, offset - (page?.limit || 20)))}>上一页</button><span>第 {Math.floor(offset / (page?.limit || 20)) + 1} 页</span><button type="button" className={s.secondaryButton} disabled={!page?.hasMore || resource.loading || busy || pendingLikes.size > 0} onClick={() => setOffset(offset + (page?.limit || 20))}>下一页</button></div>
  </Dialog>;
}
