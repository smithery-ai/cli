import * as esbuild from 'esbuild';
import path from 'path';
import dotenv from 'dotenv';

async function build() {
    try {
        // Load environment variables
        dotenv.config();
        
        // Create define object for environment variables
        const define: Record<string, string> = {};
        for (const key in process.env) {
            /* Skip environment variables that should be evaluated at runtime */
            if (['HOME', 'USER', 'XDG_CONFIG_HOME'].includes(key)) continue;
            
            define[`process.env.${key}`] = JSON.stringify(process.env[key]);
        }
        
        await esbuild.build({
            entryPoints: [path.join(__dirname, '../src/index.ts')],
            bundle: true,
            platform: 'node',
            target: 'node20',
            outfile: 'dist/index.js',
            format: 'cjs',
            minify: true,
            treeShaking: true,
            define,
        });

        console.log('Build completed successfully');
    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
}

build(); 