; Aurora NSIS Installer Hooks
; Handles: Yggdrasil installation, daemon service setup, config creation

!macro NSIS_HOOK_POSTINSTALL
  ; --- 1. Install Yggdrasil if not present ---
  nsExec::ExecToLog 'sc query yggdrasil'
  Pop $0
  ${If} $0 != 0
    DetailPrint "Installing Yggdrasil..."
    ; Find the bundled MSI
    FindFirst $1 $2 "$INSTDIR\resources\yggdrasil-*.msi"
    ${If} $2 != ""
      nsExec::ExecToLog 'msiexec /i "$INSTDIR\resources\$2" /quiet /norestart'
      Pop $0
      ${If} $0 == 0
        DetailPrint "Yggdrasil installed successfully"
      ${Else}
        DetailPrint "Yggdrasil installation failed (code: $0). Install manually from https://yggdrasil-network.github.io/"
      ${EndIf}
    ${Else}
      DetailPrint "Yggdrasil MSI not found in bundle"
    ${EndIf}
    FindClose $1
  ${Else}
    DetailPrint "Yggdrasil already installed"
  ${EndIf}

  ; --- 2. Create config directory ---
  CreateDirectory "$APPDATA\Aurora"

  ; Copy default configs if they don't exist yet
  ${IfNot} ${FileExists} "$APPDATA\Aurora\web-server.json"
    CopyFiles /SILENT "$INSTDIR\resources\default-config\web-server.json" "$APPDATA\Aurora\"
  ${EndIf}
  ${IfNot} ${FileExists} "$APPDATA\Aurora\web-users.json"
    CopyFiles /SILENT "$INSTDIR\resources\default-config\web-users.json" "$APPDATA\Aurora\"
  ${EndIf}

  ; --- 3. Copy DLLs next to daemon executable ---
  CopyFiles /SILENT "$INSTDIR\resources\dlls\*.dll" "$INSTDIR\"

  ; --- 4. Install daemon as Windows service ---
  DetailPrint "Installing Aurora daemon service..."

  ; Stop existing service if upgrading
  nsExec::ExecToLog '"$INSTDIR\resources\nssm.exe" stop AuroraDaemon'

  ; Install service
  nsExec::ExecToLog '"$INSTDIR\resources\nssm.exe" install AuroraDaemon "$INSTDIR\airdcppd.exe" "-c=$APPDATA\Aurora" "-p=5600"'
  Pop $0

  ${If} $0 == 0
    ; Configure service
    nsExec::ExecToLog '"$INSTDIR\resources\nssm.exe" set AuroraDaemon DisplayName "Aurora DC++ Daemon"'
    nsExec::ExecToLog '"$INSTDIR\resources\nssm.exe" set AuroraDaemon Description "AuroraYgg DC++ file sharing daemon for Yggdrasil mesh network"'
    nsExec::ExecToLog '"$INSTDIR\resources\nssm.exe" set AuroraDaemon Start SERVICE_AUTO_START'
    nsExec::ExecToLog '"$INSTDIR\resources\nssm.exe" set AuroraDaemon AppStdout "$APPDATA\Aurora\Logs\daemon-stdout.log"'
    nsExec::ExecToLog '"$INSTDIR\resources\nssm.exe" set AuroraDaemon AppStderr "$APPDATA\Aurora\Logs\daemon-stderr.log"'
    nsExec::ExecToLog '"$INSTDIR\resources\nssm.exe" set AuroraDaemon AppRotateFiles 1'
    nsExec::ExecToLog '"$INSTDIR\resources\nssm.exe" set AuroraDaemon AppRotateBytes 1048576'

    ; Create log directory
    CreateDirectory "$APPDATA\Aurora\Logs"

    ; Start service
    nsExec::ExecToLog '"$INSTDIR\resources\nssm.exe" start AuroraDaemon'
    Pop $0
    ${If} $0 == 0
      DetailPrint "Aurora daemon service started"
    ${Else}
      DetailPrint "Service installed but failed to start (code: $0)"
    ${EndIf}
  ${Else}
    DetailPrint "Failed to install service (code: $0). The daemon can be started manually."
  ${EndIf}

  DetailPrint "Installation complete!"
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ; --- Stop and remove the daemon service ---
  DetailPrint "Stopping Aurora daemon service..."
  nsExec::ExecToLog '"$INSTDIR\resources\nssm.exe" stop AuroraDaemon'
  nsExec::ExecToLog '"$INSTDIR\resources\nssm.exe" remove AuroraDaemon confirm'
  DetailPrint "Aurora daemon service removed"

  ; NOTE: We do NOT uninstall Yggdrasil — user may use it for other things
  ; NOTE: We do NOT delete %APPDATA%\Aurora\ — user's config and data
  ; The NSIS uninstaller will handle removing $INSTDIR files
!macroend
