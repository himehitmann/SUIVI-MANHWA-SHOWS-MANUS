# Manga speech-region rendering — 2026-09-09

The local OCR pipeline estimates the background from 48 perimeter samples instead of one pixel. Dominant-color grouping resists isolated ink pixels and preserves colored flat bubbles; foreground contrast follows the estimated background. The returned confidence indicates whether the perimeter appears uniform. This remains flat-color reconstruction, not inpainting of drawings or textures.

Duplicate detection now also checks horizontal position so identical text in separate side-by-side regions is not discarded merely because it shares a vertical coordinate. The translated span explicitly inherits its box typography and wraps within its measured width.

Verification: 174 tests passed, including dominant colored background, dark background contrast, uncertain varied backgrounds and image-edge sampling. The real packaged Chromium OCR test reads HELLO WORLD on a cream image and verifies the background is #f6e6c3. Japanese horizontal/vertical, tall image, translation restore and upgrade tests also pass. Clean synthetic fixtures do not establish performance on complex artwork.

Remaining on this prioritized workstream: robust bubble segmentation, texture-aware text removal, paragraph reconstruction, mixed-language detection, computation cancellation, representative quality corpus and latency/memory measurements. Overall specification completion estimate: 49%.
