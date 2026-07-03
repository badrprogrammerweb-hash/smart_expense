param(
  [Parameter(Mandatory=$true)]
  [int]$Phase,

  [Parameter(Mandatory=$true)]
  [string]$SpecPath,

  [switch]$DryRun
)

$ErrorActionPreference = "Continue"

$Root = "D:\claude\smart_expense"
$SkillPath = "D:\claude\smart_expense\.agents\skills\speckit-implement\SKILL.md"
$NextPhase = $Phase + 1

Set-Location $Root

$LogDir = Join-Path $Root "logs\agent-runs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

$CodexLog = Join-Path $LogDir "phase-$Phase-codex.log"
$ClaudeLog = Join-Path $LogDir "phase-$Phase-claude.log"
$TestLog = Join-Path $LogDir "phase-$Phase-tests.log"

if ($DryRun) {
  $CodexPrompt = "Say CODEX_OK only."
  $ClaudePrompt = "Say CLAUDE_OK only."
} else {
  $CodexPrompt = "Read and follow this skill file: $SkillPath. Execute only Phase $Phase tasks from $SpecPath. Follow the tasks exactly. Do not skip tests. Do not continue to Phase $NextPhase. Stop after Phase $Phase is complete with a summary."

  $ClaudePrompt = "Review completed Phase $Phase from $SpecPath. If you find any real bug, missing requirement, test gap, security issue, or mismatch with the spec/tasks, fix it directly, run the relevant tests, and summarize changes. Do not continue to Phase $NextPhase."
}

Write-Host ""
Write-Host "=============================="
Write-Host "1. Codex"
Write-Host "=============================="

$CodexPromptEscaped = $CodexPrompt.Replace('"', '""')
cmd /c "codex exec --sandbox danger-full-access ""$CodexPromptEscaped"" 2>&1" | Tee-Object -FilePath $CodexLog

if ($LASTEXITCODE -ne 0) {
  throw "Codex failed with exit code $LASTEXITCODE"
}

Write-Host ""
Write-Host "=============================="
Write-Host "2. Claude"
Write-Host "=============================="

claude -p --permission-mode acceptEdits $ClaudePrompt 2>&1 | Tee-Object -FilePath $ClaudeLog

if ($LASTEXITCODE -ne 0) {
  throw "Claude failed with exit code $LASTEXITCODE"
}

if (-not $DryRun) {
  Write-Host ""
  Write-Host "=============================="
  Write-Host "3. Backend tests"
  Write-Host "=============================="

  Set-Location "$Root\apps\api"
  $env:PYTHONPATH = (Get-Location).Path
  .\.venv\Scripts\python.exe -m pytest 2>&1 | Tee-Object -FilePath $TestLog

  if ($LASTEXITCODE -ne 0) {
    throw "Backend tests failed with exit code $LASTEXITCODE"
  }

  Write-Host ""
  Write-Host "=============================="
  Write-Host "4. Frontend tests"
  Write-Host "=============================="

  Set-Location "$Root\apps\web"
  npm test 2>&1 | Tee-Object -FilePath $TestLog -Append

  if ($LASTEXITCODE -ne 0) {
    throw "Frontend tests failed with exit code $LASTEXITCODE"
  }

  Write-Host ""
  Write-Host "=============================="
  Write-Host "5. Frontend build"
  Write-Host "=============================="

  npm run build 2>&1 | Tee-Object -FilePath $TestLog -Append

  if ($LASTEXITCODE -ne 0) {
    throw "Frontend build failed with exit code $LASTEXITCODE"
  }
}

Set-Location $Root

Write-Host ""
Write-Host "=============================="
Write-Host "Git status"
Write-Host "=============================="

git status --short --branch

Write-Host ""
Write-Host "Phase $Phase cycle complete."

if (-not $DryRun) {
  Write-Host "If everything looks good, commit manually:"
  Write-Host "git add ."
  Write-Host "git commit -m `"Implement phase $Phase`""
}