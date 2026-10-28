import DemoNotice from "./DemoNotice.jsx";

const money = (value) => `₹${Number(value).toLocaleString("en-IN")}`;
const formatDate = (value) => {
  const date = value ? new Date(value) : new Date();

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(Number.isNaN(date.getTime()) ? new Date() : date);
};

export default function OrderConfirmation({ order }) {
  const address = order.address || order.shippingAddress || {};

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-14 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-10">
          <p className="text-[9px] font-bold tracking-[0.16em] text-[var(--olive)] uppercase">
            Order confirmed
          </p>
          <h1 className="mt-3 font-['Playfair_Display',serif] text-[34px] leading-tight font-medium tracking-[-0.035em] sm:text-[44px]">
            Thank you, {address.firstName || "friend"}.
          </h1>
          <p className="mt-4 text-[12px] leading-7 text-[var(--muted)]">
            Your order <b className="text-[var(--ink)]">{order.id}</b> has been
            placed. We will prepare it for cash on delivery. No online payment
            was taken.
          </p>

          <div className="mt-7 border-y border-[var(--line)] py-5">
            {order.items.map((item) => {
              const quantity = item.qty ?? item.quantity ?? 1;

              return (
                <div
                  className="flex items-start justify-between gap-4 py-2 text-[11px]"
                  key={`${item.id}-${item.name}`}
                >
                  <span className="text-[var(--muted)]">
                    {item.name} × {quantity}
                  </span>
                  <b className="shrink-0">
                    {money(item.price * quantity)}
                  </b>
                </div>
              );
            })}
            {order.discount > 0 && (
              <div className="flex justify-between gap-4 py-2 text-[11px] text-[var(--olive)]">
                <span>Discount</span>
                <b>−{money(order.discount)}</b>
              </div>
            )}
            <div className="flex justify-between gap-4 py-2 text-[11px] text-[var(--muted)]">
              <span>Shipping</span>
              <b>
                {order.shipping ? money(order.shipping) : "Complimentary"}
              </b>
            </div>
          </div>

          <div className="mt-4 flex items-baseline justify-between gap-4">
            <span className="text-[11px]">Total</span>
            <b className="text-[22px] font-medium">{money(order.total)}</b>
          </div>

          <div className="mt-7 grid gap-5 text-[11px] leading-6 text-[var(--muted)] sm:grid-cols-2">
            <div>
              <p className="mb-1 font-semibold text-[var(--ink)]">
                Delivery address
              </p>
              <p>
                {address.firstName} {address.lastName}
                <br />
                {address.address}
                <br />
                {address.city}, {address.state} {address.postalCode}
                <br />
                {address.country}
              </p>
            </div>
            <div>
              <p className="mb-1 font-semibold text-[var(--ink)]">Payment</p>
              <p>
                {order.payment || "Cash on delivery"}
                <br />
                Status: {order.paymentStatus || "Pending"}
                <br />
                Placed: {formatDate(order.createdAt)}
              </p>
            </div>
          </div>

          <DemoNotice className="mt-7">
            Cash on delivery only. Your order was saved by the Nivora server,
            and stock was reserved when it was placed.
          </DemoNotice>

          <div className="mt-7 flex flex-wrap gap-3">
            <a className="button primary" href={`#/orders/${order.id}`}>
              View order details
            </a>
            <a className="button outline" href="#/products">
              Continue shopping
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
