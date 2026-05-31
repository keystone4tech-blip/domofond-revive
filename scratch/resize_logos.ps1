# scratch/resize_logos.ps1
# Script to resize logo.png and create PWA icons and favicon.
# Uses built-in .NET System.Drawing in Windows PowerShell.
# Written strictly in ASCII/English inside code strings to prevent encoding/parsing errors.

# File paths
$sourcePath = Join-Path $PSScriptRoot "..\public\logo.png"
$pwa192Path = Join-Path $PSScriptRoot "..\public\pwa-192x192.png"
$pwa512Path = Join-Path $PSScriptRoot "..\public\pwa-512x512.png"
$faviconPath = Join-Path $PSScriptRoot "..\public\favicon.ico"

Write-Host "=== Starting logo generation ===" -ForegroundColor Cyan
Write-Host "Source file: $sourcePath"

# Check if source file exists
if (-not (Test-Path $sourcePath)) {
    Write-Error "Source logo public/logo.png not found!"
    Exit 1
}

# Load System.Drawing assembly for graphics manipulation
Add-Type -AssemblyName System.Drawing

# Function to resize and save image
function Resize-Image {
    param (
        [string]$SourceFile,
        [string]$OutputFile,
        [int]$Width,
        [int]$Height,
        [System.Drawing.Imaging.ImageFormat]$Format
    )

    Write-Host "Generating: $OutputFile ($Width x $Height)..." -ForegroundColor Yellow

    # Load source image
    $srcImg = [System.Drawing.Image]::FromFile($SourceFile)
    
    # Create new canvas
    $destImg = New-Object System.Drawing.Bitmap($Width, $Height)
    
    # Create graphics object
    $g = [System.Drawing.Graphics]::FromImage($destImg)
    
    # High quality settings
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    # Draw image with new dimensions
    $g.DrawImage($srcImg, 0, 0, $Width, $Height)
    
    # Save file
    $destImg.Save($OutputFile, $Format)
    
    # Dispose resources
    $g.Dispose()
    $destImg.Dispose()
    $srcImg.Dispose()
    
    Write-Host "Successfully generated!" -ForegroundColor Green
}

try {
    # 1. PWA icon 192x192 (PNG)
    Resize-Image -SourceFile $sourcePath -OutputFile $pwa192Path -Width 192 -Height 192 -Format ([System.Drawing.Imaging.ImageFormat]::Png)

    # 2. PWA icon 512x512 (PNG)
    Resize-Image -SourceFile $sourcePath -OutputFile $pwa512Path -Width 512 -Height 512 -Format ([System.Drawing.Imaging.ImageFormat]::Png)

    # 3. Favicon 32x32 (ICO)
    Resize-Image -SourceFile $sourcePath -OutputFile $faviconPath -Width 32 -Height 32 -Format ([System.Drawing.Imaging.ImageFormat]::Icon)
    
    Write-Host "=== All icons successfully generated! ===" -ForegroundColor Green
}
catch {
    Write-Error "Error during icon generation: $_"
}
