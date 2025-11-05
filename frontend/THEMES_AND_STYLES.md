# Themes and Styles Guide

## Overview

This application uses a **semantic color system** built on CSS variables and Tailwind CSS. This approach provides:

- **Single source of truth**: Change colors once, update everywhere
- **Dark mode support**: Automatic light/dark theme switching
- **Maintainability**: Easy to customize and extend
- **Type safety**: Tailwind's IntelliSense provides autocomplete

## Architecture

### 1. CSS Variables (src/styles/index.css)

CSS variables define the semantic color tokens in **hex format**:

```css
:root {
  --background: #ffffff;
  --foreground: #0e1327;
  --card: #ffffff;
  --card-foreground: #0e1327;
  --primary: #5b7fdb;
  --primary-foreground: #ffffff;
  --muted: #f3f4f8;
  --muted-foreground: #6b7280;
  --accent: #00a4a6;
  --accent-foreground: #ffffff;
  --danger: #d6458e;
  --danger-foreground: #ffffff;
  --warning: #e6a700;
  --warning-foreground: #ffffff;
  --border: #e2e8f0;
  --ring: #5b7fdb;
}

.dark {
  --background: #090b14;
  --foreground: #f2f2f7;
  --card: #0c0f18;
  --card-foreground: #f2f2f7;
  /* ... dark theme values */
}
```

**Why Hex Format?**
- **Color picker support**: Most editors show a color picker UI when hovering over hex values
- **Easy to modify**: Direct hex values are intuitive (`#5b7fdb` = blue)
- **Works with Tailwind opacity**: Using `color-mix()` in Tailwind config enables opacity modifiers

### Understanding Hex Format

Hex colors are defined as `#RRGGBB` where:
- **RR** = Red component (00-FF, or 0-255 in decimal)
- **GG** = Green component (00-FF, or 0-255 in decimal)
- **BB** = Blue component (00-FF, or 0-255 in decimal)

**Example: `#5b7fdb`**
- `5b` (hex) = 91 (decimal) = Red component
- `7f` (hex) = 127 (decimal) = Green component
- `db` (hex) = 219 (decimal) = Blue component
- Result: A medium blue color

**Quick Reference:**
- `#ffffff` = White (all colors at maximum)
- `#000000` = Black (all colors at minimum)
- `#5b7fdb` = Current primary color (blue)
- `#00a4a6` = Accent color (teal/cyan)
- `#d6458e` = Danger color (pink/red)

**Color Picker in Editor:**
When you hover over a hex value like `#5b7fdb` in your editor, you'll see a color picker square that lets you visually select a new color. This is why we use hex format!

### 2. Tailwind Configuration (tailwind.config.js)

The Tailwind config uses `color-mix()` to enable opacity modifiers:

```js
colors: {
  background: "color-mix(in srgb, var(--background) calc(<alpha-value> * 100%), transparent)",
  foreground: "color-mix(in srgb, var(--foreground) calc(<alpha-value> * 100%), transparent)",
  primary: {
    DEFAULT: "color-mix(in srgb, var(--primary) calc(<alpha-value> * 100%), transparent)",
    foreground: "color-mix(in srgb, var(--primary-foreground) calc(<alpha-value> * 100%), transparent)",
  },
  // ...
}
```

**How `color-mix()` Works:**
- When you use `bg-primary/10`, Tailwind replaces `<alpha-value>` with `0.1` (10%)
- `color-mix()` blends your color with transparent based on the alpha value
- This enables opacity modifiers like `/10`, `/25`, `/50`, `/90` to work seamlessly

This allows you to use Tailwind utilities like:
- `bg-background`, `text-foreground`
- `bg-primary`, `text-primary-foreground`
- `bg-primary/10` (10% opacity), `border-accent/30` (30% opacity)
- `border-border`, `ring-ring/25` (25% opacity)

### 3. Component Classes (src/styles/index.css)

Reusable component classes use semantic tokens:

```css
.btn-primary {
  @apply bg-primary text-primary-foreground shadow-soft hover:opacity-90;
}

.card {
  @apply rounded-2xl border border-border bg-card p-6 shadow-soft;
}
```

## How to Customize Colors

### Option 1: Change CSS Variables (Recommended)

Edit `src/styles/index.css`:

```css
:root {
  --primary: #3b82f6;  /* Change to your preferred blue */
  --accent: #10b981;    /* Change to your preferred green */
}
```

**How to Change Colors:**
1. **Hover over the hex value** in your editor (e.g., `#5b7fdb`)
2. **Click the color picker square** that appears
3. **Select your new color** visually
4. The editor will automatically update the hex value

**Example Colors:**
- `#3b82f6` = Bright blue
- `#10b981` = Emerald green
- `#f59e0b` = Amber/orange
- `#8b5cf6` = Purple
- `#ef4444` = Red

All components using `bg-primary` or `text-accent` will update automatically.

**Don't forget to update `.dark` too:**
```css
.dark {
  --primary: #3b82f6;  /* Same or different for dark mode */
}
```

### Option 2: Add New Semantic Tokens

1. Add variable to `src/styles/index.css`:
```css
:root {
  --success: #10b981;
  --success-foreground: #ffffff;
}

.dark {
  --success: #10b981;
  --success-foreground: #ffffff;
}
```

2. Add to `tailwind.config.js`:
```js
colors: {
  success: {
    DEFAULT: "color-mix(in srgb, var(--success) calc(<alpha-value> * 100%), transparent)",
    foreground: "color-mix(in srgb, var(--success-foreground) calc(<alpha-value> * 100%), transparent)",
  },
}
```

