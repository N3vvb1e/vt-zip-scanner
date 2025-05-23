import axios from "axios";
import type { AnalysisReport, SubmitFileResponse } from "../types/index";

// VirusTotal API URLs
const VT_API_URL = "https://www.virustotal.com/api/v3";
const SUBMIT_URL = `${VT_API_URL}/files`;
const ANALYSIS_URL = `${VT_API_URL}/analyses`;

// Get API key from environment variable
const VT_API_KEY = import.meta.env.VITE_VT_API_KEY || "";

// Debug API key (don't log the actual key, just whether it exists)
console.log("API Key status:", {
  exists: !!VT_API_KEY,
  length: VT_API_KEY?.length || 0,
  firstChars: VT_API_KEY?.substring(0, 8) + "..." || "none",
});

// Create axios instance with default config
const api = axios.create({
  headers: {
    "X-Apikey": VT_API_KEY, // Use capital X and capital A as per VirusTotal docs
  },
});

/**
 * Submit a file to VirusTotal for scanning
 * @param file The file blob to scan
 * @returns The analysis ID to use for retrieving the report
 */
export async function submitFile(file: Blob): Promise<string> {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await api.post<SubmitFileResponse>(SUBMIT_URL, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return response.data.data.id;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;

      // Rate limit - throw specific error so caller can handle it
      if (status === 429) {
        throw new Error("RATE_LIMIT");
      }

      // Other HTTP errors
      if (status) {
        throw new Error(`HTTP ${status}: Failed to submit file for analysis`);
      }
    }

    console.error("Error submitting file to VirusTotal:", error);
    throw new Error("Failed to submit file for analysis");
  }
}

/**
 * Get the report for a previously submitted file
 * @param analysisId The analysis ID returned from submitFile
 * @returns The full analysis report
 */
export async function getReport(analysisId: string): Promise<AnalysisReport> {
  try {
    const response = await api.get(`${ANALYSIS_URL}/${analysisId}`);
    return response.data.data.attributes as AnalysisReport;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;

      // Rate limit - throw specific error so caller can handle it
      if (status === 429) {
        throw new Error("RATE_LIMIT");
      }

      // Other HTTP errors
      if (status) {
        throw new Error(`HTTP ${status}: Failed to retrieve analysis report`);
      }
    }

    console.error("Error getting report from VirusTotal:", error);
    throw new Error("Failed to retrieve analysis report");
  }
}

/**
 * Check if an API key is valid
 * @returns True if the API key is valid, false if invalid or missing
 */
export async function validateApiKey(): Promise<boolean> {
  if (!VT_API_KEY || VT_API_KEY.trim() === "") {
    console.log("No API key provided or API key is empty");
    return false;
  }

  try {
    await api.get(`${VT_API_URL}/users/current`);
    console.log("API key validation successful");
    return true;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const responseData = error.response?.data;

      console.log(`API validation failed with status: ${status}`, responseData);

      // Rate limit (429) means the API key is valid, just overused
      if (status === 429) {
        console.log("Rate limit hit, but API key is valid");
        return true;
      }

      // 401/403 means invalid API key or missing header
      if (status === 401 || status === 403) {
        console.log("Invalid API key or authentication error");
        return false;
      }

      // For other errors (network, server issues), assume key is valid
      // so user can still try to use the app
      console.log("Network/server error, assuming API key is valid");
      return true;
    }

    console.log("Unknown error during API key validation");
    return false;
  }
}
