import { useEffect, useMemo, useRef, useState } from "react";
import {
  createAdminCoupon,
  createAdminProduct,
  deactivateAdminCoupon,
  deactivateAdminProduct,
  updateAdminCoupon,
  updateAdminOrderStatus,
  updateAdminProduct,
  updateAdminUser,
} from "./api/admin.js";
import {
  addCartItem,
  fetchCart,
  mergeCart,
  quoteCart,
  removeCartItem,
  updateCartItem,
} from "./api/cart.js";
import {
  createOrder,
  fetchOrderById,
  fetchOrders,
} from "./api/orders.js";
import {
  fetchCategories,
  fetchProductBySlug,
  fetchProducts,
} from "./api/catalogue.js";
import { useAuth } from "./auth/authContext.js";
import AuthGate from "./components/AuthGate.jsx";
import CatalogueStatus from "./components/CatalogueStatus.jsx";
import { categories, products } from "./data/store.js";
import DemoNotice from "./components/DemoNotice.jsx";
import OrderConfirmation from "./components/OrderConfirmation.jsx";
import useAdminWorkspace from "./hooks/useAdminWorkspace.js";
import useCatalogueListing from "./hooks/useCatalogueListing.js";
import "./App.css";

const IS_DEVELOPMENT = import.meta.env.DEV;

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1490312278390-ab64016e0aa9?auto=format&fit=crop&w=700&q=80";
const HERO_IMAGE =
  "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1400&q=85";
const currency = (n) => `₹${Number(n).toLocaleString("en-IN")}`;
const link = (path, label, cls = "") => (
  <a className={cls} href={`#${path}`}>
    {label}
  </a>
);
const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const save = (key, value) =>
  localStorage.setItem(key, JSON.stringify(value));
const formatDate = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(Number.isNaN(date.getTime()) ? new Date() : date);
};
const decodeSegment = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};
const safeNextPath = (value) =>
  typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "";

const EMPTY_SUMMARY = Object.freeze({
  subtotal: 0,
  discount: 0,
  shipping: 0,
  total: 0,
  itemCount: 0,
});

