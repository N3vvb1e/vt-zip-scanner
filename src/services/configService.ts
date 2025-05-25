/**
 * Configuration Service
 * Handles application configuration and environment variables
 */

export interface AppConfig {
  virusTotal: {
    apiKey: string;
    apiUrl: string;
    timeout: number;
  };
  app: {
    name: string;
    version: string;
  };
}

/**
 * Configuration service for managing app settings
 */
export class ConfigService {
  private static instance: ConfigService;
  private config: AppConfig;

  private constructor() {
    this.config = this.loadConfig();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  /**
   * Get the full configuration
   */
  getConfig(): AppConfig {
    return { ...this.config };
  }

  /**
   * Get VirusTotal configuration
   */
  getVirusTotalConfig() {
    return { ...this.config.virusTotal };
  }

  /**
   * Check if VirusTotal API key is configured
   */
  hasVirusTotalApiKey(): boolean {
    return Boolean(this.config.virusTotal.apiKey?.trim());
  }

  /**
   * Update VirusTotal API key (for runtime configuration)
   */
  setVirusTotalApiKey(apiKey: string): void {
    this.config.virusTotal.apiKey = apiKey;
  }

  /**
   * Load configuration from environment variables
   */
  private loadConfig(): AppConfig {
    const apiKey = import.meta.env.VITE_VT_API_KEY || "";
    
    if (!apiKey) {
      console.warn("VirusTotal API key not found in environment variables");
    }

    return {
      virusTotal: {
        apiKey,
        apiUrl: "https://www.virustotal.com/api/v3",
        timeout: 30000, // 30 seconds
      },
      app: {
        name: "VirusTotal ZIP Scanner",
        version: "1.0.0",
      },
    };
  }
}

// Export singleton instance
export const configService = ConfigService.getInstance();
