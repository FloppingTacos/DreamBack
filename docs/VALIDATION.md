# Validation — October 7, 2026

## Verified automatically

- 43 maths, schedule, generated-expression and syntax checks: monotonic/end-anchored curves; opposite bias; sphere/cube/band distinctions; hard/soft falloff; zero range; Life captured at birth; absolute source time when a slot is recycled; exclusive playback switching; source boundaries; fades; deterministic seeks; scale/Focus offsets; default stack endpoints; signed temporal sampling; blur progression; generated JSX/expressions parse.
- 25 AE adapter/panel-event mock checks: exact structural count; source/controller/focus links; source comments preserved; generated copies added/removed without replacing survivors; master keyframes preserved; unrelated layers preserved; renamed systems resolved; blur effects actually disabled; blending mode application; panel edits add current-time keys; Life changes mark timing dirty; rebuild stores its fingerprint; baked per-slot lifetime tables; playback mode changes need no recreation; invalid counts rejected.
- The installed Fast Camera Lens Blur binary/resources were inspected read-only: correct vendor match name and `Radius` label found. Its actual AE load/license/parameter operation is unverified.
- Ready-to-install panel, demo and host-QA bundles generated from the source. No Adobe SDK or vendor plugin is bundled.

## Panel session regression

User reported that Select Controls/Select Focus did nothing and the blur checkbox required a loaded system. The initial implementation depended exclusively on a panel-local controller variable that resets when the panel is reopened or rigs are created by the separate demo script. The fix discovers the selected system, validates cached references, or finds the only matching system in the active comp. Selection buttons now display actionable errors instead of only writing an easily missed status line. Failed blur toggles restore the checkbox.

Nine regression checks exercise the real panel callbacks in a ScriptUI mock: reopen then select controls/focus; reopen with a Focus target selected then disable blur; one-system auto-discovery; selection overriding cached context; cached/tab-specific lookup; ambiguous multi-system selections and comps; AE comment line-ending normalization. These are not actual AE host tests.

## Unverified host behavior

The After Effects native UI connection timed out before running the panel or QA script. No existing project was closed, saved, or restarted. ScriptUI rendering/docking, real AE parenting compensation, real expression evaluation, real blur binding, undo behavior and rendered visual output are unverified. Passing Node and adapter mock tests does not establish a working AE panel.

## Acceptance checklist

1. Run `dist/DreamBack_Host_QA.jsx`. It should finish with host checks passed and no expression errors. Record AE version and full failure text if not. Undo its group to remove the generated QA rigs/folder if desired; existing project data is not saved by the script.
2. Open the panel with Run Script File. Check both tabs, every category, resizing and dropdowns. Install as a ScriptUI panel and verify docking.
3. Run the demo. Preview Echo with an actual camera, alpha graphics and footage. Check uniform spacing and front/back bias, X/Y steps, scale, all rotation axes, opacity curve, and blur Radius ramp.
4. Set 10 copies, then 3, then 12. Confirm actual owned layer counts match, existing controller keyframes remain, and unrelated layers are unchanged. Select source/copy/controller/focus and reload the system after closing/reopening the panel.
5. Keyframe controls on the null; close the panel and render. Reopen the project and panel, load the system and compare values. Rename and reorder controller/source/target layers; Layer Control links should survive.
6. Verify signed Delay Frames, both sequence directions and all three source boundaries at source beginning/end. Test source start offset, stretch and existing time-remap keys. Use a precomp for content with animated outer effects/masks so its full appearance is retimed.
7. Move/rotate/scale the Focus target in Sphere, Cube and Linear Band modes. Check full/half/zero influence and negative values. Animated Focus Z must not cause expression cycles. Band should ignore local X/Y distance.
8. Emit a bouncing alpha ball. At each reuse, geometry resets while source sampling advances to the new absolute time. Switch Advancing/Hold from the dropdown after creation. Held content must remain frozen throughout one life, including when Delay or Focus Time is animated.
9. Keyframe Life from 2 to 4 seconds, click Update Emit Timing, and confirm particles born before the change finish with their captured Life. Newly born particles take the value at their birth. Check speed-at-birth and source launch position/scale/orientation.
10. Render a frame, jump forward/backward and rerender it. Compare preview/export, source timing and geometry. The result should not depend on render order or an open panel.
11. Measure performance with 10, 30 and 100 copies using simple and complex sources, blur off/on, same-time vs delayed frames. Do not claim zero cost for opacity-hidden particles. Check 8/16/32 bpc subject to vendor blur support and Classic 3D vs other renderers.
12. Check undo for Create/Update/Prepare operations and errors. Generated transforms/expressions are owned by DreamBack; use controller controls rather than manually replacing copy expressions.

Known scope limits: one Focus target; signed-bias curves rather than drawn Bezier curves; blend setup affects copies only; camera-depth blur and shared-bound evaluation require host performance checks; Life requires timing update after direct timeline edits; no independent emission-rate control; source precomposing can change complex existing camera/parent/expression rigs, so validate those cases separately. The original source remains the emitter/leading layer, without generated-copy Focus/falloffs.
