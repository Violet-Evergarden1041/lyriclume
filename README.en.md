# LyricLume · 译光

[中文](README.md) · [English](README.en.md)

<img src="docs/demo.gif" width="620" alt="LyricLume demo">

**Word-level karaoke lyrics for Spotify, with Chinese translations from QQ Music.**

Spotify's built-in lyrics rarely include translations for Japanese songs. QQ Music has high-quality, community-made translations *and* a per-character timing track. LyricLume connects the two: it reads the currently playing track from Spotify, fetches the matching lyrics and translation from QQ Music, and renders them in a full-screen view — original on top, translation underneath, swept left-to-right as the song plays.

---

## Features

- **Per-character highlighting** — driven by QQ Music's word-level timestamps, a single edge sweeps continuously across the line instead of jumping line by line
- **Synchronized translation** — the Chinese line is split according to the original word durations, so it fills at the same pace
- **Readable on any cover art** — all lyrics are white; the current line is enlarged
- **Translation toggle** — one click to hide/show
- **Hover to seek** — hovering a line reveals `▶ 0'47''`; click the ▶ to jump there
- **Scroll & drag** — wheel or drag to browse; snaps back to the current line after 4s
- **Cover expansion** — click the album art to enlarge it; lyrics shift right and scale down
- **9 color schemes** — 3×3 palette
- **Local cache** — each track is fetched once
- **No account needed** — no QQ Music login, no API keys

---

## Installation

### Requirements

| Need | Notes |
|---|---|
| Windows | Desktop only |
| [Spotify (official installer)](https://www.spotify.com/download/windows/) | **Microsoft Store version is not supported** |
| [Node.js](https://nodejs.org/) | LTS is fine |
| [Spicetify](https://spicetify.app/) | Installed automatically by the script |

### One-click install

```powershell
# After downloading this repository, right-click install.ps1 → Run with PowerShell
.\install.ps1
```

The script will:

1. Check Node.js / Spotify / Spicetify
2. Install app files to `%LOCALAPPDATA%\LyricLume`
3. Install the extension to `%APPDATA%\spicetify\Extensions\lyriclume.js`
4. Register it in the Spicetify config and apply the patch
5. Create a startup entry that launches the local proxy **only when Spotify starts**

After installing, **fully quit Spotify** (including the tray icon) and reopen it.

### Manual install

<details>
<summary>Expand</summary>

```powershell
# 1. Install Spicetify
iwr -useb https://raw.githubusercontent.com/spicetify/cli/main/install.ps1 | iex
spicetify backup apply

# 2. Copy files
New-Item -ItemType Directory -Force "$env:LOCALAPPDATA\LyricLume\server"
Copy-Item .\server\*.mjs "$env:LOCALAPPDATA\LyricLume\server"
Copy-Item .\extension\lyriclume.js "$env:APPDATA\spicetify\Extensions\"

# 3. In %APPDATA%\spicetify\config-xpui.ini set
#    extensions = lyriclume.js

# 4. Re-apply
spicetify apply

# 5. Start the proxy
node "$env:LOCALAPPDATA\LyricLume\server\proxy.mjs"
```

</details>

---

## Usage

1. Play any track
2. Click the **Lyrics** button in the player bar to open Spotify's lyrics panel
3. A green **译光** button appears in the panel header — click it
4. The full-screen view expands from that button

| Action | Effect |
|---|---|
| `Ctrl + Shift + L` | Open / close the lyrics view |
| `Esc` | Close |
| ⌄ (top-left) | Close |
| 译 button | Show / hide translation |
| Click album art | Enlarge cover, shift lyrics right |
| Wheel / drag | Scroll lyrics manually |
| Hover a line | Shows `▶ time`; click ▶ to seek |

---

## How it works

```
Spotify client
   │  extension injected by Spicetify
   ├─ reads the current track (title / artist / duration)
   │
   ├─→ http://127.0.0.1:8787  (local proxy, Node)
   │        ├─ searches QQ Music, scores candidates by duration + artist + title
   │        ├─ fetches QRC word-level lyrics + translation LRC
   │        ├─ 3DES decrypt + zlib inflate
   │        └─ returns normalized JSON
   │
   └─ renders: per-word sweep + synced translation
```

**Why a local proxy?** Spotify's renderer has no Node access and is subject to CORS, so it cannot call QQ Music directly. The proxy listens on `127.0.0.1:8787` only.

**Why not Spotify's own lyrics?** They come from Musixmatch and almost never include Chinese translations for Japanese songs. QQ Music's translations are user-contributed and much better.

---

## Known limitations

- **Windows desktop only** — no mobile or web player
- Depends on Spotify's client structure; a major update may require re-running `spicetify apply`
- QQ Music's endpoints are unofficial and may change
- Some tracks have no lyrics or no translation on QQ Music
- Covers / live versions / instrumentals may match the wrong track

---

## Development

```
lyriclume/
├─ src/
│  ├─ lyriclume.src.js     extension source (CSS placeholder __QQL_CSS__)
│  └─ style.css            styles
├─ tools/build.mjs         build: inlines CSS into the source
├─ extension/lyriclume.js  build output (what Spicetify loads)
├─ server/
│  ├─ proxy.mjs            local HTTP proxy
│  ├─ qq.mjs               QQ Music search / lyrics / matching
│  └─ qrc-des.mjs          QRC decryption (3DES + zlib)
├─ install.ps1
├─ uninstall.ps1
└─ docs/
```

**Build + install:**

```powershell
node tools/build.mjs
Copy-Item .\extension\lyriclume.js "$env:APPDATA\spicetify\Extensions\"
spicetify apply
```

Edit `src/style.css` for styles and `src/lyriclume.src.js` for logic. **Do not edit `extension/lyriclume.js` directly** — it is overwritten on every build.

---

## Credits

- [Spicetify](https://github.com/spicetify/cli) — makes all of this possible
- [LDDC](https://github.com/chenmozhijin/LDDC) — reference implementation for QRC decryption
- [applemusic-like-lyrics](https://github.com/amll-dev/applemusic-like-lyrics) — lyric format references

---

## License

[GPL-3.0](LICENSE). The QRC decryption part is ported from GPL-3.0 licensed LDDC, so this project is GPL-3.0 as well.

Not affiliated with Spotify or Tencent Music. Lyrics copyright belongs to their respective owners; this tool only fetches and displays them in real time, without storing or redistributing the content.
