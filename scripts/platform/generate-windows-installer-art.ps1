param(
    [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\..\src-tauri\windows\assets')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($env:OS -ne 'Windows_NT') {
    throw 'The Windows installer artwork generator only supports Windows.'
}

Add-Type -AssemblyName System.Drawing

function New-HexColor {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Hex
    )

    return [System.Drawing.ColorTranslator]::FromHtml($Hex)
}

function New-PointF {
    param(
        [Parameter(Mandatory = $true)]
        [float]$X,
        [Parameter(Mandatory = $true)]
        [float]$Y
    )

    return [System.Drawing.PointF]::new($X, $Y)
}

function Save-Bitmap {
    param(
        [Parameter(Mandatory = $true)]
        [System.Drawing.Bitmap]$Bitmap,
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $Bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Bmp)
    $Bitmap.Dispose()
}

function New-Graphics {
    param(
        [Parameter(Mandatory = $true)]
        [System.Drawing.Bitmap]$Bitmap
    )

    $graphics = [System.Drawing.Graphics]::FromImage($Bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
    return $graphics
}

function Draw-InstallerConstellation {
    param(
        [Parameter(Mandatory = $true)]
        [System.Drawing.Graphics]$Graphics,
        [Parameter(Mandatory = $true)]
        [float]$Width,
        [Parameter(Mandatory = $true)]
        [float]$Height
    )

    $linePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(80, (New-HexColor '#C0F6E7')), 1.35)
    $accentPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(150, (New-HexColor '#7EE7C4')), 2.3)
    $smallNodeBrush = [System.Drawing.SolidBrush]::new(([System.Drawing.Color]::FromArgb(210, (New-HexColor '#E8FFF6'))))
    $largeNodeBrush = [System.Drawing.SolidBrush]::new(([System.Drawing.Color]::FromArgb(240, (New-HexColor '#9EF0D2'))))

    $points = @(
        (New-PointF ($Width * 0.18) ($Height * 0.20)),
        (New-PointF ($Width * 0.42) ($Height * 0.12)),
        (New-PointF ($Width * 0.68) ($Height * 0.26)),
        (New-PointF ($Width * 0.80) ($Height * 0.52)),
        (New-PointF ($Width * 0.62) ($Height * 0.78)),
        (New-PointF ($Width * 0.30) ($Height * 0.74)),
        (New-PointF ($Width * 0.12) ($Height * 0.48))
    )

    for ($index = 0; $index -lt $points.Count; $index++) {
        $currentPoint = $points[$index]
        $nextPoint = $points[($index + 1) % $points.Count]
        $Graphics.DrawLine($linePen, $currentPoint, $nextPoint)
    }

    $Graphics.DrawLine($accentPen, $points[1], $points[4])
    $Graphics.DrawLine($accentPen, $points[6], $points[2])

    foreach ($point in $points) {
        $Graphics.FillEllipse($smallNodeBrush, $point.X - 3.2, $point.Y - 3.2, 6.4, 6.4)
    }

    foreach ($highlightPoint in @($points[1], $points[4], $points[6])) {
        $Graphics.FillEllipse($largeNodeBrush, $highlightPoint.X - 5.4, $highlightPoint.Y - 5.4, 10.8, 10.8)
    }

    $largeNodeBrush.Dispose()
    $smallNodeBrush.Dispose()
    $accentPen.Dispose()
    $linePen.Dispose()
}

function New-HeaderBitmap {
    $bitmap = [System.Drawing.Bitmap]::new(150, 57)
    $graphics = New-Graphics -Bitmap $bitmap

    $backgroundRect = [System.Drawing.Rectangle]::new(0, 0, 150, 57)
    $backgroundBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
        [System.Drawing.Point]::new(0, 0),
        [System.Drawing.Point]::new(150, 57),
        (New-HexColor '#08151B'),
        (New-HexColor '#204E4A')
    )
    $graphics.FillRectangle($backgroundBrush, $backgroundRect)

    $shapeBrush = [System.Drawing.SolidBrush]::new(([System.Drawing.Color]::FromArgb(36, (New-HexColor '#C6FFF1'))))
    $graphics.FillEllipse($shapeBrush, 82, -18, 74, 74)
    $graphics.FillEllipse($shapeBrush, -12, 18, 44, 44)

    $stripePen = [System.Drawing.Pen]::new(([System.Drawing.Color]::FromArgb(36, (New-HexColor '#F5FFF8'))), 3.5)
    $graphics.DrawLine($stripePen, 48, 6, 122, 6)
    $graphics.DrawLine($stripePen, 32, 14, 136, 14)

    Draw-InstallerConstellation -Graphics $graphics -Width 62 -Height 42

    $titleFont = [System.Drawing.Font]::new('Segoe UI Semibold', 15.4, [System.Drawing.FontStyle]::Bold)
    $subtitleFont = [System.Drawing.Font]::new('Segoe UI', 6.8, [System.Drawing.FontStyle]::Regular)
    $titleBrush = [System.Drawing.SolidBrush]::new((New-HexColor '#F7FFF9'))
    $subtitleBrush = [System.Drawing.SolidBrush]::new(([System.Drawing.Color]::FromArgb(220, (New-HexColor '#C8F7E7'))))

    $graphics.DrawString('GreebleFS', $titleFont, $titleBrush, 50, 20)
    $graphics.DrawString('portable usr installer', $subtitleFont, $subtitleBrush, 51, 40)

    $subtitleBrush.Dispose()
    $titleBrush.Dispose()
    $subtitleFont.Dispose()
    $titleFont.Dispose()
    $stripePen.Dispose()
    $shapeBrush.Dispose()
    $backgroundBrush.Dispose()
    $graphics.Dispose()

    return $bitmap
}

