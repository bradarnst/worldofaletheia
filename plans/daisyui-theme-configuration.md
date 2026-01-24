# DaisyUI Theme Configuration

## Objective
Create a custom DaisyUI theme that matches the global CSS color palette and design principles

## Theme Customization Strategy
- Leverage existing CSS variables from global.css
- Map DaisyUI color tokens to custom color palette
- Ensure consistent typography and color scheme

## Color Mapping
- Primary: Bronze/Copper tones
  - Base color: `--color-primary-500`
  - Hover: `--color-primary-600`
  - Active: `--color-primary-700`

- Background: Parchment tones
  - Base: `--color-paper-50`
  - Content: `--color-paper-100`

- Text: Ink color palette
  - Base text: `--color-ink-900`
  - Headings: `--color-ink-950`

## Typography
- Use Lora for headings
- Use Inter for UI components
- Maintain font sizes from global CSS

## Configuration Steps
1. Update Tailwind config
2. Define custom DaisyUI theme
3. Ensure component consistency
4. Test across different components