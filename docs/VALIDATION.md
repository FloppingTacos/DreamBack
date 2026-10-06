# Validation record

## Automated results (October 6, 2026)

- C++ core synthetic-image checks pass: Feedback zero, Mix zero, depth zero, opaque Screen visibility, Mix once, historical position propagation, rotation gesture after hold, disappearing source element, transparent history, premultiplied Overlay channels, geometric coverage independent of alpha, early frames, order independence, cancellation, bounded allocation, display-space PAR rotation.
- Adapter harness passes with AddressSanitizer and UndefinedBehaviorSanitizer: parameter registration/keyframeability, runtime/PiPL metadata, unique temporal checkout IDs and times, historical parameter calls, 8/16-bit comparison, padded row safety, output ROI/full-frame equality, half-resolution geometry, negative times, seek repeatability, cancellation cleanup, format rejection, checkout failure cleanup, remap/reversal rejection, pre-render without render disposal.
- Universal arm64/x86_64 bundle built with Xcode; plist, exported entry points, and ad-hoc code signature checked.
- Core preview image inspected: nested rectangular screens and asymmetric markers show different historical angles after the outer rotation has returned to zero. `output/DreamBack-core-preview.gif` is produced by the real core on synthetic input. **It is not an AE render.** Reproduce via `tools/render_core_demo.cpp`.

## Actual AE status

**Not host-validated.** AE 26.3 is installed and running with an unsaved user project. The other version directories do not contain a runnable application. The application plug-in directory requires administrator access; installation returned permission denied and noninteractive sudo reported that a password is required. No plugin was installed and the existing AE project was not restarted, edited, saved, or closed.

The JSX demo is delivered but has not been executed in AE. Export, preview parity, isolated rendering, scrubbing, real historical input/parameter checkout behavior, and actual host cancellation remain unverified. Passing core/harness tests does not establish a working AE build.

## Host acceptance checklist

1. Save all work, quit AE, install `DreamBack.plugin`, and relaunch AE. Check Effect > DreamBack and About for version 0.1. Check that the default controls match the README and that all required controls have stopwatches.
2. Run `demo/DreamBack_Demo.jsx`. Confirm it creates five 1920×1080, 30 fps demo comps and source precomps without closing the existing project. Save a separate demo AEP for subsequent export tests.
3. Preview comp 01 at full/half/quarter resolution. Confirm the centered rectangular tunnel is visible over the opaque background. Set Feedback to 0 and then Mix to 0 separately; each should match the upstream input exactly.
4. Preview comp 02 through 1–2.8 seconds. The outer stage holds Rotation at zero after 1.6 seconds while deeper images still show the earlier left/right gesture. Increasing Delay slows the propagation; changing Zoom affects each generation.
5. Preview comp 03 through 2–3.8 seconds. The offset gesture must continue traveling inward after the outer offset returns to zero. Compare comp 04 at 2.95 and 3.2 seconds: the yellow element is absent in the source after 3 seconds but remains in historical screens.
6. Preview comp 05 over its background. Look at alpha alone and disable the background. Trails must carry alpha; no black-fringe darkening or alpha-zero color should become a visible rectangle in Overlay.
7. Purge the cache. Render frame 60 in isolation, then frames 110, 10, and 60. Compare frame 60 pixel-for-pixel against the first render. Scrub backward repeatedly and compare with forward previews.
8. Cache a rotation sequence, change a historical Rotation keyframe around 1.2 seconds, and confirm affected later frames lose their cache and visibly update. Repeat with a source-content change at 2.5 seconds. Restore the source/keyframe afterward.
9. Render comp 02 through the Render Queue and compare exported frames with preview at the same bit depth, color settings, and resolution. Repeat in 16 bpc. Native 32 bpc is unsupported; confirm no corrupted pixels when AE converts or rejects a float request.
10. Enable ROI off-center; compare that rectangle to a full-frame render, including after animated Position/Rotation. Test source PAR 2:1, Half/Quarter, and independent horizontal/vertical downsampling. Test an upstream blur that expands bounds; original layer coordinates should remain stable and expanded bounds should be clipped.
11. Test beginning/end of source, moving the layer's start time, and positive stretch. Time-remapping on the DreamBack layer and negative/zero `time_step` should show the documented error. Remapping inside the source precomp should be usable. Avoid nonlinear outer remap and preserve-frame-rate combinations until validated.
12. Cancel a heavy preview/export. AE must remain responsive and subsequent renders must work. Try separate DreamBack layers simultaneously; no MFR support is advertised, and one instance must not influence another.

Record AE version, macOS version, bit depth, color management, preview resolution, screenshots, and any exact error text before marking host acceptance complete.
