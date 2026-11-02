import { defineConfig } from 'vitest/config';

/**
 * Os scripts do deploy não passam pelo build do Angular, então não entram em
 * `ng test`. Eles rodam no Node, na esteira, antes de existir bundle — e é
 * exatamente por isso que merecem teste: quando um deles erra, erra publicando.
 */
export default defineConfig({
  test: {
    include: ['scripts/**/*.spec.mjs'],
  },
});
