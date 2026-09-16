# Profile verification — 2026-09-09

Avatar, banner, display name and biography are editable on the web. Raster files are cropped locally with zoom and horizontal/vertical position controls before being saved as compressed WebP. The header uses the actual profile avatar/initial. The library can display the profile banner and biography.

Profiles synchronize between the web API and the extension using a profile-specific modification timestamp, independently of unrelated library edits. Technical extension settings and keys are excluded from the transmitted profile. Clearing the library preserves the profile and removes library collections with deletion markers.

Validation: 168 tests pass, including profile merge ordering and extension transport without technical settings. Real Chromium tests upload a raster image, crop it, and verify avatar/name/bio in the actual API response. TypeScript and lint pass. The extension ZIP passes its full browser/OCR suite and persistent-profile upgrade test. The settings screenshot was inspected, then input styling and obsolete demo/privacy wording were corrected.

Overall specification completion remains an estimate: 46%. No production deployment or managed translation service has been configured.
