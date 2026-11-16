# Folia Sonnet and Tilt renderers

This directory contains a source-level adaptation of **Folia**, by
chthollyphile and Folia contributors, licensed under AGPL-3.0.
The complete license is preserved in `LICENSE`.

- Upstream: https://github.com/chthollyphile/folia-major
- Revision: `1f73b512e27ea640a045451c8af7ef2082264788` (2026-11-16 snapshot)
- Original source paths and SHA-256 checksums: `UPSTREAM.json`
- Local adaptation: STUDENTOP / Aiden, 2026-11-16.

Only the Sonnet compiler, Pixi renderer, Tilt typography and required layout/resource helpers
are included. Folia's application, accounts, player, stores, UI, API services,
model inference, theme library and artwork are not included.

Local changes:

1. Motion type imports use the host's existing `motion/react` dependency.
2. `types.ts` keeps only the upstream declarations used by this renderer.
3. The optional beat-analysis boundary is explicitly disabled; its compatibility
   modules expose idle signals and no beat data. Lyric-driven effects remain.
4. Optional Lucide theme icons are disabled, removing the upstream icon registry
   and server-rendering dependency. Original geometric/text animation remains.
5. The host adapter supplies Tingchao's CSS palette, fonts, playback clock and
   reduced-motion/lifecycle policy. See `src/lyrics/` outside this directory.
6. The renderer ticker is capped at 60 FPS. Glyph shadows and halos are reduced
   for Tingchao's paper/ink day theme and sea scene; original upstream parameters
   remain available from the pinned revision, not a second bundled theme.
7. Renderer initialization cleans up partial resources on failure; the WebGL
   power preference follows the browser's default. Context loss is handled by
   the host fallback instead of affecting playback.
8. Tilt retains the upstream seeded sentence splitting and alternating letter
   placement. Tingchao supplies its own stage, subtitles and lifecycle, uses
   container dimensions instead of viewport dimensions, bounds type size and
   pulse intensity, and disables word pulses when genuine timings are absent.
   No Tailwind runtime, i18n store, upstream shell or audio state is imported.

This is a maintained port, not an upstream-published standalone SDK. Future
updates must review upstream changes and this adaptation, rather than overwrite
the directory blindly. Keep this notice, the license and provenance manifest.
