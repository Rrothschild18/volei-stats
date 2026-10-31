/**
 * Geometria dos ícones Lucide (https://lucide.dev), stroke 1.5 — ver AGENTS.md.
 *
 * Gerado a partir do pacote `lucide-angular`, que declara suporte só até o
 * Angular 21. Em vez da dependência, o app desenha os mesmos `path` com o
 * `app-icon`. Para acrescentar um ícone, copie os nós de lucide.dev.
 */
export interface IconNode {
  readonly tag: string;
  readonly attrs: Readonly<Record<string, string>>;
}

export const ICONS: Readonly<Record<string, readonly IconNode[]>> = {
  house: [
    { tag: 'path', attrs: { d: 'M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8' } },
    {
      tag: 'path',
      attrs: {
        d: 'M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
      },
    },
  ],
  trophy: [
    { tag: 'path', attrs: { d: 'M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978' } },
    { tag: 'path', attrs: { d: 'M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978' } },
    { tag: 'path', attrs: { d: 'M18 9h1.5a1 1 0 0 0 0-5H18' } },
    { tag: 'path', attrs: { d: 'M4 22h16' } },
    { tag: 'path', attrs: { d: 'M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z' } },
    { tag: 'path', attrs: { d: 'M6 9H4.5a1 1 0 0 1 0-5H6' } },
  ],
  'list-ordered': [
    { tag: 'path', attrs: { d: 'M11 5h10' } },
    { tag: 'path', attrs: { d: 'M11 12h10' } },
    { tag: 'path', attrs: { d: 'M11 19h10' } },
    { tag: 'path', attrs: { d: 'M4 4h1v5' } },
    { tag: 'path', attrs: { d: 'M4 9h2' } },
    { tag: 'path', attrs: { d: 'M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02' } },
  ],
  users: [
    { tag: 'path', attrs: { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' } },
    { tag: 'path', attrs: { d: 'M16 3.128a4 4 0 0 1 0 7.744' } },
    { tag: 'path', attrs: { d: 'M22 21v-2a4 4 0 0 0-3-3.87' } },
    { tag: 'circle', attrs: { cx: '9', cy: '7', r: '4' } },
  ],
  'chevron-left': [{ tag: 'path', attrs: { d: 'm15 18-6-6 6-6' } }],
  'chevron-right': [{ tag: 'path', attrs: { d: 'm9 18 6-6-6-6' } }],
  'chevron-down': [{ tag: 'path', attrs: { d: 'm6 9 6 6 6-6' } }],
  'ellipsis-vertical': [
    { tag: 'circle', attrs: { cx: '12', cy: '12', r: '1' } },
    { tag: 'circle', attrs: { cx: '12', cy: '5', r: '1' } },
    { tag: 'circle', attrs: { cx: '12', cy: '19', r: '1' } },
  ],
  'square-pen': [
    { tag: 'path', attrs: { d: 'M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' } },
    {
      tag: 'path',
      attrs: {
        d: 'M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z',
      },
    },
  ],
  dices: [
    { tag: 'rect', attrs: { width: '12', height: '12', x: '2', y: '10', rx: '2', ry: '2' } },
    {
      tag: 'path',
      attrs: { d: 'm17.92 14 3.5-3.5a2.24 2.24 0 0 0 0-3l-5-4.92a2.24 2.24 0 0 0-3 0L10 6' },
    },
    { tag: 'path', attrs: { d: 'M6 18h.01' } },
    { tag: 'path', attrs: { d: 'M10 14h.01' } },
    { tag: 'path', attrs: { d: 'M15 6h.01' } },
    { tag: 'path', attrs: { d: 'M18 9h.01' } },
  ],
  'list-checks': [
    { tag: 'path', attrs: { d: 'M13 5h8' } },
    { tag: 'path', attrs: { d: 'M13 12h8' } },
    { tag: 'path', attrs: { d: 'M13 19h8' } },
    { tag: 'path', attrs: { d: 'm3 17 2 2 4-4' } },
    { tag: 'path', attrs: { d: 'm3 7 2 2 4-4' } },
  ],
  send: [
    {
      tag: 'path',
      attrs: {
        d: 'M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z',
      },
    },
    { tag: 'path', attrs: { d: 'm21.854 2.147-10.94 10.939' } },
  ],
  search: [
    { tag: 'path', attrs: { d: 'm21 21-4.34-4.34' } },
    { tag: 'circle', attrs: { cx: '11', cy: '11', r: '8' } },
  ],
  check: [{ tag: 'path', attrs: { d: 'M20 6 9 17l-5-5' } }],
  x: [
    { tag: 'path', attrs: { d: 'M18 6 6 18' } },
    { tag: 'path', attrs: { d: 'm6 6 12 12' } },
  ],
  lock: [
    { tag: 'rect', attrs: { width: '18', height: '11', x: '3', y: '11', rx: '2', ry: '2' } },
    { tag: 'path', attrs: { d: 'M7 11V7a5 5 0 0 1 10 0v4' } },
  ],
  pencil: [
    {
      tag: 'path',
      attrs: {
        d: 'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z',
      },
    },
    { tag: 'path', attrs: { d: 'm15 5 4 4' } },
  ],
  hourglass: [
    { tag: 'path', attrs: { d: 'M5 22h14' } },
    { tag: 'path', attrs: { d: 'M5 2h14' } },
    {
      tag: 'path',
      attrs: { d: 'M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22' },
    },
    {
      tag: 'path',
      attrs: { d: 'M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2' },
    },
  ],
  'user-round': [
    { tag: 'circle', attrs: { cx: '12', cy: '8', r: '5' } },
    { tag: 'path', attrs: { d: 'M20 21a8 8 0 0 0-16 0' } },
  ],
  'user-plus': [
    { tag: 'path', attrs: { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' } },
    { tag: 'circle', attrs: { cx: '9', cy: '7', r: '4' } },
    { tag: 'line', attrs: { x1: '19', x2: '19', y1: '8', y2: '14' } },
    { tag: 'line', attrs: { x1: '22', x2: '16', y1: '11', y2: '11' } },
  ],
  'triangle-alert': [
    {
      tag: 'path',
      attrs: { d: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3' },
    },
    { tag: 'path', attrs: { d: 'M12 9v4' } },
    { tag: 'path', attrs: { d: 'M12 17h.01' } },
  ],
  'circle-check': [
    { tag: 'circle', attrs: { cx: '12', cy: '12', r: '10' } },
    { tag: 'path', attrs: { d: 'm9 12 2 2 4-4' } },
  ],
  repeat: [
    { tag: 'path', attrs: { d: 'm17 2 4 4-4 4' } },
    { tag: 'path', attrs: { d: 'M3 11v-1a4 4 0 0 1 4-4h14' } },
    { tag: 'path', attrs: { d: 'm7 22-4-4 4-4' } },
    { tag: 'path', attrs: { d: 'M21 13v1a4 4 0 0 1-4 4H3' } },
  ],
  'arrow-left-right': [
    { tag: 'path', attrs: { d: 'M8 3 4 7l4 4' } },
    { tag: 'path', attrs: { d: 'M4 7h16' } },
    { tag: 'path', attrs: { d: 'm16 21 4-4-4-4' } },
    { tag: 'path', attrs: { d: 'M20 17H4' } },
  ],
  shuffle: [
    { tag: 'path', attrs: { d: 'm18 14 4 4-4 4' } },
    { tag: 'path', attrs: { d: 'm18 2 4 4-4 4' } },
    { tag: 'path', attrs: { d: 'M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22' } },
    { tag: 'path', attrs: { d: 'M2 6h1.972a4 4 0 0 1 3.6 2.2' } },
    { tag: 'path', attrs: { d: 'M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45' } },
  ],
  'trending-down': [
    { tag: 'path', attrs: { d: 'M16 17h6v-6' } },
    { tag: 'path', attrs: { d: 'm22 17-8.5-8.5-5 5L2 7' } },
  ],
  hand: [
    { tag: 'path', attrs: { d: 'M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2' } },
    { tag: 'path', attrs: { d: 'M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2' } },
    { tag: 'path', attrs: { d: 'M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8' } },
    {
      tag: 'path',
      attrs: {
        d: 'M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15',
      },
    },
  ],
  'git-merge': [
    { tag: 'circle', attrs: { cx: '18', cy: '18', r: '3' } },
    { tag: 'circle', attrs: { cx: '6', cy: '6', r: '3' } },
    { tag: 'path', attrs: { d: 'M6 21V9a9 9 0 0 0 9 9' } },
  ],
  'git-fork': [
    { tag: 'circle', attrs: { cx: '12', cy: '18', r: '3' } },
    { tag: 'circle', attrs: { cx: '6', cy: '6', r: '3' } },
    { tag: 'circle', attrs: { cx: '18', cy: '6', r: '3' } },
    { tag: 'path', attrs: { d: 'M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9' } },
    { tag: 'path', attrs: { d: 'M12 12v3' } },
  ],
  crown: [
    {
      tag: 'path',
      attrs: {
        d: 'M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z',
      },
    },
    { tag: 'path', attrs: { d: 'M5 21h14' } },
  ],
  calendar: [
    { tag: 'path', attrs: { d: 'M8 2v4' } },
    { tag: 'path', attrs: { d: 'M16 2v4' } },
    { tag: 'rect', attrs: { width: '18', height: '18', x: '3', y: '4', rx: '2' } },
    { tag: 'path', attrs: { d: 'M3 10h18' } },
  ],
  'trash-2': [
    { tag: 'path', attrs: { d: 'M10 11v6' } },
    { tag: 'path', attrs: { d: 'M14 11v6' } },
    { tag: 'path', attrs: { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6' } },
    { tag: 'path', attrs: { d: 'M3 6h18' } },
    { tag: 'path', attrs: { d: 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' } },
  ],
  eye: [
    {
      tag: 'path',
      attrs: {
        d: 'M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0',
      },
    },
    { tag: 'circle', attrs: { cx: '12', cy: '12', r: '3' } },
  ],
  plus: [
    { tag: 'path', attrs: { d: 'M5 12h14' } },
    { tag: 'path', attrs: { d: 'M12 5v14' } },
  ],
  minus: [{ tag: 'path', attrs: { d: 'M5 12h14' } }],
};

export type IconName = keyof typeof ICONS;
