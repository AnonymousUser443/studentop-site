# Third-party code in Tingchao

The repository's AGPL-3.0-only scope does not remove third-party notices.

| Component | Version / revision | License and retained notice |
| --- | --- | --- |
| Folia Sonnet / Tilt and required rendering helpers | `1f73b512e27ea640a045451c8af7ef2082264788` | `src/vendor/folia/LICENSE`, `NOTICE.md`, `UPSTREAM.json` |
| PixiJS | `8.21.0` | MIT, `licenses/pixi-MIT.txt` |
| Pretext | `0.0.9` | MIT, `licenses/pretext-MIT.txt` |

React, Motion, GSAP, the music API SDK and other installed dependencies retain
their own notices in their packages and bundled source. See `package-lock.json`
for the exact dependency graph. Existing font licenses remain with the packaged
fonts; album artwork, lyrics and recordings belong to their respective owners.

`tools/build-music.mjs` keeps bundled legal comments and embeds the complete
AGPL and the two new MIT notices in the native entry artifact. Corresponding
source and build instructions are in the [studentop-site repository](https://github.com/AnonymousUser443/studentop-site).
See the [release record](../../docs/tingchao-vnext/RELEASE-20261116.md) for the exact deployed commit.
