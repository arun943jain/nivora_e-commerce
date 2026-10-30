import { expect, test } from "@playwright/test";
import {
  CUSTOMER_PASSWORD,
  apiUrl,
  expectSignedInNav,
  expectSignedOutNav,
  goTo,
  logoutThroughUi,
  openMyOrders,
  registerThroughUi,
  submitLogin,
  uniqueEmail,
} from "./support/ui.mjs";

test.describe("customer authentication and access control", () => {
  test("register, restore the session, protect routes and reject customers from admin", async ({
    page,
  }) => {
    const email = uniqueEmail("auth.customer");
    const name = "Asha Auth";

    await test.step("register through the real sign-up form", async () => {
      await goTo(page, "/");
      await expectSignedOutNav(page);

      await registerThroughUi(page, { name, email });
      await expectSignedInNav(page, "Asha");
      await expect(
        page.getByText("Customer", { exact: true }),
      ).toBeVisible();
    });

    await test.step("session is restored after a full reload", async () => {
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(
        page.getByRole("heading", { name: "Account overview" }),
      ).toBeVisible();
      await expectSignedInNav(page, "Asha");
      await expect(page.getByText(email, { exact: true })).toBeVisible();
    });

    await test.step("My Orders in the primary navigation opens order history", async () => {
      await openMyOrders(page);
      await expect(
        page.getByRole("heading", { name: "No orders yet." }),
      ).toBeVisible();
    });

    await test.step("sign out clears the session and header links", async () => {
      await page.locator(".header-actions").getByRole("link", { name: "Asha" }).click();
      await expect(
        page.getByRole("heading", { name: "Account overview" }),
      ).toBeVisible();
      await logoutThroughUi(page);
      await expectSignedOutNav(page);

      await page.reload({ waitUntil: "domcontentloaded" });
      await expectSignedOutNav(page);
    });

    await test.step("protected order history redirects to sign-in with a next target", async () => {
      await goTo(page, "/orders");
      await expect(page).toHaveURL(/#\/login\?next=%2Forders/);
      await expect(
        page.getByRole("heading", { name: "Good to have you back." }),
      ).toBeVisible();

      await submitLogin(page, { email, password: CUSTOMER_PASSWORD });
      await expect(page).toHaveURL(/#\/orders$/);
      await expect(
        page.getByRole("heading", { name: "Order history" }),
      ).toBeVisible();
      await expectSignedInNav(page, "Asha");
    });

    await test.step("a signed-in customer is refused the admin workspace", async () => {
      await goTo(page, "/admin");
      await expect(
        page.getByRole("heading", { name: "Admin workspace" }),
      ).toBeVisible();
      await expect(
        page.getByText("does not have administrator permissions"),
      ).toBeVisible();

      const response = await page.request.get(apiUrl("/admin/users"));
      expect(response.status()).toBe(403);
    });
  });
});
