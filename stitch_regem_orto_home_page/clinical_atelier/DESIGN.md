# Design System Strategy: The Clinical Atelier

## 1. Overview & Creative North Star
**Creative North Star: "The Regenerative Luminary"**

This design system moves beyond the standard "medical template" to create a bespoke digital environment that mirrors the precision of a high-end surgical suite and the warmth of a luxury wellness atelier. We reject the rigid, boxy layouts of traditional healthcare software. Instead, we embrace **The Regenerative Luminary**—a style characterized by deep tonal immersion, fluid layering, and high-contrast editorial typography.

The system breaks the "template" look through:
*   **Intentional Asymmetry:** Hero sections and content blocks utilize off-center alignments to create a sense of organic movement.
*   **Depth through Luminescence:** Rather than flat shadows, we use "light leaks" and glassmorphism to imply sophisticated technology.
*   **Signature Textures:** The dot-pattern from the logo is repurposed as a functional "data texture," appearing in backgrounds at low opacity to provide a rhythmic, scientific pulse to the interface.

---

## 2. Colors & Surface Philosophy

### The Tonal Palette
The palette is anchored by a deep, authoritative navy (`primary: #021541`) and energized by a surgical cyan (`secondary: #006876`). Accents of "Steel" and "Silver" are achieved through the neutral surface tokens.

### The "No-Line" Rule
**Borders are strictly prohibited for structural sectioning.** 1px solid lines create visual clutter that contradicts the "regenerative" feel. Instead, boundaries are defined by:
*   **Background Shifts:** Transitioning from `surface` (#f7f9fb) to `surface-container-low` (#f2f4f6).
*   **Tonal Nesting:** A `surface-container-lowest` card sitting on a `surface-container` background provides all the separation needed through a natural shift in "paper weight."

### Glass & Gradient Implementation
To achieve the "High-Tech" persona, use **Glassmorphism** for floating elements (e.g., Navigation Bars, Modals).
*   **Token:** `surface` at 70% opacity + 24px backdrop-blur.
*   **Gradients:** CTAs and primary headers should utilize a subtle radial gradient from `primary` (#021541) to `primary-container` (#1a2b56). This mimics the studio lighting seen in the brand's physical office environment.

---

## 3. Typography: Editorial Authority

The typographic system is a dialogue between heritage and the future.

*   **The Display Voice (Cormorant Garamond / NotoSerif):** Used for `display` and `headline` tiers. This serif communicates clinical expertise and surgical history. Use it with generous letter-spacing (kerning) in headlines to feel premium.
*   **The Technical Voice (Manrope):** Used for `title`, `body`, and `label` tiers. Manrope’s geometric clarity complements the "REGENORTHO" wordmark. It provides the "high-tech" counterbalance to the serif headings.

**Hierarchy Strategy:** 
Large, high-contrast serif headlines (`display-lg`: 3.5rem) should be paired with small, wide-tracked sans-serif labels (`label-md`). This creates an "Editorial Gallery" look, making technical medical data feel like curated information.

---

## 4. Elevation & Depth

We eschew traditional drop shadows for **Tonal Layering**.

*   **The Layering Principle:** Depth is a physical stack. 
    1.  **Base:** `surface` (The floor)
    2.  **Sectioning:** `surface-container-low` (The raised platform)
    3.  **Interaction Objects:** `surface-container-lowest` (The clinical tool/card)
*   **Ambient Shadows:** If an element must float (e.g., a dropdown), use a "Signature Glow" instead of a shadow.
    *   **Spec:** 0px 12px 32px rgba(2, 21, 65, 0.06). This uses the `primary` color as a shadow tint to ensure the depth feels integrated into the environment.
*   **The "Ghost Border" Fallback:** For high-density data where separation is critical, use `outline-variant` at **15% opacity**. It should be felt, not seen.

---

## 5. Components

### Buttons: The "Precision Instruments"
*   **Primary:** A gradient fill (`primary` to `primary-container`) with `on-primary` text. Border radius set to `md` (0.375rem) for a modern, sharp-yet-approachable feel.
*   **Secondary:** No fill. A "Ghost Border" of `secondary` (#006876) at 40% opacity.
*   **Tertiary:** Text-only, using `label-md` in all-caps with 0.05em tracking.

### Cards: The "Atelier Trays"
Forbid dividers. Separate header from body using a `2.5` (0.85rem) spacing unit. Background must be `surface-container-lowest`. Use the dot-pattern texture in a top-right corner mask at 5% opacity to denote "active" or "premium" content.

### Input Fields: The "Clinical Record"
*   **Style:** Minimalist. Only a bottom "Ghost Border" that transitions to a full `secondary` (#006876) 2px stroke on focus.
*   **Labels:** Always use `label-sm` positioned above the field, never as placeholder text.

### Selection Chips
*   **Unselected:** `surface-container-high` with `on-surface-variant`.
*   **Selected:** `secondary` fill with `on-secondary` text. No borders.

---

## 6. Do’s and Don’ts

### Do:
*   **Use the Spacing Scale:** Stick religiously to the increments of `3` (1rem) and `6` (2rem) to create "Breathing Room."
*   **Embrace Negative Space:** Allow headlines to own their space. A "Premium" feel comes from the luxury of unused screen real estate.
*   **Tint Your Greys:** Always use `surface-variant` or `on-surface-variant` which contain subtle blue/cool undertones. Avoid "neutral" #888888 greys.

### Don’t:
*   **Don't use 100% Black:** Even for text, use `on-surface` (#191c1e). Pure black kills the "Glassmorphism" effect.
*   **Don't use Sharp Corners:** Always use at least the `sm` (0.125rem) radius to prevent the UI from feeling hostile.
*   **Don't Over-Animate:** Transitions should be "Precise" and "Smooth." Use `cubic-bezier(0.2, 0.8, 0.2, 1)` for all surface transitions—it feels like a dampened medical drawer sliding shut.