function App() {
  const { user: session, status: authStatus, logout } = useAuth();
  const [route, setRoute] = useState(location.hash.slice(1) || "/");
  const [dark, setDark] = useState(
    () => localStorage.getItem("nivora-theme") === "dark",
  );
  const [cart, setCart] = useState(() => read("nivora-cart", []));
  const [cartSource, setCartSource] = useState("guest");
  const [cartStatus, setCartStatus] = useState("ready");
  const [cartError, setCartError] = useState("");
  const [cartAttempt, setCartAttempt] = useState(0);
  const [cartPending, setCartPending] = useState(false);
  const [cartSummary, setCartSummary] = useState(EMPTY_SUMMARY);
  const [serverOrders, setServerOrders] = useState({
    status: "idle",
    items: [],
    error: "",
  });
  const [serverOrdersAttempt, setServerOrdersAttempt] = useState(0);
  const mergedSessionRef = useRef("");
  const [wish, setWish] = useState(() => read("nivora-wishlist", []));
  const [query, setQuery] = useState("");
  const [mobile, setMobile] = useState(false);
  const [notice, setNotice] = useState("");
  const [coupon, setCoupon] = useState("");
  const [sort, setSort] = useState("featured");
  const [category, setCategory] = useState(() => {
    const cat = new URLSearchParams(
      location.hash.slice(1).split("?")[1] || "",
    ).get("category");
    return categories.some((c) => c.name === cat) ? cat : "All";
  });
  const [minPrice, setMinPrice] = useState(0);
  const [reviews, setReviews] = useState(() => read("nivora-reviews", {}));
  const [catalogue, setCatalogue] = useState({
    products: null,
    categories: null,
    status: "loading",
    error: "",
  });
  const [catalogueAttempt, setCatalogueAttempt] = useState(0);
  const [productDetail, setProductDetail] = useState({
    slug: "",
    status: "idle",
    product: null,
    error: "",
  });
  const [productAttempt, setProductAttempt] = useState(0);

  const routePath = route.split("?")[0];
  const routeQuery = new URLSearchParams(route.split("?")[1] || "");
  const nextPath = routeQuery.get("next") || "";
  const productSlug = decodeSegment(routePath.split("/")[2] || "");
  const isProductRoute = routePath.startsWith("/product/");
  const shopProducts = useMemo(
    () =>
      catalogue.products ??
      (IS_DEVELOPMENT && catalogue.status === "fallback" ? products : []),
    [catalogue.products, catalogue.status],
  );
  const storefrontProducts = useMemo(
    () => shopProducts.filter((product) => product.status !== "Draft"),
    [shopProducts],
  );
  const catalogueCategories =
    catalogue.categories ??
    (IS_DEVELOPMENT && catalogue.status === "fallback" ? categories : []);
  const matchedProductDetail =
    productDetail.slug === productSlug ? productDetail : null;
  const productDetailStatus = !isProductRoute
    ? "idle"
    : !productSlug
      ? "not-found"
      : matchedProductDetail?.status || "loading";
  const detailProduct = matchedProductDetail?.product || null;
  const detailError = matchedProductDetail?.error || "";

  useEffect(() => {
    const onHash = () => {
      const next = location.hash.slice(1) || "/";
      setRoute(next);
      const cat = new URLSearchParams(next.split("?")[1] || "").get("category");
      setCategory(cat && categories.some((c) => c.name === cat) ? cat : "All");
      setMobile(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    // Older demo builds stored a fake session here. It must never be treated
    // as authentication, so remove any leftover value.
    localStorage.removeItem("nivora-session");
  }, []);
  useEffect(() => {
    localStorage.setItem("nivora-theme", dark ? "dark" : "light");
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);
  useEffect(() => {
    if (cartSource === "guest") {
      save("nivora-cart", cart);
    }
  }, [cart, cartSource]);
  useEffect(() => save("nivora-wishlist", wish), [wish]);
  useEffect(() => save("nivora-reviews", reviews), [reviews]);
  useEffect(() => {
    if (authStatus === "loading") return undefined;

    if (!session) {
      mergedSessionRef.current = "";
      setCartSource("guest");
      setCart(read("nivora-cart", []));
      setCartStatus("ready");
      setCartError("");
      setCartSummary(EMPTY_SUMMARY);
      return undefined;
    }

    const controller = new AbortController();
    let active = true;

    setCartStatus("loading");
    setCartError("");

    const syncCart = async () => {
      try {
        const guestItems = read("nivora-cart", []).filter(
          (row) =>
            row &&
            typeof row.id === "string" &&
            Number.isInteger(row.qty) &&
            row.qty > 0,
        );
        let nextCart;
        let issues = [];

        if (
          guestItems.length > 0 &&
          mergedSessionRef.current !== session.id
        ) {
          mergedSessionRef.current = session.id;

          try {
            const merged = await mergeCart(
              guestItems.map((row) => ({
                productId: row.id,
                quantity: row.qty,
              })),
              { signal: controller.signal },
            );
            nextCart = merged.cart;
            issues = merged.issues;
            save("nivora-cart", []);
          } catch (error) {
            mergedSessionRef.current = "";
            throw error;
          }
        } else {
          nextCart = await fetchCart({ signal: controller.signal });
        }

        if (!active) return;

        applyServerCart(nextCart);
        setCartStatus("ready");

        if (issues.length > 0) {
          setNotice(issues[0]);
        }
      } catch (error) {
        if (!active || error?.name === "AbortError") return;

        setCartStatus("error");
        setCartError(
          error?.message ||
            "Your bag could not be loaded. Check your connection and try again.",
        );
      }
    };

    syncCart();

    return () => {
      active = false;
      controller.abort();
    };
  }, [authStatus, session, cartAttempt]);
  useEffect(() => {
    if (!session) {
      setServerOrders({ status: "idle", items: [], error: "" });
      return undefined;
    }

    const controller = new AbortController();
    let active = true;

    setServerOrders({ status: "loading", items: [], error: "" });

    fetchOrders({ signal: controller.signal })
      .then((items) => {
        if (!active) return;
        setServerOrders({ status: "ready", items, error: "" });
      })
      .catch((error) => {
        if (!active || error?.name === "AbortError") return;

        setServerOrders({
          status: "error",
          items: [],
          error:
            error?.message ||
            "Your order history could not be loaded. Please try again.",
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [session, serverOrdersAttempt]);
  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      fetchCategories({ signal: controller.signal }),
      fetchProducts({
        limit: 60,
        sort: "featured",
        signal: controller.signal,
      }),
    ])
      .then(([categoryItems, result]) => {
        setCatalogue({
          products: result.products,
          categories: categoryItems,
          status: "ready",
          error: "",
        });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;

        setCatalogue({
          products: null,
          categories: null,
          status: IS_DEVELOPMENT ? "fallback" : "error",
          error:
            error.message ||
            "The catalogue could not be loaded. Please try again.",
        });
      });

    return () => controller.abort();
  }, [catalogueAttempt]);
  useEffect(() => {
    if (!isProductRoute || !productSlug) return undefined;

    const controller = new AbortController();
    const knownProduct =
      storefrontProducts.find((product) => product.slug === productSlug) ||
      products.find(
        (product) => product.slug === productSlug && product.status !== "Draft",
      ) ||
      null;

    fetchProductBySlug(productSlug, { signal: controller.signal })
      .then((product) => {
        setProductDetail({
          slug: productSlug,
          status: "ready",
          product,
          error: "",
        });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;

        if (IS_DEVELOPMENT && knownProduct) {
          setProductDetail({
            slug: productSlug,
            status: "fallback",
            product: knownProduct,
            error: error.message,
          });
          return;
        }

        if (!IS_DEVELOPMENT && error.status !== 404) {
          setProductDetail({
            slug: productSlug,
            status: "error",
            product: null,
            error:
              error.message ||
              "The product could not be loaded. Please try again.",
          });
          return;
        }

        setProductDetail({
          slug: productSlug,
          status: "not-found",
          product: null,
          error: "",
        });
      });

    return () => controller.abort();
  }, [isProductRoute, productSlug, productAttempt, storefrontProducts]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  function applyServerCart(nextCart) {
    const items = (nextCart.items || []).map((item) => ({
      id: item.id || item.productId,
      qty: item.qty ?? item.quantity ?? 1,
      name: item.name || "",
      price: item.price ?? 0,
      image: item.image || "",
      stock: item.stock ?? 0,
      slug: item.slug || "",
      material: item.material || "",
      sku: item.sku || "",
    }));

    setCartSource("server");
    setCart(items);
    setCartSummary({
      subtotal: nextCart.subtotal ?? 0,
      discount: nextCart.discount ?? 0,
      shipping: nextCart.shipping ?? 0,
      total: nextCart.total ?? 0,
      itemCount:
        nextCart.itemCount ??
        items.reduce((sum, item) => sum + item.qty, 0),
    });
  }
  const reloadCart = () => {
    setCartStatus("loading");
    setCartError("");
    setCartAttempt((current) => current + 1);
  };
  const retryOrders = () => {
    setServerOrders({ status: "loading", items: [], error: "" });
    setServerOrdersAttempt((current) => current + 1);
  };
  const go = (next) => {
    const target = next.startsWith("/") ? next : "/";
    setRoute(target);

    if (location.hash.slice(1) !== target) {
      location.hash = target;
    }
  };
  const retryCatalogue = () => {
    setCatalogue((current) => ({
      ...current,
      status: "loading",
      error: "",
    }));
    setCatalogueAttempt((current) => current + 1);
  };
  const refreshCatalogue = () =>
    setCatalogueAttempt((current) => current + 1);
  const retryProductDetail = () => {
    setProductDetail({
      slug: productSlug,
      status: "loading",
      product: null,
      error: "",
    });
    setProductAttempt((current) => current + 1);
  };
  const add = async (id, qty = 1) => {
    const product = shopProducts.find((item) => item.id === id);
    if (!product || product.stock <= 0) {
      setNotice("This piece is currently out of stock");
      return;
    }

    if (session) {
      if (cartPending) return;
      setCartPending(true);

      try {
        const nextCart = await addCartItem({
          productId: id,
          quantity: qty,
        });
        applyServerCart(nextCart);
        setCartStatus("ready");
        setNotice(`${product.name} added to your bag`);
      } catch (error) {
        setNotice(error?.message || "Unable to add this item to your bag.");
      } finally {
        setCartPending(false);
      }

      return;
    }

    const existing = cart.find((item) => item.id === id)?.qty || 0;
    if (existing >= product.stock) {
      setNotice(`Only ${product.stock} available`);
      return;
    }

    const nextQty = Math.min(product.stock, existing + qty);
    setCartSource("guest");
    setCart((items) => {
      const row = items.find((item) => item.id === id);
      return row
        ? items.map((item) =>
            item.id === id ? { ...item, qty: nextQty } : item,
          )
        : [...items, { id, qty: nextQty }];
    });
    setNotice(`${product.name} added to your bag`);
  };
  const remove = async (id) => {
    if (session) {
      if (cartPending) return;
      setCartPending(true);

      try {
        applyServerCart(await removeCartItem(id));
        setNotice("Removed from your bag");
      } catch (error) {
        setNotice(error?.message || "Unable to remove this item.");
      } finally {
        setCartPending(false);
      }

      return;
    }

    setCartSource("guest");
    setCart((items) => items.filter((item) => item.id !== id));
    setNotice("Removed from your bag");
  };
  const toggleWish = (id) => {
    setWish((items) =>
      items.includes(id) ? items.filter((item) => item !== id) : [...items, id],
    );
    setNotice(
      wish.includes(id)
        ? "Removed from saved pieces"
        : "Saved to your wishlist",
    );
  };
  const quantity = async (id, delta) => {
    const row = cart.find((item) => item.id === id);
    if (!row) return;

    const product = shopProducts.find((item) => item.id === id);
    const max = Math.max(1, Number(row.stock ?? product?.stock ?? 1) || 1);
    const nextQty = Math.max(1, Math.min(max, row.qty + delta));

    if (nextQty === row.qty) return;

    if (session) {
      if (cartPending) return;
      setCartPending(true);

      try {
        applyServerCart(await updateCartItem(id, nextQty));
      } catch (error) {
        setNotice(error?.message || "Unable to update that quantity.");
      } finally {
        setCartPending(false);
      }

      return;
    }

    setCartSource("guest");
    setCart((items) =>
      items.map((item) =>
        item.id === id ? { ...item, qty: nextQty } : item,
      ),
    );
  };
  const count = cart.reduce((total, item) => total + item.qty, 0);
  const guestSubtotal = cart.reduce(
    (total, item) =>
      total +
      (item.price ??
        shopProducts.find((product) => product.id === item.id)?.price ??
        0) *
        item.qty,
    0,
  );
  const guestShipping =
    guestSubtotal > 0 && guestSubtotal < 2500 ? 150 : 0;
  const summary =
    session && cartSource === "server"
      ? cartSummary
      : {
          subtotal: guestSubtotal,
          discount: 0,
          shipping: guestShipping,
          total: guestSubtotal + guestShipping,
          itemCount: count,
        };
  const effectiveCartStatus =
    session && cartStatus === "ready" && cartSource !== "server"
      ? "loading"
      : cartStatus;
  const currentOrderId = routePath.startsWith("/orders/")
    ? decodeSegment(routePath.split("/")[2] || "")
    : "";
  const isAdmin = routePath.startsWith("/admin") && session?.role === "admin";
  const filtered = useMemo(
    () =>
      products
        .filter(
          (product) =>
            product.status !== "Draft" &&
            (category === "All" || product.category === category) &&
            product.price >= minPrice &&
            (!query ||
              `${product.name} ${product.category} ${product.material} ${product.badge || ""} ${product.description}`
                .toLowerCase()
                .includes(query.toLowerCase())),
        )
        .sort((a, b) =>
          sort === "price-low"
            ? a.price - b.price
            : sort === "price-high"
              ? b.price - a.price
              : sort === "rating"
                ? b.rating - a.rating
                : Number(b.featured) - Number(a.featured),
        ),
    [category, minPrice, query, sort],
  );

  const signOut = async () => {
    try {
      await logout();
      mergedSessionRef.current = "";
      setCartSource("guest");
      setCart(read("nivora-cart", []));
      setCartStatus("ready");
      setCartError("");
      setCartSummary(EMPTY_SUMMARY);
      setServerOrders({ status: "idle", items: [], error: "" });
      setNotice("Signed out");
      go("/");
    } catch (error) {
      setNotice(error?.message || "Unable to sign out. Please try again.");
    }
  };
  const addReview = (productId, review) => {
    setReviews((items) => ({
      ...items,
      [productId]: [review, ...(items[productId] || [])],
    }));
  };
  const placeOrder = async (details, couponCode) => {
    const order = await createOrder({
      shippingAddress: {
        firstName: details.firstName,
        lastName: details.lastName,
        address: details.address,
        city: details.city,
        state: details.state,
        postalCode: details.postalCode,
        country: details.country,
      },
      phone: details.phone,
      notes: details.notes || "",
      couponCode: couponCode || "",
      paymentMethod: "Cash on delivery",
    });

    setCartSource("server");
    setCart([]);
    setCartSummary(EMPTY_SUMMARY);
    setCoupon("");
    setServerOrders((current) => ({
      status: "ready",
      items: [
        order,
        ...current.items.filter((item) => item.id !== order.id),
      ],
      error: "",
    }));
    setNotice(`Order ${order.id} placed`);
    return order;
  };

  return (
    <div className="app-shell">
      {!isAdmin && (
        <>
          <div className="announcement">
            A considered home, delivered with care{" "}
            <span>Complimentary shipping on orders over ₹2,500</span>
          </div>
          <header className="site-header">
            <button
              type="button"
              className="icon-btn menu-trigger"
              aria-label={mobile ? "Close navigation" : "Open navigation"}
              aria-expanded={mobile}
              onClick={() => setMobile(!mobile)}
            >
              ☰
            </button>
            {link("/", <Brand />)}
            <nav className={mobile ? "main-nav open" : "main-nav"}>
              {link("/products", "Shop all")}
              {link("/products?category=Lighting", "Lighting")}
              {link("/products?category=Decor", "Objects & decor")}
              {link("/products?category=Dining", "Dining")}
              {link("/products?category=Furniture", "Furniture")}
            </nav>
            <div className="header-actions">
              <form
                className="search-box"
                onSubmit={(e) => {
                  e.preventDefault();
                  go("/products");
                  setCategory("All");
                }}
              >
                <span>⌕</span>
                <input
                  aria-label="Search products"
                  placeholder="Search the collection"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </form>
              <button
                type="button"
                className="icon-btn theme-control"
                onClick={() => setDark(!dark)}
                aria-label={
                  dark ? "Switch to light mode" : "Switch to dark mode"
                }
              >
                {dark ? "☼" : "◐"}
              </button>
              {link(
                "/account",
                session ? session.name.split(" ")[0] : "Account",
                "header-text",
              )}
              {link(
                "/wishlist",
                <span>
                  ♡ <small>{wish.length}</small>
                </span>,
                "icon-btn",
              )}
              {link(
                "/cart",
                <span>
                  Bag <small>{count}</small>
                </span>,
                "bag-link",
              )}
            </div>
          </header>
        </>
      )}
      <main>
        {routePath === "/" && (
          <Home
            products={storefrontProducts}
            categories={catalogueCategories}
            catalogueStatus={catalogue.status}
            catalogueError={catalogue.error}
            onRetry={retryCatalogue}
            add={add}
            wish={wish}
            toggleWish={toggleWish}
          />
        )}
        {(routePath === "/products" || routePath === "/search") && (
          <Listing
            filtered={filtered}
            categories={catalogueCategories}
            add={add}
            category={category}
            setCategory={setCategory}
            minPrice={minPrice}
            setMinPrice={setMinPrice}
            sort={sort}
            setSort={setSort}
            query={query}
            setQuery={setQuery}
            wish={wish}
            toggleWish={toggleWish}
          />
        )}
        {isProductRoute &&
          (productDetailStatus === "error" ? (
            <div className="page-container">
              <div className="breadcrumbs">Home / Shop / Product</div>
              <CatalogueStatus
                status="error"
                error={detailError}
                onRetry={retryProductDetail}
              />
            </div>
          ) : productDetailStatus === "not-found" ? (
            <NotFound />
          ) : detailProduct ? (
            <ProductDetail
              key={detailProduct.id || productSlug}
              product={detailProduct}
              products={storefrontProducts}
              add={add}
              wish={wish}
              toggleWish={toggleWish}
              session={session}
              reviews={reviews[detailProduct.id] || []}
              onAddReview={addReview}
              setNotice={setNotice}
              catalogueStatus={productDetailStatus}
              catalogueError={detailError}
              onRetry={retryProductDetail}
            />
          ) : (
            <div className="page-container">
              <div className="breadcrumbs">Home / Shop / Product</div>
              <CatalogueStatus
                status="loading"
                loadingMessage="Loading product details…"
                onRetry={retryProductDetail}
              />
            </div>
          ))}
        {routePath === "/cart" && (
          <Cart
            products={shopProducts}
            session={session}
            cart={cart}
            quantity={quantity}
            remove={remove}
            summary={summary}
            go={go}
            status={effectiveCartStatus}
            error={cartError}
            onRetry={reloadCart}
            busy={cartPending}
          />
        )}
        {routePath === "/wishlist" && (
          <Wishlist
            products={storefrontProducts}
            wish={wish}
            toggleWish={toggleWish}
            add={add}
          />
        )}
        {routePath === "/checkout" &&
          (session ? (
            <Checkout
              products={shopProducts}
              session={session}
              cart={cart}
              summary={summary}
              coupon={coupon}
              setCoupon={setCoupon}
              setNotice={setNotice}
              onPlaceOrder={placeOrder}
              onReloadCart={reloadCart}
              cartStatus={effectiveCartStatus}
              cartError={cartError}
            />
          ) : (
            <AuthGate
              status={authStatus}
              user={session}
              title="Sign in to check out"
              copy="Your guest bag is saved in this browser. Sign in and it will be merged with your account bag, without exceeding available stock."
              next="/checkout"
            />
          ))}
        {routePath === "/login" && (
          <Auth mode="login" nextPath={nextPath} setNotice={setNotice} />
        )}
        {routePath === "/register" && (
          <Auth mode="register" nextPath={nextPath} setNotice={setNotice} />
        )}
        {routePath === "/recover" && (
          <Auth mode="recover" nextPath={nextPath} setNotice={setNotice} />
        )}
        {routePath === "/account" &&
          (session ? (
            <Account
              session={session}
              orders={serverOrders.items}
              ordersStatus={serverOrders.status}
              ordersError={serverOrders.error}
              wish={wish}
              onLogout={signOut}
            />
          ) : (
            <AuthGate
              status={authStatus}
              user={session}
              title="Sign in to your account"
              copy="Your profile, saved pieces and order history are available after you sign in."
              next="/account"
            />
          ))}
        {routePath === "/orders" &&
          (session ? (
            <OrdersPage
              orders={serverOrders.items}
              status={serverOrders.status}
              error={serverOrders.error}
              onRetry={retryOrders}
            />
          ) : (
            <AuthGate
              status={authStatus}
              user={session}
              title="Order history is protected"
              copy="Sign in to view orders placed with your Nivora account."
              next="/orders"
            />
          ))}
        {routePath.startsWith("/orders/") &&
          (session ? (
            <OrderDetail orderId={currentOrderId} />
          ) : (
            <AuthGate
              status={authStatus}
              user={session}
              title="Order details are protected"
              copy="Sign in to view the selected order."
              next={routePath}
            />
          ))}
        {routePath.startsWith("/admin") &&
          (session?.role === "admin" ? (
            <Admin
              key={routePath}
              route={routePath}
              session={session}
              setNotice={setNotice}
              categories={
                catalogueCategories.length
                  ? catalogueCategories
                  : categories
              }
              onCatalogueChanged={refreshCatalogue}
            />
          ) : (
            <AuthGate
              status={authStatus}
              user={session}
              title="Admin workspace"
              copy="This area is limited to Nivora administrators. Sign in with an administrator account to continue."
              next={routePath}
              adminOnly
            />
          ))}
        {![
          "/",
          "/products",
          "/search",
          "/cart",
          "/wishlist",
          "/checkout",
          "/login",
          "/register",
          "/recover",
          "/account",
          "/orders",
        ].includes(routePath) &&
          !route.startsWith("/product/") &&
          !route.startsWith("/admin") &&
          !route.startsWith("/orders/") && <NotFound />}
      </main>
      {!isAdmin && <Footer setNotice={setNotice} />}
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}

function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark">n</span>
      <span>NIVORA</span>
    </span>
  );
}
function SectionTitle({ eyebrow, title, copy, action }) {
  return (
    <div className="section-title">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {copy && <p className="muted">{copy}</p>}
      </div>
      {action}
    </div>
  );
}
function Home({
  products,
  categories: displayCategories,
  catalogueStatus,
  catalogueError,
  onRetry,
  add,
  wish,
  toggleWish,
}) {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">A home, more your own</p>
          <h1>
            Make room for
            <br />
            <em>the everyday.</em>
          </h1>
          <p>
            Thoughtful pieces for slow mornings, long dinners and everything in
            between.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="#/products">
              Explore the collection <span>↗</span>
            </a>
            <a className="text-link" href="#/products?category=Decor">
              Browse objects
            </a>
          </div>
          <div className="hero-note">
            <span className="note-line" />
            Small-batch finds. Made to stay.
          </div>
        </div>
        <div className="hero-photo">
          <img
            src={HERO_IMAGE}
            alt="Sunlit contemporary living room with considered furniture and decor"
          />
          <div className="photo-caption">
            Objects for softer living <span>01 / 04</span>
          </div>
        </div>
      </section>
      <div className="mx-auto w-full max-w-[var(--content)] px-[5.5%]">
        <CatalogueStatus
          status={catalogueStatus}
          error={catalogueError}
          onRetry={onRetry}
          fallbackMessage="The live catalogue API is unavailable, so sample pieces from the local demo catalogue are being shown."
        />
      </div>
      <div className="trust-strip">
        <span>Considered materials</span>
        <i>·</i>
        <span>Made to live with</span>
        <i>·</i>
        <span>Delivery across India</span>
      </div>
      <section className="section categories-section">
        <SectionTitle
          eyebrow="Find your feeling"
          title="A little more considered."
          copy="Everyday pieces, chosen for the way a space feels."
          action={
            <a href="#/products" className="text-link">
              View all categories ↗
            </a>
          }
        />
        <div className="category-grid">
          {displayCategories.slice(0, 4).map((c, i) => (
            <a
              className={`category-tile category-${i}`}
              href={`#/products?category=${encodeURIComponent(c.name)}`}
              key={c.name}
            >
              <img loading="lazy" src={c.image} alt={c.name} />
              <span>{c.name}</span>
              <b>↗</b>
            </a>
          ))}
        </div>
      </section>
      <section className="section product-section">
        <SectionTitle
          eyebrow="The edit"
          title="Pieces worth keeping."
          copy="A few favourites from the Nivora collection."
          action={
            <a href="#/products" className="text-link">
              Shop all pieces ↗
            </a>
          }
        />
        <ProductGrid
          items={products.filter((p) => p.featured).slice(0, 4)}
          add={add}
          wish={wish}
          toggleWish={toggleWish}
        />
      </section>
      <section className="editorial">
        <img
          loading="lazy"
          src="https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&q=85"
          alt="Natural materials and thoughtful objects in a calm home"
        />
        <div className="editorial-copy">
          <p className="eyebrow">The Nivora point of view</p>
          <h2>
            Less, but
            <br />
            <em>more meaningful.</em>
          </h2>
          <p>
            We look for honest materials, useful forms and the small details
            that make a house feel like yours.
          </p>
          <a href="#/products" className="button outline">
            A note on how we choose ↗
          </a>
        </div>
      </section>
      <section className="section product-section">
        <SectionTitle
          eyebrow="Made for living"
          title="The pieces you come back to."
          action={
            <a href="#/products" className="text-link">
              See bestsellers ↗
            </a>
          }
        />
        <ProductGrid
          items={products.filter((p) => p.bestseller).slice(0, 4)}
          add={add}
          wish={wish}
          toggleWish={toggleWish}
        />
      </section>
      <Benefits />
    </>
  );
}

function ProductGrid({ items, add, wish, toggleWish }) {
  return (
    <div className="product-grid">
      {items.map((p) => (
        <article className="product-card" key={p.id}>
          <div className="product-image">
            <a href={`#/product/${p.slug}`}>
              <img
                loading="lazy"
                src={p.image}
                alt={p.name}
                onError={(event) => {
                  event.currentTarget.src = FALLBACK_IMAGE;
                }}
              />
            </a>
            {(p.badge || p.stock <= 0) && (
              <span className="product-badge">
                {p.stock <= 0 ? "Sold out" : p.badge}
              </span>
            )}
            <button
              aria-label={`${wish.includes(p.id) ? "Remove" : "Add"} ${p.name} ${wish.includes(p.id) ? "from" : "to"} wishlist`}
              className={`wish-button ${wish.includes(p.id) ? "active" : ""}`}
              onClick={() => toggleWish(p.id)}
            >
              {wish.includes(p.id) ? "♥" : "♡"}
            </button>
            <button
              type="button"
              className="quick-add"
              onClick={() => add(p.id)}
              disabled={p.stock <= 0}
            >
              {p.stock <= 0 ? "Sold out" : "Add to bag"} <span>+</span>
            </button>
          </div>
          <div className="product-meta">
            <a href={`#/product/${p.slug}`} className="product-name">
              {p.name}
            </a>
            <span>{currency(p.price)}</span>
          </div>
          <div className="product-sub">
            {p.material}{" "}
            <span>
              ★ {p.rating} <small>({p.reviewCount})</small>
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}
function Listing({
  filtered,
  categories: categoryOptions,
  add,
  category,
  setCategory,
  minPrice,
  setMinPrice,
  sort,
  setSort,
  query,
  setQuery,
  wish,
  toggleWish,
}) {
  const [drawer, setDrawer] = useState(false);
  const { items, status, error, retry } = useCatalogueListing({
    category,
    minPrice,
    sort,
    query,
    fallbackItems: filtered,
  });
  return (
    <div className="page-container">
      <div className="breadcrumbs">Home / Shop</div>
      <div className="listing-heading">
        <div>
          <p className="eyebrow">The Nivora collection</p>
          <h1>Objects for living.</h1>
          <p className="muted">
            Well-made details for the spaces you call yours.
          </p>
        </div>
        <span className="results-count" aria-live="polite">
          {items.length} {items.length === 1 ? "piece" : "pieces"}
        </span>
      </div>
      <CatalogueStatus
        status={status}
        error={error}
        onRetry={retry}
        fallbackMessage="The live catalogue API is unavailable, so filtered sample pieces from the local demo catalogue are shown."
      />
      <div className="listing-controls">
        <button
          type="button"
          className="button outline filter-trigger"
          onClick={() => setDrawer(!drawer)}
          aria-expanded={drawer}
          aria-controls="product-filters"
        >
          ☷ Filters
        </button>
        <div
          id="product-filters"
          className={`filters ${drawer ? "filters-open" : ""}`}
        >
          <label>
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option>All</option>
              {categoryOptions.map((c) => (
                <option key={c.name}>{c.name}</option>
              ))}
            </select>
          </label>
          <label>
            Minimum price
            <input
              type="range"
              min="0"
              max="30000"
              step="500"
              value={minPrice}
              onChange={(e) => setMinPrice(Number(e.target.value))}
            />
            <small>{currency(minPrice)}+</small>
          </label>
          <label>
            Search
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a piece"
            />
          </label>
        </div>
        <label className="sort-select">
          Sort by{" "}
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="featured">Curated</option>
            <option value="price-low">Price: low to high</option>
            <option value="price-high">Price: high to low</option>
            <option value="rating">Top rated</option>
          </select>
        </label>
      </div>
      {items.length ? (
        <ProductGrid
          items={items}
          add={add}
          wish={wish}
          toggleWish={toggleWish}
        />
      ) : status === "loading" || status === "error" ? null : (
        <div className="empty-state" role="status">
          <h2>No pieces found</h2>
          <p>Try a different search, category or minimum price.</p>
          <button
            type="button"
            className="button outline"
            onClick={() => {
              setQuery("");
              setCategory("All");
              setMinPrice(0);
              setSort("featured");
            }}
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
function ProductDetail({
  product: p,
  products,
  add,
  wish,
  toggleWish,
  session,
  reviews,
  onAddReview,
  setNotice,
  catalogueStatus,
  catalogueError,
  onRetry,
}) {
  const [image, setImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [rating, setRating] = useState("");
  const [note, setNote] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [reviewSuccess, setReviewSuccess] = useState("");

  if (!p) return <NotFound />;

  const gallery = [...new Set([p.image, ...(p.images || [])].filter(Boolean))];
  const localReviews = reviews || [];
  const reviewCount = (p.reviewCount || 0) + localReviews.length;
  const averageRating = reviewCount
    ? (
        ((Number(p.rating) || 0) * (p.reviewCount || 0) +
          localReviews.reduce(
            (total, item) => total + Number(item.rating || 0),
            0,
          )) /
        reviewCount
      ).toFixed(1)
    : "—";
  const stock = Number(p.stock) || 0;
  const soldOut = stock <= 0;

  const submitReview = (event) => {
    event.preventDefault();
    const trimmed = note.trim();
    if (!rating) {
      setReviewError("Choose a star rating before submitting.");
      return;
    }
    if (trimmed.length < 10) {
      setReviewError("Please write at least 10 characters.");
      return;
    }
    onAddReview(p.id, {
      rating: Number(rating),
      note: trimmed,
      author: session?.name || "Guest",
      date: formatDate(),
    });
    setRating("");
    setNote("");
    setReviewError("");
    setReviewSuccess("Review saved in this browser. It is demo data only.");
    setNotice("Demo review saved locally");
  };

  return (
    <div className="page-container">
      <div className="breadcrumbs">
        Home / {p.category} / {p.name}
      </div>
      <CatalogueStatus
        status={catalogueStatus}
        error={catalogueError}
        onRetry={onRetry}
        fallbackMessage="Live product details are unavailable, so this local catalogue preview is shown."
      />
      <div className="detail-layout">
        <div className="gallery">
          <img
            className="main-product-image"
            src={gallery[image] || p.image}
            alt={p.name}
            onError={(event) => {
              event.currentTarget.src = FALLBACK_IMAGE;
            }}
          />
          <div className="thumbs">
            {gallery.map((src, index) => (
              <button
                type="button"
                className={image === index ? "selected" : ""}
                key={`${src}-${index}`}
                onClick={() => setImage(index)}
                aria-label={`Show ${p.name} image ${index + 1}`}
                aria-pressed={image === index}
              >
                <img src={src} alt={`${p.name} view ${index + 1}`} />
              </button>
            ))}
          </div>
        </div>
        <div className="detail-copy">
          <p className="eyebrow">{p.category}</p>
          <h1>{p.name}</h1>
          <div className="rating">
            ★ {averageRating}{" "}
            <span>
              ({reviewCount} reviews
              {localReviews.length ? " · includes local demo reviews" : ""})
            </span>
          </div>
          <p className="detail-price">
            {currency(p.price)}{" "}
            {p.compareAtPrice && <del>{currency(p.compareAtPrice)}</del>}
          </p>
          <p className="muted">{p.description}</p>
          <p className="stock-note">
            {soldOut
              ? "● Out of stock in this demo"
              : `● ${stock} in stock · ships in 2–4 working days`}
          </p>
          <div className="detail-actions">
            <div className="qty-control">
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => setQty(Math.max(1, qty - 1))}
                disabled={soldOut}
              >
                −
              </button>
              <span>{qty}</span>
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() => setQty(Math.min(stock, qty + 1))}
                disabled={soldOut || qty >= stock}
              >
                +
              </button>
            </div>
            <button
              type="button"
              className="button primary"
              onClick={() => add(p.id, qty)}
              disabled={soldOut}
            >
              {soldOut
                ? "Out of stock"
                : `Add to bag — ${currency(p.price * qty)}`}
            </button>
            <button
              type="button"
              className="button outline"
              onClick={() => toggleWish(p.id)}
            >
              {wish.includes(p.id) ? "♥ Saved" : "♡ Save"}
            </button>
          </div>
          <details open>
            <summary>Details & materials</summary>
            <p>{p.material}. Thoughtfully finished for everyday use.</p>
            {Object.entries(p.specifications || {}).map(([key, value]) => (
              <p key={key}>
                <b>{key}:</b> {value}
              </p>
            ))}
          </details>
          <details>
            <summary>Delivery & returns</summary>
            <p>
              Delivery estimates are illustrative. Return policy and fulfilment
              will be managed by the connected store service.
            </p>
          </details>
        </div>
      </div>
      <section className="section">
        <SectionTitle eyebrow="From the collection" title="Made to live with." />
        <ProductGrid
          items={products
            .filter((item) => item.category === p.category && item.id !== p.id)
            .slice(0, 3)}
          add={add}
          wish={wish}
          toggleWish={toggleWish}
        />
      </section>
      <section className="review-row">
        <div>
          <p className="eyebrow">The conversation</p>
          <h2>Notes on this piece</h2>
          <p className="muted">
            Catalogue ratings plus reviews saved in this browser.
          </p>
        </div>
        <button
          type="button"
          className="button outline"
          onClick={() => {
            setReviewOpen(!reviewOpen);
            setReviewError("");
            setReviewSuccess("");
          }}
          aria-expanded={reviewOpen}
        >
          {reviewOpen ? "Close" : "Write a review"}
        </button>
      </section>
      {reviewOpen && (
        <form className="review-form" onSubmit={submitReview} noValidate>
          <label>
            Your rating
            <select
              value={rating}
              onChange={(event) => setRating(event.target.value)}
              aria-invalid={Boolean(reviewError && !rating)}
            >
              <option value="">Choose a rating</option>
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={value}>
                  {value} stars
                </option>
              ))}
            </select>
          </label>
          <label>
            Your note
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="What should others know about this piece?"
              aria-invalid={Boolean(reviewError && note.trim().length < 10)}
            />
          </label>
          <button type="submit" className="button primary">
            Submit review
          </button>
        </form>
      )}
      <div aria-live="polite">
        {reviewError && <DemoNotice tone="error">{reviewError}</DemoNotice>}
        {reviewSuccess && (
          <DemoNotice tone="success">{reviewSuccess}</DemoNotice>
        )}
      </div>
      {localReviews.length > 0 && (
        <section className="mt-2 border-t border-[var(--line)] pt-6">
          <h2 className="text-[16px] font-medium">Local demo reviews</h2>
          <div className="mt-4 grid gap-3">
            {localReviews.map((item, index) => (
              <article
                className="border border-[var(--line)] bg-[var(--surface)] p-4"
                key={`${item.date}-${index}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-[var(--muted)]">
                  <b className="text-[var(--ink)]">{item.author}</b>
                  <span>
                    ★ {item.rating} · {item.date}
                  </span>
                </div>
                <p className="mt-2 text-[11px] leading-6 text-[var(--muted)]">
                  {item.note}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
function Cart({
  products,
  session,
  cart,
  quantity,
  remove,
  summary,
  go,
  status,
  error,
  onRetry,
  busy,
}) {
  const headingCount =
    summary.itemCount || cart.reduce((total, item) => total + item.qty, 0);

  return (
    <div className="page-container">
      <div className="breadcrumbs">Home / Your bag</div>
      <div className="page-heading">
        <div>
          <p className="eyebrow">A good choice</p>
          <h1>
            Your bag
            <span className="heading-count"> ({headingCount})</span>
          </h1>
        </div>
        <a href="#/products" className="text-link">
          Continue shopping ↗
        </a>
      </div>
      {session && status === "error" ? (
        <div className="empty-state" role="alert">
          <h2>Your bag could not be loaded.</h2>
          <p>{error || "Check your connection and try again."}</p>
          <button type="button" className="button primary" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : session && status === "loading" ? (
        <div className="empty-state" aria-live="polite">
          <h2>Loading your bag…</h2>
          <p>Fetching the items saved to your Nivora account.</p>
        </div>
      ) : !cart.length ? (
        <div className="empty-state">
          <h2>Your bag is taking a breather.</h2>
          <p>Find a piece that feels like you.</p>
          <a className="button primary" href="#/products">
            Explore the collection
          </a>
        </div>
      ) : (
        <div className="cart-layout">
          <div className="cart-list">
            {cart.map((row) => {
              const product = products.find((item) => item.id === row.id);
              const item = row.name ? row : product;
              if (!item) return null;

              const price = Number(item.price ?? row.price ?? 0);
              const stock = Number(item.stock ?? row.stock ?? 0);
              const soldOut = stock <= 0;
              const atLimit = !soldOut && row.qty >= stock;
              const productLink = item.slug
                ? `#/product/${item.slug}`
                : "#/products";

              return (
                <div className="cart-item" key={row.id}>
                  <img
                    src={item.image || FALLBACK_IMAGE}
                    alt={item.name}
                    onError={(event) => {
                      event.currentTarget.src = FALLBACK_IMAGE;
                    }}
                  />
                  <div className="cart-item-info">
                    <a href={productLink}>{item.name}</a>
                    <small>{item.material || "Nivora collection"}</small>
                    <div className="qty-control">
                      <button
                        type="button"
                        aria-label={`Decrease ${item.name} quantity`}
                        onClick={() => quantity(row.id, -1)}
                        disabled={busy || row.qty <= 1}
                      >
                        −
                      </button>
                      <span>{row.qty}</span>
                      <button
                        type="button"
                        aria-label={`Increase ${item.name} quantity`}
                        onClick={() => quantity(row.id, 1)}
                        disabled={busy || soldOut || atLimit}
                      >
                        +
                      </button>
                    </div>
                    {soldOut ? (
                      <small>Out of stock</small>
                    ) : (
                      atLimit && <small>Only {stock} available</small>
                    )}
                  </div>
                  <div className="cart-price">
                    {currency(row.qty * price)}
                    <button
                      type="button"
                      onClick={() => remove(row.id)}
                      aria-label={`Remove ${item.name} from bag`}
                      disabled={busy}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <aside className="summary-box">
            <h2>Order summary</h2>
            <p>
              <span>Subtotal</span>
              <b>{currency(summary.subtotal)}</b>
            </p>
            <p>
              <span>Shipping</span>
              <b>
                {summary.shipping
                  ? currency(summary.shipping)
                  : "Complimentary"}
              </b>
            </p>
            <p>
              <span>Discount</span>
              <b>
                {summary.discount > 0
                  ? `−${currency(summary.discount)}`
                  : "—"}
              </b>
            </p>
            <div className="summary-total">
              <span>Total</span>
              <b>{currency(summary.total)}</b>
            </div>
            <small>
              {session
                ? "Stock and totals are checked again by the server at checkout."
                : "Sign in at checkout to sync this bag with your account."}
            </small>
            <button
              className="button primary full"
              onClick={() => go("/checkout")}
              disabled={busy}
            >
              Continue to checkout ↗
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
function Wishlist({ products, wish, toggleWish, add }) {
  const saved = products.filter((p) => wish.includes(p.id));
  return (
    <div className="page-container">
      <div className="breadcrumbs">Home / Saved pieces</div>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Your considered list</p>
          <h1>Saved pieces.</h1>
        </div>
        <a href="#/products" className="text-link">
          Continue shopping ↗
        </a>
      </div>
      {saved.length ? (
        <ProductGrid
          items={saved}
          add={add}
          wish={wish}
          toggleWish={toggleWish}
        />
      ) : (
        <div className="empty-state">
          <h2>Nothing saved just yet.</h2>
          <p>Keep the pieces you love close at hand.</p>
          <a className="button primary" href="#/products">
            Explore the collection
          </a>
        </div>
      )}
    </div>
  );
}
function Checkout({
  products,
  session,
  cart,
  summary,
  coupon,
  setCoupon,
  setNotice,
  onPlaceOrder,
  onReloadCart,
  cartStatus,
  cartError,
}) {
  const [form, setForm] = useState(() => ({
    email: session?.email || "",
    phone: "",
    firstName: session?.name?.split(" ")[0] || "",
    lastName: session?.name?.split(" ").slice(1).join(" ") || "",
    address: "",
    city: "",
    state: "",
    postalCode: "",
    country: "India",
  }));
  const [errors, setErrors] = useState({});
  const [code, setCode] = useState(coupon || "");
  const [couponMessage, setCouponMessage] = useState(null);
  const [quote, setQuote] = useState(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(null);

  useEffect(() => {
    setQuote(null);
    setCouponMessage(null);
  }, [summary.subtotal]);

  if (placedOrder) return <OrderConfirmation order={placedOrder} />;
  if (cartStatus === "loading") {
    return (
      <div className="page-container empty-state" aria-live="polite">
        <h1>Loading your bag…</h1>
        <p>Checking the items saved to your Nivora account.</p>
      </div>
    );
  }
  if (cartStatus === "error") {
    return (
      <div className="page-container empty-state" role="alert">
        <h1>Your bag could not be loaded.</h1>
        <p>{cartError || "Check your connection and try again."}</p>
        <button type="button" className="button primary" onClick={onReloadCart}>
          Try again
        </button>
      </div>
    );
  }
  if (!cart.length) {
    return (
      <div className="page-container empty-state">
        <h1>Your bag is empty.</h1>
        <p>Add a piece to your bag before checking out.</p>
        <a className="button primary" href="#/products">
          Explore the collection
        </a>
      </div>
    );
  }

  const discount = quote?.discount ?? summary.discount ?? 0;
  const shipping = quote?.shipping ?? summary.shipping ?? 0;
  const total = quote?.total ?? summary.total ?? 0;

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
    setFormError("");
  };
  const applyCoupon = async () => {
    const normalized = code.trim().toUpperCase();

    if (!normalized) {
      setQuote(null);
      setCoupon("");
      setCouponMessage({
        tone: "error",
        text: "Enter a coupon code to apply.",
      });
      return;
    }

    if (couponBusy) return;
    setCouponBusy(true);

    try {
      const quoted = await quoteCart(normalized);
      setQuote(quoted);
      setCoupon(quoted.couponCode || normalized);
      setCouponMessage({
        tone: "success",
        text: `${quoted.couponCode || normalized} applied: ${currency(
          quoted.discount,
        )} off.`,
      });
      setNotice("Coupon applied");
    } catch (error) {
      setQuote(null);
      setCoupon("");
      setCouponMessage({
        tone: "error",
        text: error?.message || "That coupon could not be applied.",
      });
    } finally {
      setCouponBusy(false);
    }
  };
  const validate = () => {
    const nextErrors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!/^[0-9+\-\s]{10,15}$/.test(form.phone.trim())) {
      nextErrors.phone = "Enter a phone number with 10–15 digits.";
    }
    if (!form.firstName.trim()) nextErrors.firstName = "First name is required.";
    if (!form.lastName.trim()) nextErrors.lastName = "Last name is required.";
    if (form.address.trim().length < 5) {
      nextErrors.address = "Enter a delivery address.";
    }
    if (!form.city.trim()) nextErrors.city = "City is required.";
    if (!form.state.trim()) nextErrors.state = "State is required.";
    if (!/^[0-9]{6}$/.test(form.postalCode.trim())) {
      nextErrors.postalCode = "Enter a 6-digit postal code.";
    }
    if (!form.country.trim()) nextErrors.country = "Country is required.";
    return nextErrors;
  };
  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitting) return;

    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setFormError("Check the highlighted details before placing the order.");
      const firstField = Object.keys(nextErrors)[0];
      document.getElementById(`checkout-${firstField}`)?.focus();
      return;
    }

    setSubmitting(true);
    setFormError("");

    try {
      const order = await onPlaceOrder({ ...form, notes: "" }, coupon);
      setPlacedOrder(order);
    } catch (error) {
      setFormError(
        error?.message ||
          "Your order could not be placed. Please try again.",
      );

      if (error?.status === 409) {
        onReloadCart();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container">
      <div className="breadcrumbs">Home / Your bag / Checkout</div>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Almost yours</p>
          <h1>Checkout</h1>
        </div>
      </div>

      <DemoNotice>
        Checkout is processed by the Nivora server. Prices, stock, discounts
        and shipping are recalculated when you place the order. Cash on delivery
        only; no online payment is processed.
      </DemoNotice>
      <div aria-live="polite">
        {formError && <DemoNotice tone="error">{formError}</DemoNotice>}
      </div>

      <form className="checkout-layout" onSubmit={handleSubmit} noValidate>
        <div className="checkout-fields">
          <section className="form-section">
            <h2>Contact</h2>
            <label>
              Email address
              <input
                id="checkout-email"
                type="email"
                autoComplete="email"
                value={form.email}
                readOnly={Boolean(session)}
                onChange={(event) => updateField("email", event.target.value)}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "checkout-email-error" : undefined}
              />
              {session && (
                <span className="text-[9px] text-[var(--muted)]">
                  Order updates are sent to your account email.
                </span>
              )}
              {errors.email && (
                <span
                  id="checkout-email-error"
                  className="text-[9px] text-[var(--terracotta)]"
                >
                  {errors.email}
                </span>
              )}
            </label>
            <label>
              Phone number
              <input
                id="checkout-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
                aria-invalid={Boolean(errors.phone)}
                aria-describedby={errors.phone ? "checkout-phone-error" : undefined}
              />
              {errors.phone && (
                <span
                  id="checkout-phone-error"
                  className="text-[9px] text-[var(--terracotta)]"
                >
                  {errors.phone}
                </span>
              )}
            </label>
          </section>

          <section className="form-section">
            <h2>Delivery address</h2>
            <div className="field-grid">
              <label>
                First name
                <input
                  id="checkout-firstName"
                  autoComplete="given-name"
                  value={form.firstName}
                  onChange={(event) =>
                    updateField("firstName", event.target.value)
                  }
                  aria-invalid={Boolean(errors.firstName)}
                />
                {errors.firstName && (
                  <span className="text-[9px] text-[var(--terracotta)]">
                    {errors.firstName}
                  </span>
                )}
              </label>
              <label>
                Last name
                <input
                  id="checkout-lastName"
                  autoComplete="family-name"
                  value={form.lastName}
                  onChange={(event) =>
                    updateField("lastName", event.target.value)
                  }
                  aria-invalid={Boolean(errors.lastName)}
                />
                {errors.lastName && (
                  <span className="text-[9px] text-[var(--terracotta)]">
                    {errors.lastName}
                  </span>
                )}
              </label>
            </div>
            <label>
              Address
              <input
                id="checkout-address"
                autoComplete="street-address"
                value={form.address}
                onChange={(event) => updateField("address", event.target.value)}
                aria-invalid={Boolean(errors.address)}
              />
              {errors.address && (
                <span className="text-[9px] text-[var(--terracotta)]">
                  {errors.address}
                </span>
              )}
            </label>
            <div className="field-grid">
              <label>
                City
                <input
                  id="checkout-city"
                  autoComplete="address-level2"
                  value={form.city}
                  onChange={(event) => updateField("city", event.target.value)}
                  aria-invalid={Boolean(errors.city)}
                />
                {errors.city && (
                  <span className="text-[9px] text-[var(--terracotta)]">
                    {errors.city}
                  </span>
                )}
              </label>
              <label>
                State
                <input
                  id="checkout-state"
                  autoComplete="address-level1"
                  value={form.state}
                  onChange={(event) => updateField("state", event.target.value)}
                  aria-invalid={Boolean(errors.state)}
                />
                {errors.state && (
                  <span className="text-[9px] text-[var(--terracotta)]">
                    {errors.state}
                  </span>
                )}
              </label>
              <label>
                Postal code
                <input
                  id="checkout-postalCode"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  value={form.postalCode}
                  onChange={(event) =>
                    updateField("postalCode", event.target.value)
                  }
                  aria-invalid={Boolean(errors.postalCode)}
                />
                {errors.postalCode && (
                  <span className="text-[9px] text-[var(--terracotta)]">
                    {errors.postalCode}
                  </span>
                )}
              </label>
              <label>
                Country
                <select
                  id="checkout-country"
                  value={form.country}
                  onChange={(event) =>
                    updateField("country", event.target.value)
                  }
                >
                  <option>India</option>
                </select>
              </label>
            </div>
          </section>

          <section className="form-section">
            <h2>Payment preference</h2>
            <label className="radio-row">
              <input type="radio" name="payment" defaultChecked />
              Cash on delivery
              <small>Pay when your order arrives</small>
            </label>
            <label className="radio-row">
              <input type="radio" name="payment" disabled />
              Online payment
              <small>Not available in this phase</small>
            </label>
          </section>
        </div>

        <aside className="summary-box">
          <h2>Your order</h2>
          {cart.map((row) => {
            const product = products.find((item) => item.id === row.id);
            const name = row.name || product?.name || "Nivora piece";
            const price = Number(row.price ?? product?.price ?? 0);
            return (
              <p key={row.id}>
                <span>
                  {name} × {row.qty}
                </span>
                <b>{currency(price * row.qty)}</b>
              </p>
            );
          })}
          <div className="coupon-form">
            <input
              aria-label="Coupon code"
              placeholder="Coupon code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
            <button
              type="button"
              className="button outline"
              onClick={applyCoupon}
              disabled={couponBusy}
            >
              {couponBusy ? "Checking…" : "Apply"}
            </button>
          </div>
          <div aria-live="polite">
            {couponMessage && (
              <DemoNotice tone={couponMessage.tone}>
                {couponMessage.text}
              </DemoNotice>
            )}
          </div>
          <p>
            <span>Subtotal</span>
            <b>{currency(summary.subtotal)}</b>
          </p>
          <p>
            <span>Shipping</span>
            <b>{shipping ? currency(shipping) : "Complimentary"}</b>
          </p>
          <p>
            <span>Discount</span>
            <b>{discount > 0 ? `−${currency(discount)}` : "—"}</b>
          </p>
          <div className="summary-total">
            <span>Total</span>
            <b>{currency(total)}</b>
          </div>
          {quote && quote.couponCode !== coupon && (
            <small>Apply the code again after changing your bag.</small>
          )}
          <button
            type="submit"
            className="button primary full"
            disabled={submitting || couponBusy}
          >
            {submitting ? "Placing order…" : "Place order"}
          </button>
          <small>
            Cash on delivery only. Stock, discounts and totals are confirmed by
            the server when the order is placed.
          </small>
        </aside>
      </form>
    </div>
  );
}
function Auth({ mode, nextPath, setNotice }) {
  const register = mode === "register";
  const recover = mode === "recover";
  const { login, register: registerUser, restoreError } = useAuth();
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  };
  const nextQuery = nextPath
    ? `?next=${encodeURIComponent(nextPath)}`
    : "";
  const loginHref = `#/login${nextQuery}`;
  const registerHref = `#/register${nextQuery}`;
  const recoverHref = `#/recover${nextQuery}`;

  if (recover) {
    return (
      <div className="auth-wrap">
        <p className="eyebrow">Welcome to Nivora</p>
        <h1>Password recovery isn’t available yet.</h1>
        <p className="muted">
          This build does not include a password-reset email service.
        </p>

        <DemoNotice>
          No reset email has been sent. Recovery is not available in this
          build, so no password can be changed here. Return to sign in or create
          a new account.
        </DemoNotice>

        <div className="auth-links">
          <a className="button primary" href={loginHref}>
            Back to sign in
          </a>
          <br />
          New here? <a href={registerHref}>Create account</a>
        </div>
      </div>
    );
  }

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitting) return;

    const email = form.email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }

    if (register && form.name.trim().length < 2) {
      setError("Enter your full name.");
      return;
    }
    if (!form.password) {
      setError("Enter your password.");
      return;
    }
    if (register && form.password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    if (register && form.password !== form.confirm) {
      setError("The two passwords do not match.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      if (register) {
        await registerUser({
          name: form.name.trim(),
          email,
          password: form.password,
        });
        setNotice("Account created");
      } else {
        await login({ email, password: form.password });
        setNotice("Signed in");
      }

      location.hash = safeNextPath(nextPath) || "/account";
    } catch (error) {
      setError(
        error?.message ||
          (register
            ? "Unable to create your account. Please try again."
            : "Unable to sign in. Please try again."),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-wrap">
      <p className="eyebrow">Welcome to Nivora</p>
      <h1>
        {register ? "Create your account" : "Good to have you back."}
      </h1>
      <p className="muted">
        {register
          ? "A home for your favourite pieces."
          : "Sign in to see your saved pieces and orders."}
      </p>

      <DemoNotice>
        Sign-in is handled by the Nivora API. Your password is sent only when
        you submit this form, stored as a one-way hash on the server, and never
        kept in browser storage.
      </DemoNotice>

      <div aria-live="polite">
        {error ? (
          <DemoNotice tone="error">{error}</DemoNotice>
        ) : restoreError ? (
          <DemoNotice tone="error">{restoreError}</DemoNotice>
        ) : null}
      </div>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {register && (
          <label>
            Full name
            <input
              type="text"
              autoComplete="name"
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              aria-invalid={Boolean(error && form.name.trim().length < 2)}
            />
          </label>
        )}
        <label>
          Email address
          <input
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
            aria-invalid={Boolean(error)}
          />
        </label>
        <label>
          Password
          <div className="password-field">
            <input
              type={show ? "text" : "password"}
              minLength="8"
              autoComplete={register ? "new-password" : "current-password"}
              value={form.password}
              onChange={(event) =>
                updateField("password", event.target.value)
              }
              aria-invalid={Boolean(error)}
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? "Hide" : "Show"}
            </button>
          </div>
        </label>
        {register && (
          <label>
            Confirm password
            <input
              type={show ? "text" : "password"}
              minLength="8"
              autoComplete="new-password"
              value={form.confirm}
              onChange={(event) => updateField("confirm", event.target.value)}
              aria-invalid={Boolean(error)}
            />
          </label>
        )}
        <button
          type="submit"
          className="button primary full"
          disabled={submitting}
        >
          {submitting
            ? register
              ? "Creating account…"
              : "Signing in…"
            : register
              ? "Create account"
              : "Sign in"}
        </button>
      </form>

      <div className="auth-links">
        {register ? (
          <>Have an account? <a href={loginHref}>Sign in</a></>
        ) : (
          <>
            <a href={recoverHref}>Forgot password?</a>
            <br />
            New here? <a href={registerHref}>Create account</a>
          </>
        )}
      </div>
    </div>
  );
}
function Account({
  session,
  orders,
  ordersStatus,
  ordersError,
  wish,
  onLogout,
}) {
  const latestAddress = orders.find((order) => order.address)?.address;
  const latestOrder = orders[0];

  return (
    <div className="page-container">
      <div className="breadcrumbs">Home / My account</div>
      <p className="eyebrow">Your Nivora</p>
      <h1>Account overview</h1>
      <p className="muted">
        Signed in with your Nivora account. Your password is managed by the
        server.
      </p>

      <div className="account-grid">
        <section className="account-panel">
          <h2>Profile details</h2>
          <p>
            <b>{session.name}</b>
          </p>
          <p>{session.email}</p>
          <p>
            <span className="status-pill">
              {session.role === "admin" ? "Administrator" : "Customer"}
            </span>
          </p>
          <button type="button" className="button outline" onClick={onLogout}>
            Sign out
          </button>
        </section>

        <section className="account-panel">
          <h2>Saved address</h2>
          {latestAddress ? (
            <p>
              {latestAddress.firstName} {latestAddress.lastName}
              <br />
              {latestAddress.address}
              <br />
              {latestAddress.city}, {latestAddress.state}{" "}
              {latestAddress.postalCode}
              <br />
              {latestAddress.country}
            </p>
          ) : (
            <p>
              No address saved yet. The address from your most recent order will
              appear here.
            </p>
          )}
        </section>

        <section className="account-panel">
          <h2>Your orders</h2>
          <p>
            {ordersStatus === "loading" || ordersStatus === "idle"
              ? "Loading your orders…"
              : ordersStatus === "error"
                ? "Your order history could not be loaded right now."
                : `${orders.length} ${
                    orders.length === 1 ? "order" : "orders"
                  } on your account.`}
          </p>
          {ordersStatus === "error" && ordersError && (
            <p className="muted">{ordersError}</p>
          )}
          {latestOrder && (
            <p>
              Latest: <b>{latestOrder.id}</b> · {latestOrder.status}
            </p>
          )}
          <a href="#/orders" className="text-link">
            View order history ↗
          </a>
        </section>

        <section className="account-panel">
          <h2>Saved pieces</h2>
          <p>
            {wish.length} {wish.length === 1 ? "piece" : "pieces"} saved to your
            wishlist.
          </p>
          <a href="#/wishlist" className="text-link">
            View wishlist ↗
          </a>
          {session.role === "admin" && (
            <p className="mt-3">
              <a href="#/admin" className="text-link">
                Open admin workspace ↗
              </a>
            </p>
          )}
        </section>
      </div>

      <DemoNotice className="mt-6">
        Signing out clears the server-issued session cookie. Saved pieces remain
        in this browser until you clear them.
      </DemoNotice>
    </div>
  );
}
function OrdersPage({ orders, status, error, onRetry }) {
  return (
    <div className="page-container">
      <div className="breadcrumbs">Home / Order history</div>
      <p className="eyebrow">Your Nivora</p>
      <h1>Order history</h1>
      <p className="muted">
        Orders placed with your Nivora account. Cash on delivery orders are
        confirmed by the server.
      </p>

      {status === "loading" || status === "idle" ? (
        <div className="empty-state" aria-live="polite">
          <h2>Loading your orders…</h2>
          <p>Fetching your order history from your account.</p>
        </div>
      ) : status === "error" ? (
        <div className="empty-state" role="alert">
          <h2>Your orders could not be loaded.</h2>
          <p>{error || "Check your connection and try again."}</p>
          <button type="button" className="button primary" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : orders.length ? (
        orders.map((order) => (
          <div className="order-row" key={order.id}>
            <div>
              <b>{order.id}</b>
              <small>
                Placed {formatDate(order.createdAt)} ·{" "}
                {(order.items || []).map((item) => item.name).join(", ")}
              </small>
            </div>
            <span className="status-pill">{order.status}</span>
            <b>{currency(order.total)}</b>
            <a className="text-link" href={`#/orders/${order.id}`}>
              View order ↗
            </a>
          </div>
        ))
      ) : (
        <div className="empty-state">
          <h2>No orders yet.</h2>
          <p>Your first order will appear here after checkout.</p>
          <a className="button primary" href="#/products">
            Explore the collection
          </a>
        </div>
      )}
    </div>
  );
}

function OrderDetail({ orderId }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({
    status: "loading",
    order: null,
    error: "",
    notFound: false,
  });

  useEffect(() => {
    if (!orderId) {
      setState({
        status: "not-found",
        order: null,
        error: "",
        notFound: true,
      });
      return undefined;
    }

    const controller = new AbortController();
    let active = true;

    setState({
      status: "loading",
      order: null,
      error: "",
      notFound: false,
    });

    fetchOrderById(orderId, { signal: controller.signal })
      .then((order) => {
        if (!active) return;
        setState({
          status: "ready",
          order,
          error: "",
          notFound: false,
        });
      })
      .catch((error) => {
        if (!active || error?.name === "AbortError") return;

        setState({
          status: error?.status === 404 ? "not-found" : "error",
          order: null,
          error:
            error?.message ||
            "This order could not be loaded. Please try again.",
          notFound: error?.status === 404,
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [orderId, attempt]);

  if (state.status === "loading") {
    return (
      <div className="page-container empty-state" aria-live="polite">
        <p className="eyebrow">Your order</p>
        <h1>Loading order details…</h1>
      </div>
    );
  }

  if (state.status === "not-found") {
    return (
      <div className="page-container empty-state">
        <p className="eyebrow">Order not found</p>
        <h1>We can't find that order.</h1>
        <p>It may not exist, or it may belong to a different account.</p>
        <a className="button primary" href="#/orders">
          Back to order history
        </a>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="page-container empty-state" role="alert">
        <p className="eyebrow">Your order</p>
        <h1>This order could not be loaded.</h1>
        <p>{state.error}</p>
        <button
          type="button"
          className="button primary"
          onClick={() => setAttempt((current) => current + 1)}
        >
          Try again
        </button>
      </div>
    );
  }

  const order = state.order;
  const statusOrder = ["Pending", "Preparing", "Shipped", "Delivered"];
  const steps = ["Order received", "Preparing", "On its way", "Delivered"];
  const currentStep =
    order.status === "Cancelled"
      ? -1
      : Math.max(0, statusOrder.indexOf(order.status));
  const address = order.address || order.shippingAddress;
  const subtotal =
    order.subtotal ??
    (order.items || []).reduce(
      (total, item) => total + item.price * item.qty,
      0,
    );

  return (
    <div className="page-container">
      <div className="breadcrumbs">
        Home / <a href="#/orders">Order history</a> / {order.id}
      </div>
      <p className="eyebrow">Your order</p>
      <h1>Order {order.id}</h1>
      <p className="muted">
        Placed {formatDate(order.createdAt)} ·{" "}
        {order.customer || order.email || "Nivora customer"}
      </p>

      {order.status === "Cancelled" ? (
        <DemoNotice tone="error">
          This order is marked as cancelled.
        </DemoNotice>
      ) : (
        <div className="order-progress">
          {steps.map((step, index) => (
            <span className={index <= currentStep ? "done" : ""} key={step}>
              {step}
            </span>
          ))}
        </div>
      )}

      <div className="order-detail-grid">
        <section className="account-panel">
          <h2>Items</h2>
          {(order.items || []).map((item, index) => (
            <p key={`${item.id || item.name}-${index}`}>
              {item.name} × {item.qty}{" "}
              <b>{currency(item.price * item.qty)}</b>
            </p>
          ))}
          <div className="mt-5 border-t border-[var(--line)] pt-4 text-[11px]">
            <p className="flex justify-between gap-4">
              <span>Subtotal</span>
              <b>{currency(subtotal)}</b>
            </p>
            <p className="flex justify-between gap-4">
              <span>Shipping</span>
              <b>
                {order.shipping ? currency(order.shipping) : "Complimentary"}
              </b>
            </p>
            {order.discount > 0 && (
              <p className="flex justify-between gap-4 text-[var(--olive)]">
                <span>Discount</span>
                <b>−{currency(order.discount)}</b>
              </p>
            )}
            {order.couponCode && (
              <p className="flex justify-between gap-4">
                <span>Coupon</span>
                <b>{order.couponCode}</b>
              </p>
            )}
          </div>
        </section>

        <section className="account-panel">
          <h2>Delivery address</h2>
          {address ? (
            <p>
              {address.firstName} {address.lastName}
              <br />
              {address.address}
              <br />
              {address.city}, {address.state} {address.postalCode}
              <br />
              {address.country}
            </p>
          ) : (
            <p>Address not recorded for this order.</p>
          )}
          <h2>Payment status</h2>
          <p>
            {order.payment || "Cash on delivery"} ·{" "}
            {order.paymentStatus || "Pending"}
          </p>
          <p>Order status: {order.status}</p>
        </section>
      </div>

      <p className="summary-total">
        Total <b>{currency(order.total)}</b>
      </p>
      <p className="muted">
        This order detail was loaded from your Nivora account.
      </p>
    </div>
  );
}
function Benefits() {
  return (
    <section className="benefits">
      <div>
        <span>01</span>
        <b>Chosen with care</b>
        <small>Every piece earns its place.</small>
      </div>
      <div>
        <span>02</span>
        <b>Useful by nature</b>
        <small>Good design for everyday life.</small>
      </div>
      <div>
        <span>03</span>
        <b>Across India</b>
        <small>Careful delivery to your door.</small>
      </div>
    </section>
  );
}
function Footer({ setNotice }) {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div>
          <Brand />
          <p>
            Thoughtful things for
            <br />
            the way you live.
          </p>
        </div>
        <div>
          <h3>Explore</h3>
          <a href="#/products">Shop all</a>
          <a href="#/products?category=Decor">Objects & decor</a>
          <a href="#/products?category=Lighting">Lighting</a>
          <a href="#/products?category=Dining">Dining</a>
        </div>
        <div>
          <h3>Help & account</h3>
          <a href="#/account">My account</a>
          <a href="#/orders">Order history</a>
          <a href="#/wishlist">Saved pieces</a>
          <a href="#/login">Sign in</a>
        </div>
        <div className="newsletter">
          <h3>A slower note.</h3>
          <p>Occasional stories and new finds, from us to you.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setNotice("Newsletter signup will connect to the email service");
            }}
          >
            <input
              type="email"
              required
              placeholder="Your email address"
              aria-label="Email for newsletter"
            />
            <button aria-label="Subscribe">↗</button>
          </form>
          <small>Newsletter delivery requires backend integration.</small>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 Nivora · Demonstration storefront</span>
        <span>Payments, fulfilment and account services connect later.</span>
      </div>
      <a className="admin-entry" href="#/admin">
        Store admin
      </a>
    </footer>
  );
}
const ADMIN_SECTIONS = {
  products: {
    title: "Products",
    caption:
      "Manage the live catalogue. Archived products stay linked to past orders.",
    note: "Products are archived (set to Draft) instead of deleted, so historical orders keep their references.",
    statuses: [
      ["Active", "Active"],
      ["Draft", "Archived"],
    ],
    columns: [
      { label: "Product", sort: "name" },
      { label: "Category", sort: "category" },
      { label: "Price", sort: "price" },
      { label: "Stock", sort: "stock" },
      { label: "Status", sort: "status" },
    ],
  },
  orders: {
    title: "Orders",
    caption:
      "Inspect orders and move them through the allowed fulfilment steps.",
    note: "Order totals, item snapshots and payment status are read-only. Only the listed status transitions are allowed.",
    statuses: [
      ["Pending", "Pending"],
      ["Preparing", "Preparing"],
      ["Shipped", "Shipped"],
      ["Delivered", "Delivered"],
      ["Cancelled", "Cancelled"],
    ],
    columns: [
      { label: "Order", sort: "id" },
      { label: "Customer", sort: "customer" },
      { label: "Date", sort: "createdAt" },
      { label: "Total", sort: "total" },
      { label: "Status", sort: "status" },
      { label: "Payment", sort: "paymentStatus" },
    ],
  },
  users: {
    title: "Customers",
    caption:
      "Only the account fields the workspace needs are returned by the server.",
    note: "Password hashes and secrets are never returned. Self-demotion, self-suspension and removal of the last active administrator are blocked.",
    statuses: [
      ["active", "Active"],
      ["suspended", "Suspended"],
    ],
    columns: [
      { label: "Name", sort: "name" },
      { label: "Email", sort: "email" },
      { label: "Joined", sort: "joinedAt" },
      { label: "Role", sort: "role" },
      { label: "Status", sort: "status" },
    ],
  },
  coupons: {
    title: "Coupons",
    caption:
      "Create and retire discount codes. Usage is recorded by orders, not edited here.",
    note: "Coupons are deactivated instead of deleted. Usage counts and order totals cannot be changed from this workspace.",
    statuses: [
      ["active", "Active"],
      ["inactive", "Inactive"],
    ],
    columns: [
      { label: "Code", sort: "code" },
      { label: "Type", sort: "discountType" },
      { label: "Value", sort: "amount" },
      { label: "Expiry", sort: "expiresAt" },
      { label: "Minimum", sort: "minimumOrder" },
      { label: "Status", sort: "status" },
    ],
  },
};

const ADMIN_STATUS_LABELS = {
  products: { Active: "Active", Draft: "Archived" },
  orders: {
    Pending: "Pending",
    Preparing: "Preparing",
    Shipped: "Shipped",
    Delivered: "Delivered",
    Cancelled: "Cancelled",
  },
  users: { active: "Active", suspended: "Suspended" },
  coupons: { active: "Active", inactive: "Inactive" },
};

const adminSectionKey = (route) => {
  const normalized = String(route || "").replace(/\/+$/, "") || "/";
  if (normalized === "/admin/products") return "products";
  if (normalized === "/admin/orders") return "orders";
  if (normalized === "/admin/users") return "users";
  if (normalized === "/admin/coupons") return "coupons";
  return "dashboard";
};

const adminStatusLabel = (section, status) =>
  ADMIN_STATUS_LABELS[section]?.[status] || status || "—";

const adminRoleLabel = (role) =>
  role === "admin" ? "Administrator" : "Customer";

const adminDiscountLabel = (type) =>
  type === "percentage" ? "Percentage" : "Fixed amount";

const adminDate = (value) => (value ? formatDate(value) : "—");

const adminDateInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

function Admin({ route, session, setNotice, categories, onCatalogueChanged }) {
  const sectionKey = adminSectionKey(route);
  const isDashboard = sectionKey === "dashboard";
  const section = isDashboard ? null : ADMIN_SECTIONS[sectionKey];
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortKey, setSortKey] = useState("");
  const [sortDirection, setSortDirection] = useState("asc");
  const [range, setRange] = useState("This month");
  const [editor, setEditor] = useState(null);
  const [busyId, setBusyId] = useState("");
  const [actionError, setActionError] = useState("");
  const workspace = useAdminWorkspace({
    route,
    range,
    search,
    status: statusFilter,
    sort: sortKey,
    direction: sortKey ? sortDirection : "",
  });

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  };

  const handleSaved = (message, { catalogue = false } = {}) => {
    setNotice(message);
    setEditor(null);
    setActionError("");
    workspace.refresh();

    if (catalogue) {
      onCatalogueChanged();
    }
  };

  const archiveProduct = async (row) => {
    if (
      !window.confirm(
        `Archive ${row.name}? It will disappear from the storefront but stay linked to past orders.`,
      )
    ) {
      return;
    }

    setBusyId(row.id);
    setActionError("");

    try {
      await deactivateAdminProduct(row.id);
      setNotice(`${row.name} archived`);
      onCatalogueChanged();
      workspace.refresh();
    } catch (error) {
      setActionError(error?.message || "The product could not be archived.");
    } finally {
      setBusyId("");
    }
  };

  const deactivateCoupon = async (row) => {
    if (!window.confirm(`Deactivate coupon ${row.code}?`)) return;

    setBusyId(row.id);
    setActionError("");

    try {
      await deactivateAdminCoupon(row.id);
      setNotice(`Coupon ${row.code} deactivated`);
      workspace.refresh();
    } catch (error) {
      setActionError(error?.message || "The coupon could not be deactivated.");
    } finally {
      setBusyId("");
    }
  };

  const title = isDashboard ? "Overview" : section.title;
  const recordsLabel = `${workspace.total} record${
    workspace.total === 1 ? "" : "s"
  }`;

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <a href="#/" className="admin-brand">
          <Brand />
          <small>STUDIO</small>
        </a>
        <p>WORKSPACE</p>
        <a
          className={sectionKey === "dashboard" ? "current" : ""}
          href="#/admin"
        >
          ▦　Overview
        </a>
        <a
          className={route.includes("products") ? "current" : ""}
          href="#/admin/products"
        >
          ◇　Products
        </a>
        <a
          className={route.includes("orders") ? "current" : ""}
          href="#/admin/orders"
        >
          ▤　Orders
        </a>
        <a
          className={route.includes("users") ? "current" : ""}
          href="#/admin/users"
        >
          ♧　Customers
        </a>
        <a
          className={route.includes("coupons") ? "current" : ""}
          href="#/admin/coupons"
        >
          ⌑　Coupons
        </a>
        <div className="admin-sidebar-bottom">
          <a href="#/">← View storefront</a>
          <small>{session.email}</small>
          <small>Protected workspace</small>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <button
            type="button"
            className="icon-btn admin-menu"
            aria-label="Toggle admin navigation"
            onClick={() =>
              document
                .querySelector(".admin-sidebar")
                ?.classList.toggle("mobile-open")
            }
          >
            ☰
          </button>
          <span>Nivora / {title}</span>
          <span className="admin-avatar">
            {session.name.charAt(0).toUpperCase()}
          </span>
        </header>
        <div className="admin-content">
          <div className="admin-heading">
            <div>
              <p className="eyebrow">NIVORA STUDIO · LIVE DATA</p>
              <h1>{title}</h1>
              <p className="muted">
                {isDashboard
                  ? "A server-calculated summary of the selected period."
                  : section.caption}
              </p>
            </div>
            {isDashboard && (
              <select
                aria-label="Dashboard date range"
                value={range}
                onChange={(event) => setRange(event.target.value)}
              >
                <option>This month</option>
                <option>Last month</option>
                <option>Last 90 days</option>
              </select>
            )}
            {sectionKey === "products" && (
              <button
                type="button"
                className="button primary"
                onClick={() => setEditor({ type: "product", row: null })}
              >
                ＋ Add product
              </button>
            )}
            {sectionKey === "coupons" && (
              <button
                type="button"
                className="button primary"
                onClick={() => setEditor({ type: "coupon", row: null })}
              >
                ＋ Create coupon
              </button>
            )}
          </div>
          {!isDashboard && <DemoNotice>{section.note}</DemoNotice>}
          {actionError && (
            <DemoNotice tone="error">{actionError}</DemoNotice>
          )}
          {isDashboard &&
            workspace.status === "loading" &&
            workspace.summary && (
              <p className="muted">Updating summary…</p>
            )}
          {isDashboard ? (
            workspace.status === "error" ? (
              <div className="empty-state">
                <h2>Could not load the overview</h2>
                <p>{workspace.error}</p>
                <button
                  type="button"
                  className="button primary"
                  onClick={workspace.retry}
                >
                  Try again
                </button>
              </div>
            ) : workspace.summary ? (
              <Dashboard summary={workspace.summary} />
            ) : (
              <div className="empty-state">
                <h2>Loading overview…</h2>
              </div>
            )
          ) : (
            <>
              <div className="table-tools">
                <input
                  aria-label={`Search ${title.toLowerCase()}`}
                  placeholder={`Search ${title.toLowerCase()}…`}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <select
                  aria-label={`Filter ${title.toLowerCase()} by status`}
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="">All statuses</option>
                  {section.statuses.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <span>
                  {workspace.status === "loading"
                    ? "Loading…"
                    : recordsLabel}
                </span>
              </div>
              {workspace.status === "error" && (
                <div className="empty-state">
                  <h2>Could not load {title.toLowerCase()}</h2>
                  <p>{workspace.error}</p>
                  <button
                    type="button"
                    className="button primary"
                    onClick={workspace.retry}
                  >
                    Try again
                  </button>
                </div>
              )}
              {workspace.status === "loading" &&
                workspace.items.length === 0 && (
                  <div className="empty-state">
                    <h2>Loading {title.toLowerCase()}…</h2>
                  </div>
                )}
              {workspace.status === "ready" &&
                workspace.items.length === 0 && (
                  <div className="empty-state">
                    <h2>
                      {search || statusFilter
                        ? "No records match."
                        : `No ${title.toLowerCase()} yet.`}
                    </h2>
                  </div>
                )}
              {workspace.items.length > 0 && (
                <div className="data-table-wrap">
                  <table className="data-table">
                    <caption className="sr-only">
                      {title} loaded from the protected admin API
                    </caption>
                    <thead>
                      <tr>
                        {section.columns.map((column) => (
                          <th key={column.sort}>
                            <button
                              type="button"
                              onClick={() => toggleSort(column.sort)}
                              aria-label={`Sort by ${column.label}`}
                            >
                              {column.label}{" "}
                              {sortKey === column.sort
                                ? sortDirection === "asc"
                                  ? "↑"
                                  : "↓"
                                : "↕"}
                            </button>
                          </th>
                        ))}
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workspace.items.map((row) => (
                        <tr key={row.id}>
                          {sectionKey === "products" ? (
                            <>
                              <td className="table-product">
                                <img
                                  src={row.image || FALLBACK_IMAGE}
                                  alt=""
                                  onError={(event) => {
                                    event.currentTarget.src = FALLBACK_IMAGE;
                                  }}
                                />
                                <span>
                                  {row.name}
                                  <small>
                                    {row.sku} · {row.productId}
                                  </small>
                                </span>
                              </td>
                              <td>{row.category || "—"}</td>
                              <td>{currency(row.price)}</td>
                              <td>{row.stock}</td>
                              <td>
                                <span className="status-pill">
                                  {adminStatusLabel(sectionKey, row.status)}
                                </span>
                              </td>
                            </>
                          ) : sectionKey === "orders" ? (
                            <>
                              <td>{row.id}</td>
                              <td>{row.customer || "—"}</td>
                              <td>{adminDate(row.createdAt)}</td>
                              <td>{currency(row.total)}</td>
                              <td>
                                <span className="status-pill">
                                  {adminStatusLabel(sectionKey, row.status)}
                                </span>
                              </td>
                              <td>{row.paymentStatus || "Pending"}</td>
                            </>
                          ) : sectionKey === "users" ? (
                            <>
                              <td>{row.name}</td>
                              <td>{row.email}</td>
                              <td>{adminDate(row.joinedAt || row.createdAt)}</td>
                              <td>{adminRoleLabel(row.role)}</td>
                              <td>
                                <span className="status-pill">
                                  {adminStatusLabel(sectionKey, row.status)}
                                </span>
                              </td>
                            </>
                          ) : (
                            <>
                              <td>{row.code}</td>
                              <td>{adminDiscountLabel(row.discountType)}</td>
                              <td>
                                {row.discountType === "percentage"
                                  ? `${row.amount}%`
                                  : currency(row.amount)}
                              </td>
                              <td>
                                {row.expiresAt
                                  ? formatDate(row.expiresAt)
                                  : "No expiry"}
                              </td>
                              <td>{currency(row.minimumOrder)}</td>
                              <td>
                                <span className="status-pill">
                                  {adminStatusLabel(sectionKey, row.status)}
                                </span>
                              </td>
                            </>
                          )}
                          <td>
                            <button
                              type="button"
                              className="table-action"
                              onClick={() =>
                                setEditor({ type: sectionKey, row })
                              }
                            >
                              {sectionKey === "orders"
                                ? "Inspect"
                                : sectionKey === "users"
                                  ? "Manage"
                                  : "Edit"}
                            </button>
                            {sectionKey === "products" &&
                              row.status !== "Draft" && (
                                <button
                                  type="button"
                                  className="table-action danger"
                                  disabled={busyId === row.id}
                                  onClick={() => archiveProduct(row)}
                                >
                                  {busyId === row.id
                                    ? "Archiving…"
                                    : "Archive"}
                                </button>
                              )}
                            {sectionKey === "coupons" &&
                              row.status === "active" && (
                                <button
                                  type="button"
                                  className="table-action danger"
                                  disabled={busyId === row.id}
                                  onClick={() => deactivateCoupon(row)}
                                >
                                  {busyId === row.id
                                    ? "Deactivating…"
                                    : "Deactivate"}
                                </button>
                              )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {editor && (
        <AdminModal
          type={editor.type}
          row={editor.row}
          categories={categories}
          session={session}
          close={() => setEditor(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

function Dashboard({ summary }) {
  const orders = summary.orders || {};
  const products = summary.products || {};
  const users = summary.users || {};
  const coupons = summary.coupons || {};
  const statusOrder = [
    "Pending",
    "Preparing",
    "Shipped",
    "Delivered",
    "Cancelled",
  ];
  const statusCounts = statusOrder.map((status) => [
    status,
    Number(orders.byStatus?.[status] || 0),
  ]);
  const maxStatus = Math.max(1, ...statusCounts.map(([, count]) => count));
  const daily = Array.isArray(orders.byDay) ? orders.byDay : [];
  const maxDaily = Math.max(1, ...daily.map((day) => Number(day.count) || 0));
  const weeklyOrders = daily.reduce(
    (total, day) => total + Number(day.count || 0),
    0,
  );
  const recent = Array.isArray(orders.recent) ? orders.recent : [];
  const topProducts = Array.isArray(summary.topProducts)
    ? summary.topProducts
    : [];
  const stats = [
    [
      "Gross sales",
      currency(orders.grossSales || 0),
      "Excludes cancelled orders",
    ],
    [
      "Orders",
      String(orders.total || 0),
      `${orders.completedOrders || 0} non-cancelled in range`,
    ],
    [
      "Average order",
      currency(orders.averageOrder || 0),
      "Average of non-cancelled orders",
    ],
    [
      "Active products",
      String(products.active || 0),
      `${products.archived || 0} archived · ${products.categories || 0} collections`,
    ],
  ];

  return (
    <>
      <div className="kpi-grid">
        {stats.map(([label, value, detail]) => (
          <div className="kpi-card" key={label}>
            <span>{label}</span>
            <b>{value}</b>
            <small>{detail}</small>
          </div>
        ))}
      </div>
      <p className="muted" style={{ marginTop: 10 }}>
        {users.total || 0} accounts · {users.admins || 0} active
        administrators · {coupons.active || 0} active coupons
      </p>
      <div className="charts-grid">
        <section className="chart-panel">
          <div className="chart-head">
            <div>
              <h2>Orders by status</h2>
              <small>Server summary for the selected range</small>
            </div>
            <span>{orders.total || 0} orders</span>
          </div>
          <div className="bar-chart">
            {statusCounts.map(([status, count]) => (
              <div className="bar-column" key={status}>
                <div
                  style={{
                    height: `${Math.max(6, Math.round((count / maxStatus) * 100))}%`,
                  }}
                />
                <small>{status}</small>
              </div>
            ))}
          </div>
        </section>
        <section className="chart-panel activity-panel">
          <h2>Order activity</h2>
          <small>Orders created in the last 7 days</small>
          <div className="activity-bars">
            {daily.map((day) => (
              <div key={day.date}>
                <div
                  style={{
                    height: `${Math.max(6, Math.round(((Number(day.count) || 0) / maxDaily) * 100))}%`,
                  }}
                />
                <small>{day.label}</small>
              </div>
            ))}
          </div>
          <div className="activity-legend">
            <span />
            Orders this week <b>{weeklyOrders}</b>
          </div>
        </section>
      </div>
      <div className="admin-lower">
        <section className="chart-panel">
          <div className="chart-head">
            <h2>Recent orders</h2>
            <a href="#/admin/orders">View all ↗</a>
          </div>
          {recent.map((order) => (
            <div className="mini-row" key={order.id}>
              <span>
                {order.id}
                <small>{order.customer || "Customer"}</small>
              </span>
              <span className="status-pill">{order.status}</span>
              <b>{currency(order.total)}</b>
            </div>
          ))}
          {!recent.length && (
            <p className="muted">No orders in this range yet.</p>
          )}
        </section>
        <section className="chart-panel">
          <div className="chart-head">
            <h2>Top pieces</h2>
            <a href="#/admin/products">Catalogue ↗</a>
          </div>
          {topProducts.map((product, index) => (
            <div className="mini-row" key={product.id}>
              <span className="rank">0{index + 1}</span>
              <span>
                {product.name}
                <small>{product.category || "Uncategorised"}</small>
              </span>
              <b>{product.stock} in stock</b>
            </div>
          ))}
          {!topProducts.length && (
            <p className="muted">No active products yet.</p>
          )}
        </section>
      </div>
    </>
  );
}

function AdminModal({ type, row, categories, session, close, onSaved }) {
  const edit = row;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const categoryNames = categories.map((category) => category.name);

  if (edit?.category && !categoryNames.includes(edit.category)) {
    categoryNames.unshift(edit.category);
  }

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") close();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [close]);

  const title =
    type === "product"
      ? edit
        ? "Edit product"
        : "Add a product"
      : type === "coupon"
        ? edit
          ? "Edit coupon"
          : "Create coupon"
        : type === "order"
          ? "Order details and status"
          : type === "user"
            ? "Manage customer"
            : "Record details";

  const save = async (event, action) => {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      await action(new FormData(event.currentTarget));
    } catch (caught) {
      setError(caught?.message || "The change could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) =>
        event.target === event.currentTarget && close()
      }
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <button
          type="button"
          className="modal-close"
          onClick={close}
          aria-label="Close dialog"
        >
          ×
        </button>
        <p className="eyebrow">Nivora Studio · protected</p>
        <h2 id="modal-title">{title}</h2>
        {error && <DemoNotice tone="error">{error}</DemoNotice>}

        {type === "product" ? (
          <form
            onSubmit={(event) =>
              save(event, async (data) => {
                const image = String(data.get("image") || "").trim();
                const payload = {
                  name: String(data.get("name") || "").trim(),
                  description: String(data.get("description") || "").trim(),
                  category: String(data.get("category") || ""),
                  price: Number(data.get("price")),
                  compareAtPrice: data.get("compareAtPrice")
                    ? Number(data.get("compareAtPrice"))
                    : null,
                  stock: Number(data.get("stock")),
                  sku: String(data.get("sku") || "").trim(),
                  status: String(data.get("status") || "Active"),
                  material: String(data.get("material") || "").trim(),
                  featured: data.get("featured") === "on",
                  image,
                };
                const record = edit
                  ? await updateAdminProduct(edit.id, payload)
                  : await createAdminProduct(payload);

                onSaved(
                  `${record.name} ${edit ? "updated" : "created"}.`,
                  { catalogue: true },
                );
              })
            }
          >
            <label>
              Product name
              <input
                name="name"
                required
                maxLength={160}
                defaultValue={edit?.name}
                autoFocus
              />
            </label>
            <label>
              Description
              <textarea
                name="description"
                required
                maxLength={4000}
                defaultValue={edit?.description}
              />
            </label>
            <div className="field-grid">
              <label>
                Price (₹)
                <input
                  name="price"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  defaultValue={edit?.price ?? ""}
                />
              </label>
              <label>
                Compare at (₹)
                <input
                  name="compareAtPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={edit?.compareAtPrice ?? ""}
                />
              </label>
              <label>
                Category
                <select
                  name="category"
                  required
                  defaultValue={edit?.category || categoryNames[0] || ""}
                >
                  {!categoryNames.length && (
                    <option value="">No active categories</option>
                  )}
                  {categoryNames.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                SKU
                <input
                  name="sku"
                  required
                  maxLength={60}
                  defaultValue={edit?.sku}
                />
              </label>
              <label>
                Stock
                <input
                  name="stock"
                  type="number"
                  min="0"
                  step="1"
                  required
                  defaultValue={edit?.stock ?? 0}
                />
              </label>
              <label>
                Status
                <select name="status" defaultValue={edit?.status || "Active"}>
                  <option value="Active">Active</option>
                  <option value="Draft">Draft (hidden)</option>
                </select>
              </label>
              <label>
                Material
                <input
                  name="material"
                  maxLength={200}
                  defaultValue={edit?.material}
                />
              </label>
              <label className="radio-row">
                <input
                  name="featured"
                  type="checkbox"
                  defaultChecked={Boolean(edit?.featured)}
                />
                Featured on homepage
                <small>Appears in the featured collection when active.</small>
              </label>
            </div>
            <label>
              Image URL
              <input
                name="image"
                type="url"
                required
                maxLength={2048}
                defaultValue={edit?.image}
                placeholder="https://images.example.com/product.jpg"
              />
              <small>
                Use an existing HTTPS image URL. Uploads are not connected.
              </small>
            </label>
            <div className="modal-actions">
              <button type="button" className="button outline" onClick={close}>
                Cancel
              </button>
              <button type="submit" className="button primary" disabled={busy}>
                {busy ? "Saving…" : "Save product"}
              </button>
            </div>
          </form>
        ) : type === "coupon" ? (
          <form
            onSubmit={(event) =>
              save(event, async (data) => {
                const expiry = String(data.get("expiresAt") || "");
                const usageLimit = String(data.get("usageLimit") || "");
                const payload = {
                  code: String(data.get("code") || "").trim().toUpperCase(),
                  description: String(data.get("description") || "").trim(),
                  discountType: String(data.get("discountType") || "percentage"),
                  amount: Number(data.get("amount")),
                  minimumOrder: Number(data.get("minimumOrder")) || 0,
                  expiresAt: expiry
                    ? new Date(`${expiry}T23:59:59`).toISOString()
                    : null,
                  usageLimit: usageLimit ? Number(usageLimit) : null,
                  status: String(data.get("status") || "active"),
                };
                const record = edit
                  ? await updateAdminCoupon(edit.id, payload)
                  : await createAdminCoupon(payload);

                onSaved(
                  `Coupon ${record.code} ${edit ? "updated" : "created"}.`,
                );
              })
            }
          >
            <label>
              Coupon code
              <input
                name="code"
                required
                maxLength={40}
                defaultValue={edit?.code}
                autoFocus
              />
            </label>
            <label>
              Description
              <input
                name="description"
                maxLength={200}
                defaultValue={edit?.description}
              />
            </label>
            <div className="field-grid">
              <label>
                Discount type
                <select
                  name="discountType"
                  defaultValue={edit?.discountType || "percentage"}
                >
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed amount</option>
                </select>
              </label>
              <label>
                Discount value
                <input
                  name="amount"
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={edit?.amount ?? ""}
                />
              </label>
              <label>
                Expiration date
                <input
                  name="expiresAt"
                  type="date"
                  defaultValue={adminDateInputValue(edit?.expiresAt)}
                />
              </label>
              <label>
                Minimum order (₹)
                <input
                  name="minimumOrder"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={edit?.minimumOrder ?? 0}
                />
              </label>
              <label>
                Usage limit
                <input
                  name="usageLimit"
                  type="number"
                  min="1"
                  step="1"
                  defaultValue={edit?.usageLimit ?? ""}
                />
              </label>
              <label>
                Status
                <select
                  name="status"
                  defaultValue={edit?.status || "active"}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>
            {edit && (
              <p className="muted">
                Used {edit.usedCount || 0} time
                {edit.usedCount === 1 ? "" : "s"}. Usage is recorded by orders
                and cannot be edited here.
              </p>
            )}
            <div className="modal-actions">
              <button type="button" className="button outline" onClick={close}>
                Cancel
              </button>
              <button type="submit" className="button primary" disabled={busy}>
                {busy ? "Saving…" : "Save coupon"}
              </button>
            </div>
          </form>
        ) : type === "order" ? (
          <form
            onSubmit={(event) =>
              save(event, async (data) => {
                const nextStatus = String(data.get("status") || edit.status);

                if (nextStatus === edit.status) {
                  onSaved(`Order ${edit.id} left unchanged.`);
                  return;
                }

                await updateAdminOrderStatus(edit.id, nextStatus);
                onSaved(`Order ${edit.id} moved to ${nextStatus}.`);
              })
            }
          >
            <p>
              <b>{edit.id}</b> · {adminDate(edit.createdAt)}
            </p>
            <p>
              {edit.customerDetails?.name || edit.customer || "Customer"}
              {edit.customerDetails?.email ? (
                <>
                  <br />
                  {edit.customerDetails.email}
                </>
              ) : null}
              {edit.customerDetails?.phone ? (
                <>
                  <br />
                  {edit.customerDetails.phone}
                </>
              ) : null}
            </p>
            {edit.address ? (
              <p>
                {edit.address.firstName} {edit.address.lastName}
                <br />
                {edit.address.address}
                <br />
                {edit.address.city}, {edit.address.state}{" "}
                {edit.address.postalCode}
                <br />
                {edit.address.country}
              </p>
            ) : (
              <p>No shipping address recorded.</p>
            )}
            <div>
              <p>
                <b>Items</b>
              </p>
              {(edit.items || []).map((item) => (
                <p
                  className="muted"
                  key={`${item.id}-${item.sku}-${item.name}`}
                >
                  {item.name} × {item.quantity} — {currency(item.lineTotal)}
                </p>
              ))}
              {!(edit.items || []).length && (
                <p className="muted">No line items recorded.</p>
              )}
            </div>
            <p className="muted">
              Subtotal {currency(edit.subtotal || 0)} · Discount{" "}
              {currency(edit.discount || 0)} · Shipping{" "}
              {currency(edit.shipping || 0)} ·{" "}
              <b>Total {currency(edit.total || 0)}</b>
            </p>
            <p className="muted">
              Payment method: {edit.paymentMethod || "Not recorded"}
              {edit.couponCode ? ` · Coupon ${edit.couponCode}` : ""}
            </p>
            <div className="field-grid">
              <label>
                Order status
                <select
                  name="status"
                  defaultValue={edit.status || "Pending"}
                  disabled={
                    !(edit.allowedTransitions || []).length
                  }
                >
                  {[edit.status, ...(edit.allowedTransitions || [])]
                    .filter(
                      (status, index, list) =>
                        status && list.indexOf(status) === index,
                    )
                    .map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Payment status (read-only)
                <input
                  value={edit.paymentStatus || "Pending"}
                  disabled
                  readOnly
                />
              </label>
            </div>
            {!(edit.allowedTransitions || []).length && (
              <DemoNotice>
                No further status changes are allowed for this order.
              </DemoNotice>
            )}
            <div className="modal-actions">
              <button type="button" className="button outline" onClick={close}>
                Cancel
              </button>
              <button
                type="submit"
                className="button primary"
                disabled={busy || !(edit.allowedTransitions || []).length}
              >
                {busy ? "Saving…" : "Save order status"}
              </button>
            </div>
          </form>
        ) : type === "user" ? (
          <form
            onSubmit={(event) =>
              save(event, async (data) => {
                const role = String(data.get("role") || edit.role);
                const status = String(data.get("status") || edit.status);
                await updateAdminUser(edit.id, { role, status });
                onSaved(`${edit.name} updated.`);
              })
            }
          >
            <p>
              <b>{edit.name}</b>
              <br />
              {edit.email}
              <br />
              Joined {adminDate(edit.joinedAt || edit.createdAt)}
              {edit.lastLoginAt ? (
                <>
                  <br />
                  Last signed in {adminDate(edit.lastLoginAt)}
                </>
              ) : null}
            </p>
            {String(edit.id) === String(session.id) && (
              <DemoNotice>
                This is your own account. Your administrator role and active
                status cannot be removed here.
              </DemoNotice>
            )}
            <div className="field-grid">
              <label>
                Role
                <select
                  name="role"
                  defaultValue={edit.role || "customer"}
                  disabled={String(edit.id) === String(session.id)}
                >
                  <option value="customer">Customer</option>
                  <option value="admin">Administrator</option>
                </select>
              </label>
              <label>
                Status
                <select
                  name="status"
                  defaultValue={edit.status || "active"}
                  disabled={String(edit.id) === String(session.id)}
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="button outline" onClick={close}>
                Cancel
              </button>
              <button
                type="submit"
                className="button primary"
                disabled={busy || String(edit.id) === String(session.id)}
              >
                {busy ? "Saving…" : "Save customer"}
              </button>
            </div>
          </form>
        ) : (
          <div>
            <p>This record cannot be edited here.</p>
            <button type="button" className="button outline" onClick={close}>
              Close
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function NotFound() {
  return (
    <div className="empty-state not-found">
      <p className="eyebrow">A little off the map</p>
      <h1>We can't find that page.</h1>
      <p>The page may have moved. The good things are still here.</p>
      <a href="#/" className="button primary">
        Back to Nivora
      </a>
    </div>
  );
}

export default App;
