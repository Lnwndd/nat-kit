@echo off
sc stop cloudflared >nul 2>&1
rename "C:\Users\tgtt1\AppData\Local\Temp\cloudflared-windows-amd64.exe" cloudflared-windows-amd64.exe.old
rename "C:\Users\tgtt1\AppData\Local\Temp\cloudflared-windows-amd64.exe.new" cloudflared-windows-amd64.exe
del "C:\Users\tgtt1\AppData\Local\Temp\cloudflared-windows-amd64.exe.old"
sc start cloudflared >nul 2>&1
del cfd_update.bat