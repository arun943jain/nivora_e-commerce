import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { serverDir, getTestMongoUri } from "../scripts/testDatabase.mjs";
import {
  CUSTOMER_PASSWORD,
  addToBag,
  fillCheckout,
  goTo,
  loginThroughUi,
  logoutThroughUi,
  openCart,
  readConfirmedOrderId,
  registerThroughApi,
  uniqueEmail,
  uniqueSuffix,
} from "./support/ui.mjs";

const PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1568616461622-18ac2a7390e0?auto=format&fit=crop&w=720&q=82";

const promoteAdmin = (email) => {
  const output = execFileSync(
    process.execPath,
    ["src/scripts/promoteAdmin.js", email],
    {
      cwd: serverDir,
      env: {
        ...process.env,
        MONGODB_URI: getTestMongoUri(),
        NODE_ENV: "test",
      },
      encoding: "utf8",
    },
  );

  expect(output).toContain("Promoted");
  return output;
};

test.describe("admin workspace", () => {
  test("admin access, product and coupon management, order status and customer controls", async ({
    page,
  }) => {
    const email = uniqueEmail("admin.owner");
    const suffix = uniqueSuffix();
    const productName = `E2E Studio Tray ${suffix}`;
    const sku = `E2E-${suffix}`.toUpperCase();
    const couponCode = `E2E${suffix}`.toUpperCase();
    let orderId = "";

    await test.step("create a real cash-on-delivery order as a customer", async () => {
      await registerThroughApi(page, { name: "Asha Admin", email });
      await addToBag(page, "Kiyo Cotton Napkins");
      await openCart(page);
      await page.getByRole("button", { name: "Continue to checkout ↗" }).click();
      await fillCheckout(page);
      await page.getByRole("button", { name: "Place order", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Thank you, Asha." }),
      ).toBeVisible();
      orderId = await readConfirmedOrderId(page);

      await page.locator(".header-actions").getByRole("link", { name: "Asha" }).click();
      await logoutThroughUi(page);
    });

    await test.step("promote the disposable account with the documented server script", async () => {
      promoteAdmin(email);
      await loginThroughUi(page, { email, password: CUSTOMER_PASSWORD });
      await expect(
        page.getByText("Administrator", { exact: true }),
      ).toBeVisible();
    });

    await test.step("admin dashboard loads live server data", async () => {
      await goTo(page, "/admin");
      await expect(
        page.getByRole("heading", { level: 1, name: "Overview" }),
      ).toBeVisible();
      await expect(page.locator(".admin-shell")).toBeVisible();
      await expect(page.locator(".kpi-card")).toHaveCount(4);
      await expect(
        page.locator(".kpi-card span").filter({ hasText: /^Orders$/ }),
      ).toBeVisible();
      await expect(
        page.locator(".kpi-card span").filter({ hasText: /^Gross sales$/ }),
      ).toBeVisible();
    });

    await test.step("create, edit and archive a product from the admin workspace", async () => {
      const sidebar = page.locator(".admin-sidebar");
      await sidebar.getByRole("link", { name: /Products/ }).click();
      await expect(
        page.getByRole("heading", { level: 1, name: "Products" }),
      ).toBeVisible();

      await page.getByRole("button", { name: /Add product/ }).click();
      const dialog = page.getByRole("dialog");
      await expect(
        dialog.getByRole("heading", { name: "Add a product" }),
      ).toBeVisible();
      await dialog.locator('[name="name"]').fill(productName);
      await dialog
        .locator('[name="description"]')
        .fill("A synthetic product created by the automated admin workspace check.");
      await dialog.locator('[name="price"]').fill("3200");
      await dialog.locator('[name="category"]').selectOption("Decor");
      await dialog.locator('[name="sku"]').fill(sku);
      await dialog.locator('[name="stock"]').fill("5");
      await dialog.locator('[name="material"]').fill("Test oak");
      await dialog.locator('[name="image"]').fill(PRODUCT_IMAGE);
      await dialog.getByRole("button", { name: "Save product" }).click();

      await expect(dialog).toBeHidden();
      await expect(page.locator(".toast")).toContainText("created");

      let row = page.locator("tbody tr").filter({ hasText: productName });
      await expect(row).toHaveCount(1);
      await expect(row).toContainText("₹3,200");

      await goTo(page, "/products");
      const card = page
        .locator("article.product-card")
        .filter({ hasText: productName });
      await expect(card).toHaveCount(1);
      await expect(card).toContainText("₹3,200");

      await goTo(page, "/admin/products");
      row = page.locator("tbody tr").filter({ hasText: productName });
      await row.getByRole("button", { name: "Edit" }).click();
      const editDialog = page.getByRole("dialog");
      await expect(
        editDialog.getByRole("heading", { name: "Edit product" }),
      ).toBeVisible();
      await editDialog.locator('[name="price"]').fill("3400");
      await editDialog.locator('[name="stock"]').fill("6");
      await editDialog.getByRole("button", { name: "Save product" }).click();

      await expect(editDialog).toBeHidden();
      await expect(page.locator(".toast")).toContainText("updated");
      row = page.locator("tbody tr").filter({ hasText: productName });
      await expect(row).toContainText("₹3,400");
      await expect(row.getByRole("cell").nth(3)).toHaveText("6");

      await goTo(page, "/products");
      await expect(
        page.locator("article.product-card").filter({ hasText: productName }),
      ).toContainText("₹3,400");

      await goTo(page, "/admin/products");
      row = page.locator("tbody tr").filter({ hasText: productName });
      page.once("dialog", (dialog) => dialog.accept());
      await row.getByRole("button", { name: "Archive" }).click();
      await expect(page.locator(".toast")).toContainText("archived");
      await expect(row.locator(".status-pill")).toHaveText("Archived");

      await goTo(page, "/products");
      await expect(
        page.locator("article.product-card").filter({ hasText: productName }),
      ).toHaveCount(0);
    });

    await test.step("create and deactivate a coupon", async () => {
      await goTo(page, "/admin/coupons");
      await expect(
        page.getByRole("heading", { level: 1, name: "Coupons" }),
      ).toBeVisible();

      await page.getByRole("button", { name: /Create coupon/ }).click();
      const dialog = page.getByRole("dialog");
      await expect(
        dialog.getByRole("heading", { name: "Create coupon" }),
      ).toBeVisible();
      await dialog.locator('[name="code"]').fill(couponCode);
      await dialog.locator('[name="description"]').fill("Automated e2e coupon");
      await dialog.locator('[name="amount"]').fill("15");
      await dialog.locator('[name="minimumOrder"]').fill("1000");
      await dialog.locator('[name="expiresAt"]').fill("2027-12-31");
      await dialog.locator('[name="usageLimit"]').fill("5");
      await dialog.getByRole("button", { name: "Save coupon" }).click();

      await expect(dialog).toBeHidden();
      await expect(page.locator(".toast")).toContainText(
        `Coupon ${couponCode} created.`,
      );

      const row = page.locator("tbody tr").filter({ hasText: couponCode });
      await expect(row).toHaveCount(1);
      await expect(row).toContainText("15%");
      await expect(row.locator(".status-pill")).toHaveText("Active");

      page.once("dialog", (dialog) => dialog.accept());
      await row.getByRole("button", { name: "Deactivate" }).click();
      await expect(page.locator(".toast")).toContainText(
        `Coupon ${couponCode} deactivated`,
      );
      await expect(row.locator(".status-pill")).toHaveText("Inactive");
      await expect(
        row.getByRole("button", { name: "Deactivate" }),
      ).toHaveCount(0);
    });

    await test.step("move the customer order from Pending to Preparing", async () => {
      await goTo(page, "/admin/orders");
      await expect(
        page.getByRole("heading", { level: 1, name: "Orders" }),
      ).toBeVisible();

      await page.getByRole("textbox", { name: "Search orders" }).fill(orderId);
      const row = page.locator("tbody tr").filter({ hasText: orderId });
      await expect(row).toHaveCount(1);
      await expect(row.locator(".status-pill")).toHaveText("Pending");

      await row.getByRole("button", { name: "Inspect" }).click();
      const dialog = page.getByRole("dialog");
      await expect(
        dialog.getByRole("heading", { name: "Order details and status" }),
      ).toBeVisible();
      await dialog.locator('select[name="status"]').selectOption("Preparing");
      await dialog.getByRole("button", { name: "Save order status" }).click();

      await expect(dialog).toBeHidden();
      await expect(page.locator(".toast")).toContainText(
        `Order ${orderId} moved to Preparing.`,
      );
      await expect(row.locator(".status-pill")).toHaveText("Preparing");
    });

    await test.step("list customers and suspend then restore a seeded customer", async () => {
      await goTo(page, "/admin/users");
      await expect(
        page.getByRole("heading", { level: 1, name: "Customers" }),
      ).toBeVisible();

      await page
        .getByRole("textbox", { name: "Search customers" })
        .fill("Meera Sharma");
      const row = page.locator("tbody tr").filter({ hasText: "Meera Sharma" });
      await expect(row).toHaveCount(1);
      await expect(row).toContainText("meera@example.com");
      await expect(row).toContainText("Customer");
      await expect(row.locator(".status-pill")).toHaveText("Active");

      await row.getByRole("button", { name: "Manage" }).click();
      let dialog = page.getByRole("dialog");
      await expect(
        dialog.getByRole("heading", { name: "Manage customer" }),
      ).toBeVisible();
      await dialog.locator('select[name="status"]').selectOption("suspended");
      await dialog.getByRole("button", { name: "Save customer" }).click();
      await expect(dialog).toBeHidden();
      await expect(page.locator(".toast")).toContainText(
        "Meera Sharma updated.",
      );
      await expect(row.locator(".status-pill")).toHaveText("Suspended");

      await row.getByRole("button", { name: "Manage" }).click();
      dialog = page.getByRole("dialog");
      await dialog.locator('select[name="status"]').selectOption("active");
      await dialog.getByRole("button", { name: "Save customer" }).click();
      await expect(dialog).toBeHidden();
      await expect(row.locator(".status-pill")).toHaveText("Active");
    });
  });
});
