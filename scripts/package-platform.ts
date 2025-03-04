import { execSync } from 'child_process';
import { platform } from 'os';

try {
    switch (platform()) {
        case 'win32':
            execSync('npm run package:win', { stdio: 'inherit' });
            break;
        case 'darwin':
            execSync('npm run package:mac', { stdio: 'inherit' });
            break;
        case 'linux':
            execSync('npm run package:linux', { stdio: 'inherit' });
            break;
        default:
            console.error(`Unsupported platform: ${platform()}`);
            process.exit(1);
    }
} catch (error) {
    console.error('Packaging failed:', error);
    process.exit(1);
} 