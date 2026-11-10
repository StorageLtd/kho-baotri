@echo off
if exist "%~dp0START-MANAGER.cmd" (
  call "%~dp0START-MANAGER.cmd"
) else if exist "%~dp0..\fanuc-bridge-manager\START-MANAGER.cmd" (
  call "%~dp0..\fanuc-bridge-manager\START-MANAGER.cmd"
) else (
  echo Download the integrated Bridge Manager and open START-MANAGER.cmd.
  pause
)