function New-SidebarBitmap {
    $bitmap = [System.Drawing.Bitmap]::new(164, 314)
    $graphics = New-Graphics -Bitmap $bitmap

    $backgroundRect = [System.Drawing.Rectangle]::new(0, 0, 164, 314)
    $backgroundBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
        [System.Drawing.Point]::new(0, 0),
        [System.Drawing.Point]::new(164, 314),
        (New-HexColor '#081116'),
        (New-HexColor '#143F3D')
    )
    $graphics.FillRectangle($backgroundBrush, $backgroundRect)

    $overlayBrush = [System.Drawing.SolidBrush]::new(([System.Drawing.Color]::FromArgb(40, (New-HexColor '#E3FFF7'))))
    $graphics.FillEllipse($overlayBrush, -56, 186, 184, 184)
    $graphics.FillEllipse($overlayBrush, 88, -24, 94, 94)

    $gridPen = [System.Drawing.Pen]::new(([System.Drawing.Color]::FromArgb(20, (New-HexColor '#E6FFF5'))), 1)
    for ($x = -60; $x -le 220; $x += 24) {
        $graphics.DrawLine($gridPen, $x, 0, $x + 120, 314)
    }

    $accentBandBrush = [System.Drawing.SolidBrush]::new(([System.Drawing.Color]::FromArgb(24, (New-HexColor '#95F1D1'))))
    $graphics.FillRectangle($accentBandBrush, 18, 28, 128, 128)

    $symbolPen = [System.Drawing.Pen]::new(([System.Drawing.Color]::FromArgb(190, (New-HexColor '#83ECC6'))), 2.4)
    $symbolPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $graphics.DrawArc($symbolPen, 26, 36, 108, 108, 210, 210)
    $graphics.DrawLine($symbolPen, 38, 122, 86, 70)
    $graphics.DrawLine($symbolPen, 86, 70, 122, 110)

    Draw-InstallerConstellation -Graphics $graphics -Width 122 -Height 106

    $titleFont = [System.Drawing.Font]::new('Segoe UI Semibold', 21.5, [System.Drawing.FontStyle]::Bold)
    $eyebrowFont = [System.Drawing.Font]::new('Segoe UI', 7.4, [System.Drawing.FontStyle]::Regular)
    $bodyFont = [System.Drawing.Font]::new('Segoe UI', 8.8, [System.Drawing.FontStyle]::Regular)
    $titleBrush = [System.Drawing.SolidBrush]::new((New-HexColor '#F7FFF9'))
    $eyebrowBrush = [System.Drawing.SolidBrush]::new(([System.Drawing.Color]::FromArgb(225, (New-HexColor '#B9F5E0'))))
    $bodyBrush = [System.Drawing.SolidBrush]::new(([System.Drawing.Color]::FromArgb(235, (New-HexColor '#D8FFF3'))))

    $graphics.DrawString('GreebleFS', $titleFont, $titleBrush, 18, 154)
    $graphics.DrawString('USR WORKSPACE INSTALLER', $eyebrowFont, $eyebrowBrush, 20, 190)
    $graphics.DrawString('Choose an app home and the live usr workspace for portable installs.', $bodyFont, $bodyBrush, [System.Drawing.RectangleF]::new(20, 208, 122, 44))
    $graphics.DrawString('Custom install root', $bodyFont, $bodyBrush, 28, 260)
    $graphics.DrawString('Custom usr workspace', $bodyFont, $bodyBrush, 28, 278)
    $graphics.DrawString('Portable-first layout', $bodyFont, $bodyBrush, 28, 296)

    $bulletBrush = [System.Drawing.SolidBrush]::new((New-HexColor '#83ECC6'))
    foreach ($bulletY in @(266, 284, 302)) {
        $graphics.FillEllipse($bulletBrush, 18, $bulletY, 5.5, 5.5)
    }

    $bulletBrush.Dispose()
    $bodyBrush.Dispose()
    $eyebrowBrush.Dispose()
    $titleBrush.Dispose()
    $bodyFont.Dispose()
    $eyebrowFont.Dispose()
    $titleFont.Dispose()
    $symbolPen.Dispose()
    $accentBandBrush.Dispose()
    $gridPen.Dispose()
    $overlayBrush.Dispose()
    $backgroundBrush.Dispose()
    $graphics.Dispose()

    return $bitmap
}

$resolvedOutputDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $resolvedOutputDirectory | Out-Null

$headerPath = Join-Path $resolvedOutputDirectory 'greeblefs-installer-header.bmp'
$sidebarPath = Join-Path $resolvedOutputDirectory 'greeblefs-installer-sidebar.bmp'

Save-Bitmap -Bitmap (New-HeaderBitmap) -Path $headerPath
Save-Bitmap -Bitmap (New-SidebarBitmap) -Path $sidebarPath

Write-Host "Generated installer artwork:"
Write-Host "  $headerPath"
Write-Host "  $sidebarPath"
