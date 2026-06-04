import { IFileSystem } from '../ports/IFileSystem';

export type RuleSeveritySetting = 'error' | 'warn' | 'off';

export interface LinterConfig {
    rules: Record<string, RuleSeveritySetting>;
    ignore: string[];
}

export class ConfigManager {
    private static readonly CONFIG_FILENAME = '.pbiplensrc.json';

    public static readonly DEFAULT_CONFIG: LinterConfig = {
        rules: {
            'orphan-node': 'error',
            'missing-description': 'error',
        },
        ignore: [],
    };

    constructor(private fs: IFileSystem) {}

    /**
     * Loads the configuration from the target path's .pbiplensrc.json file.
     * If the file does not exist or has errors, returns the default configuration.
     */
    public async loadConfig(targetPath: string): Promise<LinterConfig> {
        const configPath = this.fs.joinPaths(targetPath, ConfigManager.CONFIG_FILENAME);
        try {
            if (await this.fs.pathExists(configPath)) {
                const content = await this.fs.readFile(configPath);
                const parsed = JSON.parse(content);

                const rules = parsed.rules ? { ...parsed.rules } : {};
                const ignore = Array.isArray(parsed.ignore) ? [...parsed.ignore] : [];

                return { rules, ignore };
            }
        } catch (error) {
            // Silently fall back to default config if reading/parsing fails
        }
        return { ...ConfigManager.DEFAULT_CONFIG };
    }
}
