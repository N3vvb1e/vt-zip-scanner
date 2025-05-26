import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Clock, Zap, AlertTriangle } from "lucide-react";
import { Badge } from "./Badge";

export interface ApiRateLimitData {
  currentRequests: number;
  maxRequests: number;
  windowDuration: number; // in milliseconds
  timeUntilReset: number; // in milliseconds
  canMakeRequest: boolean;
}

interface ApiRateLimitIndicatorProps {
  rateLimitData: ApiRateLimitData;
  className?: string;
  compact?: boolean;
}

export function ApiRateLimitIndicator({
  rateLimitData,
  className = "",
  compact = false,
}: ApiRateLimitIndicatorProps) {
  const [timeLeft, setTimeLeft] = useState(rateLimitData.timeUntilReset);

  // Update countdown timer
  useEffect(() => {
    setTimeLeft(rateLimitData.timeUntilReset);
    
    if (rateLimitData.timeUntilReset <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [rateLimitData.timeUntilReset]);

  const percentage = (rateLimitData.currentRequests / rateLimitData.maxRequests) * 100;
  const remaining = rateLimitData.maxRequests - rateLimitData.currentRequests;
  
  // Determine status and colors
  const getStatus = () => {
    if (percentage >= 100) return { status: "exhausted", color: "bg-red-500", textColor: "text-red-600" };
    if (percentage >= 75) return { status: "warning", color: "bg-yellow-500", textColor: "text-yellow-600" };
    if (percentage >= 50) return { status: "moderate", color: "bg-blue-500", textColor: "text-blue-600" };
    return { status: "good", color: "bg-green-500", textColor: "text-green-600" };
  };

  const { status, color, textColor } = getStatus();

  const formatTime = (ms: number) => {
    if (ms <= 0) return "0s";
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getStatusIcon = () => {
    switch (status) {
      case "exhausted":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Zap className="h-4 w-4 text-primary" />;
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case "exhausted":
        return <Badge variant="destructive">Rate Limited</Badge>;
      case "warning":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Low Quota</Badge>;
      case "moderate":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Moderate Usage</Badge>;
      default:
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Available</Badge>;
    }
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {getStatusIcon()}
        <span className="text-sm font-medium">
          {remaining}/{rateLimitData.maxRequests}
        </span>
        {timeLeft > 0 && (
          <span className="text-xs text-muted-foreground">
            ({formatTime(timeLeft)})
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-card border rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <h3 className="font-medium text-sm">API Rate Limit</h3>
        </div>
        {getStatusBadge()}
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Used: {rateLimitData.currentRequests}/{rateLimitData.maxRequests}</span>
          <span>{Math.round(percentage)}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <motion.div
            className={`h-2 rounded-full ${color}`}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Status Information */}
      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Remaining:</span>
          <span className={`font-medium ${textColor}`}>
            {remaining} requests
          </span>
        </div>
        
        {timeLeft > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Reset in:</span>
            <span className="font-medium flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTime(timeLeft)}
            </span>
          </div>
        )}

        <div className="flex justify-between">
          <span className="text-muted-foreground">Window:</span>
          <span className="font-medium">
            {Math.round(rateLimitData.windowDuration / 1000 / 60)}min
          </span>
        </div>
      </div>

      {/* Warning Message */}
      {status === "exhausted" && (
        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          <div className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            <span className="font-medium">Rate limit reached</span>
          </div>
          <p className="mt-1">
            Wait {formatTime(timeLeft)} before making new requests.
          </p>
        </div>
      )}

      {status === "warning" && (
        <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
          <div className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            <span className="font-medium">Approaching limit</span>
          </div>
          <p className="mt-1">
            Consider slowing down requests to avoid rate limiting.
          </p>
        </div>
      )}
    </div>
  );
}
