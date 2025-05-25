/**
 * VirusTotal Service
 * Backward-compatible service layer using the new client architecture
 */

import type { AnalysisReport } from "../types/index";
import { getVirusTotalClient } from "./virusTotalFactory";
import { configService } from "./configService";

/**
 * Submit a file to VirusTotal for scanning
 * @param file The file blob to scan
 * @returns The analysis ID to use for retrieving the report
 * @throws {Error} When submission fails
 */
export async function submitFile(file: Blob): Promise<string> {
  const client = getVirusTotalClient();
  return client.submitFile(file);
}

/**
 * Get the report for a previously submitted file
 * @param analysisId The analysis ID returned from submitFile
 * @returns The full analysis report
 * @throws {Error} When report retrieval fails
 */
export async function getReport(analysisId: string): Promise<AnalysisReport> {
  const client = getVirusTotalClient();
  return client.getReport(analysisId);
}

/**
 * Check if an API key is valid
 * @returns True if the API key is valid, false if invalid or missing
 */
export async function validateApiKey(): Promise<boolean> {
  if (!configService.hasVirusTotalApiKey()) {
    console.log("No API key provided or API key is empty");
    return false;
  }

  const client = getVirusTotalClient();
  return client.validateApiKey();
}

/**
 * Check if VirusTotal API key is configured
 * @returns True if API key is configured
 */
export function hasApiKey(): boolean {
  return configService.hasVirusTotalApiKey();
}

/**
 * Get VirusTotal configuration
 * @returns VirusTotal configuration object
 */
export function getConfig() {
  return configService.getVirusTotalConfig();
}
