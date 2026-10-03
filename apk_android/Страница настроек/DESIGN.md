---
name: Domofondar CyberShield
colors:
  surface: '#0f131d'
  surface-dim: '#0f131d'
  surface-bright: '#353944'
  surface-container-lowest: '#0a0e18'
  surface-container-low: '#171b26'
  surface-container: '#1c1f2a'
  surface-container-high: '#262a35'
  surface-container-highest: '#313540'
  on-surface: '#dfe2f1'
  on-surface-variant: '#bec8d2'
  inverse-surface: '#dfe2f1'
  inverse-on-surface: '#2c303b'
  outline: '#88929b'
  outline-variant: '#3e4850'
  surface-tint: '#89ceff'
  primary: '#89ceff'
  on-primary: '#00344d'
  primary-container: '#0ea5e9'
  on-primary-container: '#003751'
  inverse-primary: '#006591'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#7bd0ff'
  on-tertiary: '#00354a'
  tertiary-container: '#00a7e0'
  on-tertiary-container: '#00384e'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#c9e6ff'
  primary-fixed-dim: '#89ceff'
  on-primary-fixed: '#001e2f'
  on-primary-fixed-variant: '#004c6e'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#c4e7ff'
  tertiary-fixed-dim: '#7bd0ff'
  on-tertiary-fixed: '#001e2c'
  on-tertiary-fixed-variant: '#004c69'
  background: '#0f131d'
  on-background: '#dfe2f1'
  surface-variant: '#313540'
typography:
  display:
    fontFamily: Space Grotesk
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  display-mobile:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.06em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-sm: 0.75rem
  margin: 1rem
  margin-tablet: 1.5rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system establishes a high-precision, utilitarian aesthetic tailored for smart intercoms, live telepresence, automated door access, and residential perimeter security. The visual tone balances mission-critical cybersecurity dependability with the frictionless elegance of modern smart-home IoT interfaces. 

Drawing from modern tactical minimalism and glass-infused telemetry interfaces, the atmosphere is deep, stealthy, and reassuring. Interactions evoke instantaneous physical control: unlocking heavy gates, reviewing encrypted video streams, and issuing temporary guest keys. The sensory feedback must feel authoritative, secure, and technologically advanced—avoiding playful consumer tropes in favor of sharp, tactical clarity and calm confidence under low-light domestic conditions.

## Colors

The palette relies on a deep, stratified dark scale anchored in charcoal-navy hues, paired with high-voltage luminous signals for critical telemetry.

- **Background & Surfaces**: Base canvas starts at `#0b0f19` (Canvas Ground), stepping up through `#111827` (Surface Base), `#1e293b` (Surface Raised / Cards), and `#283548` (Surface Overlay / Modals).
- **Primary Cyber Accent**: `#0ea5e9` serves as the primary operational trigger (active states, key actions), supported by `#38bdf8` for luminous glows, focus rings, and high-visibility status indicators. `#0284c7` serves as the pressed/active state tone.
- **Security & Status**: Unlocked and verified states employ Emerald `#10b981` (with `#34d399` for dark-mode text badges). Alert, intrusion, or lockout states invoke an intense Coral Crimson (`#f43f5e`), while system standbys utilize Amber Gold (`#f59e0b`).
- **Typography & Structural Contrast**: Primary typography renders in crisp `#f8fafc` delivering AAA contrast against all surface tiers. Secondary metadata, timestamps, and camera technical overlays utilize cool muted slate `#94a3b8`.
- **Translucent Delimiters**: Structural lines and panel dividers rely strictly on `rgba(255, 255, 255, 0.08)` or `#334155` to prevent optical vibration while preserving layout rigor.

## Typography

The typographic hierarchy implements a three-family structure designed to separate technical status data from narrative readability and bold administrative directives:

1. **Display & Headlines (`Space Grotesk`)**: Provides an architectural, geometric edge reminiscent of high-grade aerospace and secure hardware interfaces. Used exclusively for building section names, intercom door labels, and high-level dialog headers.
2. **Body & Paragraphs (`Plus Jakarta Sans`)**: Delivers humanist legibility and low visual fatigue during prolonged reading of event logs, system announcements, and tenant settings.
3. **Data, Feeds & Technical Labels (`JetBrains Mono`)**: Handles all monospaced security credentials, PIN codes, live RTSP stream bitrates, timestamp counters (`00:14:52`), keycard tokens, and door status indicators (`[LOCKED]`, `[ONLINE]`).

## Layout & Spacing

The interface is architected around a dense, thumb-accessible layout optimized for rapid response (e.g., answering a ringing entryway call within two seconds). 

