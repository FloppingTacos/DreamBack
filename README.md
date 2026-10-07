# DreamBack 0.2 — Echo / Emit panel

DreamBack is now an After Effects **dockable ScriptUI panel** that generates editable 3D layer systems. The native video-feedback concept has been abandoned; its code remains in Git history and on `codex/dreamback-prototype`. This branch contains the new panel only.

**Status:** installable scripts built. 43 maths/generated-expression checks and 16 AE adapter mock checks pass. **Not yet verified inside AE:** the desktop UI connection timed out before the scripts could be run. `dist/DreamBack_Host_QA.jsx` provides reproducible host checks. See [validation](docs/VALIDATION.md).

## Install

The ready-to-install file is committed in this repository: **[`dist/DreamBack.jsx`](dist/DreamBack.jsx)**. On GitHub, download that file using **Download raw file**, or download the `codex/dreamback-panel` branch ZIP and extract it.

You can immediately try it using **File > Scripts > Run Script File…** in AE; it opens as a floating panel and requires no restart.

For docking, copy `DreamBack.jsx` into:

```text
/Applications/Adobe After Effects 2026/Scripts/ScriptUI Panels/
```

The folder may require administrator access. Restart AE after saving your work, then choose **Window > DreamBack.jsx**. AE versions supporting Dropdown Menu Controls are required; AE 2026 is the initial target. There is no native plugin bundle to install for this version.

Dependency: **Fast Camera Lens Blur** by TumoiYorozu. The installed copy was found at `/Library/Application Support/Adobe/Common/Plug-ins/7.0/MediaCore/TumoiYorozu/FastCameraLensBlur_AppleUnivBin.plugin`. Its PiPL match name is `TumoiYorozu FastCameraLensBlur`; its parameter label is `Radius`. The script checks availability in the running host before creating a rig and reports a missing parameter rather than guessing a different blur. Actual host parameter binding/license operation still needs verification.

## Create and edit

1. Select one **3D precomp or time-remappable footage layer**.
2. For shapes, text, stills, or an appearance containing animated masks/effects, use **Prepare Selected Source** first. This precomposes the selected layer and enables 3D on the result. It is undoable.
3. Choose **Echo** or **Emit**, set Copies (1–200), and click **Create System**.
4. Choose a control category in the panel, or select the **DreamBack Controls** null to keyframe its sliders/dropdowns directly.
5. To revisit a system, select its source, controller, focus target, or generated copy and click **Load Selected**.
6. Change count and click **Update Copies**. Existing master-control keyframes and surviving layer identities are retained. Only this system's generated layers are removed/added.

Each system has a master 3D null, an original source/emitter, a 3D Focus target, and exactly the requested number of generated copies. Copies use Layer Controls, so controller/source/target links survive renaming and reordering. Comments identify ownership; original source comments are retained. Do not delete the identifying `DB2|…` line or the layer-link controls.

The source is parented to the master null, and copies share that parent. Moving, rotating, or scaling the master moves the whole system, including its Focus target. The original source/emitter retains its own appearance; sequence falloffs and Focus affect generated copies. Generated-copy audio is disabled.

All panel actions that change the project form an undo group. Slider edits commit on release; entering a value commits on Enter/focus loss. If a property has keyframes, panel edits create/update a keyframe at the composition's current time. The panel does not remove existing keyframes. Changes to a property controlled by its own expression must be made in that expression; a new keyframe does not override it.

## Echo

- **Copies:** structural setup value in the panel. No dormant 100-layer allocation and no animated Active Copies promise. `Copies (built)` on the master records the built count and is not an animation control.
- **Distance:** uniform interval by default; total source-to-last-copy span is `Copies × Distance`. Direction chooses system-local +Z or −Z.
- **Distance Curve:** redistributes copies within that same span. Zero is linear; positive biases toward the source/front, negative toward the end/back. Curves are signed bias controls (−100…100), not hand-drawn Bezier editors.
- **X / Y Step:** cumulative displacement across the sequence, using the distance curve. Use the master null for whole-system translation.
- **Scale Step:** compounded percentage per copy. `+5` produces 105%, 110.25%, etc. Scale Curve changes where that progression accumulates.
- **Rotation X/Y/Z Step:** cumulative degrees per copy, with a shared Rotation Curve.
- **Opacity Falloff:** reduction at the last copy, 0…100%; Opacity Curve shapes the ramp.
- **Maximum Blur:** Fast Camera Lens Blur Radius at the farthest active generated copy when there is an actual camera; Blur Curve shapes the depth ramp. Two shared master expressions calculate camera-space near/far bounds, including Focus position offsets. With no explicit camera, Echo falls back to ordered +Z/−Z depth and Emit to normalized age. Default zero. A single active copy receives Maximum Blur.

Blending mode is applied to all generated copies from the panel. The menu includes the AE blending modes available in the running host. The original source keeps its own blend mode. Blending mode is a setup choice, not a keyframeable expression control.

## Time

Copies share the source's start range and extend to the main comp's end; temporal differences use Time Remap rather than staggered layer start times in Echo.

**Delay Frames** is signed: positive samples earlier frames; negative samples later frames. **Delay Direction** selects which end of the sequence anchors the ramp. Front/back means sequence order, not camera depth.

