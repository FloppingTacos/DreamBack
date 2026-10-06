# DreamBack

A native After Effects prototype for delayed camera feedback. Animate Position, Zoom, and Rotation on a precomp layer: each gesture travels into the nested images because every generation contains earlier feedback and uses its own historical controls.

**Status:** macOS universal plugin compiled (Apple Silicon + Intel), ad-hoc signed. Core and SDK callback harness tests pass, including sanitizers. **The plugin has not yet been loaded or rendered inside After Effects.** The demo JSX also requires host verification. See [validation](docs/VALIDATION.md) for the remaining checks.

## Install the compiled prototype

1. Extract `DreamBack-0.1-mac.zip` from the repository's `output` directory.
2. Save your work and quit After Effects.
3. Copy `DreamBack.plugin` to `/Applications/Adobe After Effects 2026/Plug-ins/` using Finder. macOS may ask for an administrator password. Keep only one installed copy.
4. Reopen After Effects. Choose **Effect > DreamBack > DreamBack** on a precomp layer.
5. Use an **8 or 16 bpc** project. The prototype does not support 32 bpc, GPU rendering, or Premiere Pro.

The bundle is a local development build, not notarized or Developer ID signed. The build process does not distribute Adobe SDK headers or implementation files. To uninstall, quit AE and move `DreamBack.plugin` out of the Plug-ins folder.

## Try the demo

Choose **File > Scripts > Run Script File…** and run [`demo/DreamBack_Demo.jsx`](demo/DreamBack_Demo.jsx). It adds an undoable folder to the existing project; it does not close or save that project. Save a separate demo project yourself if desired.

The script creates 1920×1080, square-pixel, 30 fps, eight-second source precomps with a rectangular frame, asymmetric orange marker, moving green shape, typography, and a yellow element that disappears at 3 seconds. It creates five main compositions:

- **01 - Centered tunnel:** default Screen behavior over an opaque source.
- **02 - Rotation gesture:** left/right gesture from 1–1.6 seconds, then hold. Inspect 1.6–2.8 seconds for the gesture traveling deeper.
- **03 - Position wave:** offset gesture from 2–2.6 seconds, then hold. Inspect 2.6–3.8 seconds.
- **04 - Disappearing element history:** the yellow element leaves the source at 3 seconds; its delayed images remain for up to 36 frames.
- **05 - Transparent overlay:** transparent graphics and typography over a background below the processed layer.

For your own project, animate content inside a precomp, place it in a main comp, apply DreamBack to that layer, and animate the effect controls. Do not apply multiple DreamBack instances in the same feedback source chain for the initial test: nested instances multiply the cost of history reconstruction.

## Controls

| Control | Default | Behavior |
| --- | --- | --- |
| Mode | Screen | Screen / Overlay; historical stages use their historical mode |
| Delay (frames) | 3 | Integer 1–120, not keyframeable |
| Depth | 12 | Maximum generations 1–32, not keyframeable |
| Feedback | 90% | Return strength 0–100%, keyframeable |
| Zoom | 90% | Scale per generation, 1–200%, keyframeable |
| Position | [0, 0] | Offset in layer pixels, keyframeable |
| Rotation | 0° | Clockwise per generation, keyframeable |
| Pivot | Layer center | Scaling/rotation center in layer pixels, keyframeable |
| Mix | 100% | Original to reconstructed output, applied once at current time |

Zero Position and a centered Pivot keep the tunnel centered. Point values shown in AE are full-resolution layer coordinates; AE adjusts point checkouts for reduced-resolution previews.

## Build and test

Requires macOS 12+, Xcode (C++17 compiler and Rez), and an extracted Adobe After Effects SDK containing `Examples/Headers/AE_Effect.h`. No CMake or third-party image libraries are required for the plugin.

```sh
export AE_SDK_ROOT="/path/to/AfterEffectsSDK"
make test
bash tools/test_sdk.sh
make plugin
```

The tested SDK is the locally supplied copy at `Documents/AfterEffectsSDK/AfterEffectsSDK`. The adapter uses `PF_WorldSuite2`, `AEGP_PFInterfaceSuite1`, and `AEGP_LayerSuite9` (AE 23+). Output is `build/DreamBack.plugin`, with arm64 and x86_64 binaries. Build flags and signing are reproducible in `tools/build_mac.sh`.

Optional install helper, after saving work and quitting AE:

