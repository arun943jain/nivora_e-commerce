import { useEffect, useState } from "react";
import {
  fetchAdminCoupons,
  fetchAdminDashboard,
  fetchAdminOrders,
  fetchAdminProducts,
  fetchAdminUsers,
} from "../api/admin.js";

const RANGE_KEYS = {
  "This month": "this-month",
  "Last month": "last-month",
  "Last 90 days": "last-90-days",
};

const RESOURCE_FETCHERS = {
  "/admin/products": fetchAdminProducts,
  "/admin/orders": fetchAdminOrders,
  "/admin/users": fetchAdminUsers,
  "/admin/coupons": fetchAdminCoupons,
};

export default function useAdminWorkspace({
  route,
  range,
  search,
  status,
  sort,
  direction,
}) {
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({
    status: "loading",
    items: [],
    total: 0,
    summary: null,
    error: "",
  });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const normalizedRoute = String(route || "").replace(/\/+$/, "") || "/";

    setState((current) => ({ ...current, status: "loading", error: "" }));

    const load = async () => {
      try {
        if (normalizedRoute === "/admin") {
          const summary = await fetchAdminDashboard({
            range: RANGE_KEYS[range] || "this-month",
            signal: controller.signal,
          });

          if (!active) return;

          setState({
            status: "ready",
            items: [],
            total: 0,
            summary,
            error: "",
          });
          return;
        }

        const fetcher = RESOURCE_FETCHERS[normalizedRoute];

        if (!fetcher) {
          throw new Error("This admin section is not available.");
        }

        const result = await fetcher({
          search: debouncedSearch,
          status,
          sort,
          direction,
          signal: controller.signal,
        });

        if (!active) return;

        setState({
          status: "ready",
          items: result.items,
          total: result.total,
          summary: null,
          error: "",
        });
      } catch (error) {
        if (!active || error?.name === "AbortError") return;

        setState({
          status: "error",
          items: [],
          total: 0,
          summary: null,
          error:
            error?.message ||
            "The admin workspace could not be loaded. Please try again.",
        });
      }
    };

    load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [route, range, debouncedSearch, status, sort, direction, attempt]);

  return {
    ...state,
    retry: () => setAttempt((current) => current + 1),
    refresh: () => setAttempt((current) => current + 1),
  };
}
