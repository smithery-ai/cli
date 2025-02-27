import * as esbuild from 'esbuild';
import path from 'path';

async function build() {
    try {
        // Bundle the application
        await esbuild.build({
            entryPoints: [path.join(__dirname, '../src/cli/index.ts')],
            bundle: true,
            platform: 'node',
            target: 'node20',
            outfile: 'dist/cli/index.js',
            format: 'cjs',
        });

        console.log('Build completed successfully');
    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
}

build(); 