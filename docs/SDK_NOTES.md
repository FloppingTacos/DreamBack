# SDK integration notes

Primary sources inspected before implementation: the supplied `AE_SDK_Guide.pdf` (471-page offline guide dated June 24, 2025), local SDK headers, and the SDK's SmartyPants and Checkout samples. No Adobe source/header code is redistributed. Sample implementation code was read as reference, not copied into the prototype.

| Topic | Supplied guide reference | Local API evidence / implementation |
| --- | --- | --- |
| Temporal source with upstream effects | Parameter checkout behavior, p.145 | SmartFX input parameter 0; `PF_PreRenderCallbacks::checkout_layer` receives explicit time/step/scale |
| Source before/after valid footage | Parameter checkout behavior, p.145 | Transparent negative stages internally; positive checkouts follow the host's source bounds |
| Time units, stretch/remap | `PF_InData`, pp.69–72; Time, pp.188–190 | Time in layer coordinates; Delay multiplied by `time_step`, not guessed fps or `local_time_step` |
| Historical point origin | `PF_InData`, p.73; buffer expansion, p.75 | Checked-out points are shifted by the **current** pre-effect source origin even for past times; subtract the current origin consistently |
| Preview/PAR mapping | Pixel aspect ratio chapter, pp.147–150 | Point controls are downsampled by AE; displayed rendered-pixel PAR = source PAR × downsampleY/downsampleX |
| Smart pre-render input declaration | SmartFX, pp.204–209 | Every nonnegative stage gets a unique checkout ID and full original-layer request; output domain is the original layer |
| Pixel checkout and release | SmartFX, pp.210–211 | At most one pixel checkout per ID; RAII explicitly checks pixels in before fetching the next stage |
| Pre-render-only disposal | SmartFX, p.207 | Host owns the successful `pre_render_data`; `delete_pre_render_data_func` deletes its immutable plan |
| Temporal invalidation | `AE_Effect.h`, automatic-wide-time flag comments | Wide-time + automatic wide-time flags track all historical input and parameter checkouts; no plugin cache |
| Format introspection | `AE_EffectCBSuites.h` | `PF_WorldSuite2::PF_GetPixelFormat`, ARGB32/ARGB64 only |
| Remapping guard | `AE_GeneralPlug.h` | Effect layer via PF Interface suite; Layer Suite9 time-remapping flag rejected |

The request plan contains at most 33 time stamps, IDs, and control structs; it contains no images. Non-layer parameters are checked out at their stage's historical time in pre-render and checked in immediately, including on exceptions. Historical Mix is not sampled: only the outer current Mix is used. Delay and Depth are fixed controls.

Successful SmartFX layer declarations belong to the host and have no manual pre-render check-in callback. Pixel checkouts use explicit check-in RAII; the output world belongs to the host and has no output check-in callback. Suites are acquired/released per call. On cancellation, checkout errors, unsupported buffers, or allocation errors, stack unwinding releases owned resources. Pre-render failure deletes the unpublished plan locally; successful pre-render transfers disposal to the host, even if smart render never follows.

Scratch storage is three float RGBA images, independent of depth. The oldest source initializes F0; each later source and historical controls compose a new stage into an alternate buffer, then swap the two return buffers. At stage zero, the current source is available for final Mix. All requested output crops are copied from the same reconstruction. No request reads DreamBack's own output through AE.

The runtime and Rez metadata share `Metadata.h`, and the SDK harness verifies version/flags agreement. No float/GPU/MFR or pixel-independence flag is advertised. `NON_PARAM_VARY` ensures that source-time progression is not collapsed just because the current source/control values happen to match.

Remaining uncertainty is host behavior, especially SmartFX reduced-resolution request/world origins, upstream expanding effects, nested timeline changes, and historical cache invalidation. The harness validates callback usage and the implemented coordinate model; it cannot prove AE's actual scheduling or conversion behavior. The prototype is deliberately labeled unverified in AE until the manual checklist has run.
