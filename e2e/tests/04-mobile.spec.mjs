import { expect, test } from "@playwright/test";
import {
  expectSignedInNav,
  goTo,
  mainNav,
  registerThroughApi,
  uniqueEmail,
} from "./support/ui.mjs";

test.describe("mobile navigation", () => {
  test("signed-in My Orders is reachable from the narrow-viewport menu", async ({
    page,
  }) => {
    const email = uniqueEmail("mobile.customer");
    await registerThroughApi(page, { name: "Asha Mobile", email });

    await page.setViewportSize({ width: 390, height: 844 });
    await goTo(page, "/");
    await expect(
      page.getByRole("heading", { level: 1, name: /Make room for/ }),
    ).toBeVisible();

    const navigation = mainNav(page);
    await expect(navigation).toBeHidden();
    await expect(page.locator(".header-text")).toBeHidden();

    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(navigation).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Close navigation" }),
    ).toHaveAttribute("aria-expanded", "true");
    await expect(
      navigation.getByRole("link", { name: "My Orders" }),
    ).toBeVisible();

    await navigation.getByRole("link", { name: "My Orders" }).click();
    await expect(page).toHaveURL(/#\/orders$/);
    await expect(
      page.getByRole("heading", { name: "Order history" }),
    ).toBeVisible();
    await expect(navigation).toBeHidden();

    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(navigation).toBeVisible();
    await page.getByRole("button", { name: "Close navigation" }).click();
    await expect(navigation).toBeHidden();

    // The desktop layout still exposes the same signed-in links.
    await page.setViewportSize({ width: 1440, height: 900 });
    await expectSignedInNav(page, "Asha");
  });
});
