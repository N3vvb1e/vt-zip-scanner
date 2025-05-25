/**
 * VirusTotal Factory Service
 * Creates and manages VirusTotal client instances
 */

import { VirusTotalClient, type VirusTotalClientInterface } from "./virusTotalClient";
import { configService } from "./configService";

/**
 * Factory for creating VirusTotal client instances
 */
export class VirusTotalFactory {
  private static clientInstance: VirusTotalClientInterface | null = null;

  /**
   * Get or create a VirusTotal client instance
   */
  static getClient(): VirusTotalClientInterface {
    if (!this.clientInstance) {
      this.clientInstance = this.createClient();
    }
    return this.clientInstance;
  }

  /**
   * Create a new VirusTotal client instance
   */
  static createClient(): VirusTotalClientInterface {
    const config = configService.getVirusTotalConfig();
    return new VirusTotalClient(config);
  }

  /**
   * Reset the client instance (useful for testing or config changes)
   */
  static resetClient(): void {
    this.clientInstance = null;
  }

  /**
   * Create a client with custom configuration
   */
  static createCustomClient(apiKey: string): VirusTotalClientInterface {
    return new VirusTotalClient({
      apiKey,
      apiUrl: configService.getVirusTotalConfig().apiUrl,
      timeout: configService.getVirusTotalConfig().timeout,
    });
  }
}

// Export convenience functions for backward compatibility
export const getVirusTotalClient = () => VirusTotalFactory.getClient();
export const createVirusTotalClient = (apiKey?: string) => 
  apiKey ? VirusTotalFactory.createCustomClient(apiKey) : VirusTotalFactory.createClient();
