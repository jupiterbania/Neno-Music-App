<p align="center">
  <img width="130px" src="assets/img/Logo.png" alt="Neno Music" />
</p>

<h1 align="center">Neno Music</h1>

<p align="center">
  <b>A fast, modern, and beautiful music streaming client powered by YouTube Music.</b><br />
  Built with Tauri v2, Rust, React, and TypeScript for <b>Android, iOS, Windows, macOS, and Linux</b>.
</p>

<p align="center">
  <a href="https://github.com/jupiterbania/Neno-Music-App/releases/latest"><img src="https://img.shields.io/badge/version-v1.0.1-ff3d00?style=for-the-badge" alt="Version 1.0.1"></a>
  <a href="https://github.com/jupiterbania/Neno-Music-App/releases/latest"><img src="https://img.shields.io/badge/platform-Android%20%7C%20iOS%20%7C%20Windows%20%7C%20macOS%20%7C%20Linux-4f46e5?style=for-the-badge" alt="Platforms"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-0ea5e9?style=for-the-badge" alt="License"></a>
  <a href="https://github.com/jupiterbania/Neno-Music-App/stargazers"><img src="https://img.shields.io/github/stars/jupiterbania/Neno-Music-App?style=for-the-badge&color=ff9700&label=stars" alt="Stars"></a>
</p>

---

## 🎧 About Neno

**Neno** is a lightweight, ad-free, high-performance music application that delivers the entire YouTube Music catalog into a native, responsive, and gorgeous experience. Unlike web tabs and heavy Electron apps, Neno is powered by **Tauri 2** and a **Rust** backend, ensuring instant startup times, minimal memory consumption, and true native desktop and mobile capabilities.

Whether you're listening on your desktop while gaming or coding, or streaming on your Android smartphone with background playback and lock-screen controls, Neno offers a seamless and premium listening journey.

> [!NOTE]
> Neno is an independent, community-driven open-source project and is not affiliated with, authorized, or endorsed by Google or YouTube.

---

## 📸 Screenshots

<div align="center">
  <table>
    <tr>
      <td align="center" width="50%">
        <img src="assets/Screenshoots/Home%20screen.jpg" alt="Home Dashboard" width="360" />
        <br />
        <sub><b>🏠 Home Dashboard</b></sub>
      </td>
      <td align="center" width="50%">
        <img src="assets/Screenshoots/Music%20Player.jpg" alt="Now Playing & Lyrics" width="360" />
        <br />
        <sub><b>🎵 Now Playing & Synced Lyrics</b></sub>
      </td>
    </tr>
    <tr>
      <td align="center" width="50%">
        <img src="assets/Screenshoots/ArtistAlbum%20Screen.jpg" alt="Artist & Album View" width="360" />
        <br />
        <sub><b>💿 Artist & Album Details</b></sub>
      </td>
      <td align="center" width="50%">
        <img src="assets/Screenshoots/Search%20Screen.jpg" alt="Search & Discovery" width="360" />
        <br />
        <sub><b>🔍 Search & Curated Moods</b></sub>
      </td>
    </tr>
    <tr>
      <td align="center" colspan="2">
        <img src="assets/Screenshoots/Satting%20Login%20Screen.jpg" alt="Settings & Account" width="360" />
        <br />
        <sub><b>⚙️ Settings & Account Sync</b></sub>
      </td>
    </tr>
  </table>
</div>

---

## ✨ Features

### 🚀 Instant Performance & Clean Experience
- **Lightning-Fast Launch**: Opens directly into your music home dashboard without sluggish reload delays or frozen state.
- **Ultra-Low Memory Footprint**: Native Rust architecture utilizes a fraction of the RAM required by typical browser or Electron clients.
- **Zero Audio Ads**: Clean and uninterrupted music playback throughout your entire library.

### 📱 Android Background Playback & Native Integration
- **Background Audio Service**: Keep listening when your screen is turned off or while using other apps.
- **Lock Screen & Media Controls**: Rich notifications with play, pause, next, previous, and seekbar controls via Android `MediaSession`.
- **Audio Focus Management**: Automatically pauses when you receive a phone call and gracefully resumes when finished.

### 🎵 High-Fidelity Audio & Dual Audio Engine
- **Audio Quality Selection**: Stream at High Quality (256 kbps), Standard Quality, or Low (Data Saver) mode.
- **Dual Audio Pipeline**: Choose between native high-performance Rust audio processing (Rodio & Symphonia) or standard Web engine.
- **Smart Gapless & Crossfade**: Smooth transitions between songs for DJ-like continuous flow.

