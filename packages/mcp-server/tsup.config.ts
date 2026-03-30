import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: true,
  treeshake: true,
  external: ['@neurameter/core', '@modelcontextprotocol/sdk'],
  banner: ({ format }) => {
    // Add shebang only for ESM cli entry
    if (format === 'esm') {
      return { js: '' };
    }
    return {};
  },
});
