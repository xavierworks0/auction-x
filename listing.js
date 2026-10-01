document.addEventListener("DOMContentLoaded", () => {
  /*
   * =========================================================
   * AUCTION X — LISTING ENGINE
   * =========================================================
   * Currency: USD
   * Market: United States
   *
   * Supports:
   * listing.html?item=iPhone%2017%20Pro
   * listing.html?id=iphone-17-pro
   * =========================================================
   */

  /* =========================================================
     CONFIG
     ========================================================= */

  const CART_KEY = "auctionXCart";
  const WATCHLIST_KEY = "auctionXWatchlist";

  const MARKET_CURRENCY = "USD";
  const MARKET_LOCALE = "en-US";

  const money = new Intl.NumberFormat(MARKET_LOCALE, {
    style: "currency",
    currency: MARKET_CURRENCY,
    maximumFractionDigits: 0
  });

  /* =========================================================
     HELPERS
     ========================================================= */

  const formatMoney = (value) => {
    return money.format(Number(value) || 0);
  };

  const escapeHTML = (value) => {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const readStorage = (key) => {
    try {
      const value = localStorage.getItem(key);

      if (!value) {
        return [];
      }

      const parsed = JSON.parse(value);

      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn(`AUCTION X: Could not read ${key}`, error);
      return [];
    }
  };

  const writeStorage = (key, value) => {
    try {
      localStorage.setItem(
        key,
        JSON.stringify(value)
      );

      return true;
    } catch (error) {
      console.warn(`AUCTION X: Could not write ${key}`, error);
      return false;
    }
  };

  /* =========================================================
     PRODUCT CATALOG
     ========================================================= */

  const products = [
    {
      id: "iphone-17-pro",
      title: "iPhone 17 Pro",
      image: "assets/images/iphone-17-pro.jpg",
      category: "GADGETS",
      brand: "Apple",
      price: 1200,
      condition: "Like New",
      location: "United States",
      reference: "AX-IP17P",
      description:
        "Premium Apple smartphone listed in the AUCTION X marketplace.",
      overview:
        "A premium Apple smartphone presented as a marketplace listing. Product information shown on this prototype is demonstration data.",
      specs: [
        ["Brand", "Apple"],
        ["Series", "iPhone"],
        ["Model", "17 Pro"],
        ["Storage", "256GB"]
      ]
    },

    {
      id: "iphone-17-pro-max",
      title: "iPhone 17 Pro Max",
      image: "assets/images/iphone-17-pro-max.jpg",
      category: "GADGETS",
      brand: "Apple",
      price: 1350,
      condition: "Like New",
      location: "United States",
      reference: "AX-IP17PM",
      description:
        "Flagship Apple smartphone with a premium large-format design.",
      overview:
        "Large-format Apple flagship smartphone listed within the AUCTION X catalog.",
      specs: [
        ["Brand", "Apple"],
        ["Series", "iPhone"],
        ["Model", "17 Pro Max"],
        ["Storage", "512GB"]
      ]
    },

    {
      id: "iphone-16-pro",
      title: "iPhone 16 Pro",
      image: "assets/images/iphone-16-pro.jpg",
      category: "GADGETS",
      brand: "Apple",
      price: 950,
      condition: "Excellent",
      location: "United States",
      reference: "AX-IP16P",
      description:
        "Professional-grade Apple smartphone listed for marketplace discovery.",
      overview:
        "Apple Pro smartphone presented as a demonstration marketplace listing.",
      specs: [
        ["Brand", "Apple"],
        ["Series", "iPhone"],
        ["Model", "16 Pro"],
        ["Storage", "256GB"]
      ]
    },

    {
      id: "iphone-16-pro-max",
      title: "iPhone 16 Pro Max",
      image: "assets/images/iphone-16-pro-max.jpg",
      category: "GADGETS",
      brand: "Apple",
      price: 1050,
      condition: "Excellent",
      location: "United States",
      reference: "AX-IP16PM",
      description:
        "Large-format Apple flagship with a premium finish.",
      overview:
        "Premium Apple smartphone displayed in the AUCTION X marketplace.",
      specs: [
        ["Brand", "Apple"],
        ["Series", "iPhone"],
        ["Model", "16 Pro Max"],
        ["Storage", "256GB"]
      ]
    },

    {
      id: "iphone-16",
      title: "iPhone 16",
      image: "assets/images/iphone-16.jpg",
      category: "GADGETS",
      brand: "Apple",
      price: 800,
      condition: "Excellent",
      location: "United States",
      reference: "AX-IP16",
      description:
        "Modern Apple smartphone with a clean premium profile.",
      overview:
        "Modern Apple smartphone presented as a demonstration marketplace listing.",
      specs: [
        ["Brand", "Apple"],
        ["Series", "iPhone"],
        ["Storage", "128GB"],
        ["Type", "Smartphone"]
      ]
    },

    {
      id: "iphone-15-pro",
      title: "iPhone 15 Pro",
      image: "assets/images/iphone-15-pro.jpg",
      category: "GADGETS",
      brand: "Apple",
      price: 650,
      condition: "Very Good",
      location: "United States",
      reference: "AX-IP15P",
      description:
        "Previous-generation Apple Pro model listed in the marketplace.",
      overview:
        "Apple Pro smartphone represented within the AUCTION X catalog.",
      specs: [
        ["Brand", "Apple"],
        ["Series", "iPhone"],
        ["Model", "15 Pro"],
        ["Storage", "256GB"]
      ]
    },

    {
      id: "iphone-14-pro",
      title: "iPhone 14 Pro",
      image: "assets/images/iphone-14-pro.jpg",
      category: "GADGETS",
      brand: "Apple",
      price: 520,
      condition: "Very Good",
      location: "United States",
      reference: "AX-IP14P",
      description:
        "Apple Pro smartphone with a premium marketplace presentation.",
      overview:
        "Apple Pro smartphone listed as demonstration catalog data.",
      specs: [
        ["Brand", "Apple"],
        ["Series", "iPhone"],
        ["Model", "14 Pro"],
        ["Storage", "256GB"]
      ]
    },

    {
      id: "galaxy-s26-ultra",
      title: "Galaxy S26 Ultra",
      image: "assets/images/galaxy-s26-ultra.jpg",
      category: "GADGETS",
      brand: "Samsung",
      price: 1100,
      condition: "Like New",
      location: "United States",
      reference: "AX-GS26U",
      description:
        "Samsung flagship smartphone presented as an AUCTION X marketplace listing.",
      overview:
        "Samsung flagship smartphone presented as a demonstration marketplace asset.",
      specs: [
        ["Brand", "Samsung"],
        ["Series", "Galaxy"],
        ["Model", "S26 Ultra"],
        ["Storage", "256GB"]
      ]
    },

    {
      id: "galaxy-z-fold",
      title: "Galaxy Z Fold",
      image: "assets/images/galaxy-z-fold.jpg",
      category: "GADGETS",
      brand: "Samsung",
      price: 1250,
      condition: "Like New",
      location: "United States",
      reference: "AX-ZFOLD",
      description:
        "Foldable Samsung smartphone with an expansive display experience.",
      overview:
        "Foldable Samsung smartphone presented within the AUCTION X catalog.",
      specs: [
        ["Brand", "Samsung"],
        ["Series", "Galaxy"],
        ["Type", "Foldable"],
        ["Storage", "512GB"]
      ]
    },

    {
      id: "macbook-air",
      title: "MacBook Air",
      image: "assets/images/macbook-air.jpg",
      category: "GADGETS",
      brand: "Apple",
      price: 850,
      condition: "Excellent",
      location: "United States",
      reference: "AX-MBAIR",
      description:
        "Slim Apple laptop designed for everyday productivity and creative work.",
      overview:
        "Apple laptop presented as a demonstration listing within the AUCTION X marketplace.",
      specs: [
        ["Brand", "Apple"],
        ["Series", "MacBook"],
        ["Type", "Laptop"],
        ["Model", "Air"]
      ]
    },

    {
      id: "rolex-watch",
      title: "Rolex Watch",
      image: "assets/images/rolex-watch.jpg",
      category: "LUXURY",
      brand: "Rolex",
      price: 3200,
      condition: "Excellent",
      location: "United States",
      reference: "AX-ROLEX",
      description:
        "Luxury timepiece presented as a marketplace-listed asset.",
      overview:
        "Luxury timepiece presented as demonstration catalog data.",
      specs: [
        ["Brand", "Rolex"],
        ["Type", "Watch"],
        ["Category", "Luxury"],
        ["Asset", "Timepiece"]
      ]
    },

    {
      id: "cartier-watch",
      title: "Cartier Watch",
      image: "assets/images/cartier-watch.jpg",
      category: "LUXURY",
      brand: "Cartier",
      price: 2800,
      condition: "Excellent",
      location: "United States",
      reference: "AX-CARTIER",
      description:
        "Premium Cartier timepiece presented in the AUCTION X luxury catalog.",
      overview:
        "Premium timepiece presented within the AUCTION X demonstration catalog.",
      specs: [
        ["Brand", "Cartier"],
        ["Type", "Watch"],
        ["Category", "Luxury"],
        ["Asset", "Timepiece"]
      ]
    }
  ];

  /* =========================================================
     FIND CURRENT PRODUCT
     ========================================================= */

  const params = new URLSearchParams(
    window.location.search
  );

  const requestedId = params.get("id");
  const requestedItem = params.get("item");

  const normalizedItem = String(
    requestedItem || ""
  )
    .trim()
    .toLowerCase();

  const product =
    products.find(
      (item) =>
        item.id === requestedId
    ) ||
    products.find(
      (item) =>
        item.title.toLowerCase() === normalizedItem
    ) ||
    products[0];

  /* =========================================================
     PAGE TITLE
     ========================================================= */

  document.title =
    `AUCTION X — ${product.title}`;

  /* =========================================================
     DOM HELPERS
     ========================================================= */

  const setText = (selector, value) => {
    const element =
      document.querySelector(selector);

    if (element) {
      element.textContent = value;
    }
  };

  /* =========================================================
     BASIC LISTING CONTENT
     ========================================================= */

  const listingImage =
    document.querySelector("#listingImage");

  if (listingImage) {
    listingImage.src = product.image;
    listingImage.alt = product.title;

    listingImage.addEventListener(
      "error",
      () => {
        listingImage.style.opacity = "0";
      }
    );
  }

  setText(
    "#listingCategory",
    product.category
  );

  setText(
    "#listingTitle",
    product.title
  );

  setText(
    "#breadcrumbTitle",
    product.title
  );

  setText(
    "#listingDescription",
    product.description
  );

  setText(
    "#listingPrice",
    formatMoney(product.price)
  );

  setText(
    "#listingCondition",
    product.condition
  );

  setText(
    "#listingLocation",
    product.location
  );

  setText(
    "#detailOverview",
    product.overview
  );

  setText(
    "#listingReference",
    product.reference
  );

  /* =========================================================
     SPECIFICATIONS
     ========================================================= */

  const specifications =
    document.querySelector(
      "#specifications"
    );

  if (specifications) {
    specifications.innerHTML =
      product.specs
        .map(
          ([label, value]) => `
            <div class="specification-item">

              <span>
                ${escapeHTML(label)}
              </span>

              <strong>
                ${escapeHTML(value)}
              </strong>

            </div>
          `
        )
        .join("");
  }

  /* =========================================================
     WATCHLIST
     ========================================================= */

  const watchButton =
    document.querySelector(
      "#watchButton"
    );

  const getWatchlist = () => {
    return readStorage(WATCHLIST_KEY);
  };

  const isProductSaved = () => {
    const watchlist =
      getWatchlist();

    return watchlist.some(
      (item) => {
        if (typeof item === "string") {
          return (
            item === product.title ||
            item === product.id
          );
        }

        return (
          item?.id === product.id ||
          item?.productId === product.id ||
          item?.title === product.title ||
          item?.name === product.title
        );
      }
    );
  };

  const updateWatchButton = () => {
    if (!watchButton) {
      return;
    }

    const saved =
      isProductSaved();

    watchButton.textContent =
      saved
        ? "♥ In Watchlist"
        : "♡ Add to Watchlist";

    watchButton.classList.toggle(
      "active",
      saved
    );

    watchButton.setAttribute(
      "aria-pressed",
      String(saved)
    );
  };

  updateWatchButton();

  if (watchButton) {
    watchButton.addEventListener(
      "click",
      () => {
        let watchlist =
          getWatchlist();

        const existingIndex =
          watchlist.findIndex(
            (item) => {
              if (typeof item === "string") {
                return (
                  item === product.title ||
                  item === product.id
                );
              }

              return (
                item?.id === product.id ||
                item?.productId === product.id ||
                item?.title === product.title ||
                item?.name === product.title
              );
            }
          );

        if (existingIndex !== -1) {
          watchlist.splice(
            existingIndex,
            1
          );
        } else {
          /*
           * Store a complete object so the
           * Account page can render it later.
           */
          watchlist.push({
            id: product.id,
            title: product.title,
            price: product.price,
            image: product.image
          });
        }

        if (
          writeStorage(
            WATCHLIST_KEY,
            watchlist
          )
        ) {
          updateWatchButton();

          /*
           * Let other open AUCTION X pages
           * know the watchlist changed.
           */
          window.dispatchEvent(
            new StorageEvent(
              "storage",
              {
                key: WATCHLIST_KEY
              }
            )
          );
        }
      }
    );
  }

  /* =========================================================
     CART
     ========================================================= */

  const getCart = () => {
    return readStorage(CART_KEY);
  };

  const saveCart = (cart) => {
    return writeStorage(
      CART_KEY,
      cart
    );
  };

  const getCartQuantity = () => {
    return getCart().reduce(
      (total, item) => {
        const quantity =
          Number(item?.quantity);

        return (
          total +
          (
            quantity > 0
              ? quantity
              : 1
          )
        );
      },
      0
    );
  };

  const updateNavbarCart = () => {
    const cartCount =
      document.querySelector(
        "#cartCount"
      );

    if (cartCount) {
      cartCount.textContent =
        getCartQuantity();
    }
  };

  const addProductToCart = () => {
    const cart =
      getCart();

    const existing =
      cart.find(
        (item) =>
          item?.name === product.title ||
          item?.id === product.id ||
          item?.productId === product.id
      );

    if (existing) {
      existing.quantity =
        Math.max(
          1,
          Number(existing.quantity) || 1
        ) + 1;

      /*
       * Keep old cart data compatible
       * with the current cart page.
       */
      existing.name =
        existing.name ||
        product.title;

      existing.id =
        existing.id ||
        product.id;

      existing.price =
        Number(existing.price) ||
        product.price;

      existing.image =
        existing.image ||
        product.image;
    } else {
      cart.push({
        id: product.id,
        productId: product.id,
        name: product.title,
        title: product.title,
        price: product.price,
        image: product.image,
        quantity: 1
      });
    }

    return saveCart(cart);
  };

  /* =========================================================
     ADD TO CART BUTTON
     ========================================================= */

  const addToCartButton =
    document.querySelector(
      "#addToCartButton"
    );

  if (addToCartButton) {
    addToCartButton.addEventListener(
      "click",
      () => {
        const saved =
          addProductToCart();

        if (!saved) {
          return;
        }

        updateNavbarCart();

        addToCartButton.classList.add(
          "added"
        );

        addToCartButton.disabled =
          true;

        addToCartButton.innerHTML = `
          Added to Cart
          <span>✓</span>
        `;

        setTimeout(() => {
          addToCartButton.disabled =
            false;

          addToCartButton.classList.remove(
            "added"
          );

          addToCartButton.innerHTML = `
            Add to Cart
            <span>→</span>
          `;
        }, 1600);
      }
    );
  }

  updateNavbarCart();

  /* =========================================================
     RELATED PRODUCTS
     ========================================================= */

  const relatedContainer =
    document.querySelector(
      "#relatedProducts"
    );

  if (relatedContainer) {
    /*
     * Prefer products from the same category.
     * Then fill remaining slots from the catalog.
     */
    const sameCategory =
      products.filter(
        (item) =>
          item.id !== product.id &&
          item.category === product.category
      );

    const remaining =
      products.filter(
        (item) =>
          item.id !== product.id &&
          item.category !== product.category
      );

    const related = [
      ...sameCategory,
      ...remaining
    ].slice(0, 4);

    relatedContainer.innerHTML =
      related
        .map(
          (item) => `
            <a
              href="listing.html?id=${encodeURIComponent(
                item.id
              )}"
              class="related-card"
            >

              <div class="related-card-image">

                <img
                  src="${escapeHTML(item.image)}"
                  alt="${escapeHTML(item.title)}"
                  loading="lazy"
                  decoding="async"
                />

                <span>
                  ${escapeHTML(item.category)}
                </span>

              </div>

              <div class="related-card-content">

                <span>
                  ${escapeHTML(item.brand)}
                </span>

                <strong>
                  ${escapeHTML(item.title)}
                </strong>

                <p>
                  ${formatMoney(item.price)}
                </p>

              </div>

            </a>
          `
        )
        .join("");
  }

  /* =========================================================
     KEYBOARD / ACCESSIBILITY
     ========================================================= */

  if (watchButton) {
    watchButton.setAttribute(
      "aria-label",
      `Add ${product.title} to watchlist`
    );
  }

  if (addToCartButton) {
    addToCartButton.setAttribute(
      "aria-label",
      `Add ${product.title} to cart`
    );
  }

  /* =========================================================
     DEBUG
     ========================================================= */

  console.log(
    "AUCTION X listing loaded:",
    product.title
  );
});