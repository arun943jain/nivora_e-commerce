const DEFAULT_API_BASE_URL = "http://localhost:5000/api";
const DEFAULT_TIMEOUT_MS = 12000;

const baseUrl =
  import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;

export const API_BASE_URL = baseUrl.replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(message, { status = 0, cause } = {}) {
    super(message, { cause });
    this.name = "ApiError";
    this.status = status;
    this.isNetworkError = status === 0;
  }
}

const readJson = async (response) => {
  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

export const apiRequest = async (
  path,
  { signal, timeoutMs, method = "GET", body, headers } = {},
) => {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs || DEFAULT_TIMEOUT_MS);
  const cancelFromCaller = () => controller.abort();

  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", cancelFromCaller, { once: true });
    }
  }

  const requestHeaders = { Accept: "application/json", ...headers };

  if (body !== undefined) {
    requestHeaders["Content-Type"] = "application/json";
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "include",
      signal: controller.signal,
    });
    const payload = await readJson(response);

    if (!response.ok) {
      throw new ApiError(
        payload?.message || `Request failed (${response.status}).`,
        { status: response.status },
      );
    }

    if (!payload || payload.success !== true) {
      throw new ApiError("The service returned an unexpected response.", {
        status: response.status,
      });
    }

    return payload;
  } catch (error) {
    if (error instanceof ApiError) throw error;

    if (error?.name === "AbortError") {
      if (timedOut) {
        throw new ApiError("The request timed out.", { cause: error });
      }

      if (signal?.aborted) throw error;

      throw new ApiError("The request was cancelled.", {
        cause: error,
      });
    }

    throw new ApiError("Unable to reach the server.", {
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancelFromCaller);
  }
};
