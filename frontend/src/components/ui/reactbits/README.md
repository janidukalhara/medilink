# React Bits components used by MediLink

Retrieved October 13, 2026 from the official registries:

- https://reactbits.dev/r/FluxLines-TS-CSS.json
- https://reactbits.dev/r/ShinyText-TS-CSS.json
- https://reactbits.dev/backgrounds/flux-lines
- https://reactbits.dev/text-animations/shiny-text

The upstream license is retained in LICENSE.md (MIT + Commons Clause, copyright David Haz). These components are included as part of the MediLink application.

Local adaptations:

- Flux Lines: 30fps frame cap; cleanup of partially compiled shaders; retain the canvas context through React StrictMode's effect replay, while deleting owned GPU resources.
- Shiny Text: inherit the existing text colour through `currentColor`; restrained mint highlight and pauses between sweeps; react to reduced-motion preference changes; stop drawing while offscreen or in a hidden tab.
- `AmbientBackground.tsx` supplies the shared low-resolution, light-mode canvas with decorative-only pointer events, a static CSS fallback, no click swirls, and reduced-motion settings. No package dependencies added.

`premium.css` is original MediLink styling inspired by the button reflections, luminous borders, and glass card patterns at https://uiverse.io/. No individual Uiverse component source was copied.
