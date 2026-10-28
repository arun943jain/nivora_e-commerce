import { useEffect, useMemo, useState } from "react";
import { categories, products, orders, users, coupons } from "./data/store.js";
import DemoGate from "./components/DemoGate.jsx";
import DemoNotice from "./components/DemoNotice.jsx";
import OrderConfirmation from "./components/OrderConfirmation.jsx";
import "./App.css";

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
const formatDate = (value = new Date()) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
const slugify = (value) =>
  String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
const decodeSegment = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};
const couponDiscount = (code, subtotal, couponList) => {
  const normalized = String(code || "").trim().toUpperCase();
  if (!normalized) return 0;
  const coupon = couponList.find((item) => item.code.toUpperCase() === normalized);
  if (!coupon || coupon.status !== "Active") return 0;
  if (subtotal < Number(coupon.minimum || 0)) return 0;
  if (coupon.expiry && new Date(coupon.expiry) < new Date()) return 0;

  const raw = String(coupon.value);
  if (raw.includes("%")) {
    const percentage = Number.parseFloat(raw.replace(/[^\d.]/g, "")) || 0;
    return Math.round((subtotal * percentage) / 100);
  }
  const amount = Number(raw.replace(/[^\d.]/g, "")) || 0;
  return Math.min(subtotal, amount);
};

