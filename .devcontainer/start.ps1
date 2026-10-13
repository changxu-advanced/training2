$ErrorActionPreference = 'Stop'
$taskWorkspace = Split-Path -Parent $PSScriptRoot
$env:COMPOSE_DISABLE_ENV_FILE = 'true'
$taskExtension = Get-ChildItem -LiteralPath (Join-Path $env:USERPROFILE '.vscode/extensions') -Directory -Filter 'ms-vscode-remote.remote-containers-*' |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
if (-not $taskExtension) { throw 'Install the VS Code Dev Containers extension first.' }
$taskCli = Join-Path $taskExtension.FullName 'dist/spec-node/devContainersSpecCLI.js'
$taskNode = Get-Command node -ErrorAction SilentlyContinue
if (-not $taskNode) { throw 'This launcher requires an existing Node runtime on Windows. It does not install project dependencies on Windows.' }
docker info --format '{{.ServerVersion}}'
if ($LASTEXITCODE -ne 0) { throw 'Start Docker Desktop before running this launcher.' }
& $taskNode.Source $taskCli up --workspace-folder $taskWorkspace
if ($LASTEXITCODE -ne 0) { throw 'Development container startup failed.' }
$taskReference = '{"containerName":"/training2-app-1"}'
$taskHex = -join ([System.Text.Encoding]::UTF8.GetBytes($taskReference) | ForEach-Object { $_.ToString('x2') })
code --new-window --folder-uri "vscode-remote://attached-container+$taskHex/workspaces/training2"
if ($LASTEXITCODE -ne 0) { throw 'VS Code could not open the container workspace.' }