```sh
bash tools/install_mac.sh "/Applications/Adobe After Effects 2026"
# If the application folder is administrator-owned:
sudo bash tools/install_mac.sh "/Applications/Adobe After Effects 2026"
```

The helper refuses to replace an existing bundle. The automated build runs locally and never installs, closes AE, or changes AE preferences.

## Image behavior

DreamBack reconstructs `F0(t)=S(t)` and `Fn(t)=Composite(S(t), Transform(Fn-1(t-Delay), controls(t)))`. It loads the oldest source first, then advances toward the requested time. The final output is `(1-Mix(t))*S(t) + Mix(t)*FDepth(t)`. Animated historical Mix is intentionally irrelevant.

Sampling is bilinear on premultiplied RGBA, with transparent padding. Let `T` be the transformed return image (including edge padding), `g` the transformed rectangle's bilinear coverage, and `f` Feedback in 0–1:

- **Screen:** `C = (1-f*g)*S + f*T`, for both RGB and alpha. Geometric coverage is independent of image alpha. The current source remains outside the returning rectangle. Inside, feedback replaces a weighted portion of the source even if the source is opaque. A transparent delayed image can make that screen area transparent. This is rectangular camera-screen placement, not the Photoshop Screen blend operation.
- **Overlay:** add premultiplied channels, `A = clamp(S.a + f*T.a, 0, 1)` and `RGB = clamp(S.rgb + f*T.rgb, 0, A)`. This is bounded additive light and alpha, so transparent trails remain usable above another layer. It may saturate quickly on opaque bright footage; reduce Feedback. Hidden color at zero alpha is removed by Overlay's alpha bound. Screen interpolates those channels; Mix zero preserves the original source.

Arithmetic runs in AE's supplied working space. No automatic linear-light conversion, tone mapping, HDR, perspective, glow, or camera integration is implemented.

## Limits

- **Time:** Delay uses `Delay * in_data.time_step` SDK ticks; seconds are ticks divided by `time_scale`. Every historical stage uses `current_time - stage*Delay*time_step`, including nonintegral current times. Layer time is distinct from main-comp time. Positive constant stretch follows AE's supplied step. Time remapping on the effect layer is explicitly rejected; reversed or zero-step requests are rejected. Put remapping/reversal inside the source precomp. Nested comps with preserve-frame-rate changes or nonlinear remapping outside the effect layer are not validated; use an ordinary 30 fps main-comp layer initially.
- **Source boundaries:** negative layer times are transparent black. Nonnegative temporal checkouts let AE supply the upstream source, including transparency beyond the source end. Layer in/out trimming does not redefine source validity. Near the beginning, Screen may show a dark/transparent inner rectangle while history fills. No frame is clamped to frame zero.
- **Coordinates:** feedback is constrained to the original layer rectangle. Expanded upstream bounds are clipped to it. Historical inputs come through SmartFX, include earlier effects, and are placed using each world's origin and row stride. Rotation corrects for pixel aspect ratio and independent horizontal/vertical downsampling. Output crops copy from the reconstructed full layer. These mechanisms are covered by the SDK harness; actual host ROI, origin, and preview parity remain unverified.
- **Formats:** explicitly inspect world format; only ARGB32 (8-bit) and ARGB64 (AE 16-bit, white = 32768) are read/written. Unsupported formats return an error; float pixels are never interpreted as integers. AE may convert a 32 bpc request for an effect without float support; this prototype does not claim native 32 bpc support.
- **Performance:** CPU only, roughly `(Depth+1)` upstream frame evaluations plus `Depth` full-frame bilinear composites per output frame. Three reusable float RGBA images: about 95 MiB at 1080p, 380 MiB at UHD 4K, plus AE's own upstream buffers/cache. Scratch images are capped at 11 million pixels (about 504 MiB). AE may retain history dependencies independently. Start at Half or Quarter preview resolution. Full-frame upstream requests intentionally trade performance for correct rotated/translated history.
- **Concurrency:** no persistent feedback framebuffer or history cache, no mutable rendering globals, and no Multi-Frame Rendering capability flag. History checkouts declare dependencies with automatic wide-time input; parameter edits should invalidate dependent frames, but host cache validation is still pending.

[SDK design notes](docs/SDK_NOTES.md) explain checkout lifetimes and the verified SDK contracts. [Validation checklist](docs/VALIDATION.md) separates automated evidence from the remaining AE checks.
