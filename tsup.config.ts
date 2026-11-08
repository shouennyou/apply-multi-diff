import { defineConfig } from 'tsup';

export default defineConfig({
  // Bundle the public entry so Node can load the CJS build without resolving
  // extensionless `.cjs` sibling imports.
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  target: 'es2020',
  outDir: 'dist',
  bundle: true,
});
