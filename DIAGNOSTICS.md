# Lyria Studio - Central Diagnostic Hub & Run-time Error Log

This document serves as the central log and mitigation archive for Lyria Studio. Any critical failures, bottlenecks, or browser exceptions caught at run-time are updated here for automated AI reference and developer diagnostics.

---

## 🔍 Pre-commit & Dev Build Health Matrix

| Error Code | Category | Symptom | Status | Recommended Mitigation / Solution |
|---|---|---|---|---|
| `ERR_AUDIO_AUTOPLAY_LOCKED` | Audio / Browser | `AudioContext` initialized as `suspended` on page load. No sound output. | **Mitigated** | Render an overlay blocking standard input, requiring a click/gesture to resume `AudioContext`. |
| `ERR_CPU_THROTTLING_LAG`| Graphics / render | Frame drops on heavy SVG track grids / Bass pulses. | **Monitored** | Consolidate `requestAnimationFrame` loops, toggle off secondary tracks if hardware acceleration is unavailable. |
| `ERR_MIC_CROSSTALK_DENIED`| Media devices | Standard capture throws `NotAllowedError` on microphone initialization. | **Handled** | Degrade gracefully to synthetic sound arrays or direct prompt generation without crashing components. |
| `ERR_API_KEY_NULL` | Networking / API | `GoogleGenAI` calls throw authentication exception. | **Handled** | Pre-flight check via local workspace or prompt user to load credentials cleanly. |
| `ERR_TS_UNEXPECTED_NODE_CAST`| TypeScript compile| `Property analyser / gain does not exist on type unknown`. | **Resolved** | Enforce strong typing, e.g. `(Object.values(channelNodes) as Array<{analyser: AnalyserNode, gain: GainNode, pan: StereoPannerNode}>)`. |

---

## 📈 Real-Time Critical Failure Logs

*This section is dynamically appended / logged during active user and AI development runtime sessions.*

### [LOG_ENTRY_001] Browser Audio Autoplay Locked
- **Detection Method**: Kdenlive DAW auto-detection (`tempCtx.state === 'suspended'`)
- **Severity**: Low (Warning)
- **Mitigation applied**: Rendered high-contrast Audio Overlay offering an explicit user gesture pathway to trigger `.resume()`, which securely primes the audio thread.

### [LOG_ENTRY_002] Critical Render State Overflow
- **Detection Method**: Caught by `ErrorBoundary` wrapper.
- **Severity**: Fatal / Medium
- **Mitigation applied**: Reset application state via fallback boundary or reset handler, avoiding local storage pollution.

---

## 🛠️ Instructions for Future AI Assistants
1. **Never suppress type safety check warnings.** Avoid adding generic `any` casts where possible; use defined, explicit union types and clean type assertions (e.g., `as AudioContext`, `as Array<...>`).
2. **Handle user-interactions with high priority.** Browsers require direct human actions (such as `onClick` or `onKeyDown`) to run sensitive hardware actions. Keep interactive buttons highly accessible and visually obvious.
3. **Keep render pathways optimized.** Minimize raw SVG node-counts and use optimized rendering frames for canvas elements (or run inside a single `useRef` anim loop).
