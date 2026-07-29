[CmdletBinding()]
param(
    [switch]$Local
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$SqlPath = Join-Path $PSScriptRoot "product-metrics.sql"
$Wrangler = Join-Path $RepoRoot "node_modules\.bin\wrangler.cmd"
$Target = if ($Local) { "--local" } else { "--remote" }
$Sql = (Get-Content $SqlPath) -join " "

$Output = & $Wrangler d1 execute tsumi-erabi $Target --json --command $Sql
if ($LASTEXITCODE -ne 0) {
    throw "D1 metrics query failed with exit code $LASTEXITCODE"
}

$Payload = ($Output -join [Environment]::NewLine) | ConvertFrom-Json
$Row = $Payload[0].results[0]
if (-not $Row) {
    throw "D1 metrics query returned no result"
}

function Get-Percent {
    param([int]$Numerator, [int]$Denominator)
    if ($Denominator -eq 0) { return $null }
    return [Math]::Round(($Numerator / $Denominator) * 100, 1)
}

$Users = [int]$Row.users
$Comparers = [int]$Row.comparers
$DecisionMakers = [int]$Row.decision_makers
$SteamVisitors = [int]$Row.steam_visitors

[ordered]@{
    generated_at = (Get-Date).ToUniversalTime().ToString("o")
    service = "tsumi-erabi"
    environment = if ($Local) { "local" } else { "production" }
    funnel = [ordered]@{
        users = $Users
        comparers = $Comparers
        comparisons = [int]$Row.comparisons
        decision_makers = $DecisionMakers
        decisions = [int]$Row.decisions
        steam_visitors = $SteamVisitors
        steam_opens = [int]$Row.steam_opens
        returned_users = [int]$Row.returned_users
        users_7d = [int]$Row.users_7d
        comparers_7d = [int]$Row.comparers_7d
        steam_visitors_7d = [int]$Row.steam_visitors_7d
        cached_games = [int]$Row.cached_games
    }
    rates = [ordered]@{
        visitor_to_compare_percent = Get-Percent $Comparers $Users
        compare_to_decision_percent = Get-Percent $DecisionMakers $Comparers
        decision_to_steam_percent = Get-Percent $SteamVisitors $DecisionMakers
        return_percent = Get-Percent ([int]$Row.returned_users) $Users
    }
} | ConvertTo-Json -Depth 4
