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
  dateRange: "all" | "today" | "last7days" | "last30days";
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
          case "today": {
            // Start of today (00:00:00)
            const startOfToday = new Date(now);
            startOfToday.setHours(0, 0, 0, 0);
            searchOptions.dateFrom = startOfToday;
            break;
          }
          case "last7days": {
            // 7 days ago from start of today
            const sevenDaysAgo = new Date(now);
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            sevenDaysAgo.setHours(0, 0, 0, 0);
            searchOptions.dateFrom = sevenDaysAgo;
            break;
          }
          case "last30days": {
            // 30 days ago from start of today
            const thirtyDaysAgo = new Date(now);
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            thirtyDaysAgo.setHours(0, 0, 0, 0);
            searchOptions.dateFrom = thirtyDaysAgo;
            break;
          }
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
