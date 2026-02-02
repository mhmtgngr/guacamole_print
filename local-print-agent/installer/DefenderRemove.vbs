Set shell = CreateObject("Shell.Application")
shell.ShellExecute "powershell.exe", "-NoProfile -Command ""Remove-MpPreference -ExclusionPath 'C:\Program Files\GuacamolePrintAgent'; Remove-MpPreference -ExclusionProcess 'GuacamolePrintAgent.exe'""", "", "runas", 0
