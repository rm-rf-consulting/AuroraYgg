# AuroraYgg

DC++ file sharing client for the [Yggdrasil](https://yggdrasil-network.github.io/) mesh network. Fork of [AirDC++ webclient](https://github.com/airdcpp-web/airdcpp-webclient) with native Yggdrasil transport support.

## What is this?

AuroraYgg brings back the DC++ file sharing experience on top of Yggdrasil -- an encrypted IPv6 overlay network that works without centralized infrastructure. Every node on Yggdrasil is directly routable (no NAT, no UPnP), making it ideal for peer-to-peer file sharing.

**Current status:** Early development. Windows build working, Yggdrasil auto-detection functional.

## Features (implemented)

- Full AirDC++ webclient functionality (ADC/NMDC protocols, web UI, REST API)
- Yggdrasil network auto-detection (`200::/7` address range)
- Direct connection mode on Yggdrasil (no UPnP needed)
- Windows x64 build with MSVC
- Web UI accessible at `http://127.0.0.1:5600`

## Features (planned)

See the full [roadmap](#roadmap) below.

## Building on Windows

### Prerequisites

- Visual Studio 2022 (C++ workload)
- [vcpkg](https://github.com/microsoft/vcpkg) package manager
- Python 3.x
- Node.js + npm
- Git

### Install dependencies

```bash
# Clone vcpkg
git clone https://github.com/microsoft/vcpkg.git D:\vcpkg
D:\vcpkg\bootstrap-vcpkg.bat

# Install C++ dependencies
D:\vcpkg\vcpkg.exe install --triplet x64-windows ^
  boost-regex boost-thread boost-system boost-format boost-variant boost-uuid ^
  boost-pool boost-bimap boost-date-time boost-logic boost-range boost-algorithm ^
  boost-asio bzip2 zlib openssl miniupnpc leveldb libmaxminddb ^
  nlohmann-json minizip

# Install websocketpp (custom fork required by AirDC++)
git clone -b develop https://github.com/amini-allight/websocketpp.git
cd websocketpp && mkdir build && cd build
cmake .. -G "Visual Studio 17 2022" -A x64 -DCMAKE_INSTALL_PREFIX="D:\vcpkg\installed\x64-windows" -DBUILD_TESTS=OFF -DBUILD_EXAMPLES=OFF
cmake --build . --target INSTALL --config Release
```

### Configure and build

```bash
cd airdcpp-webclient
mkdir build && cd build

cmake .. -G "Visual Studio 17 2022" -A x64 ^
  -DCMAKE_TOOLCHAIN_FILE="D:\vcpkg\scripts\buildsystems\vcpkg.cmake" ^
  -DVCPKG_INSTALLED_DIR="D:\vcpkg\installed" ^
  -DVCPKG_TARGET_TRIPLET="x64-windows" ^
  -DBUILD_SHARED_LIBS=OFF ^
  -DINSTALL_WEB_UI=OFF ^
  -DENABLE_NATPMP=OFF ^
  -DBZIP2_LIBRARY_RELEASE="D:\vcpkg\installed\x64-windows\lib\bz2.lib" ^
  -DBZIP2_LIBRARY_DEBUG="D:\vcpkg\installed\x64-windows\debug\lib\bz2d.lib" ^
  -DBZIP2_INCLUDE_DIR="D:\vcpkg\installed\x64-windows\include" ^
  -DZLIB_LIBRARY_RELEASE="D:\vcpkg\installed\x64-windows\lib\zlib.lib" ^
  -DZLIB_LIBRARY_DEBUG="D:\vcpkg\installed\x64-windows\debug\lib\zlibd.lib" ^
  -DZLIB_INCLUDE_DIR="D:\vcpkg\installed\x64-windows\include" ^
  -DOPENSSL_ROOT_DIR="D:\vcpkg\installed\x64-windows" ^
  -DOPENSSL_CRYPTO_LIBRARY="D:\vcpkg\installed\x64-windows\lib\libcrypto.lib" ^
  -DOPENSSL_SSL_LIBRARY="D:\vcpkg\installed\x64-windows\lib\libssl.lib" ^
  -DOPENSSL_INCLUDE_DIR="D:\vcpkg\installed\x64-windows\include" ^
  -DLIB_EAY_RELEASE="D:\vcpkg\installed\x64-windows\lib\libcrypto.lib" ^
  -DSSL_EAY_RELEASE="D:\vcpkg\installed\x64-windows\lib\libssl.lib" ^
  -DLIB_EAY_DEBUG="D:\vcpkg\installed\x64-windows\debug\lib\libcrypto.lib" ^
  -DSSL_EAY_DEBUG="D:\vcpkg\installed\x64-windows\debug\lib\libssl.lib" ^
  -Wno-dev

cmake --build . --config RelWithDebInfo --parallel
```

### Install Web UI and run

```bash
# Install web UI
cd airdcpp-webclient
npm install --ignore-scripts --prefix . airdcpp-webui@2.14.0

# Copy resources next to exe
xcopy /E /I node_modules\airdcpp-webui\dist build\airdcppd\RelWithDebInfo\web-resources
copy D:\vcpkg\installed\x64-windows\bin\*.dll build\airdcppd\RelWithDebInfo\

# First run: configure
build\airdcppd\RelWithDebInfo\airdcppd.exe --configure

# Run the client
build\airdcppd\RelWithDebInfo\airdcppd.exe --no-autoconnect
```

Open `http://127.0.0.1:5600` in your browser.

## Yggdrasil Setup

1. Install [Yggdrasil](https://github.com/yggdrasil-network/yggdrasil-go/releases) (v0.5.x)
2. Start the Yggdrasil service
3. AuroraYgg will auto-detect the Yggdrasil adapter and enable direct IPv6 connectivity

The client detects Yggdrasil addresses (`200::/7`) automatically and configures direct connection mode -- no port forwarding or UPnP required.

## Architecture

```
airdcpp-webclient/            # Forked AirDC++ webclient
  airdcpp-core/               # C++ protocol library (ADC, NMDC, file sharing)
    airdcpp/
      connection/             # Socket layer (raw Berkeley sockets, SSL)
      connectivity/           # Network detection, UPnP (+ Yggdrasil detection)
      util/NetworkUtil.*      # IP classification (+ isYggdrasilIp)
      hub/, search/, queue/   # DC++ protocol implementation
  airdcpp-webapi/             # REST + WebSocket API (40 endpoints)
  airdcppd/                   # Console daemon (Windows + Linux)
```

### Changes from upstream AirDC++

**Yggdrasil integration:**
- `NetworkUtil::isYggdrasilIp()` -- detects `200::/7` address range
- Adapter filter expanded to include TUN/virtual adapters (IfType 53, 131, 23)
- `ConnectivityManager` auto-detects Yggdrasil and sets direct connection mode

**Windows port:**
- `main.cpp` -- platform-compatible entry point (`SetConsoleCtrlHandler`, `GetModuleFileName`)
- `ConfigPrompt.cpp` -- Windows `SetConsoleMode` for password input
- `CMakeLists.txt` -- MSVC compatibility (adapter filter, linker flags, Find modules)

## Roadmap

### Tier 1 -- Core (required for launch)
1. ~~Yggdrasil-native transport~~ (done)
2. Hub discovery (DHT-like, bootstrap hubs)
3. Modern UI redesign (dark theme, media preview)
4. Desktop client via Tauri

### Tier 2 -- Security
5. E2E encryption (Signal/Noise protocol)
6. Cryptographic identity (Ed25519, Web of Trust)

### Tier 3 -- UX
7. Built-in messenger (markdown, reactions)
8. Smart search (metadata, tags)
9. Media streaming (range requests, built-in player)
10. `aurora://` URI scheme (backward-compatible with `magnet:` links)

### Tier 4 -- Ecosystem
11. Built-in mini-hub (peer-to-peer without central hub)
12. Extension marketplace
13. Docker-first for NAS (ARM64+AMD64, Helm)

## License

GPL-2.0 (inherited from AirDC++)
