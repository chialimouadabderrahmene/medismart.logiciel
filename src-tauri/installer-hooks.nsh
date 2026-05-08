; MediSmart installer hooks
; Kills running processes before file extraction to prevent "Error opening file for writing"

!macro NSIS_HOOK_PREINSTALL
  ; Kill cloudflared to allow overwriting cloudflared.exe
  nsExec::ExecToLog 'taskkill /f /im cloudflared.exe'
  ; Kill main app if still running
  nsExec::ExecToLog 'taskkill /f /im cardio_cabinet_pro.exe'
  Sleep 2000
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ; Kill processes before uninstall too
  nsExec::ExecToLog 'taskkill /f /im cloudflared.exe'
  nsExec::ExecToLog 'taskkill /f /im cardio_cabinet_pro.exe'
  Sleep 1000
!macroend
