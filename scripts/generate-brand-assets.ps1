param(
  [Parameter(Mandatory = $true)][string]$SourcePath,
  [Parameter(Mandatory = $true)][string]$OutputDirectory
)

Add-Type -AssemblyName System.Drawing

function New-Canvas([int]$Size, [System.Drawing.Color]$Background) {
  $bitmap = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear($Background)
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  return @{ Bitmap = $bitmap; Graphics = $graphics }
}

function Save-Variant([System.Drawing.Image]$Source, [string]$Path, [int]$ArtworkSize, [System.Drawing.Color]$Background) {
  $canvas = New-Canvas 1024 $Background
  try {
    $offset = [int]((1024 - $ArtworkSize) / 2)
    $canvas.Graphics.DrawImage($Source, $offset, $offset, $ArtworkSize, $ArtworkSize)
    $canvas.Bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $canvas.Graphics.Dispose()
    $canvas.Bitmap.Dispose()
  }
}

$resolvedSource = (Resolve-Path -LiteralPath $SourcePath).Path
$resolvedOutput = (Resolve-Path -LiteralPath $OutputDirectory).Path
$source = [System.Drawing.Image]::FromFile($resolvedSource)
try {
  Save-Variant $source (Join-Path $resolvedOutput 'spendspeak-mark-v2.png') 980 ([System.Drawing.Color]::Transparent)
  Save-Variant $source (Join-Path $resolvedOutput 'spendspeak-icon-v2.png') 820 ([System.Drawing.ColorTranslator]::FromHtml('#F7F3E8'))
  Save-Variant $source (Join-Path $resolvedOutput 'spendspeak-adaptive-foreground-v2.png') 700 ([System.Drawing.Color]::Transparent)
  Save-Variant $source (Join-Path $resolvedOutput 'spendspeak-splash-v2.png') 700 ([System.Drawing.Color]::Transparent)
} finally {
  $source.Dispose()
}