### 🎤 Real-Time Synced Karaoke Lyrics
- **Line-by-Line Synchronized Lyrics**: Words highlight in real-time as the artist sings.
- **Interactive Lyric Seeking**: Tap or click any lyric line to instantly jump to that part of the song.
- **Lyric Timing Offset**: Fine-tune sync delay (+/- ms) if lyrics are slightly ahead or behind.
- **Multilingual Translation**: View automatic translations in over 20+ languages beneath original lyrics.

### 💾 Offline Downloads & Storage Manager
- **One-Click Offline Downloads**: Download individual tracks, entire albums, or custom playlists to listen without an internet connection.
- **Configurable Storage Ceiling**: Set maximum disk usage caps (e.g. 2 GB, 8 GB, etc.) with automatic smart cache management.

### 📊 Last.fm & Discord Rich Presence
- **Discord Rich Presence**: Show friends what you're listening to in real-time on Discord, complete with album art and track progress.
- **Last.fm Scrobbling**: Automatically scrobble tracks to your Last.fm profile with toggleable settings.

### 🔍 Powerful Search & Discovery
- **Instant Search**: Search through millions of songs, albums, artists, and community playlists.
- **Curated Moods & Genres**: Explore charts, new releases, chill, workout, party, and focus categories.
- **Quick Keyboard Shortcuts**: Access search instantly with `Ctrl + Space` from anywhere in the app.

### 🎨 Sleek Modern UI & Customization
- **Theme Support**: Sleek obsidian dark mode and clean light theme that match your system preferences.
- **Mini Player**: Detachable floating compact player window with hover expand controls.
- **Local Files & Tagging**: Play music stored on your local disk alongside streaming tracks.

---

## 📥 Downloads & Installation

Pre-built binaries and packages are available on the **[Releases Page](https://github.com/jupiterbania/Neno-Music-App/releases/latest)**.

### 📱 Android APK
Download the appropriate APK file for your phone or tablet:
- **`app-arm64-release.apk`**: Recommended for almost all modern Android phones (64-bit ARM).
- **`app-arm-release.apk`**: For older 32-bit ARM devices.
- **`app-universal-release.apk`**: Universal APK for all Android architectures.

> **Installation Note**: Enable "Install unknown apps" in your Android settings for your browser or file manager when installing the APK for the first time.

### 🍏 iOS (iPhone & iPad)
Download the iOS package from the **[Releases Page](https://github.com/jupiterbania/Neno-Music-App/releases/latest)**:
- **`neno-ios-build.zip`**: Compiled iOS application bundle (Ready to sideload onto your iPhone/iPad via **AltStore**, **Sideloadly**, or **TrollStore**).
- **`neno-xcode-project.zip`**: Full Xcode source project for compiling & debugging directly in Xcode on a Mac.

### 💻 Desktop (Windows, macOS, Linux)
- **Windows**: Download the `.msi` installer or standalone `.exe` setup from releases.
- **Linux**: Available in `.deb`, `.rpm`, `.AppImage`, and Arch Linux AUR (`yay -S neno`).
- **macOS**: Download the `.dmg` package from releases.

---

## 🛠️ Tech Stack & Architecture

| Layer | Technologies Used |
|---|---|
| **Core Shell** | [Tauri 2](https://v2.tauri.app/) · Rust 2021 |
| **Audio Processing** | Rodio · Symphonia (Opus / Matroska / Ogg) · AAudio (Android) |
| **Frontend Framework** | React 19 · TypeScript · Vite 7 |
| **Styling & Motion** | Tailwind CSS · Framer Motion · Solar Icons |
| **Media Bridge** | Android MediaSessionCompat · WebKit Bridge · Linux MPRIS / D-Bus |

---

## 🧑‍💻 Building from Source

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or newer)
- [Rust](https://rustup.rs/) (stable channel)
- For Android builds: Android SDK, NDK (27+), and Java 17+

### 1. Clone the repository
```bash
git clone https://github.com/jupiterbania/Neno-Music-App.git
cd Neno-Music-App
```

### 2. Install dependencies
```bash
npm install
```

### 3. Run development mode
```bash
npm run dev
# Or with Tauri desktop window:
npm run tauri dev
```

### 4. Build release packages
```bash
# Build desktop release
npm run tauri build

# Build split Android APKs
npx tauri android build --apk --split-per-abi
```

---

## 🛡️ License

This project is licensed under the **Apache License, Version 2.0**. See the [LICENSE](LICENSE) file for complete terms.

```
Copyright 2026 Neno Music App Contributors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

---

<p align="center">
  Made with ❤️ for music lovers everywhere.
</p>
