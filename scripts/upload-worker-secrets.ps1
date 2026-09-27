# Uploads production Worker secrets to Cloudflare, reading values from a local
# env file so nothing is typed by hand or pasted anywhere shared.
#
# Usage (from the project root):
#   ./scripts/upload-worker-secrets.ps1                      # uses .env.local
#   ./scripts/upload-worker-secrets.ps1 -EnvFile .env.production.local
#   ./scripts/upload-worker-secrets.ps1 -DryRun              # show what WOULD upload
#
# Requires: `npx wrangler whoami` already logged in, and `pnpm build` already
# run (so .output/server/wrangler.json exists). Run from the repo root.

param(
  [string]$EnvFile = ".env.local",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# The exact runtime secrets the Worker reads (process.env.*). VITE_* are NOT
# here: they are baked into the client bundle at build time, not runtime.
$REQUIRED = @(
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY",
  "TELNYX_API_KEY",
  "TELNYX_CALL_CONTROL_APP_ID",
  "TELNYX_PHONE_NUMBER",
  "TELNYX_SIP_CREDENTIAL_ID",
  "TELNYX_PUBLIC_KEY"
)

# Optional secrets: uploaded only if present and non-empty in the env file.
$OPTIONAL = @(
  "GEMINI_API_KEY",
  "GEMINI_VISION_MODEL",
  "LOVABLE_API_KEY",
  "LOVABLE_SEND_URL",
  "DODO_PAYMENTS_ENV",
  "DODO_LIVE_API_KEY",
  "DODO_LIVE_WEBHOOK_SECRET",
  "DODO_LIVE_PRODUCT_CARE_USD",
  "DODO_LIVE_PRODUCT_CARE_PLUS_USD",
  "DODO_LIVE_PRODUCT_CARE_INR",
  "DODO_LIVE_PRODUCT_CARE_PLUS_INR",
  "DODO_TEST_API_KEY",
  "DODO_TEST_WEBHOOK_SECRET",
  "DODO_TEST_PRODUCT_CARE_USD",
  "DODO_TEST_PRODUCT_CARE_PLUS_USD",
  "DODO_TEST_PRODUCT_CARE_INR",
  "DODO_TEST_PRODUCT_CARE_PLUS_INR",
  "CALENDAR_TOKEN_ENC_KEY",
  "GOOGLE_CALENDAR_CLIENT_ID",
  "GOOGLE_CALENDAR_CLIENT_SECRET",
  "GOOGLE_CALENDAR_REDIRECT_URI",
  "TELNYX_SMS_SHORT_CODE",
  "TELNYX_SMS_SENDER_ID",
  "TELNYX_MESSAGING_PROFILE_ID",
  "TELNYX_RECORD_CALLS",
  "TELNYX_MAX_CALL_SECONDS",
  "TELNYX_RING_SECONDS"
)

if (-not (Test-Path $EnvFile)) { throw "Env file not found: $EnvFile" }

$workerConfig = ".output/server/wrangler.json"
if (-not (Test-Path $workerConfig)) {
  throw "$workerConfig not found. Run 'pnpm build' first."
}

# Parse KEY="value" / KEY=value lines from the env file.
$env = @{}
foreach ($line in Get-Content $EnvFile) {
  if ($line -match '^\s*#') { continue }
  $m = [regex]::Match($line, '^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$')
  if (-not $m.Success) { continue }
  $k = $m.Groups[1].Value
  $v = $m.Groups[2].Value.Trim()
  if ($v.Length -ge 2 -and (($v[0] -eq '"' -and $v[-1] -eq '"') -or ($v[0] -eq "'" -and $v[-1] -eq "'"))) {
    $v = $v.Substring(1, $v.Length - 2)
  }
  $env[$k] = $v
}

# Verify all required keys are present and non-empty.
$missing = $REQUIRED | Where-Object { [string]::IsNullOrWhiteSpace($env[$_]) }
if ($missing.Count -gt 0) {
  throw "These REQUIRED secrets are missing/empty in $EnvFile`n  " + ($missing -join "`n  ")
}

# Build the final set to upload: required + any optional that are set.
$toUpload = @()
$toUpload += $REQUIRED
foreach ($k in $OPTIONAL) { if (-not [string]::IsNullOrWhiteSpace($env[$k])) { $toUpload += $k } }

Write-Host ("`nWorker config : $workerConfig")
Write-Host ("Env source    : $EnvFile")
Write-Host ("Secrets to set: $($toUpload.Count)`n")

Push-Location ".output/server"
try {
  foreach ($k in $toUpload) {
    if ($DryRun) {
      Write-Host ("  would set  " + $k)
      continue
    }
    # Pipe the value into wrangler so it never appears on the command line.
    $env[$k] | npx wrangler secret put $k
    if ($LASTEXITCODE -ne 0) { throw "Failed to set $k" }
  }
} finally {
  Pop-Location
}

if ($DryRun) {
  Write-Host "`nDry run only - nothing uploaded."
} else {
  Write-Host "`nDone. Verify with: (cd .output/server) then npx wrangler secret list"
}
