import { useCallback, useRef, useState } from "react";

const SCRIPT_ID = "razorpay-checkout-sdk";
const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

const loadScript = () =>
  new Promise((resolve, reject) => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      reject(new Error("Razorpay checkout is only available in a browser."));
      return;
    }

    if (window.Razorpay) {
      resolve(window.Razorpay);
      return;
    }

    const existing = document.getElementById(SCRIPT_ID);

    if (existing) {
      existing.addEventListener(
        "load",
        () =>
          window.Razorpay
            ? resolve(window.Razorpay)
            : reject(
                new Error(
                  "Razorpay checkout loaded but is unavailable. Refresh and try again.",
                ),
              ),
        { once: true },
      );
      existing.addEventListener(
        "error",
        () => {
          existing.remove();
          reject(
            new Error(
              "Razorpay checkout could not be loaded. Check your connection and try again.",
            ),
          );
        },
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      if (window.Razorpay) {
        resolve(window.Razorpay);
      } else {
        script.remove();
        reject(
          new Error(
            "Razorpay checkout loaded but is unavailable. Refresh and try again.",
          ),
        );
      }
    };
    script.onerror = () => {
      script.remove();
      reject(
        new Error(
          "Razorpay checkout could not be loaded. Check your connection and try again.",
        ),
      );
    };
    document.body.appendChild(script);
  });

// Opens Razorpay Standard Checkout and reports how the window closed. A
// success result is only a browser callback; the caller must still verify it
// with the server before treating the order as paid.
export default function useRazorpayCheckout() {
  const [scriptStatus, setScriptStatus] = useState("idle");
  const scriptPromise = useRef(null);

  const ensureScript = useCallback(() => {
    if (typeof window !== "undefined" && window.Razorpay) {
      return Promise.resolve(window.Razorpay);
    }

    if (!scriptPromise.current) {
      setScriptStatus("loading");
      scriptPromise.current = loadScript()
        .then((Razorpay) => {
          setScriptStatus("ready");
          return Razorpay;
        })
        .catch((error) => {
          scriptPromise.current = null;
          setScriptStatus("error");
          throw error;
        });
    }

    return scriptPromise.current;
  }, []);

  const openCheckout = useCallback(
    async (session) => {
      const Razorpay = await ensureScript();

      return new Promise((resolve) => {
        let settled = false;
        let lastFailure = "";

        const finish = (result) => {
          if (settled) return;
          settled = true;
          resolve(result);
        };

        try {
          const checkout = new Razorpay({
            key: session.keyId,
            order_id: session.orderId,
            amount: session.amount,
            currency: session.currency,
            name: session.name,
            description: session.description,
            prefill: session.prefill,
            notes: { orderNumber: session.internalOrderId },
            handler: (response) => finish({ status: "success", response }),
            modal: {
              ondismiss: () =>
                finish(
                  lastFailure
                    ? { status: "failed", error: lastFailure }
                    : { status: "cancelled" },
                ),
            },
          });

          // The window stays open after a declined payment so the customer can
          // retry. Only remember the reason; the modal close decides the
          // outcome, and a later success callback still wins.
          checkout.on("payment.failed", (response) => {
            lastFailure =
              response?.error?.description ||
              "The payment was declined. You can try again.";
          });

          checkout.open();
        } catch (error) {
          finish({
            status: "failed",
            error:
              error?.message ||
              "Razorpay checkout could not be opened. Please try again.",
          });
        }
      });
    },
    [ensureScript],
  );

  return { openCheckout, scriptStatus, ensureScript };
}
