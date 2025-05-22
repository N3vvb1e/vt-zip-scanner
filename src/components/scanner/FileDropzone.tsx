import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { motion } from "framer-motion";
import { FileArchive, Upload, AlertTriangle } from "lucide-react";
import {
  processZipFile,
  MAX_ZIP_SIZE,
  formatFileSize,
} from "../../utils/zipUtils";
import { Button } from "../ui/Button";
import type { FileEntry } from "../../types";

interface FileDropzoneProps {
  onFilesExtracted: (files: FileEntry[]) => void;
  disabled?: boolean;
}

export function FileDropzone({
  onFilesExtracted,
  disabled = false,
}: FileDropzoneProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      // Reset state
      setError(null);

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

      try {
        setIsProcessing(true);

        // Process the ZIP file
        const extractedFiles = await processZipFile(zipFile);

        // Check if any files were extracted
        if (extractedFiles.length === 0) {
          setError("No files found in the ZIP archive.");
          return;
        }

        // Pass extracted files to parent component
        onFilesExtracted(extractedFiles);
      } catch (err) {
        console.error("Error processing ZIP file:", err);
        setError(
          err instanceof Error ? err.message : "Failed to process ZIP file."
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [onFilesExtracted]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: disabled || isProcessing,
    accept: {
      "application/zip": [".zip"],
    },
    maxFiles: 1,
  });

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Using a regular div with motion props to avoid TypeScript errors */}
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
              <p className="text-lg font-medium">Processing ZIP file...</p>
            </>
          ) : (
            <>
              <FileArchive className="h-12 w-12 text-primary" />

              <div>
                <p className="text-lg font-medium">
                  {isDragActive
                    ? "Drop ZIP file here"
                    : "Drag & drop a ZIP file here"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  or click to select a file (max {formatFileSize(MAX_ZIP_SIZE)})
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
    </div>
  );
}
