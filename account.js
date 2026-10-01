const CART_KEY = "auctionXCart";
const WATCHLIST_KEY = "auctionXWatchlist";
const ORDER_KEY = "auctionXLastOrder";
const ORDERS_KEY = "auctionXOrders";

/* =========================================================
   AUCTION X — PRODUCT CATALOG
   ========================================================= */

const products = [
  {
    id: "iphone-17-pro",
    title: "iPhone 17 Pro",
    price: 1200,
    image: "assets/images/iphone-17-pro.jpg"
  },
  {
    id: "iphone-17-pro-max",
    title: "iPhone 17 Pro Max",
    price: 1350,
    image: "assets/images/iphone-17-pro-max.jpg"
  },
  {
    id: "iphone-16-pro",
    title: "iPhone 16 Pro",
    price: 950,
    image: "assets/images/iphone-16-pro.jpg"
  },
  {
    id: "iphone-16-pro-max",
    title: "iPhone 16 Pro Max",
    price: 1050,
    image: "assets/images/iphone-16-pro-max.jpg"
  },
  {
    id: "iphone-16",
    title: "iPhone 16",
    price: 800,
    image: "assets/images/iphone-16.jpg"
  },
  {
    id: "iphone-15-pro",
    title: "iPhone 15 Pro",
    price: 650,
    image: "assets/images/iphone-15-pro.jpg"
  },
  {
    id: "iphone-14-pro",
    title: "iPhone 14 Pro",
    price: 520,
    image: "assets/images/iphone-14-pro.jpg"
  },
  {
    id: "galaxy-s26-ultra",
    title: "Galaxy S26 Ultra",
    price: 1100,
    image: "assets/images/galaxy-s26-ultra.jpg"
  },
  {
    id: "galaxy-z-fold",
    title: "Galaxy Z Fold",
    price: 1250,
    image: "assets/images/galaxy-z-fold.jpg"
  },
  {
    id: "macbook-air",
    title: "MacBook Air",
    price: 850,
    image: "assets/images/macbook-air.jpg"
  },
  {
    id: "rolex-watch",
    title: "Rolex Watch",
    price: 3200,
    image: "assets/images/rolex-watch.jpg"
  },
  {
    id: "cartier-watch",
    title: "Cartier Watch",
    price: 2800,
    image: "assets/images/cartier-watch.jpg"
  }
];

/* =========================================================
   STORAGE
   ========================================================= */

const getStoredArray = (key) => {
  try {
    const stored = localStorage.getItem(key);

    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);

    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn(`AUCTION X: Unable to read ${key}`, error);
    return [];
  }
};

const getOrders = () => {
  return getStoredArray(ORDERS_KEY);
};

const getLastOrder = () => {
  try {
    const stored = localStorage.getItem(ORDER_KEY);

    if (!stored) {
      return null;
    }

    return JSON.parse(stored);
  } catch (error) {
    console.warn("AUCTION X: Unable to read last order", error);
    return null;
  }
};

/* =========================================================
   HELPERS
   ========================================================= */

const escapeHTML = (value) => {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const formatMoney = (value) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
};

const getProduct = (item) => {
  if (!item) {
    return null;
  }

  /* -------------------------------------------------------
     WATCHLIST STORED AS STRING
     ------------------------------------------------------- */

  if (typeof item === "string") {
    const normalizedItem = item.toLowerCase();

    return (
      products.find(
        (product) =>
          product.id.toLowerCase() === normalizedItem ||
          product.title.toLowerCase() === normalizedItem
      ) || null
    );
  }

  /* -------------------------------------------------------
     WATCHLIST / CART STORED AS OBJECT
     ------------------------------------------------------- */

  const matchedProduct = products.find(
    (product) =>
      (item.id && product.id === item.id) ||
      (item.productId && product.id === item.productId) ||
      (item.title && product.title === item.title) ||
      (item.name && product.title === item.name)
  );

  if (matchedProduct) {
    return matchedProduct;
  }

  /* -------------------------------------------------------
     FALLBACK PRODUCT
     ------------------------------------------------------- */

  return {
    id:
      item.id ||
      item.productId ||
      item.title ||
      item.name ||
      "saved-item",

    title:
      item.title ||
      item.name ||
      "Saved listing",

    price:
      Number(item.price) ||
      Number(item.amount) ||
      0,

    image:
      item.image ||
      item.imageUrl ||
      ""
  };
};

