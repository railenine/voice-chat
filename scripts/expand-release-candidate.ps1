param(
  [Parameter(Mandatory=$true)][string]$Archive,
  [Parameter(Mandatory=$true)][string]$Destination,
  [Parameter(Mandatory=$true)][string]$ExpectedFiles,
  [string]$ExpectedVersion = ''
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$allowed = @(Get-Content -LiteralPath $ExpectedFiles -Raw | ConvertFrom-Json)
$destinationRoot = [IO.Path]::GetFullPath($Destination)
if (Test-Path -LiteralPath $destinationRoot) { throw 'Extraction destination must not exist' }
$zip = [IO.Compression.ZipFile]::OpenRead([IO.Path]::GetFullPath($Archive))
try {
  $seen = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  [long]$total = 0
  foreach ($entry in $zip.Entries) {
    if ($allowed -cnotcontains $entry.FullName -or -not $seen.Add($entry.FullName)) { throw 'Unexpected or duplicate archive entry' }
    if ($entry.Length -gt 67108864) { throw 'Oversized archive entry' }
    $total += $entry.Length
    if ($total -gt 134217728) { throw 'Oversized archive content' }
    $target = [IO.Path]::GetFullPath((Join-Path $destinationRoot $entry.FullName))
    if (-not $target.StartsWith($destinationRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Archive path escapes destination' }
  }
  if ($seen.Count -ne $allowed.Count) { throw 'Missing archive entries' }
  # Validate the entire directory before writing any files. Never overwrite.
  foreach ($entry in $zip.Entries) {
    $target = [IO.Path]::GetFullPath((Join-Path $destinationRoot $entry.FullName))
    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target)) | Out-Null
    [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $false)
  }
} finally { $zip.Dispose() }
if ($ExpectedVersion) {
  $portable = Join-Path $destinationRoot 'src-tauri/target/release/RVxis.exe'
  if (([Diagnostics.FileVersionInfo]::GetVersionInfo($portable)).ProductVersion -ne $ExpectedVersion) {
    throw 'Portable PE version does not match source'
  }
}
