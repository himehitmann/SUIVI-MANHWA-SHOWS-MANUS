# Manga translation: vertical OCR milestone — 2026-09-09

The largest remaining workstream, manga image translation, is now prioritized. This milestone adds an automatic Japanese vertical OCR pass using the bundled jpn_vert model. Horizontal and vertical overlapping detections are compared by recognition confidence. No end-user API key or OCR model selection is required. Processing remains serialized; only one Tesseract worker stays active at a time. The additional pass increases Japanese processing time and is not yet benchmarked on long real-world chapters.

Real Chromium validation: a raster fixture containing こんにちは世界 in CSS vertical-rl layout is recognized as こんにちは世界 by the packaged extension, with a vertical-model region. The horizontal Japanese fixture still passes. The full packaged browser/OCR suite and persistent-profile 0.3.1 → 0.4.0 upgrade passed. These are clean synthetic fixtures, not evidence of universal manga accuracy.

Model provenance:
- https://github.com/tesseract-ocr/tessdata_fast/blob/main/jpn_vert.traineddata
- Uncompressed bytes: 3037480
- SHA-256: bf1e2640954691797e2dc14f38533e601b59ee37958698ae0f0b81dc6f09c71b
- Apache-2.0 terms retained in tesseract/LICENSE.tessdata.

Next major translation blocks: robust speech-bubble/text detection; background-aware removal and reconstruction; mixed orientations and stylized text; automatic image-language identification; cancellation of computation rather than just UI updates; representative licensed/public-domain quality corpus; latency and memory benchmarks; managed service availability and operating costs. Current overlays do not provide neural inpainting.

Overall full-spec completion estimate: 48%. This milestone is the start of the larger translation workstream, not its completion.
