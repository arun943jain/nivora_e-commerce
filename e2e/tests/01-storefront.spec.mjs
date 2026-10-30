import { expect, test } from "@playwright/test";
import {
  expectSignedOutNav,
  goTo,
  mainNav,
  quickAdd,
} from "./support/ui.mjs";

test.describe.configure({ mode: "serial" });

test.describe("storefront browsing and navigation", () => {
  test.beforeEach(async ({ page }) => {
    await goTo(page, "/");
    await expect(
      page.getByRole("heading", { level: 1, name: /Make room for/ }),
    ).toBeVisible();
  });

  test("homepage, primary navigation and guest header", async ({ page }) => {
    await expect(page.locator(".announcement")).toContainText(
      "Complimentary shipping",
    );
    await expect(page.locator(".product-card")).toHaveCount(8);
    await expectSignedOutNav(page);

    await mainNav(page).getByRole("link", { name: "Dining" }).click();
    await expect(page).toHaveURL(/#\/products\?category=Dining/);

    const items = page.locator("article.product-card");
    await expect(page.locator(".results-count")).toHaveText("4 pieces");
    await expect(items).toHaveCount(4);
    await expect(items).toContainText([
      "Riverstone Serving Bowl",
      "Sora Stoneware Set",
      "Kiyo Cotton Napkins",
      "Silt Table Runner",
    ]);
  });

  test("product list, search, category and price filters, sorting", async ({
    page,
  }) => {
    await mainNav(page).getByRole("link", { name: "Shop all" }).click();
    await expect(page.locator(".results-count")).toHaveText("20 pieces");

    const items = page.locator("article.product-card");
    const firstName = () => items.first().locator(".product-name");

    await page.locator(".sort-select select").selectOption("price-low");
    await expect(firstName()).toHaveText("Kiyo Cotton Napkins");

    await page.locator(".sort-select select").selectOption("price-high");
    await expect(firstName()).toHaveText("Dune Floor Lamp");

    await page.locator("#product-filters select").selectOption("Lighting");
    await expect(page.locator(".results-count")).toHaveText("4 pieces");

    await page.locator('input[placeholder="Find a piece"]').fill("lamp");
    await expect(page.locator(".results-count")).toHaveText("2 pieces");
    await expect(
      items.filter({ hasText: "Solace Table Lamp" }),
    ).toHaveCount(1);
    await expect(items.filter({ hasText: "Dune Floor Lamp" })).toHaveCount(1);

    await page.locator('input[placeholder="Find a piece"]').fill("");
    await page.locator('input[type="range"]').fill("10000");
    await expect(page.locator(".results-count")).toHaveText("2 pieces");
    await expect(
      items.filter({ hasText: "Kora Pendant Light" }),
    ).toHaveCount(1);
    await expect(items.filter({ hasText: "Dune Floor Lamp" })).toHaveCount(1);

    await page.locator("#product-filters select").selectOption("All");
    await page.locator('input[type="range"]').fill("0");
    await page.locator(".sort-select select").selectOption("featured");
    await expect(page.locator(".results-count")).toHaveText("20 pieces");
  });

  test("product detail and image gallery", async ({ page }) => {
    await goTo(page, "/products");
    await page
      .locator('a.product-name[href="#/product/solace-table-lamp"]')
      .click();

    await expect(
      page.getByRole("heading", { level: 1, name: "Solace Table Lamp" }),
    ).toBeVisible();
    await expect(page.locator(".detail-price")).toContainText("₹8,490");
    await expect(page.locator(".stock-note")).toContainText("14 in stock");

    const thumbs = page.locator(
      'button[aria-label^="Show Solace Table Lamp image"]',
    );
    await expect(thumbs).toHaveCount(2);
    await expect(thumbs.first()).toHaveAttribute("aria-pressed", "true");

    const mainImage = page.locator("img.main-product-image");
    const firstSrc = await mainImage.getAttribute("src");
    await thumbs.nth(1).click();
    await expect(thumbs.nth(1)).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(async () => mainImage.getAttribute("src"))
      .not.toBe(firstSrc);

    await page.getByRole("button", { name: "Add to bag — ₹8,490" }).click();
    await expect(page.locator(".toast")).toContainText("added to your bag");
  });

  test("wishlist add and remove", async ({ page }) => {
    await goTo(page, "/products");
    await page
      .getByRole("button", { name: "Add Solace Table Lamp to wishlist" })
      .click();
    await expect(
      page.getByRole("button", { name: "Remove Solace Table Lamp from wishlist" }),
    ).toBeVisible();

    await goTo(page, "/wishlist");
    await expect(
      page.getByRole("heading", { name: "Saved pieces." }),
    ).toBeVisible();
    await expect(page.locator("article.product-card")).toHaveCount(1);
    await expect(page.locator("article.product-card")).toContainText(
      "Solace Table Lamp",
    );

    await page
      .getByRole("button", { name: "Remove Solace Table Lamp from wishlist" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Nothing saved just yet." }),
    ).toBeVisible();
  });

  test("guest navigation works at a narrow viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await goTo(page, "/");

    const navigation = mainNav(page);
    await expect(navigation).toBeHidden();

    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(navigation).toBeVisible();
    await expect(navigation.getByRole("link", { name: "Shop all" })).toBeVisible();
    await expect(
      navigation.getByRole("link", { name: "My Orders" }),
    ).toHaveCount(0);

    await navigation.getByRole("link", { name: "Shop all" }).click();
    await expect(page).toHaveURL(/#\/products/);
    await expect(navigation).toBeHidden();
  });

  test("cart quick-add works for a guest", async ({ page }) => {
    await goTo(page, "/products");
    await quickAdd(page, "Pollen Candle Holder");
    await expect(page.getByRole("link", { name: /^Bag/ })).toContainText("1");
  });
});