/* =========================================================
   ORDER STATUS
   ========================================================= */

const getOrderStatus = (order) => {
  if (!order) {
    return "Pending";
  }

  const rawStatus =
    order.paymentStatus ||
    order.status ||
    order.payment_status ||
    order.paymentState ||
    "Pending";

  const normalized = String(rawStatus)
    .toLowerCase()
    .replace(/_/g, " ")
    .trim();

  if (
    normalized.includes("finished") ||
    normalized.includes("confirmed") ||
    normalized.includes("paid") ||
    normalized.includes("complete")
  ) {
    return "Paid";
  }

  if (
    normalized.includes("waiting") ||
    normalized.includes("pending") ||
    normalized.includes("confirming") ||
    normalized.includes("required")
  ) {
    return "Pending";
  }

  if (
    normalized.includes("failed") ||
    normalized.includes("expired") ||
    normalized.includes("refund") ||
    normalized.includes("cancel")
  ) {
    return "Attention";
  }

  return normalized
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const getOrderStatusClass = (order) => {
  const status = getOrderStatus(order).toLowerCase();

  if (status === "paid") {
    return "status-paid";
  }

  if (status === "pending") {
    return "status-pending";
  }

  if (status === "attention") {
    return "status-attention";
  }

  return "status-default";
};

/* =========================================================
   ORDER DATE
   ========================================================= */

const formatOrderDate = (order) => {
  const value =
    order?.createdAt ||
    order?.created_at ||
    order?.date ||
    order?.created ||
    order?.timestamp ||
    null;

  if (!value) {
    return "Date unavailable";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
};

/* =========================================================
   ORDER REFERENCE
   ========================================================= */

const getOrderReference = (order) => {
  return (
    order?.reference ||
    order?.orderReference ||
    order?.orderId ||
    order?.id ||
    "AUCTION X ORDER"
  );
};

/* =========================================================
   ORDER TOTAL
   ========================================================= */

const getOrderTotal = (order) => {
  return (
    Number(order?.total) ||
    Number(order?.amount) ||
    Number(order?.orderTotal) ||
    0
  );
};

/* =========================================================
   OVERVIEW — CART
   ========================================================= */

const updateCartStats = () => {
  const cart = getStoredArray(CART_KEY);

  const count = cart.reduce((total, item) => {
    const quantity = Number(item?.quantity);

    return total + (quantity > 0 ? quantity : 1);
  }, 0);

  const accountCartCount = document.getElementById(
    "accountCartCount"
  );

  const navbarCartCount = document.getElementById(
    "cartCount"
  );

  if (accountCartCount) {
    accountCartCount.textContent = count;
  }

  if (navbarCartCount) {
    navbarCartCount.textContent = count;
  }
};

/* =========================================================
   OVERVIEW — WATCHLIST
   ========================================================= */

const updateWatchlistStats = () => {
  const watchlist = getStoredArray(WATCHLIST_KEY);

  const count = document.getElementById(
    "watchlistCount"
  );

  if (count) {
    count.textContent = watchlist.length;
  }
};

/* =========================================================
   OVERVIEW — ORDERS
   ========================================================= */

const updateOrderStats = () => {
  const orders = getOrders();

  const count = document.getElementById(
    "orderCount"
  );

  if (count) {
    count.textContent = orders.length;
  }
};

/* =========================================================
   WATCHLIST
   ========================================================= */

const renderWatchlist = () => {
  const panel = document.getElementById(
    "watchlistPanel"
  );

  if (!panel) {
    return;
  }

  const watchlist = getStoredArray(
    WATCHLIST_KEY
  );

  /* -------------------------------------------------------
     EMPTY WATCHLIST
     ------------------------------------------------------- */

  if (!watchlist.length) {
    panel.innerHTML = `
      <div class="empty-icon">♡</div>

      <strong>
        Nothing saved yet
      </strong>

      <p>
        Save listings you're interested in and return to them later.
      </p>

      <a
        href="index.html#auctions"
        class="account-link"
      >
        Browse listings →
      </a>
    `;

    return;
  }

  /* -------------------------------------------------------
     RESOLVE PRODUCTS
     ------------------------------------------------------- */

  const savedProducts = watchlist
    .map(getProduct)
    .filter(Boolean)
    .slice(0, 3);

  if (!savedProducts.length) {
    panel.innerHTML = `
      <div class="empty-icon">♡</div>

      <strong>
        Saved listings unavailable
      </strong>

      <p>
        Your saved listings could not be loaded.
      </p>

      <a
        href="index.html#auctions"
        class="account-link"
      >
        Browse listings →
      </a>
    `;

    return;
  }

  /* -------------------------------------------------------
     RENDER WATCHLIST
     ------------------------------------------------------- */

  panel.innerHTML = `
    <div class="watchlist-items">

      ${savedProducts
        .map((product) => {
          const title = escapeHTML(
            product.title
          );

          const image = escapeHTML(
            product.image
          );

          const productId = encodeURIComponent(
            product.id
          );

          return `
            <article class="account-watch-item">

              <div class="account-watch-image">

                ${
                  image
                    ? `
                      <img
                        src="${image}"
                        alt="${title}"
                        loading="lazy"
                      />
                    `
                    : `
                      <span>AX</span>
                    `
                }

              </div>

              <div class="account-watch-info">

                <div>

                  <span class="account-watch-label">
                    SAVED LISTING
                  </span>

                  <strong>
                    ${title}
                  </strong>

                  <span class="account-watch-price">
                    ${formatMoney(product.price)}
                  </span>

                </div>

                <a
                  href="listing.html?id=${productId}"
                  class="account-watch-link"
                >
                  View Lot →
                </a>

              </div>

            </article>
          `;
        })
        .join("")}

    </div>

    ${
      watchlist.length > 3
        ? `
          <div class="account-watch-more">
            + ${watchlist.length - 3}
            more saved listing${
              watchlist.length - 3 === 1
                ? ""
                : "s"
            }
          </div>
        `
        : ""
    }
  `;
};

/* =========================================================
   ORDERS
   ========================================================= */

const renderOrders = () => {
  const panel = document.getElementById(
    "ordersPanel"
  );

  if (!panel) {
    return;
  }

  const orders = getOrders();

  /* -------------------------------------------------------
     EMPTY ORDERS
     ------------------------------------------------------- */

  if (!orders.length) {
    panel.innerHTML = `
      <div class="empty-icon">01</div>

      <strong>
        No orders yet
      </strong>

      <p>
        Your completed and active orders will appear here.
      </p>

      <a
        href="index.html#auctions"
        class="account-link"
      >
        Explore marketplace →
      </a>
    `;

    return;
  }

  /* -------------------------------------------------------
     RECENT ORDERS
     ------------------------------------------------------- */

  const recentOrders = orders.slice(0, 3);

  panel.innerHTML = `
    <div class="orders-list">

      ${recentOrders
        .map((order) => {
          const reference = escapeHTML(
            getOrderReference(order)
          );

          const total = getOrderTotal(order);

          const status = escapeHTML(
            getOrderStatus(order)
          );

          const statusClass =
            getOrderStatusClass(order);

          return `
            <article class="account-order">

              <div class="account-order-main">

                <span class="panel-kicker">
                  ORDER
                </span>

                <strong>
                  ${reference}
                </strong>

                <span>
                  ${formatOrderDate(order)}
                </span>

              </div>

              <div class="account-order-right">

                <strong>
                  ${formatMoney(total)}
                </strong>

                <span
                  class="order-status ${statusClass}"
                >
                  ${status}
                </span>

              </div>

            </article>
          `;
        })
        .join("")}

    </div>

    <a
      href="account.html"
      class="account-link account-orders-link"
    >
      View account activity →
    </a>
  `;
};

/* =========================================================
   CART PANEL
   ========================================================= */

const renderCart = () => {
  const panel = document.getElementById(
    "cartPanel"
  );

  if (!panel) {
    return;
  }

  const cart = getStoredArray(
    CART_KEY
  );

  /* -------------------------------------------------------
     EMPTY CART
     ------------------------------------------------------- */

  if (!cart.length) {
    panel.innerHTML = `
      <div class="empty-icon">+</div>

      <strong>
        Your cart is empty
      </strong>

      <p>
        Add products from the marketplace and they'll appear here.
      </p>

      <a
        href="cart.html"
        class="account-link"
      >
        Open cart →
      </a>
    `;

    return;
  }

  /* -------------------------------------------------------
     RESOLVE CART PRODUCTS
     ------------------------------------------------------- */

  const cartItems = cart
    .map((item) => {
      const product = getProduct(item);

      if (!product) {
        return null;
      }

      return {
        ...product,
        quantity:
          Number(item?.quantity) > 0
            ? Number(item.quantity)
            : 1
      };
    })
    .filter(Boolean)
    .slice(0, 3);

  if (!cartItems.length) {
    panel.innerHTML = `
      <div class="empty-icon">+</div>

      <strong>
        Your cart is empty
      </strong>

      <p>
        Add products from the marketplace and they'll appear here.
      </p>

      <a
        href="cart.html"
        class="account-link"
      >
        Open cart →
      </a>
    `;

    return;
  }

  /* -------------------------------------------------------
     RENDER CART
     ------------------------------------------------------- */

  panel.innerHTML = `
    <div class="account-cart-list">

      ${cartItems
        .map((item) => {
          const title = escapeHTML(
            item.title
          );

          const image = escapeHTML(
            item.image
          );

          return `
            <article class="account-cart-item">

              <div class="account-cart-image">

                ${
                  image
                    ? `
                      <img
                        src="${image}"
                        alt="${title}"
                        loading="lazy"
                      />
                    `
                    : `
                      <span>AX</span>
                    `
                }

              </div>

              <div class="account-cart-info">

                <strong>
                  ${title}
                </strong>

                <span>
                  ${item.quantity}
                  ${
                    item.quantity === 1
                      ? "item"
                      : "items"
                  }
                </span>

              </div>

              <strong class="account-cart-price">
                ${formatMoney(
                  item.price * item.quantity
                )}
              </strong>

            </article>
          `;
        })
        .join("")}

    </div>

    <a
      href="cart.html"
      class="account-link"
    >
      Open cart →
    </a>
  `;
};

/* =========================================================
   ACCOUNT REFRESH
   ========================================================= */

const refreshAccount = () => {
  updateCartStats();
  updateWatchlistStats();
  updateOrderStats();

  renderWatchlist();
  renderOrders();
  renderCart();
};

/* =========================================================
   STORAGE SYNC
   ========================================================= */

window.addEventListener(
  "storage",
  (event) => {
    const watchedKeys = [
      CART_KEY,
      WATCHLIST_KEY,
      ORDER_KEY,
      ORDERS_KEY
    ];

    if (watchedKeys.includes(event.key)) {
      refreshAccount();
    }
  }
);

/* =========================================================
   INITIALIZE
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {
    refreshAccount();
  }
);