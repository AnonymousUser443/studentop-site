import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  AnimatePresence,
  LazyMotion,
  MotionConfig,
  domAnimation,
  m,
} from "motion/react";
import type {
  Artist,
  LibraryData,
  MusicHost,
  MusicRuntime,
  MusicService,
  MusicSession,
  Playlist,
  SearchType,
  Track,
} from "../domain";
import {
  PlaybackVisibilityContext,
  useDocumentVisible,
  useHost,
  usePlayback,
  useResource,
  shallowEqual,
  readStored,
  writeStored,
  formatTime,
} from "./hooks";
import { Icon, TideMark } from "./icons";
import { Brand, Cover, Dialog, EmptyState, IconButton } from "./shared";
import { Player } from "./Player";
import { WindowChrome } from "./WindowChrome";
import { CloudPage, CommentsDialog } from "./Community";
import { useListEntrance } from "./ListEntrance";
import { Immersive } from "./Immersive";
import {
  AddToPlaylistDialog,
  CreatePlaylistDialog,
  LoginDialog,
  TrackMenuDialog,
} from "./Dialogs";
import {
  DetailPage,
  HomePage,
  LibraryPage,
  LikedPage,
  PlaylistPage,
  RecentPage,
  SearchPage,
  routeKey,
  routeLabel,
  type PageProps,
  type Route,
} from "./pages";
import type { TrackActions } from "./TrackTable";
import { ViewCacheProvider, PageMemory } from "./cache";
import s from "./music.module.css";
export function MusicApp(props: {
  runtime: MusicRuntime;
  service: MusicService;
  host: MusicHost;
  visible: boolean;
}) {
  return (
    <ViewCacheProvider>
      <MusicAppContent {...props} />
    </ViewCacheProvider>
  );
}
export { MusicSurface } from "./surfaces";

type Modal =
  | { type: "login" }
  | { type: "create" }
  | { type: "add"; tracks: Track[] }
  | { type: "track"; track: Track }
  | { type: "account" }
  | { type: "comments"; track: Track }
  | null;
