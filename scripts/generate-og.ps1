Add-Type -AssemblyName System.Drawing

function New-RoundedRectPath {
    param(
        [Drawing.Rectangle]$Rect,
        [int]$Radius
    )

    $path = New-Object Drawing.Drawing2D.GraphicsPath
    $maxDiameter = [Math]::Min($Rect.Width, $Rect.Height)
    $desired = [Math]::Max(0, $Radius * 2)
    $diameter = [Math]::Min($maxDiameter, $desired)

    if ($diameter -le 0) {
        $path.AddRectangle($Rect)
        return $path
    }

    $arcRect = New-Object Drawing.Rectangle($Rect.X, $Rect.Y, $diameter, $diameter)
    $path.AddArc($arcRect, 180, 90)
    $arcRect.X = $Rect.Right - $diameter
    $path.AddArc($arcRect, 270, 90)
    $arcRect.Y = $Rect.Bottom - $diameter
    $path.AddArc($arcRect, 0, 90)
    $arcRect.X = $Rect.X
    $path.AddArc($arcRect, 90, 90)
    $path.CloseFigure()
    return $path
}

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

$accentBrush = New-Object Drawing.SolidBrush ([Drawing.Color]::FromArgb(58,36,87))
$accentRect = New-Object Drawing.Rectangle(110,120,360,360)
$g.FillRectangle($accentBrush, $accentRect)
$accentBrush.Dispose()

# Load official Gengar artwork
$art = $null
$client = New-Object System.Net.WebClient
try {
    $stream = $client.OpenRead('https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/94.png')
    if ($stream) {
        $art = [Drawing.Image]::FromStream($stream)
        $stream.Dispose()
    }
} catch {
    # ignore download issues
}
finally {
    $client.Dispose()
}

if ($art) {
    $artRect = New-Object Drawing.Rectangle(140,170,300,300)
    $g.DrawImage($art, $artRect)
    $art.Dispose()
}

$whiteBrush = [Drawing.Brushes]::White
$nameFont = New-Object Drawing.Font('Segoe UI', 40, [Drawing.FontStyle]::Bold)
$idFont = New-Object Drawing.Font('Segoe UI', 22, [Drawing.FontStyle]::Regular)
$typeFont = New-Object Drawing.Font('Segoe UI', 20, [Drawing.FontStyle]::Bold)
$metaHeadingFont = New-Object Drawing.Font('Segoe UI', 26, [Drawing.FontStyle]::Bold)
$statLabelFont = New-Object Drawing.Font('Segoe UI', 18, [Drawing.FontStyle]::Regular)
$statValueFont = New-Object Drawing.Font('Segoe UI', 18, [Drawing.FontStyle]::Bold)
$smallFont = New-Object Drawing.Font('Segoe UI', 18, [Drawing.FontStyle]::Regular)

$g.DrawString('#0094', $idFont, $whiteBrush, 150, 140)
$g.DrawString('Gengar', $nameFont, $whiteBrush, 500, 108)

$typeChips = @(
    @{ Label = 'Ghost'; Color = [Drawing.Color]::FromArgb(115,87,151) },
    @{ Label = 'Poison'; Color = [Drawing.Color]::FromArgb(148,63,166) }
)

$chipWidth = 140
$chipHeight = 46
$chipGap = 20
$totalChipWidth = ($typeChips.Length * $chipWidth) + (($typeChips.Length - 1) * $chipGap)
$chipX = [int](110 + ((360 - $totalChipWidth) / 2))
$chipY = 120 + 360 + 10
foreach ($chip in $typeChips) {
    $chipRect = New-Object Drawing.Rectangle($chipX, $chipY, $chipWidth, $chipHeight)
    $chipBrush = New-Object Drawing.SolidBrush ($chip.Color)
    $chipPath = New-RoundedRectPath $chipRect 16
    $g.FillPath($chipBrush, $chipPath)
    $chipBrush.Dispose()
    $chipPath.Dispose()
    $textSize = $g.MeasureString($chip.Label, $typeFont)
    $textX = $chipX + ($chipRect.Width - $textSize.Width) / 2
    $textY = $chipY + ($chipRect.Height - $textSize.Height) / 2
    $g.DrawString($chip.Label, $typeFont, $whiteBrush, $textX, $textY)
    $chipX += $chipWidth + $chipGap
}

$entryText = "To steal the life of its target, it slips into the prey's shadow and silently waits for an opportunity."
$entryRect = [Drawing.RectangleF]::new([float]500, [float]190, [float]520, [float]120)
$g.DrawString($entryText, $smallFont, $whiteBrush, $entryRect)

$g.DrawString('Base Stats', $metaHeadingFont, $whiteBrush, 500, 310)

$statBackBrush = New-Object Drawing.SolidBrush ([Drawing.Color]::FromArgb(42,48,62))
$statFillBrush = New-Object Drawing.SolidBrush ([Drawing.Color]::FromArgb(80,185,190))
$stats = @(
    @{ Label = 'HP'; Value = 60 },
    @{ Label = 'Attack'; Value = 65 },
    @{ Label = 'Defense'; Value = 60 },
    @{ Label = 'Sp. Atk'; Value = 130 },
    @{ Label = 'Sp. Def'; Value = 75 },
    @{ Label = 'Speed'; Value = 110 }
)

$columns = 3
$columnWidth = 150
$columnGap = 36
$barWidth = 120
$barHeight = 14
$statStartX = 500
$statStartY = 360
$rowGap = 90

for ($i = 0; $i -lt $stats.Length; $i++) {
    $stat = $stats[$i]
    $row = [Math]::Floor($i / $columns)
    $col = $i % $columns
    $xBase = [int]($statStartX + $col * ($columnWidth + $columnGap))
    $yBase = [int]($statStartY + $row * $rowGap)
    $g.DrawString($stat.Label, $statLabelFont, $whiteBrush, $xBase, $yBase)
    $barRect = [Drawing.Rectangle]::new($xBase, $yBase + 28, [int]$barWidth, [int]$barHeight)
    $g.FillRectangle($statBackBrush, $barRect)
    $normalized = ($stat.Value / 160.0) * $barWidth
    $clamped = [Math]::Min($barWidth, [Math]::Max(14.0, $normalized))
    $fillWidth = [int][Math]::Round($clamped)
    $fillRect = [Drawing.Rectangle]::new($xBase, $yBase + 28, $fillWidth, [int]$barHeight)
    $g.FillRectangle($statFillBrush, $fillRect)
    $valueX = $xBase + $barWidth + 12
    $valueY = $yBase + 24
    $g.DrawString($stat.Value.ToString(), $statValueFont, $whiteBrush, $valueX, $valueY)
}

$statBackBrush.Dispose()
$statFillBrush.Dispose()

$nameFont.Dispose()
$idFont.Dispose()
$typeFont.Dispose()
$metaHeadingFont.Dispose()
$statLabelFont.Dispose()
$statValueFont.Dispose()
$smallFont.Dispose()

$g.Dispose()
$bmp.Save($path, [Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
