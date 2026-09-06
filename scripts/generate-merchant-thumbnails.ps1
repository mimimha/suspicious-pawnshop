param(
    [int]$Size = 256
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$sourceDirectory = Join-Path $PSScriptRoot '..\public\assets\items'
$outputDirectory = Join-Path $sourceDirectory 'merchant-thumbnails'
[System.IO.Directory]::CreateDirectory($outputDirectory) | Out-Null

Get-ChildItem -LiteralPath $sourceDirectory -Filter '*.png' -File | ForEach-Object {
    $source = [System.Drawing.Image]::FromFile($_.FullName)
    try {
        $thumbnail = New-Object System.Drawing.Bitmap(
            $Size,
            $Size,
            [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
        )
        try {
            $graphics = [System.Drawing.Graphics]::FromImage($thumbnail)
            try {
                $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
                $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
                $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
                $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
                $graphics.Clear([System.Drawing.Color]::Transparent)
                $graphics.DrawImage($source, 0, 0, $Size, $Size)
            }
            finally {
                $graphics.Dispose()
            }
            $outputPath = Join-Path $outputDirectory $_.Name
            $thumbnail.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
        }
        finally {
            $thumbnail.Dispose()
        }
    }
    finally {
        $source.Dispose()
    }
}