3. Use in components:
```tsx
<div className="bg-success text-success-foreground">Success!</div>
```

## Dark Mode

Dark mode is enabled via the `dark` class on a parent element. Tailwind automatically swaps CSS variable values.

### Toggle Dark Mode

```tsx
// Add to a component
function ThemeToggle() {
  const [isDark, setIsDark] = React.useState(false);
  
  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);
  
  return (
    <button onClick={() => setIsDark(!isDark)}>
      Toggle Theme
    </button>
  );
}
```

## Using Semantic Tokens in Components

### Good Practices

✅ **Use semantic tokens:**
```tsx
<div className="bg-background text-foreground">
  <h1 className="text-foreground">Title</h1>
  <p className="text-muted-foreground">Subtitle</p>
  <button className="bg-primary text-primary-foreground">Click</button>
</div>
```

❌ **Avoid hardcoded colors:**
```tsx
<div className="bg-white text-black dark:bg-gray-900 dark:text-white">
  {/* This duplicates dark mode logic everywhere */}
</div>
```

### Common Patterns

**Cards:**
```tsx
<div className="bg-card text-card-foreground border border-border rounded-2xl p-6">
  Content
</div>
```

**Buttons:**
```tsx
<button className="bg-primary text-primary-foreground hover:opacity-90">
  Primary Action
</button>
<button className="bg-card text-card-foreground border border-border hover:border-primary">
  Secondary Action
</button>
```

**Forms:**
```tsx
<input className="bg-background text-foreground border-border focus:ring-ring" />
```

**Muted text:**
```tsx
<p className="text-muted-foreground">Less important text</p>
```

## Component Library (src/components/ui/)

Reusable UI components use semantic tokens:

- **Button**: `bg-primary text-primary-foreground`
- **Card**: `bg-card text-card-foreground border-border`
- **Alert**: `border-danger bg-danger/10 text-danger`
- **Badge**: `bg-primary/10 text-primary`

Import and use:
```tsx
import { Button, Card, Alert } from "../components/ui";

<Card>
  <Alert variant="error">Error message</Alert>
  <Button>Submit</Button>
</Card>
```

## Layout System

### AppShell Component

All pages should use `AppShell` for consistent layout:

```tsx
import { AppShell } from "../components/layout/AppShell";

export default function MyPage() {
  return (
    <AppShell>
      <main className="page-container">
        {/* Your content */}
      </main>
    </AppShell>
  );
}
```

**AppShell** provides:
- `min-h-screen` for full-page layouts
- `bg-background text-foreground` for consistent theming
- Can be extended with header/footer in the future

### Container Classes

`.page-container` and `.container` provide consistent max-width and padding:

```tsx
<div className="page-container">
  {/* Content is max 1280px wide with responsive padding */}
</div>
```

## Accessibility

### Contrast Requirements

All color combinations meet **WCAG AA** standards:

- Foreground on background: 4.5:1 minimum
- Primary on primary-foreground: 4.5:1 minimum
- Muted-foreground on background: 4.5:1 minimum

### Focus States

All interactive elements have visible focus rings:

```css
focus-visible:ring-4 focus-visible:ring-ring/25 focus-visible:ring-offset-2
```

## Best Practices

### DO:
- ✅ Use semantic tokens (`bg-background`, `text-foreground`)
- ✅ Use component classes (`.btn-primary`, `.card`)
- ✅ Define colors in CSS variables once
- ✅ Use Tailwind utilities for spacing, sizing, etc.
- ✅ Test both light and dark modes

### DON'T:
- ❌ Hardcode colors in components
- ❌ Use generic grays (`bg-gray-100`) — use `bg-muted` instead
- ❌ Duplicate dark mode logic across files
- ❌ Create component-specific CSS files
- ❌ Skip focus states

## Extending the System

### Adding a New Page

1. Wrap in `AppShell`:
```tsx
import { AppShell } from "../components/layout/AppShell";

export default function NewPage() {
  return (
    <AppShell>
      <main className="page-container py-12">
        {/* Content */}
      </main>
    </AppShell>
  );
}
```

2. Use semantic tokens and UI components
3. Test in both light and dark modes

### Creating New Components

```tsx
// src/components/ui/MyComponent.tsx
import React from "react";

export function MyComponent({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card text-card-foreground border border-border rounded-2xl p-4">
      {children}
    </div>
  );
}
```

## Troubleshooting

### Colors not updating

1. Check if CSS variable is defined in both `:root` and `.dark`
2. Verify Tailwind config uses `color-mix()` with `<alpha-value>` placeholder
3. Clear Tailwind cache: `rm -rf .next` or `rm -rf dist` (if applicable)
4. Rebuild: `npm run build`

### Opacity modifiers not working

1. Ensure Tailwind config uses `color-mix(in srgb, var(--color) calc(<alpha-value> * 100%), transparent)`
2. Check that `<alpha-value>` placeholder is present (Tailwind will replace it)
3. Verify browser supports `color-mix()` (Chrome 111+, Firefox 113+, Safari 16.4+)

### Dark mode not working

1. Ensure `darkMode: "class"` in `tailwind.config.js`
2. Add `dark` class to `<html>` or parent element
3. Check if CSS variables are defined in `.dark` selector

### Focus rings not visible

1. Use `focus-visible:` variant, not `focus:`
2. Ensure `ring-ring` color is defined
3. Test with keyboard navigation (Tab key)

## Resources

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [CSS Variables (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
- [WCAG Contrast Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)

