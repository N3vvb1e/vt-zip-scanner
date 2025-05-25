/**
 * VirusTotal API Client
 * Handles HTTP communication with VirusTotal API
 */

import axios from "axios";
import type { AnalysisReport, SubmitFileResponse } from "../types/index";
import { ErrorHandler } from "../utils/errorHandler";

export interface VirusTotalConfig {
  apiKey: string;
  apiUrl?: string;
  timeout?: number;
}

export interface VirusTotalClientInterface {
  submitFile(file: Blob): Promise<string>;
  getReport(analysisId: string): Promise<AnalysisReport>;
  validateApiKey(): Promise<boolean>;
}

/**
 * VirusTotal API Client implementation
 */
export class VirusTotalClient implements VirusTotalClientInterface {
  private readonly api: ReturnType<typeof axios.create>;
  private readonly config: Required<VirusTotalConfig>;

  constructor(config: VirusTotalConfig) {
    this.config = {
      apiUrl: "https://www.virustotal.com/api/v3",
      timeout: 30000,
      ...config,
    };

    this.api = axios.create({
      timeout: this.config.timeout,
      headers: {
        "X-Apikey": this.config.apiKey,
      },
    });
  }

  /**
   * Submit a file to VirusTotal for scanning
   */
  async submitFile(file: Blob): Promise<string> {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await this.api.post<SubmitFileResponse>(
        `${this.config.apiUrl}/files`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      return response.data.data.id;
    } catch (error) {
      throw this.handleError(error, "submitFile");
    }
  }

  /**
   * Get the report for a previously submitted file
   */
  async getReport(analysisId: string): Promise<AnalysisReport> {
    try {
      const response = await this.api.get(
        `${this.config.apiUrl}/analyses/${analysisId}`
      );

      return response.data.data.attributes as AnalysisReport;
    } catch (error) {
      throw this.handleError(error, "getReport");
    }
  }

  /**
   * Check if the API key is valid
   */
  async validateApiKey(): Promise<boolean> {
    if (!this.config.apiKey || this.config.apiKey.trim() === "") {
      return false;
    }

    try {
      await this.api.get(`${this.config.apiUrl}/users/current`);
      return true;
    } catch (error) {
      const appError = ErrorHandler.handleAxiosError(error, "validateApiKey");

      // Rate limit means the API key is valid, just overused
      if (ErrorHandler.isRateLimitError(appError)) {
        return true;
      }

      // Auth errors mean invalid API key
      if (ErrorHandler.isAuthError(appError)) {
        return false;
      }

      // For network/server errors, assume key is valid so user can still try to use the app
      if (ErrorHandler.isNetworkError(appError)) {
        return true;
      }

      return false;
    }
  }

  /**
   * Handle errors consistently across all methods
   */
  private handleError(error: unknown, context: string): Error {
    const appError = ErrorHandler.handleAxiosError(error, context);
    ErrorHandler.logError(appError);

    // Convert to legacy error format for backward compatibility
    if (ErrorHandler.isRateLimitError(appError)) {
      return new Error("RATE_LIMIT");
    }

    return new Error(appError.message);
  }
}
