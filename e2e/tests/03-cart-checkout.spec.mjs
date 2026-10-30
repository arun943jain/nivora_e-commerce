import { expect, test } from "@playwright/test";
import {
  addToBag,
  expectSignedInNav,
  fillCheckout,
  goTo,
  openCart,
  openMyOrders,
  quickAdd,
  readConfirmedOrderId,
  registerThroughApi,
  uniqueEmail,
} from "./support/ui.mjs";

test.describe("bag, coupons and cash-on-delivery checkout", () => {
  test("cart totals, coupon rules, order creation, confirmation and history", async ({
    page,
  }) => {
    const email = uniqueEmail("cart.customer");
    await registerThroughApi(page, { name: "Asha Cart", email });

    await test.step("cart add, quantity change, shipping threshold and removal", async () => {
      await goTo(page, "/products");
      await expectSignedInNav(page, "Asha");

      await quickAdd(page, "Pollen Candle Holder");
      await openCart(page);
      await expect(
        page.getByRole("heading", { name: /Your bag \(1\)/ }),
      ).toBeVisible();

      const summary = page.locator(".summary-box");
      const summaryRow = (label) =>
        summary.locator("p").filter({ hasText: new RegExp(`^${label}`) });

      await expect(summaryRow("Subtotal").locator("b")).toHaveText("₹1,450");
      await expect(summaryRow("Shipping").locator("b")).toHaveText("₹150");
      await expect(summary.locator(".summary-total")).toContainText("₹1,600");

      await page
        .getByRole("button", { name: "Increase Pollen Candle Holder quantity" })
        .click();
      await expect(
        page.getByRole("heading", { name: /Your bag \(2\)/ }),
      ).toBeVisible();
      await expect(summaryRow("Subtotal").locator("b")).toHaveText("₹2,900");
      await expect(summaryRow("Shipping").locator("b")).toHaveText(
        "Complimentary",
      );
      await expect(summary.locator(".summary-total")).toContainText("₹2,900");

      await page
        .getByRole("button", { name: "Remove Pollen Candle Holder from bag" })
        .click();
      await expect(
        page.getByRole("heading", { name: "Your bag is taking a breather." }),
      ).toBeVisible();
    });

    await test.step("checkout validation blocks an incomplete delivery address", async () => {
      await addToBag(page, "Solace Table Lamp");
      await openCart(page);
      await page.getByRole("button", { name: "Continue to checkout ↗" }).click();

      await expect(
        page.getByRole("heading", { name: "Checkout" }),
      ).toBeVisible();
      await expect(page.locator("#checkout-email")).toHaveValue(email);

      await page.getByRole("button", { name: "Place order", exact: true }).click();
      await expect(
        page.getByText("Check the highlighted details before placing the order."),
      ).toBeVisible();
      await expect(
        page.getByText("Enter a phone number with 10–15 digits."),
      ).toBeVisible();
      await expect(
        page.getByText("Enter a delivery address.", { exact: true }),
      ).toBeVisible();
    });

    await test.step("invalid coupon is rejected without changing the total", async () => {
      const summary = page.locator(".summary-box");

      await page.getByLabel("Coupon code").fill("NOPE123");
      await page
        .locator(".coupon-form")
        .getByRole("button", { name: "Apply" })
        .click();
      await expect(
        page.getByText("That coupon code is not valid."),
      ).toBeVisible();
      await expect(summary.locator(".summary-total")).toContainText("₹8,490");
    });

    await test.step("NIVORA10 applies a verified 10% discount", async () => {
      const summary = page.locator(".summary-box");

      await page.getByLabel("Coupon code").fill("NIVORA10");
      await page
        .locator(".coupon-form")
        .getByRole("button", { name: "Apply" })
        .click();
      await expect(
        page.getByText("NIVORA10 applied: ₹849 off."),
      ).toBeVisible();
      await expect(
        summary.locator("p").filter({ hasText: /^Discount/ }).locator("b"),
      ).toHaveText("−₹849");
      await expect(summary.locator(".summary-total")).toContainText("₹7,641");
    });

    let orderId = "";

    await test.step("cash-on-delivery order is created and confirmed", async () => {
      await fillCheckout(page);
      await page.getByRole("button", { name: "Place order", exact: true }).click();

      await expect(
        page.getByRole("heading", { name: "Thank you, Asha." }),
      ).toBeVisible();
      orderId = await readConfirmedOrderId(page);

      await expect(
        page.locator("main p").filter({ hasText: "Status: Pending" }).last(),
      ).toContainText("Cash on delivery");
      await expect(page.getByText("Status: Pending")).toBeVisible();
      await expect(page.getByText("₹7,641", { exact: true })).toBeVisible();
      await expect(page.getByText("Complimentary", { exact: true })).toBeVisible();
    });

    await test.step("order detail shows the server-returned order", async () => {
      await page.getByRole("link", { name: "View order details" }).click();
      await expect(page).toHaveURL(new RegExp(`#/orders/${orderId}$`));
      await expect(
        page.getByRole("heading", { name: `Order ${orderId}` }),
      ).toBeVisible();
      await expect(page.getByText("Order status: Pending")).toBeVisible();
      await expect(page.getByText("Cash on delivery · Pending")).toBeVisible();
      await expect(page.getByText("Solace Table Lamp × 1")).toBeVisible();
      await expect(page.getByText("NIVORA10", { exact: true })).toBeVisible();
    });

    await test.step("order history lists the new order and the bag is empty", async () => {
      await openMyOrders(page);
      const row = page.locator(".order-row").filter({ hasText: orderId });
      await expect(row).toHaveCount(1);
      await expect(row).toContainText("Payment Pending");
      await expect(row).toContainText("₹7,641");
      await expect(row.locator(".status-pill")).toHaveText("Pending");

      await goTo(page, "/cart");
      await expect(
        page.getByRole("heading", { name: "Your bag is taking a breather." }),
      ).toBeVisible();
    });
  });
});
