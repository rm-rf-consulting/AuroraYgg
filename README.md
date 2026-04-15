# AuroraYgg

Modern DC++ file sharing client for the [Yggdrasil](https://yggdrasil-network.github.io/) mesh network. Fork of [AirDC++ webclient](https://github.com/airdcpp-web/airdcpp-webclient) with a completely rewritten UI, invite-based access control, and native desktop app.

## What is this?

AuroraYgg brings back the DC++ file sharing experience on top of Yggdrasil -- an encrypted IPv6 overlay network that works without centralized infrastructure. Every node on Yggdrasil is directly routable (no NAT, no UPnP), making it ideal for peer-to-peer file sharing.

## Screenshots

> *Aurora features an Apple-inspired dark UI with glass navigation, real-time transfers, and a command palette.*

## Quick Start

### Desktop App (Windows)

Download `Aurora_0.1.0_x64-setup.exe` from Releases and install. The app bundles the web UI in a native window via Tauri.

### Web UI

```bash
cd aurora-ui
npm install
npm run dev        # Dev server on http://localhost:3000
npm run build      # Production build → dist/
npm run deploy     # Copy build to daemon web-resources/
```

### Daemon

```bash
# Start the daemon
airdcppd.exe -c=path/to/config -p 5600

# Aurora UI connects to ws://localhost:5600/api/v1/
```

Default login: configure on first run with `airdcppd.exe --configure`

## Features

### UI (aurora-ui/)

| Feature | Status |
|---------|--------|
| Dashboard with live transfer stats | Done |
| File search with real-time WebSocket results | Done |
| Download queue with 6 priority levels | Done |
| Active transfers with disconnect controls | Done |
| Hub chat with user list, filter, filelist browse | Done |
| Private messaging | Done |
| Share management (add/remove directories) | Done |
| Filelist browser with folder download | Done |
| Events/log viewer with severity filters | Done |
| Favorite hubs | Done |
| Settings editor (editable + save) | Done |
| Yggdrasil Peer Manager (auto-fetch from GitHub) | Done |
| Admin panel (user CRUD, 26 permissions, sessions) | Done |
| Invite system (generate codes, registration page) | Done |
| Command Palette (Cmd+K) | Done |
| Toast notification system | Done |
| Auth persistence (refresh token) | Done |
| Responsive layout (mobile sidebar) | Done |
| Keyboard shortcuts | Done |

### Backend (C++ daemon)

| Feature | Status |
|---------|--------|
| AirDC++ full protocol (ADC/NMDC) | Done |
| Yggdrasil auto-detection (200::/7) | Done |
| REST + WebSocket API | Done |
| Invite system (create/redeem/revoke) | Done |
| Public registration endpoint | Done |
| 26 granular permissions | Done |
| Session management + force logout | Done |
| Rate limiting (5 attempts/45s per IP) | Done |

### Desktop (Tauri v2)

| Feature | Status |
|---------|--------|
| Native Windows app (8.3 MB) | Done |
| NSIS installer (1.9 MB) | Done |
| MSI installer (2.8 MB) | Done |
| Auto-generated app icons | Done |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4 |
| State | Zustand, React Router 7 |
| Design | Apple-inspired dark theme, SF Pro, glass effects |
| API Client | airdcpp-apisocket v3 (WebSocket + REST) |
| Backend | C++ (AirDC++ fork), Boost, WebSocket++, nlohmann-json |
| Desktop | Tauri v2, Rust |
| Icons | Lucide React |

## Project Structure

```
AuroraYgg/
├── aurora-ui/                   # New React frontend
│   ├── src/
│   │   ├── api/                 # WebSocket connection singleton
│   │   ├── stores/              # Zustand stores (auth, hubs, transfers)
│   │   ├── components/
│   │   │   ├── layout/          # AppShell, GlassNav, Sidebar
│   │   │   └── shared/          # CommandPalette, Toast, ErrorBoundary
│   │   ├── pages/               # 16 pages (Dashboard, Search, Queue, ...)
│   │   ├── services/            # Peer parser (GitHub API)
│   │   └── hooks/               # Global hotkeys
│   ├── server/                  # Vite middleware (peer management API)
│   ├── src-tauri/               # Tauri desktop wrapper
│   └── scripts/                 # Deploy script
├── airdcpp-webclient/           # C++ daemon (forked)
│   ├── airdcpp-core/            # Protocol library
│   ├── airdcpp-webapi/          # REST/WS API + invite system
│   └── airdcppd/                # Console daemon
├── DESIGN.md                    # Apple design system reference
└── testconfig/                  # Dev configuration
```

## Building from Source

### Prerequisites

- **Frontend:** Node.js 20+, npm
- **Desktop:** Rust 1.77+, Tauri CLI v2 (`cargo install tauri-cli`)
- **Backend:** Visual Studio 2022 (C++ workload), vcpkg, CMake

### Frontend

```bash
cd aurora-ui
npm install
npm run build
```

### Desktop App

```bash
cd aurora-ui
cargo tauri build
# Output: src-tauri/target/release/bundle/nsis/Aurora_0.1.0_x64-setup.exe
```

### C++ Daemon

```bash
cd airdcpp-webclient/build
cmake --build . --config RelWithDebInfo --target airdcppd
```

See detailed C++ build instructions in the [Building on Windows](#building-on-windows-detailed) section below.

## Yggdrasil Setup

1. Install [Yggdrasil](https://github.com/yggdrasil-network/yggdrasil-go/releases) (v0.5+)
2. Start the Yggdrasil service
3. Open Aurora UI → **Ygg Peers** page → select peers by region → **Apply & Restart**

The Peer Manager fetches public peers from [yggdrasil-network/public-peers](https://github.com/yggdrasil-network/public-peers) — 379 peers across 34 countries, filterable by protocol (TLS/TCP/QUIC).

## Invite System

Aurora uses invite-based registration:

1. Admin opens **Admin → Invites** tab
2. Clicks **Generate Code** (24h / 3d / 7d / 30d expiry)
3. Copies the invite link
4. New user opens the link → fills username + password → account created
5. New user inherits permissions from the invite code

API:
```
POST /api/v1/web_users/invites          # Create invite (admin)
GET  /api/v1/web_users/invites          # List invites (admin)
DELETE /api/v1/web_users/invites/{code}  # Revoke (admin)
POST /api/v1/web_users/register          # Redeem invite (public)
```

## Roadmap

### Done
- [x] Yggdrasil-native transport (auto-detection, direct connection)
- [x] Modern UI (React 19, dark theme, 16 pages)
- [x] Desktop client (Tauri v2)
- [x] Invite-based access control
- [x] Yggdrasil peer management

### Next
- [ ] Hub discovery (DHT-like, bootstrap hubs)
- [ ] Docker for NAS (ARM64 + AMD64)
- [ ] E2E encryption (Signal/Noise protocol)
- [ ] `aurora://` URI scheme + `magnet:` backward compatibility
- [ ] Media streaming (range requests, built-in player)
- [ ] Built-in mini-hub (P2P without central hub)
- [ ] Extension marketplace

## Building on Windows (Detailed)

### Install C++ dependencies

```bash
git clone https://github.com/microsoft/vcpkg.git D:\vcpkg
D:\vcpkg\bootstrap-vcpkg.bat

D:\vcpkg\vcpkg.exe install --triplet x64-windows ^
  boost-regex boost-thread boost-system boost-format boost-variant boost-uuid ^
  boost-pool boost-bimap boost-date-time boost-logic boost-range boost-algorithm ^
  boost-asio bzip2 zlib openssl miniupnpc leveldb libmaxminddb ^
  nlohmann-json minizip

git clone -b develop https://github.com/amini-allight/websocketpp.git
cd websocketpp && mkdir build && cd build
cmake .. -G "Visual Studio 17 2022" -A x64 ^
  -DCMAKE_INSTALL_PREFIX="D:\vcpkg\installed\x64-windows" ^
  -DBUILD_TESTS=OFF -DBUILD_EXAMPLES=OFF
cmake --build . --target INSTALL --config Release
```

### Configure and build daemon

```bash
cd airdcpp-webclient && mkdir build && cd build

cmake .. -G "Visual Studio 17 2022" -A x64 ^
  -DCMAKE_TOOLCHAIN_FILE="D:\vcpkg\scripts\buildsystems\vcpkg.cmake" ^
  -DVCPKG_INSTALLED_DIR="D:\vcpkg\installed" ^
  -DVCPKG_TARGET_TRIPLET="x64-windows" ^
  -DBUILD_SHARED_LIBS=OFF -DINSTALL_WEB_UI=OFF -DENABLE_NATPMP=OFF ^
  -Wno-dev

cmake --build . --config RelWithDebInfo --parallel
```

### Deploy Aurora UI to daemon

```bash
cd aurora-ui
npm run deploy
# Copies dist/ → airdcpp-webclient/build/airdcppd/RelWithDebInfo/web-resources/
```

## License

GPL-2.0 (inherited from AirDC++)
