import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { loadServerEnv } from "../scripts/testDatabase.mjs";
import { apiUrl } from "./support/ui.mjs";

const webhookSecret = () => {
  const env = loadServerEnv();
  return String(env.RAZORPAY_WEBHOOK_SECRET || "").trim();
};

const sign = (secret, body) =>
  createHmac("sha256", secret).update(body, "utf8").digest("hex");

const fixture = () =>
  JSON.stringify({
    entity: "event",
    account_id: "acc_e2e_local",
    event: "payment.captured",
    contains: ["payment"],
    payload: {
      payment: {
        entity: {
          id: "pay_E2EUnknownFixture01",
          entity: "payment",
          amount: 1000,
          currency: "INR",
          status: "captured",
          captured: true,
          order_id: "order_E2EUnknownFixture01",
          method: "card",
          error_description: null,
        },
      },
    },
    created_at: 1_700_000_000,
  });

const postWebhook = (page, body, { signature, eventId }) =>
  page.request.post(apiUrl("/payments/razorpay/webhook"), {
    data: body,
    headers: {
      "content-type": "application/json",
      ...(signature ? { "x-razorpay-signature": signature } : {}),
      ...(eventId ? { "x-razorpay-event-id": eventId } : {}),
    },
  });

test.describe("Razorpay webhook signature and idempotency", () => {
  test.beforeEach(() => {
    test.skip(
      !webhookSecret(),
      "RAZORPAY_WEBHOOK_SECRET is not configured, so signed webhook fixtures cannot be produced.",
    );
  });

  test("accepts a signed unknown payment once, deduplicates it, and rejects a bad signature", async ({
    page,
  }) => {
    test.info().annotations.push({
      type: "webhook",
      description:
        "Uses locally signed fixtures against the test API. Deliveries triggered from the real Razorpay dashboard are not tested locally.",
    });

    const secret = webhookSecret();
    const body = fixture();
    const signature = sign(secret, body);
    const eventId = `evt_e2e_${Date.now()}`;

    await test.step("a signed event for an unknown payment is accepted and ignored", async () => {
      const response = await postWebhook(page, body, { signature, eventId });
      expect(response.status()).toBe(200);

      const result = await response.json();
      expect(result).toEqual({
        received: true,
        duplicate: false,
        status: "ignored",
      });
    });

    await test.step("the same event id is reported as a duplicate", async () => {
      const response = await postWebhook(page, body, { signature, eventId });
      expect(response.status()).toBe(200);

      const result = await response.json();
      expect(result).toEqual({
        received: true,
        duplicate: true,
        status: "ignored",
      });
    });

    await test.step("an invalid signature is rejected with 400 and is not stored", async () => {
      const invalidEventId = `${eventId}_bad`;
      const tamperedSignature =
        (signature[0] === "a" ? "b" : "a") + signature.slice(1);

      const rejected = await postWebhook(page, body, {
        signature: tamperedSignature,
        eventId: invalidEventId,
      });
      expect(rejected.status()).toBe(400);
      const rejectedBody = await rejected.json();
      expect(rejectedBody?.message).toBe("Invalid webhook signature.");

      // The rejected request must not have reserved the event id: the same id
      // with a valid signature is treated as a fresh event, not a duplicate.
      const fresh = await postWebhook(page, body, {
        signature,
        eventId: invalidEventId,
      });
      expect(fresh.status()).toBe(200);
      const freshBody = await fresh.json();
      expect(freshBody.duplicate).toBe(false);
    });

    await test.step("a missing signature is rejected", async () => {
      const rejected = await postWebhook(page, body, {
        eventId: `${eventId}_missing`,
      });
      expect(rejected.status()).toBe(400);
      const rejectedBody = await rejected.json();
      expect(rejectedBody?.message).toBe("Invalid webhook signature.");
    });
  });
});
