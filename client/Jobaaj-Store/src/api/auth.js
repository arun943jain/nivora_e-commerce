import { ApiError, apiRequest } from "./client.js";

const expectUser = (payload) => {
  const user = payload?.data?.user;

  if (
    !user ||
    typeof user !== "object" ||
    !user.email ||
    !user.role ||
    !user.name
  ) {
    throw new ApiError(
      "The authentication service returned an invalid response.",
      { status: 200 },
    );
  }

  return user;
};

export const registerAccount = async ({ name, email, password }) =>
  expectUser(
    await apiRequest("/auth/register", {
      method: "POST",
      body: { name, email, password },
    }),
  );

export const loginAccount = async ({ email, password }) =>
  expectUser(
    await apiRequest("/auth/login", {
      method: "POST",
      body: { email, password },
    }),
  );

export const logoutAccount = async () =>
  apiRequest("/auth/logout", { method: "POST" });

export const fetchCurrentUser = async ({ signal } = {}) =>
  expectUser(await apiRequest("/auth/me", { signal }));
