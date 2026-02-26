# NEO App Color Theme & Contrast Analysis

This document provides a comprehensive overview of the color palette, typography, and contrast standards used in the NEO application.

## 🎨 Core Color Palette

The application follows a premium dark aesthetic with high-contrast accents, primarily using violet and indigo tones.

### 🌑 Backgrounds & Surfaces
| Variable | Value | HEX | Usage |
| :--- | :--- | :--- | :--- |
| `--bg-base` | `#0A0A0A` | ![#0A0A0A](https://via.placeholder.com/15/0A0A0A/0A0A0A?text=+) | Primary application background |
| `--bg-surface` | `#141414` | ![#141414](https://via.placeholder.com/15/141414/141414?text=+) | Cards, panels, and secondary containers |
| `--bg-surface-hover` | `#262626` | ![#262626](https://via.placeholder.com/15/262626/262626?text=+) | Interaction states for surface elements |
| `Modal Window` | `#000000` | ![#000000](https://via.placeholder.com/15/000000/000000?text=+) | Modal content backgrounds |

### ✨ Accents & Brand Colors
| Variable | Value | HEX | Usage |
| :--- | :--- | :--- | :--- |
| `--accent-primary` | `#8B5CF6` | ![#8B5CF6](https://via.placeholder.com/15/8B5CF6/8B5CF6?text=+) | Primary brand color (Violet), used for key highlights |
| `--accent-primary-hover` | `#7C3AED` | ![#7C3AED](https://via.placeholder.com/15/7C3AED/7C3AED?text=+) | Hover state for primary accents |
| `Indigo/Blue` | `#4F46E5` | ![#4F46E5](https://via.placeholder.com/15/4F46E5/4F46E5?text=+) | Used for active states, sidebar icons, and primary buttons |
| `HUD Accent` | `#6366F1` | ![#6366F1](https://via.placeholder.com/15/6366F1/6366F1?text=+) | Neon indigo used in HUD components |

### 📝 Typography
| Variable | Value | HEX | Usage |
| :--- | :--- | :--- | :--- |
| `--text-primary` | `#EDEDED` | ![#EDEDED](https://via.placeholder.com/15/EDEDED/EDEDED?text=+) | Main body text and headings |
| `--text-secondary` | `#A1A1AA` | ![#A1A1AA](https://via.placeholder.com/15/A1A1AA/A1A1AA?text=+) | Supportive text, labels, and descriptions |
| `--text-tertiary` | `#52525B` | ![#52525B](https://via.placeholder.com/15/52525B/52525B?text=+) | Disabled text or subtle hints |

### ✅ Status Colors
| Variable | Value | HEX | Usage |
| :--- | :--- | :--- | :--- |
| `--status-success` | `#10B981` | ![#10B981](https://via.placeholder.com/15/10B981/10B981?text=+) | Success states, active indicators |
| `--status-error` | `#EF4444` | ![#EF4444](https://via.placeholder.com/15/EF4444/EF4444?text=+) | Errors, destructive actions, close buttons |
| `--status-warning` | `#F59E0B` | ![#F59E0B](https://via.placeholder.com/15/F59E0B/F59E0B?text=+) | Warnings and pending states |

---

## 🔘 Button Components

The app uses several distinct button styles depending on the context.

### 1. Primary Action Buttons
- **Color**: `#4F46E5` (Indigo) or Gradient `#6366F1` to `#8B5CF6`.
- **Text**: White (`#FFFFFF`).
- **Interaction**: Hover brightness increase and subtle scale effect.
- **Example**: "Activate", "New Session".

### 2. Secondary/Ghost Buttons
- **Color**: Transparent background with border `#1A1A1A` or `#262626`.
- **Text**: Gray (`#A1A1AA` or `#888888`).
- **Interaction**: Becomes White (`#FFFFFF`) on hover with a darker gray background (`#111111`).

### 3. Destructive Buttons
- **Color**: Red (`#EF4444`).
- **Text**: White (`#FFFFFF`).
- **Example**: Close modal buttons, "Delete".

---

## 🌓 Contrast & Accessibility

The application is designed for high accessibility in dark mode:
- **Text Contrast**: White/Light Gray text on Black/Dark Gray backgrounds ensures a contrast ratio exceeding **7:1** (WCAG AAA) for primary content.
- **Visual Hierarchy**: Usage of translucent overlays (`rgba`) and `backdrop-filter: blur` helps maintaining depth and focus without losing contrast.
- **Borders**: Subtle borders (`#262626`) are used to define boundaries between similar dark-toned surfaces.

---

## ⚙️ Design Tokens

Reference these CSS variables in your components to maintain consistency:

```css
/* Core Theme Reference */
--accent-glow: rgba(139, 92, 246, 0.15);
--border-subtle: #262626;
--radius-md: 12px;
--transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
```