interface Notice {
  message: string;
  error: boolean;
}
const EMPTY_LIKES = new Set<string>();
function MusicAppContent({
  runtime,
  service,
  host,
  visible,
}: {
  runtime: MusicRuntime;
  service: MusicService;
  host: MusicHost;
  visible: boolean;
}) {
  const root = useRef<HTMLDivElement>(null),
    { locked, reduced, revision: hostRevision } = useHost(host),
    documentVisible = useDocumentVisible(),
    active = visible && !locked && documentVisible;
  const [history, setHistory] = useState<Route[]>([{ kind: "home" }]),
    [cursor, setCursor] = useState(0),
    route = history[cursor];
  const [query, setQuery] = useState(""),
    [revision, setRevision] = useState(0),
    [session, setSession] = useState<MusicSession>({
      authenticated: false,
      user: null,
    }),
    [storedLibrary, setLibrary] = useState<LibraryData | null>(null),
    [libraryOwner, setLibraryOwner] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null),
    [queueOpen, setQueueOpen] = useState(false),
    [immersive, setImmersive] = useState(false),
    [notice, setNotice] = useState<Notice | null>(null),
    [navOpen, setNavOpen] = useState(false),
    [storedLikedIds, setLikedIds] = useState<Set<string>>(new Set());
  const ownsLibrary = !!session.user?.id && libraryOwner === session.user.id;
  const library = ownsLibrary ? storedLibrary : null;
  const likedIds = ownsLibrary ? storedLikedIds : EMPTY_LIKES;
  const likePending = useRef(new Set<string>());
  useEffect(() => {
    host.setDesktopLyricsSuppressed?.("dialog", (!!modal || queueOpen) && active);
    return () => host.setDesktopLyricsSuppressed?.("dialog", false);
  }, [host, !!modal, queueOpen, active]);
  useEffect(() => {
    host.setDesktopLyricsSuppressed?.("immersive", immersive && active);
    return () => host.setDesktopLyricsSuppressed?.("immersive", false);
  }, [host, immersive, active]);
  const heartRequest = useRef<AbortController | null>(null);
  const [heartBusy, setHeartBusy] = useState(false);
  useListEntrance(root, { key: `sidebar:${session.user?.id || "guest"}`, selector: "[data-sidebar-item]", active, phase: 80 });
  useEffect(() => () => { heartRequest.current?.abort(); }, [session.user?.id]);
  const [searches, setSearches] = useState<string[]>(() => {
      const saved = readStored<unknown>("tingchao.searches", []);
      return Array.isArray(saved)
        ? saved
            .filter(
              (v): v is string => typeof v === "string" && v.length <= 100,
            )
            .slice(0, 10)
        : [];
    }),
    [recent, setRecent] = useState<Track[]>([]);
  const current = usePlayback(
    runtime,
    (state) => ({
      track: state.currentTrack,
      status: state.status,
      error: state.error,
      queue: state.queue,
      currentIndex: state.currentIndex,
    }),
    shallowEqual,
  );
  const sessionResource = useResource(
    (signal) => service.session(signal),
    `session-${revision}`,
    active,
  );
  const libraryResource = useResource(
    (signal) => service.library(signal),
    `library-root-${session.user?.id || ""}-${revision}`,
    active && session.authenticated,
  );
  useEffect(() => {
    if (sessionResource.value) setSession(sessionResource.value);
  }, [sessionResource.value]);
  useEffect(() => {
    if (libraryResource.value) {
      setLibrary(libraryResource.value);
      setLibraryOwner(session.user?.id || null);
      setLikedIds(new Set(libraryResource.value.likedIds));
    }
  }, [libraryResource.value, session.user?.id]);
  useEffect(() => {
    setLibrary(null);
    setLibraryOwner(null);
    setLikedIds(new Set());
  }, [session.authenticated, session.user?.id]);
  useEffect(() => {
    const values = readStored<Track[]>(
      `tingchao.recent.${session.user?.id || "guest"}`,
      [],
    );
    setRecent(Array.isArray(values) ? values.slice(0, 60) : []);
  }, [session.user?.id]);
  useEffect(() => {
    if (!current.track || current.status !== "playing") return;
    const track = current.track,
      key = `tingchao.recent.${session.user?.id || "guest"}`;
    setRecent((old) => {
      if (old[0]?.id === track.id) return old;
      const next = [track, ...old.filter((t) => t.id !== track.id)].slice(
        0,
        60,
      );
      writeStored(key, next);
      return next;
    });
  }, [current.track, current.status, session.user?.id]);
  useEffect(() => {
    host.setTitle(
      current.track
        ? `${current.status === "playing" ? "♫ " : ""}${current.track.title} · 听潮`
        : "听潮 · AidenOS Music",
    );
  }, [host, current.track, current.status]);
  useEffect(() => {
    if (current.error)
      setNotice({ message: current.error.message, error: true });
  }, [current.error]);
  useEffect(() => {
    if (!notice || notice.error) return;
    const timer = setTimeout(() => setNotice(null), 3800);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (route.kind === "search") setQuery(route.query);
  }, [route]);
  const navigate = (next: Route) => {
    setImmersive(false);
    setQueueOpen(false);
    setNavOpen(false);
    if (routeKey(next) === routeKey(route)) return;
    setHistory((old) => [...old.slice(0, cursor + 1), next]);
    setCursor(cursor + 1);
  };
  const handleError = (error: unknown) => {
    const e = error as { message?: string; code?: string };
    setNotice({
      message: e?.message || "暂时没有接通，请稍后重试。",
      error: true,
    });
    if (["authentication_required", "login_expired"].includes(e?.code || ""))
      setModal({ type: "login" });
  };
  const play = (tracks: Track[], index: number) => {
    void runtime.playTracks(tracks, index).catch(handleError);
  };
  const like = (track: Track) => {
    if (!session.authenticated) {
      setModal({ type: "login" });
      return;
    }
    if (likePending.current.has(track.id)) return;
    likePending.current.add(track.id);
    const liked = likedIds.has(track.id);
    setLikedIds((old) => {
      const next = new Set(old);
      liked ? next.delete(track.id) : next.add(track.id);
      return next;
    });
    void service
      .setLike(track.id, !liked)
      .then(() => {
        setNotice({
          message: liked ? "已从喜欢中移除" : "这首歌，已留在喜欢里。",
          error: false,
        });
        setRevision((x) => x + 1);
      })
      .catch((error) => {
        setLikedIds((old) => {
          const next = new Set(old);
          liked ? next.add(track.id) : next.delete(track.id);
          return next;
        });
        handleError(error);
      })
      .finally(() => likePending.current.delete(track.id));
  };
  const add = (track: Track) => {
    setModal(
      session.authenticated
        ? { type: "add", tracks: [track] }
        : { type: "login" },
    );
  };
  const search = (value: string, type: SearchType = "tracks") => {
    const trimmed = value.trim();
    setQuery(trimmed);
    if (trimmed) {
      setSearches((old) => {
        const next = [trimmed, ...old.filter((q) => q !== trimmed)].slice(
          0,
          10,
        );
        writeStored("tingchao.searches", next);
        return next;
      });
    }
    navigate({ kind: "search", query: trimmed, type: type || "tracks" });
  };
  const actions: TrackActions = {
    play,
    like,
    add,
    menu: (track) => setModal({ type: "track", track }),
    album: (id) => navigate({ kind: "album", id }),
    artist: (artist) => navigate({ kind: "artist", id: artist.id }),
  };
  const createPlaylist = () =>
    setModal(session.authenticated ? { type: "create" } : { type: "login" });
  const startHeartMode = async () => {
    if (!session.authenticated) { setModal({ type: "login" }); return; }
    const seed = current.track && likedIds.has(current.track.id) ? current.track.id : library?.likedIds[0];
    if (!seed || !library?.likedPlaylistId) {
      setNotice({ message: "先喜欢一首歌曲，再从心动模式出发。", error: false }); return;
    }
    if (heartRequest.current) return;
    const controller = new AbortController(); heartRequest.current = controller; setHeartBusy(true);
    try {
      const tracks = await service.heartMode(seed, library.likedPlaylistId, controller.signal);
      if (controller.signal.aborted) return;
      if (!tracks.length) { setNotice({ message: "这次心动模式没有返回歌曲，请稍后再试。", error: false }); return; }
      await runtime.playTracks(tracks);
      setNotice({ message: `已接续网易云心动模式返回的 ${tracks.length} 首歌曲。`, error: false });
    } catch (error) { if (!controller.signal.aborted) handleError(error); }
    finally { if (heartRequest.current === controller) { heartRequest.current = null; setHeartBusy(false); } }
  };
  const pageProps: PageProps = {
    service,
    runtime,
    visible: active && !modal,
    session,
    library,
    likedIds,
    actions,
    navigate,
    login: () => setModal({ type: "login" }),
    createPlaylist,
    onError: handleError,
    revision,
    light: host.theme() === "light",
    recent,
    searches,
    search,
    clearSearches: () => {
      writeStored("tingchao.searches", []);
      setSearches([]);
    },
  };
  const logout = async () => {
    try {
      await service.logout();
      runtime.resetAccount();
      setSession({ authenticated: false, user: null });
      setLibrary(null);
      setLikedIds(new Set());
      service.invalidate();
      setRevision((x) => x + 1);
      setModal(null);
      setNotice({ message: "已退出网易云音乐。", error: false });
    } catch (error) {
      handleError(error);
    }
  };
  const refresh = () => {
    service.invalidate();
    setRevision((x) => x + 1);
  };
  const goBack = () => {
    if (immersive) {
      setImmersive(false);
      return;
    }
    setCursor((x) => Math.max(0, x - 1));
    setQueueOpen(false);
  };
  const formSubmit = (event: FormEvent) => {
    event.preventDefault();
    search(query, route.kind === "search" ? route.type : "tracks");
  };
  return (
    <PlaybackVisibilityContext.Provider value={active}>
      <LazyMotion features={domAnimation} strict>
        <MotionConfig reducedMotion={reduced ? "always" : "never"}>
          <div
            className={`${s.palette} ${s.appRoot}`}
            ref={root}
            data-tingchao-root
            data-music-theme={host.theme()}
            data-reduced-motion={reduced ? "true" : "false"}
            data-visible={active ? "true" : "false"}
            data-window-chrome={host.mountWindowControls ? "true" : undefined}
            onKeyDown={(event) => {
              const target = event.target as HTMLElement;
              if (
                target.closest(
                  'input,textarea,select,button,[contenteditable="true"]',
                ) ||
                event.nativeEvent.isComposing
              )
                return;
              if (event.code === "Space" && current.track) {
                event.preventDefault();
                void runtime.togglePlay().catch(handleError);
              }
              if (event.key === "Escape") {
                if (modal) setModal(null);
                else if (queueOpen) setQueueOpen(false);
                else if (immersive) setImmersive(false);
                else setNavOpen(false);
              }
            }}
          >
            <WindowChrome host={host} />
            <div className={s.appWorkspace} inert={!!modal}>
              <aside className={`${s.sidebar} ${navOpen ? s.sidebarOpen : ""}`}>
                <Brand />
                <nav className={s.navigation} aria-label="音乐导航">
                  <span className={s.navCaption}>漫游</span>
                  <NavItem
                    icon="home"
                    label="听潮漫游"
                    active={route.kind === "home"}
                    onClick={() => navigate({ kind: "home" })}
                  />
                  <NavItem
                    icon="search"
                    label="寻找声音"
                    active={route.kind === "search"}
                    onClick={() =>
                      navigate({ kind: "search", query: "", type: "tracks" })
                    }
                  />
                  <NavItem
                    icon="clock"
                    label="最近听过"
                    active={route.kind === "recent"}
                    onClick={() => navigate({ kind: "recent" })}
                  />
                  <span className={s.navCaption}>我的声音</span>
                  <NavItem
                    icon="heart"
                    label="我喜欢的音乐"
                    active={route.kind === "liked"}
                    onClick={() => navigate({ kind: "liked" })}
                  />
                  <NavItem
                    icon="library"
                    label="我的歌单"
                    active={route.kind === "library"}
                    onClick={() => navigate({ kind: "library" })}
                  />
                  <NavItem icon="album" label="我的云盘" active={route.kind === "cloud"} onClick={() => navigate({ kind: "cloud" })} />
                  <button type="button" className={s.navItem} onClick={() => void startHeartMode()} disabled={heartBusy || (session.authenticated && !library)} title="使用喜欢歌曲作为种子，接续网易云心动模式返回的曲目"><Icon name={heartBusy ? "refresh" : "heart"} size={19} /><span>{heartBusy ? "寻找心动…" : "心动模式"}</span></button>
                </nav>
                <div className={s.sidebarCollections}>
                  <div>
                    <span>我的歌单</span>
                    <IconButton
                      icon="plus"
                      label="新建歌单"
                      onClick={createPlaylist}
                    />
                  </div>
                  {library?.created.length ? (
                    library.created.map((playlist) => (
                      <button
                        key={playlist.id}
                        data-sidebar-item data-list-key={playlist.id}
                        type="button"
                        title={playlist.title}
                        className={
                          route.kind === "playlist" && route.id === playlist.id
                            ? s.sidebarPlaylistActive
                            : ""
                        }
                        onClick={() =>
                          navigate({ kind: "playlist", id: playlist.id })
                        }
                      >
                        <Cover src={playlist.coverUrl} />
                        <span>{playlist.title}</span>
                        {playlist.privacy === "private" && (
                          <Icon name="lock" size={11} />
                        )}
                      </button>
                    ))
                  ) : (
                    <p>
                      {session.authenticated
                        ? "为喜欢的歌，新建一处归所。"
                        : "登录后，歌单会在这里等你。"}
                    </p>
                  )}
                </div>
                <div className={s.sidebarBottom}>
                  {!session.authenticated ? (
                    <button
                      className={s.loginInvitation}
                      type="button"
                      onClick={() => setModal({ type: "login" })}
                    >
                      <span className={s.invitationMark}>
                        <TideMark size={24} />
                      </span>
                      <strong>把喜欢，留在身边</strong>
                      <small>扫码接入你的音乐世界</small>
                      <Icon name="forward" size={14} />
                    </button>
                  ) : null}
                  <span className={s.sidebarCredit}>AidenOS Music / 听潮</span>
                </div>
              </aside>
              {navOpen && (
                <button
                  type="button"
                  className={s.navShade}
                  aria-label="收起导航"
                  onClick={() => setNavOpen(false)}
                />
              )}
              <div className={s.mainColumn}>
                <header className={s.topBar}>
                  <IconButton
                    icon="library"
                    label="展开音乐导航"
                    className={s.navToggle}
                    onClick={() => setNavOpen((v) => !v)}
                    aria-expanded={navOpen}
                  />
                  <div className={s.historyButtons}>
                    <IconButton
                      icon="back"
                      label="后退"
                      onClick={goBack}
                      disabled={!immersive && cursor === 0}
                    />
                    <IconButton
                      icon="forward"
                      label="前进"
                      onClick={() =>
                        setCursor((x) => Math.min(history.length - 1, x + 1))
                      }
                      disabled={cursor >= history.length - 1}
                    />
                  </div>
                  <form className={s.searchBox} onSubmit={formSubmit}>
                    <Icon name="search" size={17} />
                    <input
                      aria-label="搜索歌曲、歌手、专辑或歌单"
                      value={query}
                      maxLength={100}
                      onChange={(event) => setQuery(event.currentTarget.value)}
                      placeholder="搜索一首歌，或一段心绪…"
                      enterKeyHint="search"
                    />
                    {query && (
                      <button
                        type="button"
                        aria-label="清空搜索框"
                        onClick={() => setQuery("")}
                      >
                        <Icon name="close" size={13} />
                      </button>
                    )}
                    <button
                      type="submit"
                      className={s.searchSubmit}
                      aria-label="开始搜索"
                    >
                      <Icon name="forward" size={14} />
                    </button>
                  </form>
                  <div className={s.topBarEnd}>
                    {host.setDesktopLyricsEnabled && <IconButton icon="lyrics" label="桌面歌词" active={host.desktopLyricsEnabled?.() ?? false} aria-pressed={host.desktopLyricsEnabled?.() ?? false} onClick={() => host.setDesktopLyricsEnabled?.(!(host.desktopLyricsEnabled?.() ?? false))} />}
                    <IconButton icon="more" label="当前歌曲评论" disabled={!current.track} onClick={() => current.track && setModal({ type: "comments", track: current.track })} />
                    <label className={s.themeChoice} title="听潮外观">
                      <Icon name="sun" size={16} />
                      <select
                        value={host.themeMode()}
                        aria-label="听潮外观"
                        onChange={(event) =>
                          host.setThemeMode(
                            event.currentTarget.value as
                              | "auto"
                              | "light"
                              | "dark",
                          )
                        }
                      >
                        <option value="auto">随系统</option>
                        <option value="light">日光</option>
                        <option value="dark">夜航</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      className={s.accountButton}
                      onClick={() =>
                        setModal({
                          type: session.authenticated ? "account" : "login",
                        })
                      }
                    >
                      {session.authenticated ? (
                        <>
                          <Cover src={session.user?.avatarUrl} />
                          <span>{session.user?.name}</span>
                        </>
                      ) : (
                        <>
                          <span className={s.anonymousAvatar}>
                            <Icon name="artist" size={14} />
                          </span>
                          <span>扫码登录</span>
                        </>
                      )}
                    </button>
                  </div>
                </header>
                <div className={s.pageBreadcrumb}>
                  <span>音乐</span>
                  <Icon name="forward" size={10} />
                  <strong>{routeLabel(route)}</strong>
                  <span className={s.breadcrumbEnd}>
                    <i />
                    {current.status === "playing"
                      ? "潮声正在继续"
                      : "留一点时间给自己"}
                  </span>
                </div>
                <div className={s.pageAndRail}>
                  <main
                    className={s.pageViewport}
                    key={routeKey(route)}
                    aria-label={routeLabel(route)}
                  >
                    <PageMemory cacheKey={routeKey(route) + ":" + revision}>
                      <m.div
                        className={s.pageTransition}
                        initial={reduced ? false : { opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.23,
                          ease: [0.2, 0.7, 0.2, 1],
                        }}
                      >
                        {route.kind === "home" ? (
                          <HomePage {...pageProps} />
                        ) : route.kind === "search" ? (
                          <SearchPage
                            {...pageProps}
                            query={route.query}
                            type={route.type}
                          />
                        ) : route.kind === "playlist" ? (
                          <PlaylistPage {...pageProps} id={route.id} />
                        ) : route.kind === "album" ||
                          route.kind === "artist" ? (
                          <DetailPage
                            {...pageProps}
                            kind={route.kind}
                            id={route.id}
                          />
                        ) : route.kind === "library" ? (
                          <LibraryPage {...pageProps} />
                        ) : route.kind === "liked" ? (
                          <LikedPage {...pageProps} />
                        ) : route.kind === "cloud" ? (
                          <CloudPage key={`${session.user?.id}:${revision}`} {...pageProps} />
                        ) : (
                          <RecentPage {...pageProps} />
                        )}
                      </m.div>
                    </PageMemory>
                  </main>
                  <ListeningRail
                    runtime={runtime}
                    onImmersive={() => setImmersive(true)}
                    onQueue={() => setQueueOpen(true)}
                    play={play}
                  />
                </div>
              </div>
              <AnimatePresence>
                {immersive && current.track && (
                  <Immersive
                    key="lyrics"
                    runtime={runtime}
                    host={host}
                    visible={active && !modal}
                    onClose={() => setImmersive(false)}
                    onLike={like}
                    liked={likedIds.has(current.track.id)}
                  />
                )}
              </AnimatePresence>
              <Player
                runtime={runtime}
                host={host}
                liked={!!current.track && likedIds.has(current.track.id)}
                onLike={like}
                onImmersive={() => setImmersive((v) => !v)}
                onQueue={() => setQueueOpen((v) => !v)}
                queueOpen={queueOpen}
                immersive={immersive}
                onError={handleError}
              />
              <AnimatePresence>
                {queueOpen && (
                  <QueuePanel
                    key="queue"
                    runtime={runtime}
                    onClose={() => setQueueOpen(false)}
                    play={play}
                  />
                )}
              </AnimatePresence>
            </div>
            <AnimatePresence>
              {notice && (
                <m.div
                  className={`${s.notice} ${notice.error ? s.noticeError : ""}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  role={notice.error ? "alert" : "status"}
                >
                  <Icon name={notice.error ? "refresh" : "check"} size={16} />
                  <span>{notice.message}</span>
                  <IconButton
                    icon="close"
                    label="关闭消息"
                    onClick={() => setNotice(null)}
                  />
                </m.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {modal?.type === "login" ? (
                <LoginDialog
                  key="login"
                  service={service}
                  visible={active}
                  onClose={() => setModal(null)}
                  onSuccess={(next) => {
                    runtime.resetAccount();
                    setSession(next);
                    setModal(null);
                    refresh();
                    setNotice({
                      message: "欢迎回来，喜欢的声音已为你接续。",
                      error: false,
                    });
                  }}
                />
              ) : modal?.type === "create" ? (
                <CreatePlaylistDialog
                  key="create"
                  service={service}
                  onClose={() => setModal(null)}
                  onCreated={(playlist) => {
                    setModal(null);
                    refresh();
                    navigate({ kind: "playlist", id: playlist.id });
                    setNotice({
                      message: "新歌单已经准备好了。",
                      error: false,
                    });
                  }}
                />
              ) : modal?.type === "add" ? (
                <AddToPlaylistDialog
                  key="add"
                  service={service}
                  tracks={modal.tracks}
                  visible={active}
                  onClose={() => setModal(null)}
                  onAdded={() => {
                    setModal(null);
                    refresh();
                    setNotice({ message: "已收藏到歌单。", error: false });
                  }}
                />
              ) : modal?.type === "track" ? (
                <TrackMenuDialog
                  key="track"
                  track={modal.track}
                  onClose={() => setModal(null)}
                  onNext={() => {
                    runtime.enqueue([modal.track], true);
                    setNotice({ message: "已放在下一首。", error: false });
                  }}
                  onEnqueue={() => {
                    runtime.enqueue([modal.track]);
                    setNotice({ message: "已加入播放队列。", error: false });
                  }}
                  onAdd={() => add(modal.track)}
                  onArtist={() =>
                    modal.track.artists[0] &&
                    actions.artist(modal.track.artists[0])
                  }
                  onAlbum={() => actions.album(modal.track.album.id)}
                  onComments={() => setModal({ type: "comments", track: modal.track })}
                />
              ) : modal?.type === "comments" ? (
                <CommentsDialog key={`comments:${modal.track.id}:${session.user?.id || "guest"}`} track={modal.track} service={service} visible={active} authenticated={session.authenticated} login={() => setModal({ type: "login" })} onClose={() => setModal(null)} />
              ) : modal?.type === "account" ? (
                <Dialog
                  key="account"
                  title="你的听潮账号"
                  onClose={() => setModal(null)}
                >
                  <div className={s.accountSummary}>
                    <Cover src={session.user?.avatarUrl} />
                    <h3>{session.user?.name}</h3>
                    <span>已连接网易云音乐</span>
                  </div>
                  <p className={s.dialogCopy}>
                    歌单与喜欢保存在你的网易云音乐账号中。听潮的播放队列、音量与外观保留在当前浏览器。
                  </p>
                  <button
                    type="button"
                    className={s.logoutButton}
                    onClick={() => void logout()}
                  >
                    <Icon name="logout" size={17} />
                    退出网易云音乐
                  </button>
                </Dialog>
              ) : null}
            </AnimatePresence>
          </div>
        </MotionConfig>
      </LazyMotion>
    </PlaybackVisibilityContext.Provider>
  );
}
function NavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentProps<typeof Icon>["name"];
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${s.navItem} ${active ? s.navItemActive : ""}`}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      title={label}
    >
      {active && (
        <m.span
          className={s.navActiveLine}
          layoutId="music-nav-line"
          transition={{ type: "spring", stiffness: 440, damping: 35 }}
        />
      )}
      <Icon name={icon} size={19} />
      <span>{label}</span>
    </button>
  );
}
function ListeningRail({
  runtime,
  onImmersive,
  onQueue,
  play,
}: {
  runtime: MusicRuntime;
  onImmersive: () => void;
  onQueue: () => void;
  play: (tracks: Track[], index: number) => void;
}) {
  const rail = useRef<HTMLElement>(null);
  useListEntrance(rail, { key: "listening-rail", phase: 160 });
  const state = usePlayback(
    runtime,
    (v) => ({
      track: v.currentTrack,
      queue: v.queue,
      index: v.currentIndex,
      status: v.status,
    }),
    shallowEqual,
  );
  const upcoming = state.queue.slice(state.index + 1, state.index + 4);
  return (
    <aside className={s.listeningRail} aria-label="此刻正在听" ref={rail}>
      <div className={s.railHeading}>
        <span className={s.eyebrow}>HERE & NOW</span>
        <span className={s.railStatus}>
          <i />
          {state.status === "playing" ? "正在播放" : "此刻"}
        </span>
      </div>
      <button
        className={s.railArtwork}
        type="button"
        onClick={onImmersive}
        disabled={!state.track}
      >
        <Cover src={state.track?.coverUrl} />
        <span>
          <Icon name="expand" size={20} />
        </span>
      </button>
      <div className={s.railIdentity}>
        <strong>{state.track?.title || "等一首，让心停留的歌"}</strong>
        <span>
          {state.track?.artists.map((x) => x.name).join(" / ") ||
            "AidenOS Music · 听潮"}
        </span>
      </div>
      <MiniLyric runtime={runtime} />
      <button
        className={s.railLyricButton}
        type="button"
        disabled={!state.track}
        onClick={onImmersive}
      >
        进入沉浸歌词
        <Icon name="forward" size={14} />
      </button>
      <div className={s.railQueueHeading}>
        <h3>接下来</h3>
        <button type="button" className={s.textButton} onClick={onQueue}>
          全部 <Icon name="forward" size={11} />
        </button>
      </div>
      {upcoming.length ? (
        <div className={s.railQueue}>
          {upcoming.map((item, i) => (
            <button
              type="button"
              key={item.queueId}
              data-list-item data-list-key={item.queueId} data-list-index={i}
              onClick={() =>
                play(
                  state.queue.map((x) => x.track),
                  state.index + i + 1,
                )
              }
            >
              <Cover src={item.track.coverUrl} />
              <span>
                <strong>{item.track.title}</strong>
                <small>
                  {item.track.artists.map((x) => x.name).join(" / ")}
                </small>
              </span>
              <Icon name="play" size={12} />
            </button>
          ))}
        </div>
      ) : (
        <p className={s.railQueueEmpty}>
          下一阵潮声，
          <br />
          由你决定。
        </p>
      )}
    </aside>
  );
}
function MiniLyric({ runtime }: { runtime: MusicRuntime }) {
  const value = usePlayback(runtime, (state) => {
    const lines = state.lyrics?.lines || [];
    let index = lines.findIndex(
      (line, i) =>
        line.startMs <= state.positionMs &&
        (!lines[i + 1] || lines[i + 1].startMs > state.positionMs),
    );
    if (index < 0) index = 0;
    return lines[index]?.text || "";
  });
  return (
    <p className={s.railLyric}>
      {value || "声音如潮，来去之间，都是片刻的自己。"}
    </p>
  );
}
function QueuePanel({
  runtime,
  onClose,
  play,
}: {
  runtime: MusicRuntime;
  onClose: () => void;
  play: (tracks: Track[], index: number) => void;
}) {
  const state = usePlayback(
    runtime,
    (value) => ({
      queue: value.queue,
      index: value.currentIndex,
      status: value.status,
    }),
    shallowEqual,
  );
  const scroll = useRef<HTMLDivElement>(null),
    [viewport, setViewport] = useState({ top: 0, height: 500 });
  useListEntrance(scroll, { key: "play-queue", phase: 120 });
  useEffect(() => {
    const node = scroll.current;
    if (!node) return;
    const observer = new ResizeObserver(() =>
      setViewport((v) => ({ ...v, height: node.clientHeight })),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const virtual = state.queue.length > 140,
    start = virtual
      ? Math.max(
          0,
          Math.min(state.queue.length - 1, Math.floor(viewport.top / 96) - 6),
        )
      : 0,
    end = virtual
      ? Math.min(
          state.queue.length,
          start + Math.ceil(viewport.height / 96) + 13,
        )
      : state.queue.length;
  return (
    <m.div
      className={s.queueShade}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <m.aside
        className={s.queuePanel}
        initial={{ x: 60 }}
        animate={{ x: 0 }}
        exit={{ x: 60 }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        aria-label="播放队列"
      >
        <header>
          <div>
            <span className={s.eyebrow}>UP NEXT / 循声而往</span>
            <h2>
              播放队列 <small>{state.queue.length}</small>
            </h2>
          </div>
          <IconButton icon="close" label="关闭播放队列" onClick={onClose} />
        </header>
        <div className={s.queueSummary}>
          <span>
            {formatTime(
              state.queue.reduce((sum, item) => sum + item.track.durationMs, 0),
            )}{" "}
            的音乐时光
          </span>
          <button
            className={s.textButton}
            type="button"
            disabled={!state.queue.length}
            onClick={() => runtime.clear()}
          >
            <Icon name="remove" size={12} />
            清空
          </button>
        </div>
        <div
          className={s.queueRows}
          ref={scroll}
          onScroll={(event) => {
            const top = event.currentTarget.scrollTop;
            if (virtual)
              setViewport((v) => ({
                ...v,
                top,
              }));
          }}
        >
          {start > 0 && (
            <div style={{ height: start * 96 }} aria-hidden="true" />
          )}
          {state.queue.length ? (
            state.queue.slice(start, end).map((item, relativeIndex) => {
              const index = start + relativeIndex;
              return (
                <div
                  key={item.queueId}
                  data-list-item data-list-key={item.queueId} data-list-index={index}
                  className={`${s.queueRow} ${index === state.index ? s.queueCurrent : ""}`}
                >
                  <button
                    type="button"
                    className={s.queueRowPlay}
                    onClick={() =>
                      play(
                        state.queue.map((x) => x.track),
                        index,
                      )
                    }
                    aria-label={`播放 ${item.track.title}`}
                  >
                    <Cover src={item.track.coverUrl} />
                    <span>
                      <Icon
                        name={
                          index === state.index && state.status === "playing"
                            ? "pause"
                            : "play"
                        }
                        size={15}
                      />
                    </span>
                  </button>
                  <div>
                    <button
                      className={s.queueTrackTitle}
                      type="button"
                      onClick={() =>
                        play(
                          state.queue.map((x) => x.track),
                          index,
                        )
                      }
                    >
                      {item.track.title}
                    </button>
                    <span>
                      {item.track.artists.map((x) => x.name).join(" / ")}
                    </span>
                  </div>
                  <div className={s.queueRowActions}>
                    <IconButton
                      icon="arrow-up"
                      label={`上移 ${item.track.title}`}
                      disabled={index === 0}
                      onClick={() => runtime.move(item.queueId, -1)}
                    />
                    <IconButton
                      icon="arrow-down"
                      label={`下移 ${item.track.title}`}
                      disabled={index === state.queue.length - 1}
                      onClick={() => runtime.move(item.queueId, 1)}
                    />
                    <IconButton
                      icon="close"
                      label={`移除 ${item.track.title}`}
                      onClick={() => runtime.remove(item.queueId)}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <EmptyState
              title="队列里，还留着空位"
              body="把心动的声音，放进接下来的时光里。"
              icon="queue"
            />
          )}
          {end < state.queue.length && (
            <div
              style={{ height: (state.queue.length - end) * 96 }}
              aria-hidden="true"
            />
          )}
        </div>
        <footer>
          <Icon name="headphones" size={14} />
          关上窗口，音乐仍会继续。
        </footer>
      </m.aside>
    </m.div>
  );
}
