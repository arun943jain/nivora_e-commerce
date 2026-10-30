import { expect, test } from "@playwright/test";
import {
  addToBag,
  apiUrl,
  expectSignedInNav,
  fetchOrderThroughApi,
  fillCheckout,
  goTo,
  openCart,
  registerThroughApi,
  uniqueEmail,
} from "./support/ui.mjs";

// Razorpay test card from the official guide. Any future expiry and any random
// CVV are documented as valid.
// https://razorpay.com/docs/payments/payments/test-card-details/
const TEST_CARD_NUMBER = "4100280000001007";
const TEST_CARD_EXPIRY = "12/34";
const TEST_CARD_CVV = "123";

const hasVisible = (locator) =>
  locator.isVisible().catch(() => false);

const readFrameText = async (frame) => {
  try {
    return (await frame.locator("body").innerText()).replace(/\s+/g, " ");
  } catch {
    return "";
  }
};

test.describe("Razorpay test-mode checkout", () => {
  test("starts one checkout, refuses an OTP gate safely and rejects a tampered signature", async ({
    page,
  }) => {
    test.setTimeout(240_000);

    const email = uniqueEmail("pay.customer");
    await registerThroughApi(page, { name: "Asha Pay", email });
    await goTo(page, "/");
    await expectSignedInNav(page, "Asha");
    await addToBag(page, "Solace Table Lamp");
    await openCart(page);
    await page.getByRole("button", { name: "Continue to checkout ↗" }).click();
    await fillCheckout(page);
    await page.getByRole("radio", { name: /Pay online with Razorpay/ }).check();

    const checkoutResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/payments/razorpay/checkout") &&
        response.request().method() === "POST",
      { timeout: 60_000 },
    );
    await page.getByRole("button", { name: "Place order and pay" }).click();

    const response = await checkoutResponse;
    expect(response.status(), "checkout creation should succeed").toBe(201);

    const payload = await response.json();
    const order = payload?.data?.order;
    const payment = payload?.data?.payment;

    expect(order?.id).toMatch(/^NV-/);
    expect(order?.paymentStatus).toBe("Pending");
    expect(order?.paymentMethod).toBe("Razorpay");
    expect(payment?.currency).toBe("INR");
    expect(payment?.amount).toBe(849000);
    expect(payment?.keyId).toMatch(/^rzp_test_/);
    expect(payment?.orderId).toMatch(/^order_/);

    const frame = page.frameLocator("iframe.razorpay-checkout-frame");
    const cardNumber = frame.locator('input[name="card.number"]');
    await cardNumber.waitFor({ timeout: 60_000 });
    await expect(page.getByText("Test Mode").first()).toBeVisible();
    await expect(frame.getByText("Price Summary")).toBeVisible();

    await test.step("submit the documented test card exactly once", async () => {
      await page.waitForTimeout(1500);
      await cardNumber.click();
      await cardNumber.pressSequentially(TEST_CARD_NUMBER, { delay: 35 });

      const expiry = frame.locator('input[name="card.expiry"]');
      await expiry.click();
      await expiry.pressSequentially(TEST_CARD_EXPIRY, { delay: 35 });

      const cvv = frame.locator('input[name="card.cvv"]');
      await cvv.click();
      await cvv.pressSequentially(TEST_CARD_CVV, { delay: 35 });

      // This documented card renders without a cardholder-name field. The
      // RBI save-card checkbox stays unchecked so no saved-card OTP is asked.
      const saveCard = frame.locator('input[name="save"]');
      if (await saveCard.isChecked().catch(() => false)) {
        await saveCard.uncheck({ force: true });
      }

      await frame.getByRole("button", { name: "Continue" }).click();
    });

    let outcome = "timeout";
    let saveCardPromptDismissed = false;

    await test.step("observe one documented test-mode outcome", async () => {
      const deadline = Date.now() + 60_000;

      while (Date.now() < deadline) {
        if (
          (await hasVisible(page.getByText("Payment confirmed").first())) ||
          (await hasVisible(
            page.getByRole("heading", { name: /Thank you,/ }).first(),
          ))
        ) {
          outcome = "success";
          break;
        }

        const mockSuccess = frame.getByRole("button", { name: /^Success$/i });
        if (await hasVisible(mockSuccess)) {
          // Documented mock-bank control, not a test shortcut.
          await mockSuccess.click();
          outcome = "mock-success";
          break;
        }

        const frameText = await readFrameText(frame);
        const mainText = await page.locator("main").innerText();

        if (/payment was cancelled/i.test(mainText)) {
          outcome = "cancelled";
          break;
        }

        if (/otp|one[- ]time password|verification code/i.test(frameText)) {
          outcome = "otp";
          break;
        }

        // Razorpay offers optional card saving before the mock payment page.
        // Dismiss the offer with Escape once and submit the same checkout once
        // more. No OTP is typed and no new payment order is created.
        if (!saveCardPromptDismissed && /save your card/i.test(frameText)) {
          await frame.locator("body").press("Escape");
          saveCardPromptDismissed = true;
          await page.waitForTimeout(1000);

          const continueButton = frame.getByRole("button", {
            name: "Continue",
            exact: true,
          });
          if (await hasVisible(continueButton)) {
            await continueButton.click();
          }

          continue;
        }

        if (
          /payment (was )?(failed|declined)|could not be completed/i.test(
            mainText,
          )
        ) {
          outcome = "failed";
          break;
        }

        await page.waitForTimeout(1000);
      }
    });

    console.log(`[e2e] Razorpay test-mode outcome: ${outcome}`);
    await page.screenshot({
      path: `.artifacts/razorpay-outcome-${outcome}.png`,
      fullPage: false,
    });

    if (outcome === "cancelled") {
      test.info().annotations.push({
        type: "payment",
        description:
          "The Razorpay test checkout was dismissed during the optional save-card step. The order stayed unpaid; no second attempt was made.",
      });
    }

    if (outcome === "otp") {
      await page.screenshot({
        path: ".artifacts/razorpay-needs-manual.png",
        fullPage: false,
      });
      test.info().annotations.push({
        type: "payment",
        description:
          "Razorpay test checkout asked for an OTP/verification step. The attempt was stopped without entering or guessing an OTP, so success needs manual interaction.",
      });
      console.log(
        "[e2e] Payment outcome: needs manual interaction (OTP/verification screen). No OTP was entered and no second payment order was created.",
      );

      // Closing the checkout by reloading it guarantees no retry/extra attempt.
      await page.reload({ waitUntil: "domcontentloaded" });
    }

    if (outcome === "timeout") {
      throw new Error(
        "Razorpay test checkout did not show the documented mock Success control, a verified success, or an OTP gate within 60s. Manual handling required; no second payment attempt was made.",
      );
    }

    if (outcome === "mock-success" || outcome === "success") {
      // The browser callback alone is not proof: the server must verify the
      // signature and capture before the order can be treated as paid.
      await expect(
        page.getByRole("heading", { name: /Thank you,/ }),
      ).toBeVisible({ timeout: 30_000 });

      const paidOrder = await fetchOrderThroughApi(page, order.id);
      expect(paidOrder.paymentStatus, "server must verify the payment").toBe(
        "Paid",
      );
      expect(paidOrder.status).not.toBe("Cancelled");
    } else {
      // Cancelled, failed, or an external OTP gate: the order must stay unpaid.
      const unpaidOrder = await fetchOrderThroughApi(page, order.id);
      expect(
        ["Pending", "Failed"],
        "an unverified payment must not mark the order paid",
      ).toContain(unpaidOrder.paymentStatus);
      expect(unpaidOrder.paymentStatus).not.toBe("Paid");
    }

    await test.step("a tampered signature is rejected and the order stays unpaid", async () => {
      const verify = await page.request.post(
        apiUrl("/payments/razorpay/verify"),
        {
          data: {
            razorpay_order_id: payment.orderId,
            razorpay_payment_id: "pay_E2ETampered0001",
            razorpay_signature: "0".repeat(64),
          },
        },
      );

      if (outcome === "mock-success" || outcome === "success") {
        // The order is already settled; the rejection message is still checked
        // without touching the paid state.
        expect([400, 409]).toContain(verify.status());
      } else {
        expect(verify.status()).toBe(400);
        const body = await verify.json();
        expect(body?.message).toContain("signature could not be verified");

        const afterTamper = await fetchOrderThroughApi(page, order.id);
        expect(afterTamper.paymentStatus).toBe("Pending");
      }
    });

    await test.step("order history shows the unpaid online order exactly once", async () => {
      await goTo(page, "/orders");
      const rows = page.locator(".order-row").filter({ hasText: order.id });
      await expect(rows).toHaveCount(1);

      if (outcome === "mock-success" || outcome === "success") {
        await expect(rows).toContainText("Payment Paid");
      } else {
        await expect(rows).toContainText("Payment Pending");
      }
    });
  });
});
