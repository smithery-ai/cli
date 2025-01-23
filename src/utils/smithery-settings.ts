import { homedir, platform } from 'os'
import { join } from 'path'
import { promises as fs } from 'fs'
import { v4 as uuidv4 } from 'uuid'

interface Settings {
  userId: string;
  cache?: {
    servers?: Record<string, {
      lastFetched: number;
      data: unknown;
    }>;
  };
}

export class SmitherySettings {
  private static getSettingsPath(): string {
    switch (platform()) {
      case 'win32':
        return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'smithery');
      case 'darwin':
        return join(homedir(), 'Library', 'Application Support', 'smithery');
      default:
        return join(homedir(), '.config', 'smithery');
    }
  }

  private static SETTINGS_PATH = join(SmitherySettings.getSettingsPath(), 'settings.json');
  private data: Settings | null = null;

  async initialize(): Promise<void> {
    try {
      await fs.mkdir(SmitherySettings.getSettingsPath(), { recursive: true });
      
      try {
        const content = await fs.readFile(SmitherySettings.SETTINGS_PATH, 'utf-8');
        this.data = JSON.parse(content);
        
        // Ensure userId exists in loaded data
        if (this.data && !this.data.userId) {
          this.data.userId = uuidv4();
          await this.save();
        }
      } catch (error) {
        // Create new settings if file doesn't exist
        this.data = {
          userId: uuidv4(),
          cache: { servers: {} }
        };
        await this.save();
      }
    } catch (error) {
      console.error('Failed to initialize settings:', error);
      throw error;
    }
  }

  private async save(): Promise<void> {
    await fs.writeFile(
      SmitherySettings.SETTINGS_PATH,
      JSON.stringify(this.data, null, 2)
    );
  }

  getUserId(): string {
    if (!this.data) {
      throw new Error('Settings not initialized');
    }
    return this.data.userId;
  }
} 