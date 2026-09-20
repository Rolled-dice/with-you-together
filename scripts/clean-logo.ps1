# One-off brand asset build.
#
# The supplied logo exports (logo.png, then a 7 MB "SVG" that was really a
# base64 PNG) both had the transparency checkerboard flattened into opaque
# pixels. The artwork itself is fine, so rather than redraw it we strip the grid:
# the checkerboard is pure greyscale, the mark is saturated, so a channel-spread
# threshold separates them cleanly. Alpha is applied at full resolution and the
# downscale then produces smooth anti-aliased edges for free.
#
# Usage:  pwsh -File scripts/clean-logo.ps1 -Source <path-to-flattened-png>

param(
  [Parameter(Mandatory = $true)][string]$Source,
  [string]$OutDir = "public"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Drawing.Drawing2D;

public static class LogoCleaner
{
    /// Returns the content bounding box after knocking out greyscale pixels.
    public static Rectangle Mask(Bitmap src, int spreadThreshold)
    {
        int w = src.Width, h = src.Height;
        var rect = new Rectangle(0, 0, w, h);
        var data = src.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
        int stride = data.Stride;
        int len = Math.Abs(stride) * h;
        byte[] buf = new byte[len];
        System.Runtime.InteropServices.Marshal.Copy(data.Scan0, buf, 0, len);

        int minX = w, minY = h, maxX = -1, maxY = -1;

        for (int y = 0; y < h; y++)
        {
            int row = y * stride;
            for (int x = 0; x < w; x++)
            {
                int i = row + x * 4;           // BGRA
                int b = buf[i], g = buf[i + 1], r = buf[i + 2];
                int mx = Math.Max(r, Math.Max(g, b));
                int mn = Math.Min(r, Math.Min(g, b));

                if (mx - mn < spreadThreshold)
                {
                    buf[i + 3] = 0;            // background -> transparent
                }
                else
                {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }

        System.Runtime.InteropServices.Marshal.Copy(buf, 0, data.Scan0, len);
        src.UnlockBits(data);

        if (maxX < 0) return Rectangle.Empty;
        return new Rectangle(minX, minY, maxX - minX + 1, maxY - minY + 1);
    }

    /// Crop, then scale to a target width preserving aspect.
    public static Bitmap Scaled(Bitmap src, Rectangle crop, int targetWidth)
    {
        int tw = targetWidth;
        int th = (int)Math.Round(crop.Height * (targetWidth / (double)crop.Width));
        var dst = new Bitmap(tw, th, PixelFormat.Format32bppArgb);
        using (var gr = Graphics.FromImage(dst))
        {
            gr.Clear(Color.Transparent);
            gr.InterpolationMode = InterpolationMode.HighQualityBicubic;
            gr.PixelOffsetMode = PixelOffsetMode.HighQuality;
            gr.CompositingQuality = CompositingQuality.HighQuality;
            gr.DrawImage(src, new Rectangle(0, 0, tw, th), crop, GraphicsUnit.Pixel);
        }
        return dst;
    }

    /// Centre the mark on a transparent square, with padding, for touch icons.
    public static Bitmap Square(Bitmap src, Rectangle crop, int size, double inset)
    {
        var dst = new Bitmap(size, size, PixelFormat.Format32bppArgb);
        double avail = size * inset;
        double scale = Math.Min(avail / crop.Width, avail / crop.Height);
        int dw = (int)Math.Round(crop.Width * scale);
        int dh = (int)Math.Round(crop.Height * scale);
        var target = new Rectangle((size - dw) / 2, (size - dh) / 2, dw, dh);

        using (var gr = Graphics.FromImage(dst))
        {
            gr.Clear(Color.Transparent);
            gr.InterpolationMode = InterpolationMode.HighQualityBicubic;
            gr.PixelOffsetMode = PixelOffsetMode.HighQuality;
            gr.CompositingQuality = CompositingQuality.HighQuality;
            gr.DrawImage(src, target, crop, GraphicsUnit.Pixel);
        }
        return dst;
    }
}
"@

if (-not (Test-Path $Source)) { throw "Source not found: $Source" }
if (-not (Test-Path $OutDir)) { throw "Output dir not found: $OutDir" }

$src = New-Object System.Drawing.Bitmap($Source)
Write-Host "Source        : $($src.Width) x $($src.Height)"

$crop = [LogoCleaner]::Mask($src, 25)
if ($crop.IsEmpty) { throw "No saturated pixels found - nothing to keep." }
Write-Host "Content bounds: $($crop.X),$($crop.Y) $($crop.Width) x $($crop.Height)"

# Two wide sizes: a large one for Open Graph and structured data, and a small
# one for the nav, which renders at 36px tall and must not pull the big file.
foreach ($spec in @(@(640, "logo.png"), @(256, "logo-mark.png"))) {
  $wide = [LogoCleaner]::Scaled($src, $crop, $spec[0])
  $wide.Save((Join-Path $OutDir $spec[1]), [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Host "Wrote         : $OutDir/$($spec[1])  ($($wide.Width) x $($wide.Height))"
  $wide.Dispose()
}

# Square, padded icons. 0.82 inset keeps the mark off the rounded corners iOS adds.
foreach ($spec in @(@(180, "apple-touch-icon.png"), @(64, "favicon-64.png"))) {
  $sq = [LogoCleaner]::Square($src, $crop, $spec[0], 0.82)
  $sq.Save((Join-Path $OutDir $spec[1]), [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Host "Wrote         : $OutDir/$($spec[1])  ($($spec[0]) x $($spec[0]))"
  $sq.Dispose()
}

$src.Dispose()
Write-Host "Done."
