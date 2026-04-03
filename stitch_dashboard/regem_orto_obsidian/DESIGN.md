# Design System Specification: Clinical Precision & Tonal Depth

## 1. Overview & Creative North Star: "The Digital Surgeon"
The creative north star for this design system is **"The Digital Surgeon."** In a high-end clinic management environment, the interface must mirror the qualities of a world-class practitioner: precise, calm, authoritative, and sophisticated. 

We move beyond the "SaaS-template" look by rejecting harsh lines and flat containers. Instead, we utilize **Tonal Layering** and **Atmospheric Depth**. By treating the UI as a series of recessed and elevated "surgical trays," we create a sense of focus. The layout favors intentional asymmetry—placing high-density data visualizations against expansive breathing room—to ensure that while the system is data-dense, it never feels cluttered.

---

## 2. Color Architecture
Our palette is rooted in deep obsidian and midnight tones, accented by precious metals and clinical teals.

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders to define sections. Structural boundaries are achieved exclusively through background shifts.
*   **Background:** `#0A0E14` (The Canvas)
*   **Sectioning:** Use `surface-container-low` (`#181C22`) to define large content areas against the background.
*   **Nesting:** Place `surface-container` (`#1C2026`) elements inside those sections to denote interactable panels.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of materials:
1.  **Level 0 (Base):** `surface-dim` (`#10141a`) — The foundation.
2.  **Level 1 (Sidebar):** `surface-container-low` (`#181c22`) — Navigation and secondary utility.
3.  **Level 2 (Cards/Panels):** `surface-container` (`#1c2026`) — The primary workspace.
4.  **Level 3 (Modals/Popovers):** `surface-container-highest` (`#31353c`) — Critical focus elements.

### The "Glass & Gradient" Rule
For primary CTAs and high-level KPIs, use a **Signature Texture**:
*   **Teal Gradient:** From `primary-container` (`#006e72`) to `primary` (`#61d8dd`) at a 135° angle.
*   **Glassmorphism:** For floating menus, use `surface-bright` at 60% opacity with a `20px` backdrop blur. This ensures the clinical depth is felt throughout the navigation.

---

## 3. Typography: Editorial Authority
We use a dual-typeface system to balance human-centric clinical care with mathematical precision.

*   **Primary (Plus Jakarta Sans):** Used for all UI labels, headers, and body copy. It provides a geometric, modern friendliness that reduces "software fatigue."
*   **Technical (Space Mono):** Used for all numerical data, timestamps, KPI values, and patient IDs. This monospace choice signals "data integrity" and ensures columns of numbers align perfectly for quick scanning.

**Hierarchy Note:**
*   **Headline-LG:** `32px / Plus Jakarta Sans / Bold` — Used for patient names or major dashboard views.
*   **Label-MD:** `12px / Space Mono / Medium` — Used for currency, dates, and medical codes.

---

## 4. Elevation & Depth: Tonal Layering
Traditional box-shadows are often too "dirty" for a high-end dark mode. We use light and tone to define height.

*   **The Layering Principle:** Depth is achieved by "stacking." A `surface-container-lowest` card placed on a `surface-container-low` background creates a natural "recessed" look.
*   **Ambient Shadows:** If an element must float (e.g., a dropdown), use a shadow color of `rgba(0, 0, 0, 0.4)` with a `32px` blur and `12px` Y-offset. Never use pure black shadows; they deaden the Teal accents.
*   **The "Ghost Border" Fallback:** Where containment is strictly required for accessibility, use `outline-variant` (`#3e4949`) at **15% opacity**. It should feel like a whisper of a line, not a boundary.

---

## 5. Components

### Navigation: The 220px Sidebar
The sidebar is a fixed monolith using `surface-container-low`. 
*   **Groups:** PRINCIPAL, MARKETING, CLÍNICA, CONFIG. 
*   **Active State:** No bulky backgrounds. Use a `2px` vertical `primary` (`#61d8dd`) "light-bar" on the far left and transition the text color to `on-primary-fixed`.

### Buttons
*   **Primary:** `8px` radius. Background: `primary` gradient. Text: `on-primary` (bold).
*   **Secondary:** `8px` radius. Ghost-style with a `primary` "Ghost Border" (20% opacity) and `primary` text.
*   **Action Chips:** Use `14px` (full-round) pills. For status (Success/Danger), use a 15% opacity background of the status color with 100% opacity text of the same hue.

### Cards & Data Panels
*   **Radius:** `14px` (Large).
*   **Layout:** Forbid the use of divider lines. Separate "Patient History" from "Billing" using a `spacing-8` (1.75rem) vertical gap or a subtle shift from `surface-container` to `surface-container-high`.
*   **KPIs:** Always pair a `headline-md` value in **Space Mono** with a `label-sm` title in **Plus Jakarta Sans**.

### Input Fields
*   **Style:** Minimalist. `surface-container-highest` background, `8px` radius, no border. 
*   **Focus State:** A subtle `primary` outer glow (4px blur, 20% opacity) and a transition of the helper text to `primary-fixed`.

---

## 6. Do’s and Don’ts

### Do:
*   **Do** use `Space Mono` for any data that can be measured or counted.
*   **Do** use asymmetrical margins (e.g., a wider right margin on dashboard cards) to create an "editorial" feel.
*   **Do** lean into the "Gold" accent (`secondary`) specifically for premium features, VIP patients, or "Outstanding Balance" highlights to give them a high-end, urgent feel.

### Don’t:
*   **Don’t** use pure white (#FFFFFF) for text. Always use `on-surface` (`#dfe2eb`) to prevent eye strain in dark mode.
*   **Don’t** use 100% opaque borders. They break the illusion of the "Digital Surgeon" atmosphere.
*   **Don’t** use standard "Blue" for links. Use the signature `primary` Teal to maintain brand cohesion.