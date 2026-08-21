import { loadConfig, createCompiler } from '@stencil/core/compiler';
const { config } = await loadConfig({ configPath: 'stencil.config.ts', initConfig: true, config: {} });
const compiler = await createCompiler(config);
const results = await compiler.build();
console.log('=== build result ===');
const all = results.diagnostics || [];
console.log('total diagnostics:', all.length);
for (const d of all.slice(0, 30)) {
  console.log('  -', d.level, String(d.messageText || d).slice(0,160), '| rel:', d.relFilePath);
}
