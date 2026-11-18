import type { AudioAnalysisController } from "./audio-analysis";

export interface Artist {
  id: string;
  name: string;
  coverUrl?: string;
}
export interface Album {
  id: string;
  title: string;
  coverUrl: string;
  artists?: Artist[];
  publishTime?: number;
}
export type Availability =
  | "unknown"
  | "full"
  | "preview"
  | "unavailable"
  | "login_required";
export interface Track {
  id: string;
  title: string;
  artists: Artist[];
  album: Album;
  durationMs: number;
  coverUrl: string;
  availability: Availability;
  alias?: string;
}
export interface MusicUser {
  id: string;
  name: string;
  avatarUrl: string;
}
export interface Playlist {
  id: string;
  title: string;
  coverUrl: string;
  description: string;
  creator: MusicUser;
  trackCount: number;
  playCount: number;
  tags: string[];
  editable: boolean;
  subscribed: boolean;
  privacy: "public" | "private";
}
export interface Page<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}
export interface PlaylistDetail {
  playlist: Playlist;
  tracks: Page<Track>;
}
export interface AlbumDetail {
  album: Album;
  tracks: Track[];
  description: string;
}
export interface ArtistDetail {
  artist: Artist;
  tracks: Track[];
  description: string;
}
export type SearchType = "tracks" | "playlists" | "albums" | "artists";
export interface SearchResult {
  type: SearchType;
  tracks: Track[];
  playlists: Playlist[];
  albums: Album[];
  artists: Artist[];
  total: number;
  hasMore: boolean;
  offset: number;
  limit: number;
}
export interface HomeData {
  featured: Playlist[];
  recommended: Playlist[];
  tracks: Track[];
  personalized: boolean;
}
export interface LibraryData {
  created: Playlist[];
  collected: Playlist[];
  likedIds: string[];
  likedPlaylistId: string | null;
}
export interface CommentReply {
  id: string | null;
  user: MusicUser;
  content: string;
}
export interface TrackComment {
  id: string;
  user: MusicUser;
  content: string;
  createdAt: number;
  liked: boolean;
  likeCount: number;
  replies: CommentReply[];
}
export interface CommentPage extends Page<TrackComment> {
  trackId: string;
  hot: TrackComment[];
  /** Time cursor for sequential pages beyond the upstream 5,000-comment offset window. */
  nextBefore: number | null;
}
export interface MusicSession {
  authenticated: boolean;
  user: MusicUser | null;
}
export interface QrChallenge {
  id: string;
  imageUrl: string;
  expiresAt: number;
}
export interface QrStatus {
  status: "waiting" | "scanned" | "authorized" | "expired";
  session?: MusicSession;
}
export interface RawLyrics {
  lrc: string;
  yrc: string;
  translation: string;
  romanization: string;
  instrumental: boolean;
}
export interface LyricWord {
  text: string;
  startMs: number;
  durationMs: number;
}
export interface LyricLine {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  words: LyricWord[];
  translation?: string;
  romanization?: string;
}
export interface Lyrics {
  lines: LyricLine[];
  instrumental: boolean;
  hasWordTiming: boolean;
}
export type Quality = "standard" | "higher" | "exhigh" | "lossless";
export interface PlaybackSource {
  url: string;
  expiresAt: number;
  quality: Quality;
  availability: Availability;
  preview: { startMs: number; endMs: number } | null;
}
export type MusicErrorCode =
  | "authentication_required"
  | "login_expired"
  | "unavailable"
  | "rate_limited"
  | "upstream_error"
  | "network_error"
  | "invalid_request"
  | "forbidden"
  | "lease_expired";
