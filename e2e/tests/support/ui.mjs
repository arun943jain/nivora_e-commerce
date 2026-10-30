import { expect } from "@playwright/test";
import { API_ORIGIN } from "../../scripts/testDatabase.mjs";

export const CUSTOMER_PASSWORD = "E2eTest!2345";
export const ADMIN_PASSWORD = "E2eAdmin!2345";

export const uniqueEmail = (prefix) =>
  `${prefix}.${Date.now()}.${Math.floor(Math.random() * 100000)}@example.test`;

export const uniqueSuffix = () => `${Date.now().toString(36)}`;

export const apiUrl = (path) => `${API_ORIGIN}/api${path}`;

/** Registers a disposable account through the real API and shares its cookie. */
export const registerThroughApi = async (
  page,
  { name, email, password = CUSTOMER_PASSWORD },
) => {
  const response = await page.request.post(apiUrl("/auth/register"), {
    data: { name, email, password },
  });
  expect(response.status(), "registration should succeed").toBe(201);
  const payload = await response.json();
  expect(payload?.data?.user?.email).toBe(email);
  return payload.data.user;
};

/** Reads the current API order as the signed-in customer. */
export const fetchOrderThroughApi = async (page, orderId) => {
  const response = await page.request.get(apiUrl(`/orders/${orderId}`));
  expect(response.ok(), "order should be readable by its owner").toBeTruthy();
  const payload = await response.json();
  return payload.data.order;
};


export const shippingAddress = Object.freeze({
  firstName: "Asha",
  lastName: "Test",
  address: "12 Test Lane, Synthetic Nagar",
  city: "Pune",
  state: "Maharashtra",
  postalCode: "411001",
  country: "India",
  phone: "9876500123",
  email: "asha.test@example.test",
});

export const goTo = async (page, path) => {
  await page.goto(`/#${path}`, { waitUntil: "domcontentloaded" });
};

/** Registers through the real sign-up form and lands on the account page. */
export const registerThroughUi = async (page, { name, email }) => {
  await goTo(page, "/register");
  await expect(
    page.getByRole("heading", { name: "Create your account" }),
  ).toBeVisible();

  await page.locator('input[autocomplete="name"]').fill(name);
  await page.locator('input[autocomplete="email"]').fill(email);
  await page
    .locator('input[autocomplete="new-password"]')
    .first()
    .fill(CUSTOMER_PASSWORD);
  await page
    .locator('input[autocomplete="new-password"]')
    .nth(1)
    .fill(CUSTOMER_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/#\/account/);
  await expect(
    page.getByRole("heading", { name: "Account overview" }),
  ).toBeVisible();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
};

/** Signs in on the current sign-in page, preserving any `next` target. */
export const submitLogin = async (page, { email, password }) => {
  await expect(
    page.getByRole("heading", { name: "Good to have you back." }),
  ).toBeVisible();

  await page.locator('input[autocomplete="email"]').fill(email);
  await page
    .locator('input[autocomplete="current-password"]')
    .fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
};

/** Signs in through the real form and waits for the session-restored header. */
export const loginThroughUi = async (page, { email, password }) => {
  await goTo(page, "/login");
  await submitLogin(page, { email, password });

  await expect(page).toHaveURL(/#\/account/);
  await expect(
    page.getByRole("heading", { name: "Account overview" }),
  ).toBeVisible();
};

export const logoutThroughUi = async (page) => {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
};

export const mainNav = (page) => page.getByRole("navigation");

export const expectSignedInNav = async (page, firstName) => {
  await expect(mainNav(page).getByRole("link", { name: "My Orders" })).toBeVisible();
  await expect(
    page.locator(".header-actions").getByRole("link", { name: firstName }),
  ).toBeVisible();
};

export const expectSignedOutNav = async (page) => {
  await expect(
    mainNav(page).getByRole("link", { name: "My Orders" }),
  ).toHaveCount(0);
  await expect(
    page.locator(".header-actions").getByRole("link", { name: "Account" }),
  ).toBeVisible();
};

/** Adds one catalogue item from the product grid's quick-add button. */
export const quickAdd = async (page, productName) => {
  const card = page
    .locator("article.product-card")
    .filter({ hasText: productName });
  await expect(card).toHaveCount(1);
  await card.getByRole("button", { name: "Add to bag" }).click();
  await expect(page.locator(".toast")).toContainText("added to your bag");
};

export const openCart = async (page) => {
  await page.getByRole("link", { name: /^Bag/ }).click();
  await expect(page.getByRole("heading", { name: /Your bag/ })).toBeVisible();
};

export const checkoutForm = (page) => ({
  email: page.locator("#checkout-email"),
  phone: page.locator("#checkout-phone"),
  firstName: page.locator("#checkout-firstName"),
  lastName: page.locator("#checkout-lastName"),
  address: page.locator("#checkout-address"),
  city: page.locator("#checkout-city"),
  state: page.locator("#checkout-state"),
  postalCode: page.locator("#checkout-postalCode"),
});

export const fillCheckout = async (page, overrides = {}) => {
  const form = checkoutForm(page);
  const values = { ...shippingAddress, ...overrides };

  if (!(await form.phone.inputValue())) {
    await form.phone.fill(values.phone);
  }

  await form.firstName.fill(values.firstName);
  await form.lastName.fill(values.lastName);
  await form.address.fill(values.address);
  await form.city.fill(values.city);
  await form.state.fill(values.state);
  await form.postalCode.fill(values.postalCode);
};

/** Navigates to the shop and quick-adds a single product as the current user. */
export const addToBag = async (page, productName) => {
  await goTo(page, "/products");
  await expect(page.locator(".results-count")).toHaveText("20 pieces");
  await quickAdd(page, productName);
};

/** Reads the order id from the confirmation page's order link. */
export const readConfirmedOrderId = async (page) => {
  const link = page.locator('a[href^="#/orders/"]').first();
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  const id = String(href || "").replace("#/orders/", "").trim();
  expect(id).toMatch(/^NV-/);
  return id;
};

/** Asserts the signed-in header links and opens the server-backed order history. */
export const openMyOrders = async (page) => {
  await mainNav(page).getByRole("link", { name: "My Orders" }).click();
  await expect(page).toHaveURL(/#\/orders$/);
  await expect(
    page.getByRole("heading", { name: "Order history" }),
  ).toBeVisible();
};
