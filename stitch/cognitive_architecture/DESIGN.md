---
name: Cognitive Architecture
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#434655'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#585f67'
  on-secondary: '#ffffff'
  secondary-container: '#dce3ec'
  on-secondary-container: '#5e656d'
  tertiary: '#943700'
  on-tertiary: '#ffffff'
  tertiary-container: '#bc4800'
  on-tertiary-container: '#ffede6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#dce3ec'
  secondary-fixed-dim: '#c0c7d0'
  on-secondary-fixed: '#151c23'
  on-secondary-fixed-variant: '#40484f'
  tertiary-fixed: '#ffdbcd'
  tertiary-fixed-dim: '#ffb596'
  on-tertiary-fixed: '#360f00'
  on-tertiary-fixed-variant: '#7d2d00'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display:
    fontFamily: Be Vietnam Pro
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Be Vietnam Pro
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Be Vietnam Pro
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Be Vietnam Pro
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Be Vietnam Pro
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-sm:
    fontFamily: Be Vietnam Pro
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  headline-lg-mobile:
    fontFamily: Be Vietnam Pro
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 32px
  sidebar-width: 280px
---

## Brand & Style

The design system focuses on the "Company's Brain" concept—a sophisticated, high-performance tool for BlueOcean's EdTech ecosystem. The personality is hyper-rational, efficient, and transparent. It adopts a **Minimalist / Vercel-inspired** aesthetic that prioritizes clarity over decoration. 

The UI should feel "airy" and expansive, utilizing generous whitespace to reduce cognitive load when dealing with complex AI data. It avoids all non-functional elements: no gradients, no decorative illustrations, and no heavy dividers. The emotional response should be one of calm control and professional precision.

## Colors

This design system utilizes a high-clarity, blue-focused palette. 
- **Primary (#2563eb):** Reserved for intent and action. It marks the active path, primary interactions, and focus states.
- **Sidebar Background (#eff6ff):** A soft, functional blue that provides structural distinction without the weight of a dark sidebar.
- **Content Area (#ffffff):** Pure white to maximize legibility and provide the "airy" feel requested.
- **Muted Greys:** Body text uses a medium-dark slate (#64748b) to reduce contrast harshness while maintaining accessibility. 
- **Semantic Accents:** Defined for badges (Green #10b981, Amber #f59e0b, Red #ef4444, Purple #8b5cf6).

## Typography

**Be Vietnam Pro** is used globally to provide a contemporary, friendly yet professional tone. The scale relies on tight letter-spacing for larger headlines to maintain the "tech-first" B2B aesthetic. 

Body text is optimized for long-form reading of AI-generated insights, using a 14px base for standard UI and 16px for prose-heavy content. Labels use a medium weight (500) to distinguish them from interactive body text.

## Layout & Spacing

The layout follows a **Fixed Sidebar + Fluid Content** model. 
- **Sidebar:** 280px width, utilizing the #eff6ff background.
- **Content:** Wrapped in a container with a max-width of 1440px for dashboard views, centered with 32px margins. 
- **Rhythm:** An 8px grid system governs all spatial relationships. "Airiness" is achieved by using 32px or 48px of padding between major logical sections.
- **Grids:** Use a 12-column grid for dashboard widgets. Gutters are fixed at 24px to ensure breathing room between data-heavy cards.

## Elevation & Depth

To maintain the Vercel aesthetic, depth is created through **Tonal Layers** and **Subtle Shadows** rather than heavy borders.

- **Level 0:** Sidebar (#eff6ff) and Main Background (#ffffff).
- **Level 1 (Cards/Inputs):** White surface with a 1px border (#e2e8f0). No shadow in rest state.
- **Level 2 (Modals/Overlays):** White surface with a soft, diffused shadow (`0 10px 15px -3px rgba(0, 0, 0, 0.05)`).
- **Backdrop:** Modals utilize a background blur (12px) with a semi-transparent white tint to maintain the "airy" feel.
- **Dividers:** Used sparingly. Prefer whitespace to define boundaries. When necessary, use 1px #f1f5f9.

## Shapes

The shape language is "Soft" but disciplined. 
- **Standard Radius:** 6px (0.375rem) for buttons, inputs, and small components.
- **Container Radius:** 8px (0.5rem) for cards and panels.
- **Large Radius:** 12px (0.75rem) for modals.
- **Badges:** Fully rounded (pill) is avoided; use a 4px radius to match the technical aesthetic.

## Components

- **Buttons:** Primary buttons use #2563eb with white text. Ghost buttons use #64748b text. No gradients. Hover state is a subtle darken (5-10%).
- **Inputs:** White background with a 1px #e2e8f0 border. On focus, the border transitions to #2563eb with a 2px soft blue outer ring.
- **Tables:** Clean execution. No vertical lines. Header text is Label-SM in #64748b. Rows highlight on hover using #eff6ff.
- **Badges:** Small, 12px font size. Backgrounds are very desaturated versions of the semantic color with high-contrast text (e.g., Light Green BG / Dark Green Text).
- **Sidebar Nav:** Active state is indicated by a primary blue icon and a subtle 2px vertical bar on the left edge or a light blue background tint.
- **Cards:** Use as the primary container for AI insights. Border only (#e2e8f0), no shadow unless hovered.