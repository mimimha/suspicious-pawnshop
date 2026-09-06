<#
.SYNOPSIS
    Hands the instruction in .handoff/task.md to the Claude Code CLI and tracks
    run state in .handoff/state.json.

.DESCRIPTION
    Minimal handoff runner for the vive-pawnshop project.

        .handoff/task.md
          -> state.json = working
          -> claude -p
          -> state.json = completed | ready_for_playtest | failed | waiting_for_decision
          -> .handoff/history/<timestamp>/

    This script only ever reads the project's own task.md. It does NOT accept or
    execute arbitrary commands from anywhere, and it never leaves the project root.

.PARAMETER TaskFile
    Task file to hand off. Defaults to <repo>/.handoff/task.md.

.PARAMETER ClaudeCommand
    Path to the Claude Code CLI. When omitted, the CLI is resolved in this order:
      1. 'claude' on PATH
      2. the CLI bundled with the VS Code extension, i.e.
         %USERPROFILE%\.vscode[-insiders]\extensions\anthropic.claude-code-*\
             resources\native-binary\claude.exe
         (highest version wins, compared as versions and not as strings)
    Passing this parameter overrides both; it never falls back to another binary.
    Resolution is read-only - the extension and PATH are never modified.

.PARAMETER PermissionMode
    Passed through to `claude --permission-mode`. Defaults to 'acceptEdits' so the
    non-interactive run can write files. Use 'plan' for a read-only rehearsal.

.PARAMETER Prd
    Sets state.json currentPrd for this run (e.g. docs/prd/01-core-loop.md).
    Omit to keep whatever is already recorded.

.PARAMETER MaxIterations
    Sets state.json maxIterations for this run. Omit to keep the stored value.

.PARAMETER DryRun
    Print the prompt that would be sent and exit. No CLI call, no state change.

.PARAMETER NoArchive
    Skip copying the handoff files into .handoff/history/.

.OUTPUTS
    Exit code: 0 = completed, 1 = failed, 2 = waiting_for_decision,
               3 = unknown state, 4 = ready_for_playtest.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\claude-handoff.ps1 -DryRun

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\claude-handoff.ps1 -Prd docs\prd\01-core-loop.md
#>
[CmdletBinding()]
param(
    [string] $TaskFile,
    [string] $ClaudeCommand = 'claude',
    [ValidateSet('default', 'acceptEdits', 'plan', 'bypassPermissions')]
    [string] $PermissionMode = 'acceptEdits',
    [string] $Prd,
    [ValidateRange(1, 50)]
    [int] $MaxIterations = 0,
    [switch] $DryRun,
    [switch] $NoArchive
)

$ErrorActionPreference = 'Stop'

# Was -ClaudeCommand actually passed, or is this just the 'claude' default?
$ExplicitCli = $PSBoundParameters.ContainsKey('ClaudeCommand')

# --- paths -------------------------------------------------------------------

$RepoRoot     = Split-Path -Parent $PSScriptRoot
$HandoffDir   = Join-Path $RepoRoot '.handoff'
$HistoryDir   = Join-Path $HandoffDir 'history'
$ResultFile   = Join-Path $HandoffDir 'result.md'
$StateFile    = Join-Path $HandoffDir 'state.json'
$DecisionFile = Join-Path $HandoffDir 'decision.md'

if (-not $TaskFile) { $TaskFile = Join-Path $HandoffDir 'task.md' }

if (-not (Test-Path $TaskFile)) {
    throw "Task file not found: $TaskFile"
}

