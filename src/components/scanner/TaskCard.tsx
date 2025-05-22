import { motion } from "framer-motion";
import {
  FileIcon,
  XCircle,
  Download,
  Loader2,
  AlertTriangle,
  CheckCircle,
  ShieldAlert,
} from "lucide-react";
import type { ScanTask } from "../../types";
import { Progress } from "../ui/Progress";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { formatFileSize } from "../../utils/zipUtils";

interface TaskCardProps {
  task: ScanTask;
  onRemove: (id: string) => void;
  onDownload: (task: ScanTask) => void;
}

export function TaskCard({ task, onRemove, onDownload }: TaskCardProps) {
  const getStatusBadge = () => {
    switch (task.status) {
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "uploading":
        return <Badge variant="info">Uploading</Badge>;
      case "scanning":
        return <Badge variant="warning">Scanning</Badge>;
      case "completed":
        if (task.report?.stats?.malicious && task.report.stats.malicious > 0) {
          return (
            <Badge variant="destructive">
              Detected: {task.report.stats.malicious}
            </Badge>
          );
        }
        return <Badge variant="success">Clean</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  const getStatusIcon = () => {
    switch (task.status) {
      case "pending":
        return <Loader2 className="h-5 w-5 text-muted-foreground" />;
      case "uploading":
        return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
      case "scanning":
        return <Loader2 className="h-5 w-5 text-warning animate-spin" />;
      case "completed":
        if (task.report?.stats?.malicious && task.report.stats.malicious > 0) {
          return <ShieldAlert className="h-5 w-5 text-destructive" />;
        }
        return <CheckCircle className="h-5 w-5 text-success" />;
      case "error":
        return <AlertTriangle className="h-5 w-5 text-destructive" />;
      default:
        return <FileIcon className="h-5 w-5" />;
    }
  };

  const isCompleted = task.status === "completed";
  const isSafe = isCompleted && task.report?.stats.malicious === 0;
  const isError = task.status === "error";

  return (
    <motion.div
      className="border rounded-lg p-4 mb-4 bg-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className="p-2 bg-muted rounded-md">{getStatusIcon()}</div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="font-medium truncate pr-2">{task.file.name}</h3>
              {getStatusBadge()}
            </div>

            <p className="text-sm text-muted-foreground mt-1">
              {formatFileSize(task.file.size)} • {task.file.type}
            </p>

            {isError && task.error && (
              <p className="text-sm text-destructive mt-2">{task.error}</p>
            )}

            {isCompleted && task.report && (
              <div className="mt-2 text-sm">
                <div className="flex items-center space-x-2 text-sm">
                  <span
                    className={isSafe ? "text-green-600" : "text-destructive"}
                  >
                    {task.report.stats.malicious} malicious
                  </span>
                  <span>•</span>
                  <span className="text-yellow-600">
                    {task.report.stats.suspicious} suspicious
                  </span>
                  <span>•</span>
                  <span className="text-green-600">
                    {task.report.stats.harmless} harmless
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex space-x-2">
          {isSafe && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDownload(task)}
              title="Download file"
            >
              <Download className="h-4 w-4" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(task.id)}
            title="Remove from list"
          >
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {(task.status === "uploading" || task.status === "scanning") && (
        <div className="mt-4">
          <Progress value={task.progress} className="h-2" />
        </div>
      )}
    </motion.div>
  );
}
