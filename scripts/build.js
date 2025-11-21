import { build } from 'esbuild';
import { rm, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const commonBuildOptions = {
  entryPoints: [join(rootDir, 'src/index.ts')],
  bundle: true,
  sourcemap: true,
  minify: false,
  platform: 'neutral',
  target: ['es2020'],
  external: [], // No external dependencies to exclude
  logLevel: 'info',
};

async function cleanDist() {
  const distDir = join(rootDir, 'dist');
  try {
    await rm(distDir, { recursive: true, force: true });
    console.log('✓ Cleaned dist directory');
  } catch (err) {
    // Directory might not exist, that's fine
  }
  // Ensure dist directories exist
  await mkdir(join(distDir, 'esm'), { recursive: true });
}

async function buildESM() {
  await build({
    ...commonBuildOptions,
    format: 'esm',
    outfile: join(rootDir, 'dist/esm/index.js'),
  });
  console.log('✓ Built ESM bundle (dist/esm/index.js)');
}

async function buildCJS() {
  await build({
    ...commonBuildOptions,
    format: 'cjs',
    outfile: join(rootDir, 'dist/index.js'),
  });
  console.log('✓ Built CommonJS bundle (dist/index.js)');
}

async function buildTypes() {
  try {
    // Run tsc only for type declarations - it will generate .d.ts files
    // We need to ensure it outputs to the correct location
    await execAsync('npx tsc --emitDeclarationOnly --declaration --declarationMap', {
      cwd: rootDir,
    });
    
    // Copy .d.ts files from dist/ to dist/esm/ if needed
    // Actually, tsc should generate them in dist/ and we can use them for both
    console.log('✓ Generated TypeScript declarations');
  } catch (err) {
    console.error('Error generating types:', err.message);
    throw err;
  }
}

async function main() {
  console.log('Building package with esbuild...\n');
  
  try {
    await cleanDist();
    
    // Build both formats in parallel
    await Promise.all([buildESM(), buildCJS()]);
    
    // Generate types
    await buildTypes();
    
    console.log('\n✓ Build complete!');
    console.log('  - ESM: dist/esm/index.js');
    console.log('  - CJS: dist/index.js');
    console.log('  - Types: dist/*.d.ts');
  } catch (err) {
    console.error('\n✗ Build failed:', err.message);
    process.exit(1);
  }
}

main();

