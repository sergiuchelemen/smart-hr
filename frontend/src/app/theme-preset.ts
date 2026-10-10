import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

// Presetul Aura personalizat cu tokenii Smart HR (valorile vin din variabilele CSS din styles/tokens.scss).
const surfaces = {
  0: 'var(--surface-raised)',
  50: 'var(--surface-raised)',
  100: 'var(--surface)',
  200: 'var(--surface-sunken)',
  300: 'var(--border)',
  400: 'var(--border-strong)',
  500: 'var(--border-strong)',
  600: 'var(--ink-muted)',
  700: 'var(--ink-muted)',
  800: 'var(--ink)',
  900: 'var(--ink)',
  950: 'var(--ink)',
};

const scheme = {
  surface: surfaces,
  primary: {
    color: 'var(--brand)',
    contrastColor: 'var(--on-brand)',
    hoverColor: 'var(--brand-ink)',
    activeColor: 'var(--brand-ink)',
  },
  highlight: {
    background: 'var(--brand-tint)',
    focusBackground: 'var(--brand-tint)',
    color: 'var(--brand-ink)',
    focusColor: 'var(--brand-ink)',
  },
  mask: { background: 'rgba(14, 14, 16, 0.5)', color: 'var(--ink)' },
  formField: {
    background: 'var(--surface-raised)',
    disabledBackground: 'var(--surface-sunken)',
    filledBackground: 'var(--surface-raised)',
    filledHoverBackground: 'var(--surface-raised)',
    filledFocusBackground: 'var(--surface-raised)',
    borderColor: 'var(--border-strong)',
    hoverBorderColor: 'var(--ink-muted)',
    focusBorderColor: 'var(--brand)',
    invalidBorderColor: 'var(--danger)',
    color: 'var(--ink)',
    disabledColor: 'var(--ink-muted)',
    placeholderColor: 'var(--ink-muted)',
    invalidPlaceholderColor: 'var(--danger-ink)',
    floatLabelColor: 'var(--ink-muted)',
    floatLabelFocusColor: 'var(--brand-ink)',
    floatLabelInvalidColor: 'var(--danger-ink)',
    iconColor: 'var(--ink-muted)',
    shadow: 'none',
  },
  text: {
    color: 'var(--ink)',
    hoverColor: 'var(--ink)',
    mutedColor: 'var(--ink-muted)',
    hoverMutedColor: 'var(--ink)',
  },
  content: {
    background: 'var(--surface-raised)',
    hoverBackground: 'var(--surface-sunken)',
    borderColor: 'var(--border)',
    color: 'var(--ink)',
    hoverColor: 'var(--ink)',
  },
  overlay: {
    select: { background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--ink)' },
    popover: { background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--ink)' },
    modal: { background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--ink)' },
  },
  list: {
    option: {
      focusBackground: 'var(--surface-sunken)',
      selectedBackground: 'var(--brand-tint)',
      selectedFocusBackground: 'var(--brand-tint)',
      color: 'var(--ink)',
      focusColor: 'var(--ink)',
      selectedColor: 'var(--brand-ink)',
      selectedFocusColor: 'var(--brand-ink)',
      icon: { color: 'var(--ink-muted)', focusColor: 'var(--ink)' },
    },
  },
  navigation: {
    item: {
      focusBackground: 'var(--surface-sunken)',
      activeBackground: 'var(--brand-tint)',
      color: 'var(--ink)',
      focusColor: 'var(--ink)',
      activeColor: 'var(--brand-ink)',
      icon: { color: 'var(--ink-muted)', focusColor: 'var(--ink)', activeColor: 'var(--brand-ink)' },
    },
  },
};

const { primary: _unused, ...schemeRest } = scheme;

export const SmartHrPreset = definePreset(Aura, {
  primitive: {
    borderRadius: { none: '0', xs: '4px', sm: '10px', md: '10px', lg: '18px', xl: '18px' },
  },
  semantic: {
    transitionDuration: '0.16s',
    primary: {
      ...scheme.primary,
      50: 'var(--brand-tint)',
      100: 'var(--brand-tint)',
      200: 'var(--brand-tint)',
      300: 'var(--brand)',
      400: 'var(--brand)',
      500: 'var(--brand)',
      600: 'var(--brand)',
      700: 'var(--brand-ink)',
      800: 'var(--brand-ink)',
      900: 'var(--brand-ink)',
      950: 'var(--brand-ink)',
    },
    focusRing: { width: '2px', style: 'solid', color: 'var(--brand)', offset: '2px', shadow: 'none' },
    ...schemeRest,
  },
  components: {
    button: {
      root: {
        borderRadius: '999px',
        paddingX: '1.25rem',
        paddingY: '0.625rem',
        sm: { paddingX: '1rem', paddingY: '0.5rem' },
        label: { fontWeight: '600' },
      },
    },
    paginator: {
      root: { background: 'transparent' },
      navButton: { borderRadius: '999px', width: '2.25rem', height: '2.25rem' },
    },
    datatable: {
      headerCell: { background: 'var(--surface-sunken)', color: 'var(--ink)' },
      row: { background: 'var(--surface-raised)', color: 'var(--ink)', hoverBackground: 'var(--surface-sunken)' },
    },
    skeleton: { root: { borderRadius: '10px' } },
    message: { root: { borderRadius: '18px' } },
  },
});
