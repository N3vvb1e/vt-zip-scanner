import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { motion } from "framer-motion";
import {
  FileArchive,
  Upload,
  AlertTriangle,
  Shield,
  ShieldAlert,
  Info,
  CheckCircle,
} from "lucide-react";
import {
  processZipFileSecurely,
  MAX_ZIP_SIZE,
  type ZipSecurityReport,
} from "../../utils/secureZipUtils";
import { formatFileSize } from "../../utils/common";
import { Button } from "../ui/Button";
import type { FileEntry } from "../../types";

interface FileDropzoneProps {
  onFilesExtracted: (files: FileEntry[]) => void;
  disabled?: boolean;
}

interface SecurityReportModalProps {
  report: ZipSecurityReport;
  onContinue: () => void;
  onCancel: () => void;
  isProcessing: boolean;
}

function SecurityReportModal({
  report,
  onContinue,
  onCancel,
  isProcessing,
}: SecurityReportModalProps) {
  const hasErrors = report.errors.length > 0;
  const hasWarnings = report.warnings.length > 0;

  return (
    <motion.div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-card rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
      >
        <div className="flex items-center mb-4">
          {hasErrors ? (
            <ShieldAlert className="h-8 w-8 text-destructive mr-3" />
          ) : hasWarnings ? (
            <AlertTriangle className="h-8 w-8 text-yellow-500 mr-3" />
          ) : (
            <Shield className="h-8 w-8 text-green-500 mr-3" />
          )}
          <h2 className="text-2xl font-bold">
            {hasErrors
              ? "Security Issues Detected"
              : hasWarnings
              ? "Security Warnings"
              : "Security Check Passed"}
          </h2>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 bg-secondary/50 rounded-lg p-4">
          <div>
            <p className="text-sm text-muted-foreground">Files</p>
            <p className="text-xl font-semibold">{report.stats.fileCount}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Size</p>
            <p className="text-xl font-semibold">
              {formatFileSize(report.stats.totalUncompressedSize)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Compression</p>
            <p className="text-xl font-semibold">
              {report.stats.compressionRatio.toFixed(1)}:1
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Suspicious</p>
            <p className="text-xl font-semibold text-yellow-500">
              {report.stats.suspiciousFiles.length}
            </p>
          </div>
        </div>

        {/* Errors */}
        {hasErrors && (
          <div className="mb-6">
            <h3 className="font-semibold text-destructive mb-2 flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Critical Issues ({report.errors.length})
            </h3>
            <div className="space-y-2">
              {report.errors.map((error, index) => (
                <div
                  key={index}
                  className="bg-destructive/10 border border-destructive/30 rounded p-3 text-sm"
                >
                  {error}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Warnings */}
        {hasWarnings && (
          <div className="mb-6">
            <h3 className="font-semibold text-yellow-600 mb-2 flex items-center">
              <Info className="h-5 w-5 mr-2" />
              Warnings ({report.warnings.length})
            </h3>
            <div className="space-y-2">
              {report.warnings.map((warning, index) => (
                <div
                  key={index}
                  className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3 text-sm"
                >
                  {warning}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suspicious Files */}
        {report.stats.suspiciousFiles.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold mb-2">Suspicious Files</h3>
            <div className="bg-muted rounded p-3 max-h-32 overflow-y-auto">
              <ul className="text-sm space-y-1">
                {report.stats.suspiciousFiles.map((file, index) => (
                  <li key={index} className="font-mono text-xs">
                    {file}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Success message */}
        {!hasErrors && !hasWarnings && (
          <div className="mb-6 bg-green-500/10 border border-green-500/30 rounded p-4">
            <p className="flex items-center text-green-600">
              <CheckCircle className="h-5 w-5 mr-2" />
              No security issues detected. The ZIP file appears to be safe.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-3">
          <Button variant="outline" onClick={onCancel} disabled={isProcessing}>
            Cancel
          </Button>
          {!hasErrors && (
            <Button
              variant={hasWarnings ? "destructive" : "default"}
              onClick={onContinue}
              isLoading={isProcessing}
              disabled={isProcessing}
            >
              {hasWarnings ? "Continue Anyway" : "Continue"}
            </Button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export function FileDropzone({
  onFilesExtracted,
  disabled = false,
}: FileDropzoneProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [securityReport, setSecurityReport] =
    useState<ZipSecurityReport | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [extractionInProgress, setExtractionInProgress] = useState(false);

  const handleSecurityCheck = useCallback(
    async (zipFile: File) => {
      try {
        const result = await processZipFileSecurely(zipFile, {
          strictMode: false, // Allow warnings but block errors
          allowNestedZips: false,
        });

        // Show security report
        setSecurityReport(result.securityReport);
        setPendingFile(zipFile);

        // If no issues, proceed automatically
        if (
          result.securityReport.isSecure &&
          result.securityReport.warnings.length === 0
        ) {
          onFilesExtracted(result.files);
          setIsProcessing(false);
        }
      } catch (err: unknown) {
        console.error("Error processing ZIP file:", err);

        // Check if it's a security error with report
        if (err && typeof err === "object" && "securityReport" in err) {
          setSecurityReport(
            (err as { securityReport: ZipSecurityReport }).securityReport
          );
          setPendingFile(null);
        } else {
          setError(
            err instanceof Error ? err.message : "Failed to process ZIP file."
          );
          setIsProcessing(false);
        }
      }
    },
    [onFilesExtracted]
  );

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      // Reset state
      setError(null);
      setSecurityReport(null);
      setPendingFile(null);

      // Check if any files were dropped
      if (acceptedFiles.length === 0) {
        setError("No files were selected.");
        return;
      }

      // Get the first file (we only handle one zip at a time)
      const zipFile = acceptedFiles[0];

      // Validate file type
      if (!zipFile.name.toLowerCase().endsWith(".zip")) {
        setError("Only ZIP files are supported.");
        return;
      }

      // Validate file size
      if (zipFile.size > MAX_ZIP_SIZE) {
        setError(
          `File size exceeds the maximum allowed (${formatFileSize(
            MAX_ZIP_SIZE
          )}).`
        );
        return;
      }

      setIsProcessing(true);
      await handleSecurityCheck(zipFile);
    },
    [handleSecurityCheck]
  );

  const handleContinueExtraction = useCallback(async () => {
    if (!pendingFile || !securityReport) return;

    setExtractionInProgress(true);
    try {
      // Re-process with warnings allowed
      const result = await processZipFileSecurely(pendingFile, {
        strictMode: false,
        allowNestedZips: false,
      });

      onFilesExtracted(result.files);
      setSecurityReport(null);
      setPendingFile(null);
    } catch (err) {
      console.error("Error during extraction:", err);
      setError("Failed to extract files.");
    } finally {
      setIsProcessing(false);
      setExtractionInProgress(false);
    }
  }, [pendingFile, securityReport, onFilesExtracted]);

  const handleCancelExtraction = useCallback(() => {
    setSecurityReport(null);
    setPendingFile(null);
    setIsProcessing(false);
    setExtractionInProgress(false);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: disabled || isProcessing,
    accept: {
      "application/zip": [".zip"],
      "application/x-zip-compressed": [".zip"],
    },
    maxFiles: 1,
  });

  return (
    <>
      <div className="w-full max-w-2xl mx-auto">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? "border-primary bg-primary/10"
              : "border-muted-foreground/30 hover:border-primary/50"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <input {...getInputProps()} />

          <div className="flex flex-col items-center justify-center space-y-4">
            {isProcessing ? (
              <>
                <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                <p className="text-lg font-medium">
                  Analyzing ZIP file security...
                </p>
                <p className="text-sm text-muted-foreground">
                  Checking for malicious patterns and potential threats
                </p>
              </>
            ) : (
              <>
                <div className="relative">
                  <FileArchive className="h-12 w-12 text-primary" />
                  <Shield className="h-6 w-6 text-green-500 absolute -bottom-1 -right-1" />
                </div>

                <div>
                  <p className="text-lg font-medium">
                    {isDragActive
                      ? "Drop ZIP file here"
                      : "Drag & drop a ZIP file here"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    or click to select a file (max{" "}
                    {formatFileSize(MAX_ZIP_SIZE)})
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  className="mt-2"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Select ZIP file
                </Button>
              </>
            )}
          </div>
        </div>

        {error && (
          <motion.div
            className="mt-4 p-4 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <AlertTriangle className="h-5 w-5 text-destructive mr-2 flex-shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
          </motion.div>
        )}

        {/* Security info */}
        <div className="mt-4 bg-muted rounded-lg p-4 flex items-start">
          <Shield className="h-5 w-5 text-primary mr-3 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Enhanced Security</p>
            <p className="text-muted-foreground mt-1">
              ZIP files are analyzed for malicious patterns, including ZIP
              bombs, directory traversal attacks, and suspicious file types
              before extraction.
            </p>
          </div>
        </div>
      </div>

      {/* Security Report Modal */}
      {securityReport && (
        <SecurityReportModal
          report={securityReport}
          onContinue={handleContinueExtraction}
          onCancel={handleCancelExtraction}
          isProcessing={extractionInProgress}
        />
      )}
    </>
  );
}
