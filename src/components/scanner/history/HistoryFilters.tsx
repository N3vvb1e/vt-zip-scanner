/**
 * History filters component
 * Handles search and filtering UI for history view
 */

import { Search, Filter, X } from "lucide-react";
import { Button } from "../../ui/Button";
import type { HistoryFilters } from "../../../hooks/useHistoryFilters";

interface HistoryFiltersProps {
  filters: HistoryFilters;
  updateFilter: <K extends keyof HistoryFilters>(key: K, value: HistoryFilters[K]) => void;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  totalEntries: number;
  filteredCount: number;
}

export function HistoryFilters({
  filters,
  updateFilter,
  showFilters,
  setShowFilters,
  totalEntries,
  filteredCount,
}: HistoryFiltersProps) {
  const hasActiveFilters = 
    filters.query || 
    filters.status !== "all" || 
    filters.dateRange !== "all" || 
    filters.hasThreats !== "all";

  const clearAllFilters = () => {
    updateFilter("query", "");
    updateFilter("status", "all");
    updateFilter("dateRange", "all");
    updateFilter("hasThreats", "all");
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search files..."
            value={filters.query}
            onChange={(e) => updateFilter("query", e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <Button
          variant={showFilters ? "default" : "outline"}
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2"
        >
          <Filter className="h-4 w-4" />
          Filters
          {hasActiveFilters && (
            <span className="bg-blue-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              !
            </span>
          )}
        </Button>
      </div>

      {/* Filter Controls */}
      {showFilters && (
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => updateFilter("status", e.target.value as HistoryFilters["status"])}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="error">Error</option>
              </select>
            </div>

            {/* Date Range Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Date Range
              </label>
              <select
                value={filters.dateRange}
                onChange={(e) => updateFilter("dateRange", e.target.value as HistoryFilters["dateRange"])}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
            </div>

            {/* Threat Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Threats
              </label>
              <select
                value={filters.hasThreats}
                onChange={(e) => updateFilter("hasThreats", e.target.value as HistoryFilters["hasThreats"])}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Files</option>
                <option value="safe">Safe Files</option>
                <option value="threats">Files with Threats</option>
              </select>
            </div>
          </div>

          {/* Filter Actions */}
          {hasActiveFilters && (
            <div className="mt-4 flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Showing {filteredCount} of {totalEntries} entries
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllFilters}
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
