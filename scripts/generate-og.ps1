Add-Type -AssemblyName System.Drawing

$width = 1200
$height = 630
$path = Join-Path (Get-Location) 'public/og-preview.png'

$bmp = New-Object Drawing.Bitmap $width, $height
$g = [Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [Drawing.Text.TextRenderingHint]::AntiAlias

$bg = [Drawing.Color]::FromArgb(19,22,32)
$g.Clear($bg)

$panelBrush = New-Object Drawing.SolidBrush ([Drawing.Color]::FromArgb(32,36,48))
$panelRect = New-Object Drawing.Rectangle(80,80,1040,470)
$g.FillRectangle($panelBrush, $panelRect)
$panelBrush.Dispose()

$accentBrush = New-Object Drawing.SolidBrush ([Drawing.Color]::FromArgb(255,199,88))
$g.FillRectangle($accentBrush, 110, 120, 360, 360)
$accentBrush.Dispose()

$chipBrush = New-Object Drawing.SolidBrush ([Drawing.Color]::FromArgb(54,60,78))
for ($i = 0; $i -lt 3; $i++) {
    $g.FillRectangle($chipBrush, 510 + $i * 170, 150, 150, 38)
}
$chipBrush.Dispose()

$neutralBrush = New-Object Drawing.SolidBrush ([Drawing.Color]::FromArgb(42,48,62))
for ($i = 0; $i -lt 5; $i++) {
    $g.FillRectangle($neutralBrush, 510, 225 + $i * 55, 520, 28)
}
$neutralBrush.Dispose()

$barBrush = New-Object Drawing.SolidBrush ([Drawing.Color]::FromArgb(80,185,190))
for ($i = 0; $i -lt 5; $i++) {
    $g.FillRectangle($barBrush, 510, 230 + $i * 55, 420, 18)
}
$barBrush.Dispose()

$cardBrush = New-Object Drawing.SolidBrush ([Drawing.Color]::FromArgb(37,41,58))
for ($row = 0; $row -lt 2; $row++) {
    for ($col = 0; $col -lt 3; $col++) {
        $g.FillRectangle($cardBrush, 520 + $col * 170, 360 + $row * 80, 150, 60)
    }
}
$cardBrush.Dispose()

$whiteBrush = [Drawing.Brushes]::White
$fontTitle = New-Object Drawing.Font('Segoe UI', 44, [Drawing.FontStyle]::Bold)
$fontSubtitle = New-Object Drawing.Font('Segoe UI', 24, [Drawing.FontStyle]::Regular)
$fontFootnote = New-Object Drawing.Font('Segoe UI', 18, [Drawing.FontStyle]::Regular)
$g.DrawString('Pokedex DB', $fontTitle, $whiteBrush, 500, 118)
$g.DrawString('Complete detail view for every Pokemon', $fontSubtitle, $whiteBrush, 500, 180)
$g.DrawString('Types - Stats - Evolutions - Weakness chart', $fontFootnote, $whiteBrush, 120, 500)

$fontTitle.Dispose()
$fontSubtitle.Dispose()
$fontFootnote.Dispose()

$g.Dispose()
$bmp.Save($path, [Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