- **Grid Architecture**: Mobile viewports utilize a 4-column fluid layout with `1rem` margins and `0.75rem` gutters. Tablet devices transition to an 8-column layout (`1.5rem` margins), presenting split-screen surveillance feeds alongside direct access toggles. Desktop control panels expand to a 12-column layout.
- **Rhythm & Touch Targets**: Spacing follows a 4px/8px modular base. Interactive touch targets for critical door releases require an absolute minimum dimension of 56px height, buffered by `space-md` gaps to eliminate accidental misclicks. 
- **Safe Zones**: Pinned bottom navigation panels and floating critical release buttons incorporate system safe-area insets (`env(safe-area-inset-bottom)`) with additional `space-md` clearance.

## Elevation & Depth

Depth in this dark environment is established via tonal staging, frosted dark glass, and selective luminescence rather than heavy drop shadows:

- **Tier 0 (Floor)**: `#0b0f19` pure ground. Used for application-level shell and underlying canvas.
- **Tier 1 (Surface Panels & Video Frames)**: `#111827` bordered with a 1px hairline stroke of `rgba(255, 255, 255, 0.06)`.
- **Tier 2 (Interactive Modules & Sensor Cards)**: `#1e293b` backed by an ambient, deep-tinted shadow (`0 8px 24px -4px rgba(2, 6, 23, 0.6)`).
- **Tier 3 (Modals, Incoming Call Overlays, Access Triggers)**: Frosted translucent slate (`#1e293bd9` with `backdrop-filter: blur(16px)`), framed with a luminous edge highlight (`rgba(56, 189, 248, 0.2)`).
- **Luminous Radiance (Active States)**: Critical elements like active unlock confirmations or live door buzzers emit a controlled, low-spread cyan or emerald glow (`box-shadow: 0 0 20px rgba(14, 165, 233, 0.35)`), reinforcing physical activation without visual blow-out.

## Shapes

The design language balances high-tech precision with comfortable physical ergonomic containment:

- **Base Radius (`0.5rem`)**: Applied to compact controls, chip selectors, telemetry tags, and numeric keypad keys.
- **Container Radius (`1rem` / `rounded-lg`)**: Applied to camera monitor frames, tenant listings, entry authorization cards, and bottom sheet containers.
- **Pill Radius (`9999px`)**: Reserved strictly for high-visibility dynamic badges (e.g., `● LIVE`, `UNLOCKED`), user action pills, and biometric activation surfaces.

## Components

### Door Release & Action Buttons
- **Primary Hold-to-Unlock**: Minimum 56px height. Background in `#0ea5e9` resting; transitions to `#0284c7` with animated radial fill progress during a 1-second long-press verification. Text rendered in `#f8fafc` using `Space Grotesk` (semi-bold).
- **Destructive / Emergency Lock**: Outlined with `#f43f5e`, background at `rgba(244, 63, 94, 0.1)`, with bold coral labeling.
- **Secondary Actions**: Background `#1e293b` with a hairline stroke of `rgba(255, 255, 255, 0.08)`, text in `#94a3b8`.

### Live Intercom Stream Module
- Aspect ratio fixed at 16:9 with `rounded-lg` corners and an inset 1px border (`rgba(255, 255, 255, 0.1)`).
- Superimposed live telemetry badges (`JetBrains Mono` at `label-sm`) render against semi-transparent `#0b0f19b3` backing chips with a pulsing emerald recording dot.
- Quick action floating bar pinned over bottom stream quadrant: 2-way microphone toggle, night-vision toggle, snapshot button.

### Cards & Access Logs
- Background `#1e293b` with `0.5rem` internal padding and `1px` border (`#334155`).
- Access event logs feature timestamp columns in `JetBrains Mono` (`#94a3b8`), tenant or visitor name in `#f8fafc`, and state badges indicating Entry Method (Face ID, NFC Key, Remote App, Temporary Code).

### Keypads & Input Fields
- Secure PIN entry keys rendered as rounded tactile square blocks (`#111827`) with active state depression (`#283548`), labeled with high-visibility digits (`Space Grotesk`).
- Standard text fields feature deep recessed fills (`#0b0f19`), slate borders (`#334155`), and electric cyan focus outlines (`#38bdf8`) with zero ambient bleed.

### Badges, Chips & Switches
- **Status Chips**: Micro-pills containing state indicators. Emerald variant: `rgba(16, 185, 129, 0.15)` fill, `#34d399` text, and `rgba(16, 185, 129, 0.3)` border.
- **Toggle Switches**: Compact capsule shape with dark charcoal track (`#1f293d`) transitioning to electric cyan (`#0ea5e9`) on activation, paired with a solid pure-white mechanical knob.