function App() {
  const [route, setRoute] = useState(location.hash.slice(1) || "/");
  const [dark, setDark] = useState(
    () => localStorage.getItem("nivora-theme") === "dark",
  );
  const [cart, setCart] = useState(() => read("nivora-cart", []));
  const [wish, setWish] = useState(() => read("nivora-wishlist", []));
  const [query, setQuery] = useState("");
  const [mobile, setMobile] = useState(false);
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState(null);
  const [modal, setModal] = useState("");
  const [coupon, setCoupon] = useState("");
  const [sort, setSort] = useState("featured");
  const [category, setCategory] = useState(() => {
    const cat = new URLSearchParams(
      location.hash.slice(1).split("?")[1] || "",
    ).get("category");
    return categories.some((c) => c.name === cat) ? cat : "All";
  });
  const [minPrice, setMinPrice] = useState(0);
  const [range, setRange] = useState("This month");
  const [productList, setProductList] = useState(() =>
    read("nivora-admin-products", products),
  );
  const [orderList, setOrderList] = useState(() =>
    read("nivora-orders", orders),
  );
  const [userList, setUserList] = useState(() => read("nivora-users", users));
  const [couponList, setCouponList] = useState(() =>
    read("nivora-coupons", coupons),
  );
  const [reviews, setReviews] = useState(() => read("nivora-reviews", {}));
  const [session, setSession] = useState(() => read("nivora-session", null));

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
    localStorage.setItem("nivora-theme", dark ? "dark" : "light");
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);
  useEffect(() => save("nivora-cart", cart), [cart]);
  useEffect(() => save("nivora-wishlist", wish), [wish]);
  useEffect(() => save("nivora-admin-products", productList), [productList]);
  useEffect(() => save("nivora-orders", orderList), [orderList]);
  useEffect(() => save("nivora-users", userList), [userList]);
  useEffect(() => save("nivora-coupons", couponList), [couponList]);
  useEffect(() => save("nivora-reviews", reviews), [reviews]);
  useEffect(() => save("nivora-session", session), [session]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  const go = (next) => {
    location.hash = next;
  };
  const add = (id, qty = 1) => {
    const product = productList.find((item) => item.id === id);
    if (!product || product.stock <= 0) {
      setNotice("This piece is currently out of stock");
      return;
    }
    const existing = cart.find((item) => item.id === id)?.qty || 0;
    if (existing >= product.stock) {
      setNotice(`Only ${product.stock} available in this demo`);
      return;
    }
    const nextQty = Math.min(product.stock, existing + qty);
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
  const remove = (id) => {
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
  const quantity = (id, delta) => {
    const max = productList.find((item) => item.id === id)?.stock || 1;
    setCart((items) =>
      items.map((item) =>
        item.id === id
          ? { ...item, qty: Math.max(1, Math.min(max, item.qty + delta)) }
          : item,
      ),
    );
  };
  const count = cart.reduce((total, item) => total + item.qty, 0);
  const subtotal = cart.reduce(
    (total, item) =>
      total +
      (productList.find((product) => product.id === item.id)?.price || 0) *
        item.qty,
    0,
  );
  const routePath = route.split("?")[0];
  const routeQuery = new URLSearchParams(route.split("?")[1] || "");
  const nextPath = routeQuery.get("next") || "";
  const productSlug = decodeSegment(routePath.split("/")[2] || "");
  const storefrontProducts = productList.filter(
    (product) => product.status !== "Draft",
  );
  const currentProduct = storefrontProducts.find(
    (product) => product.slug === productSlug,
  );
  const currentOrderId = routePath.startsWith("/orders/")
    ? decodeSegment(routePath.split("/")[2] || "")
    : "";
  const currentOrder = orderList.find((order) => order.id === currentOrderId);
  const isAdmin = routePath.startsWith("/admin") && session?.role === "admin";
  const filtered = useMemo(
    () =>
      productList
        .filter(
          (product) =>
            product.status !== "Draft" &&
            (category === "All" || product.category === category) &&
            product.price >= minPrice &&
            (!query ||
              `${product.name} ${product.category} ${product.material} ${product.description}`
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
    [category, minPrice, productList, query, sort],
  );

  const authenticate = (demoUser, next) => {
    const role =
      String(demoUser.role || "Customer").toLowerCase() === "admin"
        ? "admin"
        : "customer";
    const nextSession = {
      name: demoUser.name,
      email: demoUser.email.toLowerCase(),
      role,
      demo: true,
    };
    setSession(nextSession);
    setNotice(`Demo ${role} session started`);
    go(next && next.startsWith("/") ? next : "/account");
  };
  const registerDemoUser = (demoUser) => {
    setUserList((items) => {
      if (items.some((item) => item.email.toLowerCase() === demoUser.email)) {
        return items;
      }
      return [
        {
          id: `U-${Date.now().toString().slice(-5)}`,
          name: demoUser.name,
          email: demoUser.email,
          joined: formatDate(),
          role: demoUser.role,
          status: "Active",
        },
        ...items,
      ];
    });
  };
  const logout = () => {
    setSession(null);
    setNotice("Signed out of the demo session");
    go("/");
  };
  const addReview = (productId, review) => {
    setReviews((items) => ({
      ...items,
      [productId]: [review, ...(items[productId] || [])],
    }));
  };
  const placeOrder = (details) => {
    const items = cart
      .map((row) => {
        const product = productList.find((item) => item.id === row.id);
        return product
          ? {
              id: product.id,
              name: product.name,
              price: product.price,
              qty: row.qty,
              image: product.image,
            }
          : null;
      })
      .filter(Boolean);
    const orderSubtotal = items.reduce(
      (total, item) => total + item.price * item.qty,
      0,
    );
    const discount = couponDiscount(coupon, orderSubtotal, couponList);
    const shipping = orderSubtotal >= 2500 ? 0 : 150;
    const total = Math.max(0, orderSubtotal - discount + shipping);
    const order = {
      id: `NV-${Date.now().toString().slice(-6)}`,
      customer: `${details.firstName} ${details.lastName}`.trim(),
      email: details.email,
      phone: details.phone,
      date: formatDate(),
      createdAt: new Date().toISOString(),
      total,
      subtotal: orderSubtotal,
      discount,
      shipping,
      status: "Pending",
      payment: "Cash on delivery",
      paymentStatus: "Pending",
      items,
      address: {
        firstName: details.firstName,
        lastName: details.lastName,
        address: details.address,
        city: details.city,
        state: details.state,
        postalCode: details.postalCode,
        country: details.country,
      },
    };
    setOrderList((items) => [order, ...items]);
    setCart([]);
    setCoupon("");
    setNotice(`Order ${order.id} saved in this browser`);
    return order;
  };
  const saveProduct = (product) => {
    setProductList((items) =>
      items.some((item) => item.id === product.id)
        ? items.map((item) => (item.id === product.id ? product : item))
        : [product, ...items],
    );
  };
  const deleteProduct = (id) => {
    setProductList((items) => items.filter((item) => item.id !== id));
    setCart((items) => items.filter((item) => item.id !== id));
    setWish((items) => items.filter((item) => item !== id));
    setReviews((items) => {
      const next = { ...items };
      delete next[id];
      return next;
    });
  };
  const saveCoupon = (nextCoupon) => {
    setCouponList((items) =>
      items.some((item) => item.id === nextCoupon.id)
        ? items.map((item) =>
            item.id === nextCoupon.id ? nextCoupon : item,
          )
        : [nextCoupon, ...items],
    );
  };
  const deleteCoupon = (id) =>
    setCouponList((items) => items.filter((item) => item.id !== id));
  const updateOrder = (id, patch) =>
    setOrderList((items) =>
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  const updateUser = (id, patch) =>
    setUserList((items) =>
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );

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
            add={add}
            wish={wish}
            toggleWish={toggleWish}
          />
        )}
        {(routePath === "/products" || routePath === "/search") && (
          <Listing
            filtered={filtered}
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
        {routePath.startsWith("/product/") && (
          <ProductDetail
            key={currentProduct?.id || productSlug || "missing-product"}
            product={currentProduct}
            products={storefrontProducts}
            add={add}
            wish={wish}
            toggleWish={toggleWish}
            session={session}
            reviews={reviews[currentProduct?.id] || []}
            onAddReview={addReview}
            setNotice={setNotice}
          />
        )}
        {routePath === "/cart" && (
          <Cart
            products={productList}
            cart={cart}
            quantity={quantity}
            remove={remove}
            subtotal={subtotal}
            go={go}
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
        {routePath === "/checkout" && (
          <Checkout
            products={productList}
            coupons={couponList}
            session={session}
            cart={cart}
            subtotal={subtotal}
            coupon={coupon}
            setCoupon={setCoupon}
            setNotice={setNotice}
            onPlaceOrder={placeOrder}
          />
        )}
        {routePath === "/login" && (
          <Auth
            mode="login"
            users={userList}
            session={session}
            nextPath={nextPath}
            onAuthenticate={authenticate}
            onRegister={registerDemoUser}
            setNotice={setNotice}
          />
        )}
        {routePath === "/register" && (
          <Auth
            mode="register"
            users={userList}
            session={session}
            nextPath={nextPath}
            onAuthenticate={authenticate}
            onRegister={registerDemoUser}
            setNotice={setNotice}
          />
        )}
        {routePath === "/recover" && (
          <Auth
            mode="recover"
            users={userList}
            session={session}
            nextPath={nextPath}
            onAuthenticate={authenticate}
            onRegister={registerDemoUser}
            setNotice={setNotice}
          />
        )}
        {routePath === "/account" &&
          (session ? (
            <Account
              session={session}
              orders={orderList}
              wish={wish}
              onLogout={logout}
            />
          ) : (
            <DemoGate
              title="Sign in to your account"
              copy="The account area is protected in this frontend demo. Sign in locally to see your demo profile, saved address and order history."
              next="/account"
            />
          ))}
        {routePath === "/orders" &&
          (session ? (
            <OrdersPage orders={orderList} />
          ) : (
            <DemoGate
              title="Order history is protected"
              copy="This demonstration keeps orders in browser storage. Sign in to view the demo order history."
              next="/orders"
            />
          ))}
        {routePath.startsWith("/orders/") &&
          (session ? (
            <OrderDetail order={currentOrder} />
          ) : (
            <DemoGate
              title="Order details are protected"
              copy="Sign in with the local demo account to view the selected order."
              next={routePath}
            />
          ))}
        {routePath.startsWith("/admin") &&
          (session?.role === "admin" ? (
            <Admin
              key={routePath}
              route={routePath}
              products={productList}
              orders={orderList}
              users={userList}
              coupons={couponList}
              session={session}
              setModal={setModal}
              setSelected={setSelected}
              range={range}
              setRange={setRange}
              onDeleteProduct={deleteProduct}
              onDeleteCoupon={deleteCoupon}
            />
          ) : (
            <DemoGate
              title="Admin workspace"
              copy="The admin area is protected in this frontend demo. Sign in as the demo admin to manage local products, orders, customers and coupons."
              next="/admin"
              adminOnly
              session={session}
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
      {modal && (
        <Modal
          type={modal}
          close={() => setModal("")}
          products={productList}
          selected={selected}
          session={session}
          onSaveProduct={saveProduct}
          onSaveCoupon={saveCoupon}
          onUpdateOrder={updateOrder}
          onUpdateUser={updateUser}
          setNotice={setNotice}
        />
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
function Home({ products, add, wish, toggleWish }) {
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
          {categories.slice(0, 4).map((c, i) => (
            <a
              className={`category-tile category-${i}`}
              href={`#/products?category=${c.name}`}
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
          {filtered.length} {filtered.length === 1 ? "piece" : "pieces"}
        </span>
      </div>
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
              {categories.map((c) => (
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
      {filtered.length ? (
        <ProductGrid
          items={filtered}
          add={add}
          wish={wish}
          toggleWish={toggleWish}
        />
      ) : (
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
            Sample catalogue ratings plus reviews saved in this browser.
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
function Cart({ products, cart, quantity, remove, subtotal, go }) {
  return (
    <div className="page-container">
      <div className="breadcrumbs">Home / Your bag</div>
      <div className="page-heading">
        <div>
          <p className="eyebrow">A good choice</p>
          <h1>
            Your bag
            <span className="heading-count">
              {" "}
              ({cart.reduce((a, b) => a + b.qty, 0)})
            </span>
          </h1>
        </div>
        <a href="#/products" className="text-link">
          Continue shopping ↗
        </a>
      </div>
      {!cart.length ? (
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
              const p = products.find((x) => x.id === row.id);
              if (!p) return null;
              return (
                <div className="cart-item" key={row.id}>
                  <img
                    src={p.image || FALLBACK_IMAGE}
                    alt={p.name}
                    onError={(event) => {
                      event.currentTarget.src = FALLBACK_IMAGE;
                    }}
                  />
                  <div className="cart-item-info">
                    <a href={`#/product/${p.slug}`}>{p.name}</a>
                    <small>{p.material}</small>
                    <div className="qty-control">
                      <button
                        type="button"
                        aria-label={`Decrease ${p.name} quantity`}
                        onClick={() => quantity(row.id, -1)}
                      >
                        −
                      </button>
                      <span>{row.qty}</span>
                      <button
                        type="button"
                        aria-label={`Increase ${p.name} quantity`}
                        onClick={() => quantity(row.id, 1)}
                        disabled={row.qty >= p.stock}
                      >
                        +
                      </button>
                    </div>
                    {row.qty >= p.stock && (
                      <small>Only {p.stock} available in this demo</small>
                    )}
                  </div>
                  <div className="cart-price">
                    {currency(row.qty * p.price)}
                    <button
                      type="button"
                      onClick={() => remove(row.id)}
                      aria-label={`Remove ${p.name} from bag`}
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
              <b>{currency(subtotal)}</b>
            </p>
            <p>
              <span>Shipping</span>
              <b>{subtotal >= 2500 ? "Complimentary" : "₹150"}</b>
            </p>
            <p>
              <span>Discount</span>
              <b>—</b>
            </p>
            <div className="summary-total">
              <span>Total</span>
              <b>
                {currency(subtotal + (subtotal >= 2500 || !subtotal ? 0 : 150))}
              </b>
            </div>
            <small>
              Taxes included where applicable. Final shipping details shown at
              checkout.
            </small>
            <button
              className="button primary full"
              onClick={() => go("/checkout")}
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
  coupons,
  session,
  cart,
  subtotal,
  coupon,
  setCoupon,
  setNotice,
  onPlaceOrder,
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
  const [formError, setFormError] = useState("");
  const [placedOrder, setPlacedOrder] = useState(null);

  if (placedOrder) return <OrderConfirmation order={placedOrder} />;
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

  const discount = couponDiscount(coupon, subtotal, coupons);
  const shipping = subtotal >= 2500 ? 0 : 150;
  const total = Math.max(0, subtotal - discount + shipping);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
    setFormError("");
  };
  const applyCoupon = () => {
    const normalized = code.trim().toUpperCase();
    const found = coupons.find(
      (item) =>
        item.code.toUpperCase() === normalized && item.status === "Active",
    );
    if (!found) {
      setCoupon("");
      setCouponMessage({
        tone: "error",
        text: "That code is not available in this demo.",
      });
      return;
    }
    if (subtotal < Number(found.minimum || 0)) {
      setCoupon("");
      setCouponMessage({
        tone: "error",
        text: `This code needs a minimum order of ${currency(found.minimum)}.`,
      });
      return;
    }
    if (found.expiry && new Date(found.expiry) < new Date()) {
      setCoupon("");
      setCouponMessage({
        tone: "error",
        text: "That code has expired in this demo.",
      });
      return;
    }
    setCoupon(normalized);
    setCouponMessage({
      tone: "success",
      text: `Demo code applied: ${found.value} off.`,
    });
    setNotice("Demo coupon applied");
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
  const handleSubmit = (event) => {
    event.preventDefault();
    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setFormError("Check the highlighted details before placing the order.");
      const firstField = Object.keys(nextErrors)[0];
      document.getElementById(`checkout-${firstField}`)?.focus();
      return;
    }
    const stockIssue = cart.find((row) => {
      const product = products.find((item) => item.id === row.id);
      return !product || row.qty > product.stock;
    });
    if (stockIssue) {
      const product = products.find((item) => item.id === stockIssue.id);
      setFormError(
        product
          ? `${product.name} has only ${product.stock} available in this demo.`
          : "One item in your bag is no longer available.",
      );
      return;
    }
    const order = onPlaceOrder(form);
    setPlacedOrder(order);
    setNotice(`Order ${order.id} placed locally`);
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
        Local demo checkout. Placing an order saves it in this browser, updates
        the demo order history and clears the bag. No payment is processed.
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
                onChange={(event) => updateField("email", event.target.value)}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "checkout-email-error" : undefined}
              />
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
              Pay on delivery
              <small>Demo order · no payment is processed</small>
            </label>
            <label className="radio-row">
              <input type="radio" name="payment" disabled />
              Online payment
              <small>Not available until payment integration is added</small>
            </label>
          </section>
        </div>

        <aside className="summary-box">
          <h2>Your order</h2>
          {cart.map((row) => {
            const product = products.find((item) => item.id === row.id);
            return (
              <p key={row.id}>
                <span>
                  {product?.name} × {row.qty}
                </span>
                <b>{currency((product?.price || 0) * row.qty)}</b>
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
            >
              Apply
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
            <b>{currency(subtotal)}</b>
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
          <button type="submit" className="button primary full">
            Place demo order
          </button>
          <small>
            No payment is processed. The order is stored in this browser only.
          </small>
        </aside>
      </form>
    </div>
  );
}
function Auth({
  mode,
  users,
  session,
  nextPath,
  onAuthenticate,
  onRegister,
  setNotice,
}) {
  const register = mode === "register";
  const recover = mode === "recover";
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: session?.email || "",
    password: "",
    confirm: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
    setSuccess("");
  };
  const nextQuery = nextPath
    ? `?next=${encodeURIComponent(nextPath)}`
    : "";
  const loginHref = `#/login${nextQuery}`;
  const registerHref = `#/register${nextQuery}`;
  const recoverHref = `#/recover${nextQuery}`;

  const handleSubmit = (event) => {
    event.preventDefault();
    const email = form.email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }

    if (recover) {
      setSuccess(
        "Demo recovery request accepted. No email was sent and no password was changed.",
      );
      setNotice("Demo password recovery only");
      return;
    }

    if (register && form.name.trim().length < 2) {
      setError("Enter your full name.");
      return;
    }
    if (form.password.length < 8) {
      setError("Use at least 8 characters for the demo password.");
      return;
    }
    if (register && form.password !== form.confirm) {
      setError("The two passwords do not match.");
      return;
    }

    const existing = users.find(
      (user) => user.email.toLowerCase() === email,
    );
    if (register && existing) {
      setError("That demo email is already registered. Sign in instead.");
      return;
    }

    const role =
      email === "admin@nivora.demo" ||
      existing?.role?.toLowerCase() === "admin"
        ? "Admin"
        : "Customer";
    const name =
      register || existing
        ? form.name.trim() || existing?.name || email.split("@")[0]
        : email === "admin@nivora.demo"
          ? "Nivora Admin"
          : email.split("@")[0];
    const demoUser = { name, email, role };

    if (register) {
      onRegister(demoUser);
      setNotice("Demo account created in this browser");
    }
    onAuthenticate(demoUser, nextPath);
  };

  return (
    <div className="auth-wrap">
      <p className="eyebrow">Welcome to Nivora</p>
      <h1>
        {register
          ? "Create your account"
          : recover
            ? "Reset your password"
            : "Good to have you back."}
      </h1>
      <p className="muted">
        {register
          ? "A home for your favourite pieces."
          : recover
            ? "Enter your email to preview a reset request."
            : "Sign in to see your saved pieces and orders."}
      </p>

      <DemoNotice>
        Frontend demo only. Any password of 8 or more characters is accepted
        locally. Passwords are never stored, checked against a server or sent
        anywhere. Use <b>admin@nivora.demo</b> to preview the admin workspace.
      </DemoNotice>

      {session && (
        <p className="muted">
          Current demo session: <b>{session.email}</b> ({session.role}).
        </p>
      )}

      <div aria-live="polite">
        {error && <DemoNotice tone="error">{error}</DemoNotice>}
        {success && <DemoNotice tone="success">{success}</DemoNotice>}
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
        {!recover && (
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
        )}
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
        <button type="submit" className="button primary full">
          {register
            ? "Create demo account"
            : recover
              ? "Preview reset request"
              : "Sign in to demo"}
        </button>
      </form>

      <div className="auth-links">
        {register ? (
          <>Have an account? <a href={loginHref}>Sign in</a></>
        ) : recover ? (
          <>Remembered it? <a href={loginHref}>Sign in</a></>
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
function Account({ session, orders, wish, onLogout }) {
  const latestAddress = orders.find((order) => order.address)?.address;
  const latestOrder = orders[0];

  return (
    <div className="page-container">
      <div className="breadcrumbs">Home / My account</div>
      <p className="eyebrow">Your Nivora</p>
      <h1>Account overview</h1>
      <p className="muted">
        Demo profile stored in this browser. This is not a server-backed
        account.
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
              {session.role === "admin" ? "Demo admin" : "Demo customer"}
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
              No address saved yet. The address from your first demo checkout
              will appear here.
            </p>
          )}
        </section>

        <section className="account-panel">
          <h2>Your orders</h2>
          <p>
            {orders.length} demo {orders.length === 1 ? "order" : "orders"} in
            this browser.
          </p>
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
        Signing out only clears the local demo session. It does not affect real
        accounts or server data.
      </DemoNotice>
    </div>
  );
}
function OrdersPage({ orders }) {
  return (
    <div className="page-container">
      <div className="breadcrumbs">Home / Order history</div>
      <p className="eyebrow">Your Nivora</p>
      <h1>Order history</h1>
      <p className="muted">
        Sample orders plus orders placed in this browser. Demo records are shared
        by any local sign-in and are not tied to a real customer account.
      </p>
      <DemoNotice>
        These orders are frontend demo records. The admin workspace can update
        their status, but no server or payment provider is connected.
      </DemoNotice>
      {orders.length ? (
        orders.map((order) => (
          <div className="order-row" key={order.id}>
            <div>
              <b>{order.id}</b>
              <small>
                Placed {order.date} ·{" "}
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
          <p>Your first demo order will appear here after checkout.</p>
          <a className="button primary" href="#/products">
            Explore the collection
          </a>
        </div>
      )}
    </div>
  );
}

function OrderDetail({ order }) {
  if (!order) {
    return (
      <div className="page-container empty-state">
        <p className="eyebrow">Order not found</p>
        <h1>We can't find that order.</h1>
        <p>It may have been removed from this browser's demo data.</p>
        <a className="button primary" href="#/orders">
          Back to order history
        </a>
      </div>
    );
  }

  const statusOrder = ["Pending", "Preparing", "Shipped", "Delivered"];
  const steps = ["Order received", "Preparing", "On its way", "Delivered"];
  const currentStep =
    order.status === "Cancelled" ? -1 : Math.max(0, statusOrder.indexOf(order.status));
  const address = order.address;
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
      <p className="eyebrow">Demo order</p>
      <h1>Order {order.id}</h1>
      <p className="muted">
        Placed {order.date} · {order.customer || "Demo customer"}
      </p>

      {order.status === "Cancelled" ? (
        <DemoNotice tone="error">
          This demo order is marked as cancelled.
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
            <p>Address not recorded for this sample order.</p>
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
      <DemoNotice>
        This detail view is powered by the order ID in the URL and local demo
        data. A backend will replace this storage later.
      </DemoNotice>
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
function Admin({
  route,
  products,
  orders,
  users,
  coupons,
  session,
  setModal,
  setSelected,
  range,
  setRange,
  onDeleteProduct,
  onDeleteCoupon,
}) {
  const items =
    route === "/admin/products"
      ? products
      : route === "/admin/orders"
        ? orders
        : route === "/admin/users"
          ? users
          : route === "/admin/coupons"
            ? coupons
            : [];
  const title = route.includes("products")
    ? "Products"
    : route.includes("orders")
      ? "Orders"
      : route.includes("users")
        ? "Customers"
        : route.includes("coupons")
          ? "Coupons"
          : "Overview";
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [sortKey, setSortKey] = useState("");
  const [sortDirection, setSortDirection] = useState("asc");

  const filterOptions = route.includes("products")
    ? ["Active", "Draft"]
    : route.includes("orders")
      ? ["Pending", "Preparing", "Shipped", "Delivered", "Cancelled"]
      : route.includes("users")
        ? ["Active", "Suspended"]
        : ["Active", "Inactive"];
  const columns = route.includes("products")
    ? [
        ["Product", "name"],
        ["category", "category"],
        ["price", "price"],
        ["stock", "stock"],
        ["status", "status"],
      ]
    : route.includes("orders")
      ? [
          ["Order", "id"],
          ["customer", "customer"],
          ["date", "date"],
          ["total", "total"],
          ["status", "status"],
          ["payment", "payment"],
        ]
      : route.includes("users")
        ? [
            ["name", "name"],
            ["email", "email"],
            ["joined", "joined"],
            ["role", "role"],
            ["status", "status"],
          ]
        : [
            ["code", "code"],
            ["type", "type"],
            ["value", "value"],
            ["expiry", "expiry"],
            ["minimum", "minimum"],
            ["status", "status"],
          ];
  const shown = items
    .filter(
      (item) =>
        JSON.stringify(item).toLowerCase().includes(search.toLowerCase()) &&
        (filter === "All" || item.status === filter),
    )
    .sort((a, b) => {
      if (!sortKey) return 0;
      const left = a[sortKey];
      const right = b[sortKey];
      const comparison =
        typeof left === "number" && typeof right === "number"
          ? left - right
          : String(left || "").localeCompare(String(right || ""));
      return sortDirection === "asc" ? comparison : -comparison;
    });
  const openEditor = (row) => {
    setSelected(row);
    setModal(
      route.includes("products")
        ? "product"
        : route.includes("coupons")
          ? "coupon"
          : route.includes("orders")
            ? "order"
            : "user",
    );
  };
  const removeRow = (row) => {
    if (!window.confirm(`Remove ${row.name || row.code || row.id}?`)) return;
    if (route.includes("products")) onDeleteProduct(row.id);
    if (route.includes("coupons")) onDeleteCoupon(row.id);
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <a href="#/" className="admin-brand">
          <Brand />
          <small>STUDIO</small>
        </a>
        <p>WORKSPACE</p>
        <a className={route === "/admin" ? "current" : ""} href="#/admin">
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
          <small>Preview workspace · local demo data</small>
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
              <p className="eyebrow">NIVORA STUDIO · SAMPLE DATA</p>
              <h1>{title}</h1>
              <p className="muted">
                {route === "/admin"
                  ? "A snapshot of the demo shop. These figures are illustrative only."
                  : "Manage the demonstration catalogue and records."}
              </p>
            </div>
            {route === "/admin" && (
              <select value={range} onChange={(e) => setRange(e.target.value)}>
                <option>This month</option>
                <option>Last month</option>
                <option>Last 90 days</option>
              </select>
            )}
            {route.includes("products") && (
              <button
                type="button"
                className="button primary"
                onClick={() => {
                  setSelected(null);
                  setModal("product");
                }}
              >
                ＋ Add product
              </button>
            )}
            {route.includes("coupons") && (
              <button
                type="button"
                className="button primary"
                onClick={() => {
                  setSelected(null);
                  setModal("coupon");
                }}
              >
                ＋ Create coupon
              </button>
            )}
          </div>
          <DemoNotice>
            Admin changes are stored in this browser only. They are not saved to
            a server and will not appear for other visitors.
          </DemoNotice>
          {route === "/admin" ? (
            <Dashboard products={products} orders={orders} />
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
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                >
                  <option>All</option>
                  {filterOptions.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
                <span>{shown.length} records · local demo</span>
              </div>
              <div className="data-table-wrap">
                <table className="data-table">
                  <caption className="sr-only">
                    {title} stored in this browser for the demo
                  </caption>
                  <thead>
                    <tr>
                      {columns.map(([label, key]) => (
                        <th key={key}>
                          <button
                            type="button"
                            onClick={() => {
                              if (sortKey === key) {
                                setSortDirection((current) =>
                                  current === "asc" ? "desc" : "asc",
                                );
                              } else {
                                setSortKey(key);
                                setSortDirection("asc");
                              }
                            }}
                            aria-label={`Sort by ${label}`}
                          >
                            {label.charAt(0).toUpperCase() + label.slice(1)}{" "}
                            {sortKey === key
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
                    {shown.map((row) => (
                      <tr key={row.id}>
                        {route.includes("products") ? (
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
                                <small>{row.sku}</small>
                              </span>
                            </td>
                            <td>{row.category}</td>
                            <td>{currency(row.price)}</td>
                            <td>{row.stock}</td>
                            <td>
                              <span className="status-pill">
                                {row.status || "Active"}
                              </span>
                            </td>
                          </>
                        ) : route.includes("orders") ? (
                          <>
                            <td>{row.id}</td>
                            <td>{row.customer}</td>
                            <td>{row.date}</td>
                            <td>{currency(row.total)}</td>
                            <td>
                              <span className="status-pill">{row.status}</span>
                            </td>
                            <td>{row.payment}</td>
                          </>
                        ) : route.includes("users") ? (
                          <>
                            <td>{row.name}</td>
                            <td>{row.email}</td>
                            <td>{row.joined}</td>
                            <td>{row.role}</td>
                            <td>
                              <span className="status-pill">{row.status}</span>
                            </td>
                          </>
                        ) : (
                          <>
                            <td>{row.code}</td>
                            <td>{row.type}</td>
                            <td>{row.value}</td>
                            <td>{row.expiry}</td>
                            <td>{currency(row.minimum)}</td>
                            <td>
                              <span className="status-pill">{row.status}</span>
                            </td>
                          </>
                        )}
                        <td>
                          <button
                            type="button"
                            className="table-action"
                            onClick={() => openEditor(row)}
                          >
                            {route.includes("orders")
                              ? "Update"
                              : route.includes("users")
                                ? "View"
                                : "Edit"}
                          </button>
                          {(route.includes("products") ||
                            route.includes("coupons")) && (
                            <button
                              type="button"
                              className="table-action danger"
                              onClick={() => removeRow(row)}
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!shown.length && (
                <div className="empty-state">
                  <h2>No records match.</h2>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
function Dashboard({ products, orders }) {
  const grossSales = orders.reduce(
    (total, order) => total + Number(order.total || 0),
    0,
  );
  const averageOrder = orders.length
    ? Math.round(grossSales / orders.length)
    : 0;
  const stats = [
    ["Demo sales", currency(grossSales), "From orders stored in this browser"],
    ["Orders", String(orders.length), "Local demo order records"],
    ["Average order", currency(averageOrder), "Based on local demo orders"],
    [
      "Items in catalogue",
      String(products.length),
      `Across ${categories.length} collections`,
    ],
  ];
  const bars = [38, 54, 47, 71, 63, 82, 58, 73, 89, 66, 78, 95];
  return (
    <>
      <div className="kpi-grid">
        {stats.map(([a, b, c]) => (
          <div className="kpi-card" key={a}>
            <span>{a}</span>
            <b>{b}</b>
            <small>{c}</small>
          </div>
        ))}
      </div>
      <div className="charts-grid">
        <section className="chart-panel">
          <div className="chart-head">
            <div>
              <h2>Sales overview</h2>
              <small>Illustrative revenue · ₹ thousands</small>
            </div>
            <span>Last 12 months</span>
          </div>
          <div className="bar-chart">
            {bars.map((n, i) => (
              <div className="bar-column" key={i}>
                <div style={{ height: `${n}%` }} />
                <small>
                  {
                    [
                      "Nov",
                      "Dec",
                      "Jan",
                      "Feb",
                      "Mar",
                      "Apr",
                      "May",
                      "Jun",
                      "Jul",
                      "Aug",
                      "Sep",
                      "Oct",
                    ][i]
                  }
                </small>
              </div>
            ))}
          </div>
        </section>
        <section className="chart-panel activity-panel">
          <h2>Order activity</h2>
          <small>Illustrative weekly activity</small>
          <div className="activity-bars">
            {[42, 70, 54, 86, 62, 100, 76].map((n, i) => (
              <div key={i}>
                <div style={{ height: `${n}%` }} />
                <small>{["M", "T", "W", "T", "F", "S", "S"][i]}</small>
              </div>
            ))}
          </div>
          <div className="activity-legend">
            <span />
            Orders this week <b>68</b>
          </div>
        </section>
      </div>
      <div className="admin-lower">
        <section className="chart-panel">
          <div className="chart-head">
            <h2>Recent orders</h2>
            <a href="#/admin/orders">View all ↗</a>
          </div>
          {orders.slice(0, 4).map((order) => (
            <div className="mini-row" key={order.id}>
              <span>
                {order.id}
                <small>{order.customer}</small>
              </span>
              <span className="status-pill">{order.status}</span>
              <b>{currency(order.total)}</b>
            </div>
          ))}
          {!orders.length && <p className="muted">No demo orders yet.</p>}
        </section>
        <section className="chart-panel">
          <div className="chart-head">
            <h2>Top pieces</h2>
            <a href="#/admin/products">Catalogue ↗</a>
          </div>
          {products
            .filter((p) => p.bestseller)
            .slice(0, 4)
            .map((p, i) => (
              <div className="mini-row" key={p.id}>
                <span className="rank">0{i + 1}</span>
                <span>
                  {p.name}
                  <small>{p.category}</small>
                </span>
                <b>{p.stock} in stock</b>
              </div>
            ))}
        </section>
      </div>
    </>
  );
}
function Modal({
  type,
  close,
  products,
  selected,
  session,
  onSaveProduct,
  onSaveCoupon,
  onUpdateOrder,
  onUpdateUser,
  setNotice,
}) {
  const edit = selected;
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
          ? "Update order"
          : type === "user"
            ? "Customer details"
            : "Record details";
  const dateInputValue = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
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
        <p className="eyebrow">Nivora Studio · local demo</p>
        <h2 id="modal-title">{title}</h2>
        <DemoNotice>
          Changes here update local demo state in this browser only. They are
          not sent to a server.
        </DemoNotice>

        {type === "product" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const name = String(data.get("name") || "").trim();
              const image =
                String(data.get("image") || "").trim() ||
                edit?.image ||
                FALLBACK_IMAGE;
              const featured = data.get("featured") === "on";
              const material =
                String(data.get("material") || "").trim() || "See details";
              let slug = slugify(name);
              let suffix = 2;
              while (
                products.some(
                  (product) =>
                    product.slug === slug && product.id !== edit?.id,
                )
              ) {
                slug = `${slugify(name)}-${suffix}`;
                suffix += 1;
              }
              const product = {
                ...(edit || {}),
                id: edit?.id || `NV-${Date.now().toString().slice(-5)}`,
                name,
                slug,
                description: String(data.get("description") || "").trim(),
                price: Number(data.get("price")) || 0,
                compareAtPrice: data.get("compareAtPrice")
                  ? Number(data.get("compareAtPrice"))
                  : null,
                category: String(data.get("category") || "Decor"),
                sku: String(data.get("sku") || "").trim(),
                stock: Number(data.get("stock")) || 0,
                status: String(data.get("status") || "Active"),
                image,
                images:
                  edit && image === edit.image ? edit.images || [] : [image],
                material,
                featured,
                badge: featured
                  ? edit?.badge || "Nivora favourite"
                  : edit?.badge || "",
                bestseller: edit?.bestseller || false,
                rating: edit?.rating || 0,
                reviewCount: edit?.reviewCount || 0,
                specifications: edit?.specifications || {
                  Material: material,
                  Care: "Wipe gently with a soft, dry cloth",
                  Origin: "Designed in India",
                },
              };
              onSaveProduct(product);
              setNotice("Product saved in this browser (demo only)");
              close();
            }}
          >
            <label>
              Product name
              <input name="name" required defaultValue={edit?.name} autoFocus />
            </label>
            <label>
              Description
              <textarea
                name="description"
                required
                defaultValue={edit?.description}
              />
            </label>
            <div className="field-grid">
              <label>
                Price (₹)
                <input
                  name="price"
                  type="number"
                  min="1"
                  required
                  defaultValue={edit?.price}
                />
              </label>
              <label>
                Compare at (₹)
                <input
                  name="compareAtPrice"
                  type="number"
                  min="0"
                  defaultValue={edit?.compareAtPrice ?? ""}
                />
              </label>
              <label>
                Category
                <select name="category" defaultValue={edit?.category || "Decor"}>
                  {categories.map((category) => (
                    <option key={category.name}>{category.name}</option>
                  ))}
                </select>
              </label>
              <label>
                SKU
                <input name="sku" required defaultValue={edit?.sku} />
              </label>
              <label>
                Stock
                <input
                  name="stock"
                  type="number"
                  min="0"
                  required
                  defaultValue={edit?.stock ?? 0}
                />
              </label>
              <label>
                Status
                <select name="status" defaultValue={edit?.status || "Active"}>
                  <option>Active</option>
                  <option>Draft</option>
                </select>
              </label>
              <label>
                Material
                <input name="material" defaultValue={edit?.material} />
              </label>
              <label className="radio-row">
                <input
                  name="featured"
                  type="checkbox"
                  defaultChecked={edit?.featured}
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
                defaultValue={edit?.image}
                placeholder="https://images.example.com/product.jpg"
              />
              <small>
                Use an existing image URL. Cloudinary upload is not connected.
              </small>
            </label>
            <div className="modal-actions">
              <button type="button" className="button outline" onClick={close}>
                Cancel
              </button>
              <button type="submit" className="button primary">
                Save product
              </button>
            </div>
          </form>
        ) : type === "coupon" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const discountType = String(data.get("discountType"));
              const amount = Number(data.get("value")) || 0;
              const expiry = String(data.get("expiry"));
              const expiryDate = expiry
                ? new Date(`${expiry}T12:00:00`)
                : null;
              const coupon = {
                ...(edit || {}),
                id: edit?.id || `C-${Date.now().toString().slice(-5)}`,
                code: String(data.get("code") || "")
                  .trim()
                  .toUpperCase(),
                type: discountType,
                value:
                  discountType === "Percentage"
                    ? `${amount}%`
                    : currency(amount),
                expiry: expiryDate ? formatDate(expiryDate) : "",
                minimum: Number(data.get("minimum")) || 0,
                usageLimit: data.get("usageLimit")
                  ? Number(data.get("usageLimit"))
                  : null,
                status: String(data.get("status") || "Active"),
              };
              onSaveCoupon(coupon);
              setNotice("Coupon saved in this browser (demo only)");
              close();
            }}
          >
            <label>
              Coupon code
              <input
                name="code"
                required
                defaultValue={edit?.code}
                autoFocus
              />
            </label>
            <div className="field-grid">
              <label>
                Discount type
                <select
                  name="discountType"
                  defaultValue={edit?.type || "Percentage"}
                >
                  <option>Percentage</option>
                  <option>Fixed amount</option>
                </select>
              </label>
              <label>
                Discount value
                <input
                  name="value"
                  required
                  type="number"
                  min="1"
                  defaultValue={
                    edit?.value
                      ? String(edit.value).replace(/[^\d.]/g, "")
                      : ""
                  }
                />
              </label>
              <label>
                Expiration date
                <input
                  name="expiry"
                  required
                  type="date"
                  defaultValue={dateInputValue(edit?.expiry)}
                />
              </label>
              <label>
                Minimum order (₹)
                <input
                  name="minimum"
                  type="number"
                  min="0"
                  defaultValue={edit?.minimum ?? 0}
                />
              </label>
              <label>
                Usage limit
                <input
                  name="usageLimit"
                  type="number"
                  min="1"
                  defaultValue={edit?.usageLimit ?? ""}
                />
              </label>
              <label>
                Status
                <select name="status" defaultValue={edit?.status || "Active"}>
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="button outline" onClick={close}>
                Cancel
              </button>
              <button type="submit" className="button primary">
                Save coupon
              </button>
            </div>
          </form>
        ) : type === "order" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              onUpdateOrder(edit.id, {
                status: String(data.get("status")),
                paymentStatus: String(data.get("paymentStatus")),
              });
              setNotice("Order updated in this browser (demo only)");
              close();
            }}
          >
            <p>
              <b>{edit.id}</b> · {edit.customer} · {edit.date} ·{" "}
              {currency(edit.total)}
            </p>
            {edit.address ? (
              <p>
                {edit.address.firstName} {edit.address.lastName}
                <br />
                {edit.address.address}
                <br />
                {edit.address.city}, {edit.address.state}{" "}
                {edit.address.postalCode}
              </p>
            ) : (
              <p>No address recorded for this sample order.</p>
            )}
            <p>
              Items:{" "}
              {(edit.items || [])
                .map((item) => `${item.name} × ${item.qty}`)
                .join(", ")}
            </p>
            <p>Payment method: {edit.payment || "Not recorded"}</p>
            <div className="field-grid">
              <label>
                Order status
                <select name="status" defaultValue={edit.status || "Pending"}>
                  {["Pending", "Preparing", "Shipped", "Delivered", "Cancelled"].map(
                    (status) => (
                      <option key={status}>{status}</option>
                    ),
                  )}
                </select>
              </label>
              <label>
                Payment status
                <select
                  name="paymentStatus"
                  defaultValue={edit.paymentStatus || "Pending"}
                >
                  {["Pending", "Paid (demo)", "Refunded"].map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="button outline" onClick={close}>
                Cancel
              </button>
              <button type="submit" className="button primary">
                Save order status
              </button>
            </div>
          </form>
        ) : type === "user" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              onUpdateUser(edit.id, {
                role: String(data.get("role")),
                status: String(data.get("status")),
              });
              setNotice("Customer record updated in this browser (demo only)");
              close();
            }}
          >
            <p>
              <b>{edit.name}</b>
              <br />
              {edit.email}
              <br />
              Joined {edit.joined}
            </p>
            {session?.email === edit.email.toLowerCase() && (
              <DemoNotice tone="error">
                This is the currently signed-in demo account. Role changes apply
                to local data only and will not update this session.
              </DemoNotice>
            )}
            <div className="field-grid">
              <label>
                Role
                <select name="role" defaultValue={edit.role || "Customer"}>
                  <option>Customer</option>
                  <option>Admin</option>
                </select>
              </label>
              <label>
                Status
                <select name="status" defaultValue={edit.status || "Active"}>
                  <option>Active</option>
                  <option>Suspended</option>
                </select>
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="button outline" onClick={close}>
                Cancel
              </button>
              <button type="submit" className="button primary">
                Save customer
              </button>
            </div>
          </form>
        ) : (
          <div>
            <p>This record cannot be edited in the local demo.</p>
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
