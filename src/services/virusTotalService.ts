import axios from "axios";
import type { AnalysisReport, SubmitFileResponse } from "../types/index";

// VirusTotal API URLs
const VT_API_URL = "https://www.virustotal.com/api/v3";
const SUBMIT_URL = `${VT_API_URL}/files`;
const ANALYSIS_URL = `${VT_API_URL}/analyses`;

// Get API key from environment variable
const VT_API_KEY = import.meta.env.VITE_VT_API_KEY || "";

// Create axios instance with default config
const api = axios.create({
  headers: {
    "x-apikey": VT_API_KEY,
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
    console.error("Error getting report from VirusTotal:", error);
    throw new Error("Failed to retrieve analysis report");
  }
}

/**
 * Check if an API key is valid
 * @returns True if the API key is valid
 */
export async function validateApiKey(): Promise<boolean> {
  if (!VT_API_KEY) return false;

  try {
    await api.get(`${VT_API_URL}/users/current`);
    return true;
  } catch {
    return false;
  }
}
