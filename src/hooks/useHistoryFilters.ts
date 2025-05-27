/**
 * History filters hook
 * Manages filtering state and logic for history view
 */

import { useState, useCallback } from "react";
import type {
  HistoryEntry,
  SearchOptions,
} from "../services/repositories/historyRepository";

export interface HistoryFilters {
  query: string;
  status: "all" | "completed" | "error";
  dateRange: "all" | "today" | "week" | "month";
  hasThreats: "all" | "safe" | "threats";
}

export interface HistoryFiltersHook {
  filters: HistoryFilters;
  setFilters: React.Dispatch<React.SetStateAction<HistoryFilters>>;
  updateFilter: <K extends keyof HistoryFilters>(
    key: K,
    value: HistoryFilters[K]
  ) => void;
  buildSearchOptions: (page: number, pageSize: number) => SearchOptions;
  getFilteredEntries: (entries: HistoryEntry[]) => HistoryEntry[];
}

export function useHistoryFilters(): HistoryFiltersHook {
  const [filters, setFilters] = useState<HistoryFilters>({
    query: "",
    status: "all",
    dateRange: "all",
    hasThreats: "all",
  });

  // Update a specific filter
  const updateFilter = useCallback(
    <K extends keyof HistoryFilters>(key: K, value: HistoryFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // Build search options for database query
  const buildSearchOptions = useCallback(
    (page: number, pageSize: number): SearchOptions => {
      const searchOptions: SearchOptions = {
        limit: pageSize,
        offset: page * pageSize,
      };

      // Query
      if (filters.query) {
        searchOptions.query = filters.query;
      }

      // Status filter - only apply database filter for specific single statuses
      if (filters.status !== "all" && filters.status !== "completed") {
        // For "error" status, we can use the database index
        searchOptions.status = filters.status as "error";
      }
      // For "completed" status, we'll filter client-side to include both "completed" and "reused"

      // Date range
      if (filters.dateRange !== "all") {
        const now = new Date();
        switch (filters.dateRange) {
          case "today":
            searchOptions.dateFrom = new Date(now.setHours(0, 0, 0, 0));
            break;
          case "week":
            searchOptions.dateFrom = new Date(now.setDate(now.getDate() - 7));
            break;
          case "month":
            searchOptions.dateFrom = new Date(now.setMonth(now.getMonth() - 1));
            break;
        }
      }

      // Threat filter
      if (filters.hasThreats !== "all") {
        searchOptions.hasThreats = filters.hasThreats === "threats";
      }

      return searchOptions;
    },
    [filters.query, filters.status, filters.dateRange, filters.hasThreats]
  );

  // Client-side filtering for entries (used for "completed" status filter)
  const getFilteredEntries = useCallback(
    (entries: HistoryEntry[]): HistoryEntry[] => {
      // Apply client-side status filtering for "completed" filter
      if (filters.status === "completed") {
        return entries.filter(
          (entry) => entry.status === "completed" || entry.status === "reused"
        );
      }

      return entries;
    },
    [filters.status]
  );

  return {
    filters,
    setFilters,
    updateFilter,
    buildSearchOptions,
    getFilteredEntries,
  };
}