Time Remap samples the source layer's existing time-remap clock. Outside its first/last time-remap keys, that clock continues with the endpoint slope so the boundary choice works predictably. **Source Boundary:** Hold Ends, Loop, or Transparent. The last held sample is the last valid source frame, not the duration boundary. Precompose arbitrary original time-remap expressions if you need their own behavior outside their keyed span preserved.

Retiming affects the source image/precomp contents. Animated effects/transforms on the outside layer are not baked into those pixels; put the animation whose entire appearance should be delayed inside the source precomp. Native copy transforms remain controller-driven.

No optical-flow/frame-blending interpolation is generated. Expressions are lightweight, but different sample times still require different source-frame renders. Complex source comps and per-layer blur can be expensive. The panel's blur checkbox disables the actual generated blur effects for preview; it does not merely set their Radius to zero.

## Focus

Focus Shape is an exclusive dropdown, changeable after creation:

- **Sphere:** radial distance around the target.
- **Cube:** maximum absolute local X/Y/Z distance, giving equal-sided bounds before target scaling.
- **Linear Band:** distance along the target's local Z only; unlimited X/Y extent. Rotate the target to orient the band.

**Range** is the outer extent. **Feather** controls how much of that extent transitions from full influence to zero: zero is a hard boundary; 100% feathers throughout the range. **Focus Curve** shapes that transition. The target's rotation and scale affect its influence space; scaling it can stretch a sphere into an ellipsoid or a cube into a box.

Focus adds Scale (%), X/Y/Z, X/Y/Z rotation (degrees), source-time offset (frames), and blur Radius. `Focus Scale = 5` makes a fully influenced copy 5% larger and a half-influenced copy 2.5% larger. Source-time offsets can be positive or negative.

Proximity is calculated from the baseline position **before** Focus offsets. This avoids cyclic position dependencies and unstable self-influence. One target is supported per system. Focus does not modify the controller, target, or original emitter.

## Emit

A fixed pool of the requested number of layer slots is reused. Initial births are evenly phased over the initial Life. Each slot restarts when its own sampled lifetime expires; changing Life can make subsequent births unevenly spaced, which is intentional. There is no separate emission-rate control in 0.2.

- **Life:** keyframeable, evaluated at each birth. A particle keeps the Life it received at birth. Minimum lifetime is one main-comp frame.
- **Speed:** system-local pixels/second, also sampled at birth. Existing particles retain their launch speed.
- **Travel Curve:** adjusts progress through a particle's lifetime; zero gives constant-speed movement. Its end distance remains launch speed × captured Life.
- **Fade In / Fade Out:** seconds within each particle's captured Life. They multiply when their durations overlap.
- **Start Size / End Size:** percentage of the source's launch scale, with Scale Curve shaping interpolation.
- **Playback Mode:** one exclusive dropdown; can be changed after creation without rebuilding. **Advancing Frames** follows current source time with an age-dependent delay ramp. **Hold Birth Frame** captures a birth-time source sample, including the slot's delay and birth-time Focus time offset, and keeps that frame until the slot is reused. The next birth captures its new absolute source time, never source frame zero unless the chosen boundary mode maps there.

Birth position, source scale/rotation, Life and Speed are sampled at birth. Master-null movement, Focus, curves, opacity, fades, size endpoints, and other controls remain live. Hold mode freezes its source-time contributors at birth; moving Focus later can still affect geometry/blur but cannot accidentally unfreeze the held image.

**Update Emit Timing / Life Keyframes** is necessary after editing Life keyframes directly on the null, source in-point, composition duration, or Life expression dependencies. Life edits through the panel update timing automatically. The schedule is embedded in expressions, so rendering works with the panel closed and in any request order. Ordinary transform/Focus/playback edits need no schedule update.

Birth lookup uses binary search, with no frame-by-frame integration or persistent simulation state. Schedules are capped at 20,000 total births and a conservative per-slot expression-size budget. Increase Life, shorten the comp, or reduce Copies if a schedule exceeds the budget. A slot with no births in the comp is disabled. Other slots remain real AE layers; fading them to zero does not guarantee zero evaluation cost.

## Demo / host verification

Run [`dist/DreamBack_Demo.jsx`](dist/DreamBack_Demo.jsx) through Run Script File. It adds an animated ball-on-alpha precomp plus Echo/Focus, advancing Emit, and held-frame Emit demos. It does not close/save your existing project. The Emit demos contain keyframed Life.

Run [`dist/DreamBack_Host_QA.jsx`](dist/DreamBack_Host_QA.jsx) for script/API and expression checks. It adds an undoable QA folder and reports pass/failure in an alert. The script does not prove rendered pixel quality; follow the visual checklist in [validation](docs/VALIDATION.md).

## Build / tests

Node.js is only needed to rebuild/test; installing the single `.jsx` needs no Node, compiler, npm packages, or native SDK.

```sh
node tests/core.mjs
node tests/rig.mjs
node tools/build.mjs
bash tools/package.sh
```

`src/` contains the maths, controls, expression generator, AE integration, and panel. `dist/` contains committed ready-to-install scripts. `output/DreamBack-0.2-panel.zip` contains the panel, demo, host QA and documentation. Adapter mocks validate our calls and preservation logic, not AE's real execution or ScriptUI layout.
