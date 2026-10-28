import { useEffect, useRef, useState } from "react";
import { fetchProducts } from "../api/catalogue.js";

const isDevelopment = import.meta.env.DEV;

export default function useCatalogueListing({
  category,
  minPrice,
  sort,
  query,
  fallbackItems,
}) {
  const fallbackRef = useRef(fallbackItems);
  const [attempt, setAttempt] = useState(0);
  const [debouncedQuery, setDebouncedQuery] = useState(() => query.trim());
  const [state, setState] = useState({
    items: [],
    status: "loading",
    error: "",
    pagination: null,
  });

  useEffect(() => {
    fallbackRef.current = fallbackItems;
  }, [fallbackItems]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();

    fetchProducts({
      page: 1,
      limit: 60,
      category: category === "All" ? "" : category,
      minPrice,
      sort,
      search: debouncedQuery,
      signal: controller.signal,
    })
      .then(({ products, pagination }) => {
        setState({
          items: products,
          status: "ready",
          error: "",
          pagination,
        });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;

        setState({
          items: isDevelopment ? fallbackRef.current : [],
          status: isDevelopment ? "fallback" : "error",
          error:
            error.message ||
            "The catalogue could not be loaded. Please try again.",
          pagination: null,
        });
      });

    return () => controller.abort();
  }, [category, debouncedQuery, minPrice, sort, attempt]);

  return {
    ...state,
    retry: () => setAttempt((current) => current + 1),
  };
}
