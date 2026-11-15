import { useEffect, useRef, useState } from "react";
import type {
  Album,
  Artist,
  HomeData,
  LibraryData,
  MusicRuntime,
  MusicService,
  MusicSession,
  Playlist,
  PlaylistDetail,
  SearchResult,
  SearchType,
  Track,
} from "../domain";
import {
  Cover,
  EmptyState,
  ErrorState,
  IconButton,
  Loading,
  SectionTitle,
} from "./shared";
import { Icon } from "./icons";
import { TrackTable, type TrackActions } from "./TrackTable";
import { formatCount, formatTime, useResource } from "./hooks";
import s from "./music.module.css";
import { useScrollMemory, useViewState } from "./cache";

export type Route =
  | { kind: "home" }
  | { kind: "search"; query: string; type: SearchType }
  | { kind: "library" }
  | { kind: "playlist"; id: string }
  | { kind: "album"; id: string }
  | { kind: "artist"; id: string }
  | { kind: "recent" }
  | { kind: "liked" };
export interface PageProps {
  service: MusicService;
  runtime: MusicRuntime;
  visible: boolean;
  session: MusicSession;
  library: LibraryData | null;
  likedIds: Set<string>;
  actions: TrackActions;
  navigate: (route: Route) => void;
  login: () => void;
  createPlaylist: () => void;
  onError: (error: unknown) => void;
  revision: number;
  light: boolean;
  recent: Track[];
  searches: string[];
  search: (query: string, type?: SearchType) => void;
  clearSearches: () => void;
}
export function routeKey(route: Route) {
  return route.kind === "search"
    ? `search:${route.type}:${route.query}`
    : "id" in route
      ? `${route.kind}:${route.id}`
      : route.kind;
}
export function routeLabel(route: Route) {
  return {
    home: "听潮漫游",
    search: "寻找声音",
    library: "我的歌单",
    playlist: "歌单",
    album: "专辑",
    artist: "歌手",
    recent: "最近听过",
    liked: "我喜欢的音乐",
  }[route.kind];
}
function uniquePlaylists(data: HomeData) {
  const seen = new Set(data.featured.map((x) => x.id));
  return data.recommended.filter((x) => {
    if (seen.has(x.id)) return false;
    seen.add(x.id);
    return true;
  });
}
export function PlaylistCard({
  playlist,
  onClick,
  index = 0,
}: {
  playlist: Playlist;
  onClick: () => void;
  index?: number;
}) {
  return (
    <button className={s.playlistCard} type="button" onClick={onClick}>
      <span className={s.playlistArt}>
        <Cover src={playlist.coverUrl} />
        <span className={s.playlistArtShade} />
        {playlist.playCount > 0 && (
          <span className={s.playCount}>
            <Icon name="headphones" size={11} />
            {formatCount(playlist.playCount)}
          </span>
        )}
        <span className={s.cardPlay}>
          <Icon name="play" size={19} />
        </span>
        <small className={s.cardIndex}>
          {String(index + 1).padStart(2, "0")}
        </small>
      </span>
      <strong title={playlist.title}>{playlist.title}</strong>
      <span className={s.cardSubtitle}>
        {playlist.tags.slice(0, 2).join(" / ") ||
          `${playlist.trackCount} 首 · ${playlist.creator.name || "音乐歌单"}`}
      </span>
    </button>
  );
}
export function HomePage(props: PageProps) {
  const resource = useResource(
      (signal) => props.service.home(signal),
      `home-${props.revision}-${props.session.user?.id || "guest"}`,
      props.visible,
    ),
    data = resource.value;
  const recommended = data ? uniquePlaylists(data) : [];
  const listen = () => {
    if (data?.tracks.length) props.actions.play(data.tracks, 0);
    else if (data?.featured[0])
      props.navigate({ kind: "playlist", id: data.featured[0].id });
  };
  const date = new Date();
  return (
    <div className={s.homePage}>
      <section className={`${s.hero} ${props.light ? s.dayHero : ""}`}>
        <img
          className={s.heroImage}
          src={
            props.light
              ? "/assets/img/music/day-tide.webp"
              : "/assets/img/music/night-tide.webp"
          }
          alt=""
          draggable={false}
        />
        <div className={s.heroShade} />
        <div className={s.heroCopy}>
          <div className={s.heroOverline}>
            <span />
            <span>
              TINGCHAO · {props.light ? "DAYLIGHT REVERIE" : "NIGHT VOYAGE"}
            </span>
          </div>
          <h1>
            {props.light ? (
              <>
                风起时，
                <br />
                听见一片晴海。
              </>
            ) : (
              <>
                把片刻心绪，
                <br />
                交给这一片潮。
              </>
            )}
          </h1>
          <p>
            {props.light
              ? "让旋律穿过日常，带一点轻盈回来。"
              : "世界慢下来，声音便有了归处。"}
          </p>
          <div className={s.heroActions}>
            <button
              type="button"
              className={s.heroPlay}
              onClick={listen}
              disabled={!data?.tracks.length && !data?.featured.length}
            >
              <Icon name="play" size={17} />
              {data?.personalized ? "听今日推荐" : "从一首歌开始"}
            </button>
            <span className={s.heroDate}>
              {String(date.getMonth() + 1).padStart(2, "0")} /{" "}
              {String(date.getDate()).padStart(2, "0")}
              <i />
              {props.light ? "日光正好" : "与夜同频"}
            </span>
          </div>
        </div>
        <div className={s.heroSignature}>
          <span>{props.light ? "日 / 光" : "听 / 潮"}</span>
          <small>{props.light ? "LIGHT ON THE WATER" : "A SEA OF SOUND"}</small>
        </div>
      </section>
      <div className={s.discoveryTags}>
        <span>循着心绪去听</span>
        {["国风", "独立音乐", "轻音乐", "华语", "氛围音乐"].map((tag) => (
          <button type="button" key={tag} onClick={() => props.search(tag)}>
            {tag}
            <Icon name="forward" size={11} />
          </button>
        ))}
      </div>
      {resource.loading && !data ? (
        <div className={s.homeSkeleton}>
          <div />
          <div />
          <div />
          <div />
          <div />
          <div />
        </div>
      ) : resource.error && !data ? (
        <ErrorState error={resource.error} retry={resource.retry} />
      ) : data ? (
        <>
          <section className={s.homeSection}>
            <SectionTitle
              eyebrow={data.personalized ? "MADE FOR YOU" : "ALONG THE TIDE"}
              title={data.personalized ? "你的今日回响" : "在歌单里，遇见同频"}
              action={
                <button
                  className={s.textButton}
                  type="button"
                  onClick={resource.retry}
                >
                  <Icon name="refresh" size={14} />
                  换一阵风
                </button>
              }
            />
            <div className={s.playlistStrip}>
              {[...data.featured, ...recommended]
                .slice(0, 6)
                .map((playlist, index) => (
                  <PlaylistCard
                    key={playlist.id}
                    playlist={playlist}
                    index={index}
                    onClick={() =>
                      props.navigate({ kind: "playlist", id: playlist.id })
                    }
                  />
                ))}
            </div>
          </section>
          {data.tracks.length > 0 && (
            <section className={s.homeSection}>
              <SectionTitle
                eyebrow="SOMETHING TO STAY WITH"
                title={data.personalized ? "为你接续这一刻" : "听见新的可能"}
                action={
                  <button
                    className={s.textButton}
                    onClick={() => props.actions.play(data.tracks, 0)}
                  >
                    <Icon name="play" size={14} />
                    播放这些歌
                  </button>
                }
              />
              <TrackTable
                compact
                tracks={data.tracks.slice(0, 8)}
                runtime={props.runtime}
                actions={props.actions}
                likedIds={props.likedIds}
              />
            </section>
          )}
          {recommended.length > 6 && (
            <section className={s.homeSection}>
              <SectionTitle
                eyebrow="A LITTLE FURTHER"
                title="让心绪，再走远一点"
              />
              <div className={s.playlistStrip}>
                {recommended.slice(6, 12).map((playlist, index) => (
                  <PlaylistCard
                    key={playlist.id}
                    playlist={playlist}
                    index={index}
                    onClick={() =>
                      props.navigate({ kind: "playlist", id: playlist.id })
                    }
                  />
                ))}
              </div>
            </section>
          )}
        </>
      ) : null}
      <div className={s.pageColophon}>
        <span>听潮 · AidenOS Music</span>
        <span>音乐内容来自网易云音乐</span>
      </div>
    </div>
  );
}
export function PlaylistPage(props: PageProps & { id: string }) {
  const resource = useResource(
    (signal) => props.service.playlist(props.id, 0, signal),
    `playlist-${props.id}-${props.revision}`,
    props.visible,
  );
  const [detail, setDetail] = useState<PlaylistDetail | null>(null),
    [moreBusy, setMoreBusy] = useState(false),
    [allBusy, setAllBusy] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => {
    setDetail(resource.value);
  }, [resource.value]);
  useEffect(() => {
    setDetail(null);
    return () => pending.current?.abort();
  }, [props.id]);
  useEffect(() => {
    if (!props.visible) {
      pending.current?.abort();
      setMoreBusy(false);
      setAllBusy(false);
    }
  }, [props.visible]);
  const loadMore = async () => {
    if (!detail || moreBusy || !detail.tracks.hasMore) return;
    const controller = new AbortController();
    pending.current?.abort();
    pending.current = controller;
    setMoreBusy(true);
    try {
      const result = await props.service.playlist(
        props.id,
        detail.tracks.offset + detail.tracks.items.length,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setDetail((old) =>
        old
          ? {
              ...old,
              tracks: {
                ...result.tracks,
                offset: 0,
                items: [...old.tracks.items, ...result.tracks.items],
              },
            }
          : result,
      );
    } catch (err) {
      if (!controller.signal.aborted) props.onError(err);
    } finally {
      if (!controller.signal.aborted) setMoreBusy(false);
    }
  };
  const playAll = async () => {
    if (!detail || allBusy) return;
    const controller = new AbortController();
    pending.current?.abort();
    pending.current = controller;
    setAllBusy(true);
    try {
      let tracks = detail.tracks.items.slice(),
        page = detail.tracks;
      while (page.hasMore && tracks.length < 10000) {
        const result = await props.service.playlist(
          props.id,
          tracks.length,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        if (!result.tracks.items.length) break;
        tracks.push(...result.tracks.items);
        page = result.tracks;
      }
      if (!controller.signal.aborted) {
        setDetail((old) =>
          old ? { ...old, tracks: { ...page, offset: 0, items: tracks } } : old,
        );
        props.actions.play(tracks, 0);
      }
    } catch (err) {
      if (!controller.signal.aborted) props.onError(err);
    } finally {
      if (!controller.signal.aborted) setAllBusy(false);
    }
  };
  if (resource.loading && !detail) return <Loading />;
  if (resource.error && !detail)
    return <ErrorState error={resource.error} retry={resource.retry} />;
  if (!detail) return null;
  const playlist = detail.playlist,
    actions: TrackActions = {
      ...props.actions,
      ...(playlist.editable
        ? {
            remove: (track: Track) => {
              void props.service
                .editPlaylistTracks(playlist.id, "remove", [track.id])
                .then(() => {
                  setDetail((old) =>
                    old
                      ? {
                          ...old,
                          playlist: {
                            ...old.playlist,
                            trackCount: Math.max(
                              0,
                              old.playlist.trackCount - 1,
                            ),
                          },
                          tracks: {
                            ...old.tracks,
                            total: Math.max(0, old.tracks.total - 1),
                            items: old.tracks.items.filter(
                              (t) => t.id !== track.id,
                            ),
                          },
                        }
                      : old,
                  );
                })
                .catch(props.onError);
            },
          }
        : {}),
    };
  return (
    <div className={s.collectionPage}>
      <header className={s.collectionHeader}>
        <div className={s.collectionCover}>
          <Cover src={playlist.coverUrl} eager />
          <span>
            {playlist.privacy === "private" ? (
              <Icon name="lock" size={14} />
            ) : (
              "歌单"
            )}
          </span>
        </div>
        <div className={s.collectionMeta}>
          <span className={s.eyebrow}>
            PLAYLIST / {playlist.editable ? "我的歌单" : "发现歌单"}
          </span>
          <h1>{playlist.title}</h1>
          <div className={s.creatorLine}>
            <Cover src={playlist.creator.avatarUrl} />
            <span>{playlist.creator.name || "网易云音乐"}</span>
            <i />
            <span>{formatCount(playlist.trackCount)} 首</span>
            {playlist.playCount > 0 && (
              <>
                <i />
                <span>{formatCount(playlist.playCount)} 次聆听</span>
              </>
            )}
          </div>
          {playlist.description && (
            <p className={s.collectionDescription} title={playlist.description}>
              {playlist.description}
            </p>
          )}
          <div className={s.collectionTags}>
            {playlist.tags.slice(0, 4).map((tag) => (
              <button type="button" key={tag} onClick={() => props.search(tag)}>
                {tag}
              </button>
            ))}
          </div>
          <div className={s.collectionActions}>
            <button
              className={s.primaryButton}
              type="button"
              disabled={allBusy || !detail.tracks.items.length}
              onClick={() => void playAll()}
            >
              <Icon name="play" size={17} />
              {allBusy ? "正在接续完整歌单…" : "播放全部"}
            </button>
            <button
              className={s.secondaryButton}
              type="button"
              disabled={!detail.tracks.items.length}
              onClick={() => props.runtime.enqueue(detail.tracks.items)}
            >
              <Icon name="queue" size={16} />
              加入队列
            </button>
            {playlist.editable && (
              <span className={s.editableHint}>
                <Icon name="check" size={13} />
                可编辑 · 曲目右侧可移出
              </span>
            )}
          </div>
        </div>
      </header>
      <div className={s.collectionListHeading}>
        <h2>
          歌曲列表 <small>{playlist.trackCount}</small>
        </h2>
        <span>把喜欢的声音，慢慢听完</span>
      </div>
      {detail.tracks.items.length ? (
        <TrackTable
          tracks={detail.tracks.items}
          runtime={props.runtime}
          likedIds={props.likedIds}
          actions={actions}
          hasMore={detail.tracks.hasMore}
          loadingMore={moreBusy}
          onMore={() => void loadMore()}
        />
      ) : (
        <EmptyState
          title="这张歌单，等着第一首歌"
          body="在搜索结果或正在播放的歌曲中，选择“收藏到歌单”。"
          icon="album"
          action={
            <button
              className={s.secondaryButton}
              onClick={() =>
                props.navigate({ kind: "search", query: "", type: "tracks" })
              }
            >
              <Icon name="search" size={16} />
              去找一首歌
            </button>
          }
        />
      )}
    </div>
  );
}
export function SearchPage(
  props: PageProps & { query: string; type: SearchType },
) {
  const [result, setResult] = useViewState<SearchResult | null>(
      `search-results:${props.type}:${props.query}:${props.revision}`,
      null,
    ),
    [busy, setBusy] = useState(false);
  const pending = useRef<AbortController | null>(null),
    gridScroll = useRef<HTMLDivElement>(null);
  const resource = useResource(
    (signal) => props.service.search(props.query, props.type, 0, signal),
    `search-${props.type}-${props.query}-${props.revision}`,
    props.visible && !!props.query && !result,
  );
  useScrollMemory(
    gridScroll,
    "search-grid",
    (result?.playlists.length || 0) +
      (result?.albums.length || 0) +
      (result?.artists.length || 0),
  );
  useEffect(() => {
    if (resource.value && !result) setResult(resource.value);
  }, [resource.value]);
  useEffect(() => () => pending.current?.abort(), [props.type, props.query]);
  useEffect(() => {
    if (!props.visible) {
      pending.current?.abort();
      setBusy(false);
    }
  }, [props.visible]);
  const more = async () => {
    if (!result || busy || !result.hasMore) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    try {
      const next = await props.service.search(
        props.query,
        props.type,
        result.offset + result.limit,
        controller.signal,
      );
      if (!controller.signal.aborted)
        setResult((old) =>
          old
            ? {
                ...next,
                tracks: [...old.tracks, ...next.tracks],
                albums: [...old.albums, ...next.albums],
                artists: [...old.artists, ...next.artists],
                playlists: [...old.playlists, ...next.playlists],
              }
            : next,
        );
    } catch (err) {
      if (!controller.signal.aborted) props.onError(err);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  if (!props.query)
    return (
      <div className={s.searchLanding}>
        <div className={s.searchIllustration}>
          <Icon name="search" size={36} />
          <span />
          <span />
        </div>
        <span className={s.eyebrow}>FOLLOW A NAME, FIND A FEELING</span>
        <h1>你想听见什么？</h1>
        <p>一首歌、一个名字，或者一句没说完的心事。</p>
        {props.searches.length > 0 && (
          <section>
            <div className={s.sectionHeading}>
              <h2>最近找过</h2>
              <button className={s.textButton} onClick={props.clearSearches}>
                清除记录
              </button>
            </div>
            <div className={s.searchChips}>
              {props.searches.map((query) => (
                <button
                  type="button"
                  key={query}
                  onClick={() => props.search(query)}
                >
                  <Icon name="clock" size={13} />
                  {query}
                  <Icon name="forward" size={12} />
                </button>
              ))}
            </div>
          </section>
        )}
        <section>
          <SectionTitle title="试着找找这些声音" />
          <div className={s.searchChips}>
            {["新国风", "器乐", "民谣", "游戏原声", "爵士", "纯音乐"].map(
              (query) => (
                <button
                  type="button"
                  key={query}
                  onClick={() => props.search(query)}
                >
                  {query}
                  <Icon name="forward" size={12} />
                </button>
              ),
            )}
          </div>
        </section>
      </div>
    );
  return (
    <div className={s.searchPage}>
      <header className={s.searchHeading}>
        <span className={s.eyebrow}>SEARCH / 循声而来</span>
        <h1>
          关于 <em>“{props.query}”</em> 的声音
        </h1>
        <p>
          {result
            ? `找到 ${formatCount(result.total)} 个相关结果`
            : "正在远处寻找…"}
        </p>
      </header>
      <nav className={s.resultTabs} aria-label="搜索结果类型">
        {(
          [
            ["tracks", "单曲"],
            ["playlists", "歌单"],
            ["albums", "专辑"],
            ["artists", "歌手"],
          ] as [SearchType, string][]
        ).map(([type, label]) => (
          <button
            type="button"
            key={type}
            className={props.type === type ? s.resultTabActive : ""}
            aria-pressed={props.type === type}
            onClick={() => props.search(props.query, type)}
          >
            {label}
          </button>
        ))}
      </nav>
      {resource.loading && !result ? (
        <Loading />
      ) : resource.error && !result ? (
        <ErrorState error={resource.error} retry={resource.retry} />
      ) : result && result.total === 0 ? (
        <EmptyState
          title="还没有遇见这段声音"
          body="换个歌名、歌手名，或试试更短的关键词。"
          icon="search"
        />
      ) : result ? (
        <>
          {props.type === "tracks" ? (
            <TrackTable
              tracks={result.tracks}
              runtime={props.runtime}
              likedIds={props.likedIds}
              actions={props.actions}
              hasMore={result.hasMore}
              loadingMore={busy}
              onMore={() => void more()}
            />
          ) : (
            <div className={s.resultsGridScroll} ref={gridScroll}>
              {props.type === "playlists" ? (
                <div className={s.resultCoverGrid}>
                  {result.playlists.map((playlist, index) => (
                    <PlaylistCard
                      key={playlist.id}
                      playlist={playlist}
                      index={index}
                      onClick={() =>
                        props.navigate({ kind: "playlist", id: playlist.id })
                      }
                    />
                  ))}
                </div>
              ) : props.type === "albums" ? (
                <div className={s.resultCoverGrid}>
                  {result.albums.map((album) => (
                    <AlbumCard
                      key={album.id}
                      album={album}
                      onClick={() =>
                        props.navigate({ kind: "album", id: album.id })
                      }
                    />
                  ))}
                </div>
              ) : (
                <div className={s.artistGrid}>
                  {result.artists.map((artist) => (
                    <ArtistCard
                      key={artist.id}
                      artist={artist}
                      onClick={() =>
                        props.navigate({ kind: "artist", id: artist.id })
                      }
                    />
                  ))}
                </div>
              )}
              {result.hasMore && (
                <button
                  className={s.loadMore}
                  type="button"
                  onClick={() => void more()}
                  disabled={busy}
                >
                  {busy ? "正在寻找…" : "加载更多"}
                  <Icon name="chevron" size={15} />
                </button>
              )}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
function AlbumCard({ album, onClick }: { album: Album; onClick: () => void }) {
  return (
    <button type="button" className={s.playlistCard} onClick={onClick}>
      <span className={s.playlistArt}>
        <Cover src={album.coverUrl} />
        <span className={s.cardPlay}>
          <Icon name="album" size={20} />
        </span>
      </span>
      <strong>{album.title}</strong>
      <span className={s.cardSubtitle}>
        {album.artists?.map((x) => x.name).join(" / ") || "专辑"}
      </span>
    </button>
  );
}
function ArtistCard({
  artist,
  onClick,
}: {
  artist: Artist;
  onClick: () => void;
}) {
  return (
    <button type="button" className={s.artistCard} onClick={onClick}>
      <Cover src={artist.coverUrl} />
      <strong>{artist.name}</strong>
      <small>
        歌手 <Icon name="forward" size={11} />
      </small>
    </button>
  );
}
export function DetailPage(
  props: PageProps & { kind: "album" | "artist"; id: string },
) {
  const resource = useResource(
    async (signal) =>
      props.kind === "album"
        ? {
            kind: "album" as const,
            value: await props.service.album(props.id, signal),
          }
        : {
            kind: "artist" as const,
            value: await props.service.artist(props.id, signal),
          },
    `${props.kind}-${props.id}-${props.revision}`,
    props.visible,
  );
  if (resource.loading && !resource.value) return <Loading />;
  if (resource.error && !resource.value)
    return <ErrorState error={resource.error} retry={resource.retry} />;
  const data = resource.value;
  if (!data) return null;
  const title =
      data.kind === "album" ? data.value.album.title : data.value.artist.name,
    cover =
      data.kind === "album"
        ? data.value.album.coverUrl
        : data.value.artist.coverUrl,
    tracks = data.value.tracks;
  return (
    <div className={s.collectionPage}>
      <header className={s.collectionHeader}>
        <div
          className={`${s.collectionCover} ${data.kind === "artist" ? s.artistDetailCover : ""}`}
        >
          <Cover src={cover} eager />
        </div>
        <div className={s.collectionMeta}>
          <span className={s.eyebrow}>
            {data.kind === "album" ? "ALBUM / 专辑" : "ARTIST / 歌手"}
          </span>
          <h1>{title}</h1>
          {data.kind === "album" && (
            <p className={s.detailArtistNames}>
              {data.value.album.artists?.map((x) => x.name).join(" / ")}
            </p>
          )}
          <p className={s.collectionDescription}>
            {data.value.description ||
              `${data.kind === "album" ? "一张专辑" : "一个名字"}，让声音慢慢展开。`}
          </p>
          <div className={s.collectionActions}>
            <button
              type="button"
              className={s.primaryButton}
              disabled={!tracks.length}
              onClick={() => props.actions.play(tracks, 0)}
            >
              <Icon name="play" size={16} />
              播放{data.kind === "artist" ? "热门作品" : "专辑"}
            </button>
            <button
              type="button"
              className={s.secondaryButton}
              disabled={!tracks.length}
              onClick={() => props.runtime.enqueue(tracks)}
            >
              <Icon name="queue" size={16} />
              加入队列
            </button>
          </div>
        </div>
      </header>
      <div className={s.collectionListHeading}>
        <h2>
          {data.kind === "album" ? "专辑歌曲" : "热门作品"}{" "}
          <small>{tracks.length}</small>
        </h2>
      </div>
      {tracks.length ? (
        <TrackTable
          tracks={tracks}
          runtime={props.runtime}
          actions={props.actions}
          likedIds={props.likedIds}
        />
      ) : (
        <EmptyState title="暂时没有可用曲目" body="稍后再回来看看吧。" />
      )}
    </div>
  );
}
export function LibraryPage(props: PageProps) {
  const [tab, setTab] = useState<"created" | "collected">("created");
  const resource = useResource(
    (signal) => props.service.library(signal),
    `library-${props.revision}`,
    props.visible && props.session.authenticated,
  );
  if (!props.session.authenticated)
    return (
      <div className={s.libraryGuest}>
        <div className={s.libraryGuestArt}>
          <Icon name="library" size={55} />
          <span />
          <span />
        </div>
        <span className={s.eyebrow}>YOUR OWN LITTLE SEA</span>
        <h1>
          喜欢的歌，
          <br />
          值得有一个归处。
        </h1>
        <p>
          扫码登录后，在这里找到你的歌单与收藏。
          <br />
          听过的声音，也可以慢慢变成自己的风景。
        </p>
        <button type="button" className={s.primaryButton} onClick={props.login}>
          接入我的网易云音乐
          <Icon name="forward" size={16} />
        </button>
      </div>
    );
  const data = resource.value || props.library,
    playlists = data?.[tab] || [];
  return (
    <div className={s.libraryPage}>
      <header className={s.libraryHeader}>
        <div>
          <span className={s.eyebrow}>COLLECT WHAT MOVES YOU</span>
          <h1>我的声音收藏</h1>
          <p>{props.session.user?.name}，这里留着你想再听一次的心绪。</p>
        </div>
        <button
          className={s.primaryButton}
          type="button"
          onClick={props.createPlaylist}
        >
          <Icon name="plus" size={17} />
          新建歌单
        </button>
      </header>
      <button
        type="button"
        className={s.likedBanner}
        onClick={() => props.navigate({ kind: "liked" })}
      >
        <span className={s.likedArtwork}>
          <Icon name="heart" size={35} />
        </span>
        <span>
          <small>那些听见心里的声音</small>
          <strong>我喜欢的音乐</strong>
          <em>{data?.likedIds.length || 0} 首，仍在不断相遇</em>
        </span>
        <span className={s.likedBannerArrow}>
          <Icon name="forward" size={24} />
        </span>
      </button>
      <div className={s.libraryTabs}>
        {(
          [
            ["created", "我创建的"],
            ["collected", "我收藏的"],
          ] as const
        ).map(([key, label]) => (
          <button
            type="button"
            key={key}
            className={tab === key ? s.resultTabActive : ""}
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
          >
            {label}
            <span>{data?.[key].length || 0}</span>
          </button>
        ))}
      </div>
      {resource.loading && !data ? (
        <Loading />
      ) : resource.error && !data ? (
        <ErrorState error={resource.error} retry={resource.retry} />
      ) : !playlists.length ? (
        <EmptyState
          title={
            tab === "created" ? "给喜欢的声音，取一个名字" : "还没有收藏的歌单"
          }
          body={
            tab === "created"
              ? "从第一张歌单，开始你的听潮之旅。"
              : "去首页或搜索里，遇见新的歌单吧。"
          }
          icon="album"
          action={
            <button
              className={s.secondaryButton}
              onClick={
                tab === "created"
                  ? props.createPlaylist
                  : () => props.navigate({ kind: "home" })
              }
            >
              {tab === "created" ? "新建歌单" : "去听潮漫游"}
              <Icon name="forward" size={15} />
            </button>
          }
        />
      ) : (
        <div className={s.libraryGrid}>
          {playlists.map((playlist, index) => (
            <PlaylistCard
              key={playlist.id}
              playlist={playlist}
              index={index}
              onClick={() =>
                props.navigate({ kind: "playlist", id: playlist.id })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
export function RecentPage(props: PageProps) {
  return (
    <div className={s.collectionPage}>
      <header className={s.simplePageHeader}>
        <span className={s.eyebrow}>ECHOES OF YOUR DAYS</span>
        <h1>最近听过</h1>
        <p>有些声音，再听一次也很好。</p>
      </header>
      {props.recent.length ? (
        <>
          <div className={s.collectionListHeading}>
            <h2>
              留下的回响 <small>{props.recent.length}</small>
            </h2>
            <button
              type="button"
              className={s.textButton}
              onClick={() => props.actions.play(props.recent, 0)}
            >
              <Icon name="play" size={14} />
              播放全部
            </button>
          </div>
          <TrackTable
            tracks={props.recent}
            runtime={props.runtime}
            actions={props.actions}
            likedIds={props.likedIds}
          />
        </>
      ) : (
        <EmptyState
          title="第一段回响，尚未开始"
          body="在听潮里播放过的歌曲，会留在这里。"
          icon="clock"
          action={
            <button
              className={s.secondaryButton}
              onClick={() => props.navigate({ kind: "home" })}
            >
              去听一首歌
              <Icon name="forward" size={15} />
            </button>
          }
        />
      )}
    </div>
  );
}
export function LikedPage(props: PageProps) {
  const resource = useResource(
    (signal) => props.service.library(signal),
    `liked-${props.revision}`,
    props.visible && props.session.authenticated,
  );
  if (!props.session.authenticated)
    return (
      <EmptyState
        title="喜欢的音乐，等你回来"
        body="扫码接入你的网易云音乐，继续听那些熟悉的声音。"
        icon="heart"
        action={
          <button className={s.primaryButton} onClick={props.login}>
            扫码登录
          </button>
        }
      />
    );
  const data = resource.value || props.library;
  if (resource.loading && !data) return <Loading />;
  if (resource.error && !data)
    return <ErrorState error={resource.error} retry={resource.retry} />;
  if (data?.likedPlaylistId)
    return <PlaylistPage {...props} id={data.likedPlaylistId} />;
  return (
    <EmptyState
      title="喜欢，从一首歌开始"
      body="点亮歌曲旁的心形，便会在这里再次相遇。"
      icon="heart"
      action={
        <button
          className={s.secondaryButton}
          onClick={() => props.navigate({ kind: "home" })}
        >
          去听潮漫游
          <Icon name="forward" size={15} />
        </button>
      }
    />
  );
}
