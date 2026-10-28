import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  fetchCurrentUser,
  loginAccount,
  logoutAccount,
  registerAccount,
} from "../api/auth.js";
import { ApiError } from "../api/client.js";
import { AuthContext } from "./authContext.js";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");
  const [restoreError, setRestoreError] = useState("");
  const sessionVersion = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const version = sessionVersion.current;

    fetchCurrentUser({ signal: controller.signal })
      .then((nextUser) => {
        if (controller.signal.aborted || version !== sessionVersion.current) {
          return;
        }

        setUser(nextUser);
        setStatus("authenticated");
        setRestoreError("");
      })
      .catch((error) => {
        if (
          controller.signal.aborted ||
          error?.name === "AbortError" ||
          version !== sessionVersion.current
        ) {
          return;
        }

        setUser(null);
        setStatus("anonymous");
        setRestoreError(
          error instanceof ApiError && error.status !== 401
            ? error.message
            : "",
        );
      });

    return () => controller.abort();
  }, []);

  const login = useCallback(async (credentials) => {
    const nextUser = await loginAccount(credentials);

    sessionVersion.current += 1;
    setUser(nextUser);
    setStatus("authenticated");
    setRestoreError("");
    return nextUser;
  }, []);

  const register = useCallback(async (details) => {
    const nextUser = await registerAccount(details);

    sessionVersion.current += 1;
    setUser(nextUser);
    setStatus("authenticated");
    setRestoreError("");
    return nextUser;
  }, []);

  const logout = useCallback(async () => {
    await logoutAccount();

    sessionVersion.current += 1;
    setUser(null);
    setStatus("anonymous");
    setRestoreError("");
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      restoreError,
      login,
      register,
      logout,
    }),
    [user, status, restoreError, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
