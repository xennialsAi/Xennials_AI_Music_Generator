# Agent Instructions & Project Context

This file serves as the core reference for any AI agent or developer updating **Lyria Studio**. Make sure to adhere to these design parameters, performance constraints, and architectural guidelines during any future modifications.

---

## 🚫 Autoplay Policy & Audio Engine Locking
The browser strictly restricts standard audio tags or Web Audio `AudioContext` from making output sounds unless initialized during an active user interaction session (click, tap, keyboard input).

### 1. The Locking Pattern
* On entry, the Kdenlive DAW detects if the Web Audio instance is initialized as `suspended` and starts in a locked/muted state.
* **Workaround (Unmute & Activate Overlay)**: To unlock browser audio dynamically, the editor provides a secure modal overlay and an upper unmuting switch. Clicking these triggers standard `.resume()` calls on the AudioContext and executes a tiny, silent oscillator tick to register high-priority human gesture permissions across chrome tracks.
* **Strict Constraint**: Ensure future updates to the synthesized chord sequencer, live bass filters, or playheads never bypass or break this security pattern, as doing so will crash state-level sound initialization handlers.

### 2. Browser Autoplay Restriction Policies
Modern web browsers (such as Google Chrome, Chromium, Safari, and Firefox) strictly enforce Autoplay Protection Policies.
* **The Suspended State**: Upon loading any web application, the browser automatically forces all Web Audio AudioContext instances into a suspended state by default.
* **Programmatic Blocks**: Programmatic attempts to resume the audio context (such as triggering play from an asynchronous timer or a React useEffect hook) are detected as non-human gestures and blocked blockwise.
* **The Gesture Requirement**: To resolve these blocks, the browser requires an explicit, direct, and synchronous human interaction (such as clicking an active button) as a security handshake to activate sound layers.

### 3. How to Instantly Fix This in Lyria Studio
We have integrated a standard security workaround matching high-end digital audio workstations:
* **Method A: Use the "Unlock Engine" Button (Recommended)**:
  On page entry, look at the center visual preview canvas monitor. You will see a dark overlay labeled Autoplay Protection.
  Click the Unlock Engine Output button. This directly invokes the synchronous Web Audio unlock handler, registers your gesture permission with the browser, and plays a microscopic silent pulse to register safety clearing.
  Alternatively, click the blinking red Unmute Engine button in the top menu bar to achieve the same gesture unlocking.
  Now, click Play—all synths, loops, and generated audio stems will play instantly.
* **Method B: Synchronous Trigger Handler (For Code Maintenance)**:
  If you are developing or maintaining the audio handlers and want to ensure the play button itself always triggers playback without external overlays, ensure the ctx.resume() call is executed synchronously within the interactive click handler rather than waiting for an asynchronous React state change inside useEffect:

---

## ⚡ Performance Health & Hardware Warnings
When updating or introducing changes to the post-production DAW, maintain a high-end, responsive system layout by minding these computational variables:

### 1. CPU Throttling
* **Dynamic Canvas Rendering**: The live monitor constructs high-performance SVG visualizer tracks, circular low-frequency bass pulses, and complex multi-channel grid oscilloscopes in real-time.
* **Optimization Constraint**: Running more than 3 concurrent high-frequency canvas analysis loops may cause frame degradation on low-end terminals. Ensure that rendering intervals and animate frame loops are properly combined or throttled. Keeping browser hardware acceleration active is highly recommended for hardware-supported WebGL rendering.

### 2. Audio Crosstalk / Recording Permissions
* **Microphone Access**: Standard browser recording/media device permissions must be granted when accessing the Mic Vocal Capture companion components.
* **Graceful Degradation Rule**: If permissions are denied, the system has been built to load generic placeholder streams gracefully. Do NOT attempt to throw blocking synchronous alerts or let the execution fail; fail-safes are required to prevent application-wide crashes.

---

## 🎥 Architectural Guidelines: Remotion & Future Features
Remotion principles provide strong guidance for offline non-realtime canvas captures and future server-side pipelines:

### 1. Frame-Accurate Visual Canvas Operations
* To keep animations and timeline text tracks perfectly synchronized, avoid relying on unstable wall-clock seconds. Reference canvas frames as physical offsets:
  $$\text{frame} = \lfloor \text{currentTime} \times 30 \rfloor$$
* Use this precise frame index to fire specific effects at reliable tick boundaries (e.g., glitch sweeps, subtitle overlays, and slider offsets).

### 2. Offline Render Exports
* The client exports currently record active canvas buffers using a real-time stream. Because host performance dictates capture quality, future non-realtime renderers can paint each index frame sequentially into static data URLs, decoupling export fidelity entirely from the machine's processor speed.