export class MusicError extends Error {
  constructor(
    public code: MusicErrorCode,
    message: string,
    public retryable = false,
  ) {
    super(message);
    this.name = "MusicError";
  }
}
export interface MusicService {
  session(signal?: AbortSignal): Promise<MusicSession>;
  logout(): Promise<void>;
  createQr(signal?: AbortSignal): Promise<QrChallenge>;
  checkQr(id: string, signal?: AbortSignal): Promise<QrStatus>;
  home(signal?: AbortSignal): Promise<HomeData>;
  search(
    query: string,
    type: SearchType,
    offset?: number,
    signal?: AbortSignal,
  ): Promise<SearchResult>;
  playlist(
    id: string,
    offset?: number,
    signal?: AbortSignal,
  ): Promise<PlaylistDetail>;
  album(id: string, signal?: AbortSignal): Promise<AlbumDetail>;
  artist(id: string, signal?: AbortSignal): Promise<ArtistDetail>;
  library(signal?: AbortSignal): Promise<LibraryData>;
  cloud(offset?: number, signal?: AbortSignal): Promise<Page<Track>>;
  comments(
    trackId: string,
    offset?: number,
    signal?: AbortSignal,
  ): Promise<CommentPage>;
  setCommentLike(
    trackId: string,
    commentId: string,
    liked: boolean,
  ): Promise<void>;
  sendComment(
    trackId: string,
    content: string,
    replyTo?: string,
  ): Promise<void>;
  heartMode(
    trackId: string,
    playlistId: string,
    signal?: AbortSignal,
  ): Promise<Track[]>;
  setLike(trackId: string, liked: boolean): Promise<void>;
  createPlaylist(
    name: string,
    privacy: "public" | "private",
  ): Promise<Playlist>;
  editPlaylistTracks(
    id: string,
    op: "add" | "remove",
    trackIds: string[],
  ): Promise<void>;
  lyrics(id: string, signal?: AbortSignal): Promise<RawLyrics>;
  ensurePlaybackLease(): Promise<void>;
  resolve(
    id: string,
    quality: Quality,
    signal?: AbortSignal,
  ): Promise<PlaybackSource>;
  invalidate(): void;
}
export interface QueueItem {
  queueId: string;
  track: Track;
}
export type PlayMode = "sequence" | "shuffle" | "repeat-one";
export interface PlaybackState {
  queue: QueueItem[];
  currentIndex: number;
  currentTrack: Track | null;
  status: "idle" | "loading" | "playing" | "paused" | "error";
  positionMs: number;
  durationMs: number;
  volume: number;
  muted: boolean;
  mode: PlayMode;
  quality: Quality;
  source: PlaybackSource | null;
  lyrics: Lyrics | null;
  error: MusicError | null;
}
export interface MusicRuntime {
  /** Optional Web Audio analyser owned by the document-lifetime runtime. */
  readonly audioAnalysis?: AudioAnalysisController | null;
  getSnapshot(): PlaybackState;
  subscribe(listener: () => void): () => void;
  playTracks(tracks: Track[], index?: number): Promise<void>;
  togglePlay(): Promise<void>;
  resume(): Promise<void>;
  pause(): void;
  seek(positionMs: number): void;
  next(): Promise<void>;
  previous(): Promise<void>;
  enqueue(tracks: Track[], next?: boolean): void;
  remove(queueId: string): void;
  move(queueId: string, delta: number): void;
  clear(): void;
  setVolume(value: number): void;
  setMuted(value: boolean): void;
  setMode(mode: PlayMode): void;
  setQuality(quality: Quality): void;
  refreshLyrics(): Promise<void>;
  resetAccount(): void;
  dispose(): void;
}
export interface MusicHost {
  theme(): "light" | "dark";
  themeMode(): "auto" | "light" | "dark";
  setThemeMode(mode: "auto" | "light" | "dark"): void;
  isLocked(): boolean;
  reducedMotion(): boolean;
  desktopLyricsEnabled?(): boolean;
  setDesktopLyricsEnabled?(value: boolean): void;
  setDesktopLyricsSuppressed?(reason: "dialog" | "quality" | "immersive", value: boolean): void;
  mountWindowControls?(container: HTMLElement): () => void;
  openMain(): void;
  setTitle(title: string): void;
  notify(message: string): void;
  onStateChange(callback: () => void): () => void;
}