# Stay inside the project. Refuse a -TaskFile pointing outside the repo.
$resolvedTask = (Resolve-Path $TaskFile).Path
if (-not $resolvedTask.StartsWith((Resolve-Path $RepoRoot).Path, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Task file must live inside the project root: $RepoRoot"
}

# --- helpers -----------------------------------------------------------------

function Read-Utf8 {
    param([string] $Path)
    return [System.IO.File]::ReadAllText($Path, [System.Text.UTF8Encoding]::new($false))
}

function Write-Utf8 {
    param([string] $Path, [string] $Content)
    [System.IO.File]::WriteAllText($Path, $Content, [System.Text.UTF8Encoding]::new($false))
}

function Get-HandoffState {
    if (-not (Test-Path $StateFile)) {
        return [pscustomobject]@{
            status            = 'idle'
            currentPrd        = $null
            currentTask       = $null
            iteration         = 0
            maxIterations     = 5
            needsUserDecision = $false
            lastUpdated       = $null
            summary           = ''
        }
    }
    try {
        return (Read-Utf8 $StateFile) | ConvertFrom-Json
    }
    catch {
        throw "state.json is not valid JSON: $StateFile`n$($_.Exception.Message)"
    }
}

function Save-HandoffState {
    param([psobject] $State)
    Write-Utf8 $StateFile (($State | ConvertTo-Json -Depth 5) + "`r`n")
}

function Get-DecisionStatus {
    if (-not (Test-Path $DecisionFile)) { return 'missing' }
    $m = [regex]::Match((Read-Utf8 $DecisionFile), '(?im)^\s*status:\s*(none|pending)\s*$')
    if ($m.Success) { return $m.Groups[1].Value.ToLower() }
    return 'unknown'
}

function Get-Utc {
    return (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
}

function Find-VSCodeBundledClaude {
    # The VS Code extension ships its own claude.exe. Read-only lookup:
    # nothing here installs, modifies, or reorders the extension.
    $roots = @(
        (Join-Path $env:USERPROFILE '.vscode\extensions'),
        (Join-Path $env:USERPROFILE '.vscode-insiders\extensions')
    ) | Where-Object { $_ -and (Test-Path $_) }

    $found = @()
    foreach ($root in $roots) {
        $dirs = Get-ChildItem -Path $root -Directory -Filter 'anthropic.claude-code-*' -ErrorAction SilentlyContinue
        foreach ($d in $dirs) {
            $exe = Join-Path $d.FullName 'resources\native-binary\claude.exe'
            if (-not (Test-Path $exe)) { continue }

            # Compare as real versions (2.1.233 > 2.1.9), not as strings.
            $ver = $null
            $m = [regex]::Match($d.Name, 'anthropic\.claude-code-(\d+(?:\.\d+){1,3})')
            if ($m.Success) { [void][version]::TryParse($m.Groups[1].Value, [ref]$ver) }

            $found += [pscustomobject]@{
                Path    = $exe
                Version = $ver
                Name    = $d.Name
            }
        }
    }
    if ($found.Count -eq 0) { return $null }

    # Unparseable version names sort last but stay usable.
    return ($found |
        Sort-Object `
            @{ Expression = { if ($null -eq $_.Version) { [version]'0.0.0' } else { $_.Version } }; Descending = $true }, `
            @{ Expression = { $_.Name }; Descending = $true } |
        Select-Object -First 1)
}

function Resolve-ClaudeCli {
    # Priority: explicit -ClaudeCommand > PATH > VS Code bundled CLI.
    # Returns @{ Path; Origin } or $null. Never throws, never modifies PATH.
    param(
        [string] $Name,
        [bool]   $Explicit
    )

    $cmd = Get-Command $Name -CommandType Application, ExternalScript -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($cmd) {
        $origin = if ($Explicit) { '-ClaudeCommand' } else { 'PATH' }
        return [pscustomobject]@{ Path = $cmd.Source; Origin = $origin }
    }

    # An explicit -ClaudeCommand must never silently fall back to another binary.
    if ($Explicit) { return $null }

    $bundled = Find-VSCodeBundledClaude
    if ($bundled) {
        return [pscustomobject]@{
            Path   = $bundled.Path
            Origin = "VS Code extension $($bundled.Name)"
        }
    }
    return $null
}

# --- read the task -----------------------------------------------------------

$taskRaw = Read-Utf8 $resolvedTask
if ([string]::IsNullOrWhiteSpace($taskRaw)) {
    throw "Task file is empty: $resolvedTask"
}

# Strip HTML comments so template hints are not sent as instructions.
$taskBody = [regex]::Replace($taskRaw, '(?s)<!--.*?-->', '').Trim()
if ([string]::IsNullOrWhiteSpace($taskBody)) {
    throw "Task file has no instruction (only comments): $resolvedTask"
}

# --- state before the run ----------------------------------------------------

$state = Get-HandoffState

if ($Prd) { $state.currentPrd = $Prd }
if ($MaxIterations -gt 0) { $state.maxIterations = $MaxIterations }
if (-not $state.maxIterations) { $state.maxIterations = 5 }

$prevStatus   = $state.status
$prevDecision = Get-DecisionStatus

# --- build the prompt --------------------------------------------------------

$prdLine = if ($state.currentPrd) { $state.currentPrd } else { '(none set - stay strictly inside the task text)' }

$prompt = @"
You are running a handoff task for the vive-pawnshop project.

Follow the 'handoff-loop' skill in .claude/skills/handoff-loop/SKILL.md for the
full procedure. In short:

1. Read CLAUDE.md and .handoff/state.json first.
2. Current PRD (scope boundary): $prdLine
3. Work autonomously inside that scope: implement, verify by actually running
   something, analyse failures, fix, re-verify. Decide technical details
   (names, internal design, small refactors, bug fixes) yourself.
4. Stop and set status 'waiting_for_decision' + fill .handoff/decision.md ONLY for
   design/UX changes, conflicting requirements, work outside the current PRD,
   architecture forks, or data-loss / large-refactor risk.
4b. If the change affects actual play feel (UI layout, tempo, controls, animation
   speed, visual feedback, fun), do NOT finish as 'completed' on automated tests
   alone. Follow the 'playtest-loop' skill: set 'ready_for_playtest', write the
   playtest URL and a numbered checklist into .handoff/result.md, and stop.
5. Respect maxIterations in state.json. Over the limit -> 'waiting_for_decision'
   (if it is a choice) or 'failed' (if it is a technical block). Do not revert work.
6. Do not start the next PRD after finishing the current one.
7. Always end by writing .handoff/result.md and .handoff/state.json.

Only touch files inside the project root.

--- BEGIN TASK (.handoff/task.md) ---
$taskBody
--- END TASK ---
"@

Write-Host "[handoff] repo     : $RepoRoot"
Write-Host "[handoff] task     : $resolvedTask"
Write-Host "[handoff] prd      : $prdLine"
Write-Host "[handoff] mode     : $PermissionMode"
Write-Host "[handoff] state    : $prevStatus (maxIterations=$($state.maxIterations))"
Write-Host "[handoff] decision : $prevDecision"

if ($prevDecision -eq 'pending') {
    Write-Warning "[handoff] decision.md is still 'pending'. Make sure this task answers it."
}
if ($prevStatus -eq 'working') {
    Write-Warning "[handoff] previous run left state 'working' - it may have been interrupted."
}
if ($prevStatus -eq 'ready_for_playtest') {
    Write-Host "[handoff] previous run is awaiting playtest - this task is treated as playtest feedback."
}

if ($DryRun) {
    # Report which binary a real run would use, but never fail the dry run over it.
    $probe = Resolve-ClaudeCli -Name $ClaudeCommand -Explicit $ExplicitCli
    if ($probe) {
        Write-Host "[handoff] claude   : $($probe.Path)  [$($probe.Origin)]"
    }
    else {
        Write-Warning "[handoff] claude   : not resolved (a real run would fail here)"
    }
    Write-Host "[handoff] dry run - prompt below, CLI not invoked, state unchanged" -ForegroundColor Yellow
    Write-Host '--------------------------------------------------------------'
    Write-Host $prompt
    Write-Host '--------------------------------------------------------------'
    return
}

# --- resolve the CLI ---------------------------------------------------------

$cli = Resolve-ClaudeCli -Name $ClaudeCommand -Explicit $ExplicitCli
if (-not $cli) {
    if ($ExplicitCli) {
        throw "Claude Code CLI not found at the given -ClaudeCommand: '$ClaudeCommand'"
    }
    $lines = @(
        "Claude Code CLI not found.",
        "  - not on PATH as '$ClaudeCommand'",
        "  - no bundled CLI under $env:USERPROFILE\.vscode\extensions\anthropic.claude-code-*\resources\native-binary\claude.exe",
        "Install Claude Code, or pass -ClaudeCommand <full path to claude.exe>."
    )
    throw ($lines -join [Environment]::NewLine)
}
Write-Host "[handoff] claude   : $($cli.Path)  [$($cli.Origin)]"

# --- mark working ------------------------------------------------------------

# One-line label for state.json: first meaningful line, skipping the '# Task' header.
$firstLine = ($taskBody -split "`r?`n" |
    Where-Object { $_ -match '\S' -and $_ -notmatch '^\s*#+\s*task\s*$' } |
    Select-Object -First 1).Trim().TrimStart('#', '-', ' ').Trim()

$state.status            = 'working'
$state.currentTask       = $firstLine
$state.iteration         = 0
$state.needsUserDecision = $false
$state.lastUpdated       = Get-Utc
$state.summary           = 'run started by claude-handoff.ps1'
Save-HandoffState $state

# --- run ---------------------------------------------------------------------

$resultBefore = if (Test-Path $ResultFile) { (Get-Item $ResultFile).LastWriteTimeUtc } else { $null }

Push-Location $RepoRoot
try {
    $prompt | & $cli.Path -p --permission-mode $PermissionMode
    $cliExit = $LASTEXITCODE
}
finally {
    Pop-Location
}

if ($cliExit -ne 0) {
    Write-Warning "[handoff] claude exited with code $cliExit"
}

# --- state after the run -----------------------------------------------------

$state = Get-HandoffState

if ($state.status -eq 'working') {
    # Claude never wrote a terminal state - treat as failed rather than silently ok.
    Write-Warning "[handoff] state.json still says 'working'; recording 'failed'."
    $state.status      = 'failed'
    $state.summary     = "run ended without a terminal state (claude exit $cliExit)"
    $state.lastUpdated = Get-Utc
    Save-HandoffState $state
}

$resultAfter = if (Test-Path $ResultFile) { (Get-Item $ResultFile).LastWriteTimeUtc } else { $null }
if ($resultAfter -eq $resultBefore) {
    Write-Warning "[handoff] .handoff/result.md was not updated by this run."
}

Write-Host ''
switch ($state.status) {
    'completed' {
        Write-Host "[handoff] STATUS: completed" -ForegroundColor Green
        $exitCode = 0
    }
    'ready_for_playtest' {
        Write-Host "[handoff] STATUS: ready_for_playtest - play it and give feedback" -ForegroundColor Cyan
        Write-Host "[handoff] see .handoff/result.md for the playtest URL and checklist"
        $exitCode = 4
    }
    'waiting_for_decision' {
        Write-Host "[handoff] STATUS: waiting_for_decision - user input required" -ForegroundColor Yellow
        Write-Host "[handoff] see .handoff/decision.md"
        if ((Get-DecisionStatus) -ne 'pending') {
            Write-Warning "[handoff] decision.md is not marked 'pending' - it may be incomplete."
        }
        $exitCode = 2
    }
    'failed' {
        Write-Host "[handoff] STATUS: failed" -ForegroundColor Red
        Write-Host "[handoff] see .handoff/result.md"
        $exitCode = 1
    }
    default {
        Write-Host "[handoff] STATUS: $($state.status) (unexpected)" -ForegroundColor Magenta
        $exitCode = 3
    }
}
Write-Host "[handoff] iteration: $($state.iteration) / $($state.maxIterations)"
if ($state.summary) { Write-Host "[handoff] summary  : $($state.summary)" }

# --- archive -----------------------------------------------------------------

if (-not $NoArchive) {
    if (-not (Test-Path $HistoryDir)) {
        New-Item -ItemType Directory -Path $HistoryDir | Out-Null
    }
    $entryDir = Join-Path $HistoryDir ((Get-Date -Format 'yyyyMMdd-HHmmss') + "-$($state.status)")
    New-Item -ItemType Directory -Path $entryDir | Out-Null

    Copy-Item $resolvedTask (Join-Path $entryDir 'task.md')
    foreach ($f in @($ResultFile, $StateFile, $DecisionFile)) {
        if (Test-Path $f) { Copy-Item $f (Join-Path $entryDir (Split-Path -Leaf $f)) }
    }
    Write-Host "[handoff] archived : $entryDir"
}

exit $exitCode
