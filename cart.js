document.addEventListener("DOMContentLoaded", () => {
  const CART_KEY = "auctionXCart";

  const cartItems = document.querySelector("#cartItems");
  const cartEmpty = document.querySelector("#cartEmpty");
  const cartCount = document.querySelector("#cartCount");
  const cartItemHeading = document.querySelector("#cartItemHeading");

  const summaryItems = document.querySelector("#summaryItems");
  const summaryShipping = document.querySelector("#summaryShipping");
  const summaryService = document.querySelector("#summaryService");
  const summaryTotal = document.querySelector("#summaryTotal");

  const clearCartButton = document.querySelector("#clearCart");
  const checkoutButton = document.querySelector("#checkoutButton");

  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  // ==================================================
  // PRODUCT DATABASE
  // ==================================================

  const products = {
    "iPhone 17 Pro": {
      image: "assets/images/iphone-17-pro.jpg",
      category: "GADGETS",
      brand: "Apple",
      condition: "Like New",
      price: 1200,
    },

    "iPhone 17 Pro Max": {
      image: "assets/images/iphone-17-pro-max.jpg",
      category: "GADGETS",
      brand: "Apple",
      condition: "Like New",
      price: 1350,
    },

    "iPhone 16 Pro": {
      image: "assets/images/iphone-16-pro.jpg",
      category: "GADGETS",
      brand: "Apple",
      condition: "Excellent",
      price: 950,
    },

    "iPhone 16 Pro Max": {
      image: "assets/images/iphone-16-pro-max.jpg",
      category: "GADGETS",
      brand: "Apple",
      condition: "Excellent",
      price: 1050,
    },

    "iPhone 16": {
      image: "assets/images/iphone-16.jpg",
      category: "GADGETS",
      brand: "Apple",
      condition: "Excellent",
      price: 800,
    },

    "iPhone 15 Pro": {
      image: "assets/images/iphone-15-pro.jpg",
      category: "GADGETS",
      brand: "Apple",
      condition: "Very Good",
      price: 650,
    },

    "iPhone 14 Pro": {
      image: "assets/images/iphone-14-pro.jpg",
      category: "GADGETS",
      brand: "Apple",
      condition: "Very Good",
      price: 520,
    },

    "Galaxy S26 Ultra": {
      image: "assets/images/galaxy-s26-ultra.jpg",
      category: "GADGETS",
      brand: "Samsung",
      condition: "Like New",
      price: 1100,
    },

    "Galaxy Z Fold": {
      image: "assets/images/galaxy-z-fold.jpg",
      category: "GADGETS",
      brand: "Samsung",
      condition: "Like New",
      price: 1250,
    },

    "MacBook Air": {
      image: "assets/images/macbook-air.jpg",
      category: "GADGETS",
      brand: "Apple",
      condition: "Excellent",
      price: 850,
    },

    "Rolex Watch": {
      image: "assets/images/rolex-watch.jpg",
      category: "LUXURY",
      brand: "Rolex",
      condition: "Excellent",
      price: 3200,
    },

    "Cartier Watch": {
      image: "assets/images/cartier-watch.jpg",
      category: "LUXURY",
      brand: "Cartier",
      condition: "Excellent",
      price: 2800,
    },
  };

  // ==================================================
  // MONEY
  // ==================================================

  function formatMoney(value) {
    return formatter.format(Number(value) || 0);
  }

  // ==================================================
  // CART STORAGE
  // ==================================================

  function getCart() {
    try {
      const saved = localStorage.getItem(CART_KEY);

      if (!saved) {
        return [];
      }

      const parsed = JSON.parse(saved);

      return Array.isArray(parsed)
        ? parsed
        : [];
    } catch {
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem(
      CART_KEY,
      JSON.stringify(cart)
    );
  }

  function normalizeCart(cart) {
    return cart
      .map((item) => {

        if (typeof item === "string") {
          return {
            name: item,
            quantity: 1,
          };
        }

        return {
          name: item?.name || "",
          quantity: Math.max(
            1,
            Number(item?.quantity) || 1
          ),
        };
      })
      .filter((item) => products[item.name]);
  }

  // ==================================================
  // CART COUNT
  // ==================================================

  function updateCartCount(cart) {
    const quantity = cart.reduce(
      (total, item) =>
        total + item.quantity,
      0
    );

    if (cartCount) {
      cartCount.textContent = quantity;
    }
  }

  // ==================================================
  // HEADING
  // ==================================================

  function updateHeading(cart) {
    const quantity = cart.reduce(
      (total, item) =>
        total + item.quantity,
      0
    );

    if (cartItemHeading) {
      cartItemHeading.textContent =
        `${quantity} ${
          quantity === 1
            ? "Listing"
            : "Listings"
        }`;
    }
  }

  // ==================================================
  // SUMMARY
  // ==================================================

  function updateSummary(subtotal) {
    const serviceFee = 0;

    if (summaryItems) {
      summaryItems.textContent =
        formatMoney(subtotal);
    }

    if (summaryShipping) {
      summaryShipping.textContent =
        "Calculated later";
    }

    if (summaryService) {
      summaryService.textContent =
        formatMoney(serviceFee);
    }

    if (summaryTotal) {
      summaryTotal.textContent =
        formatMoney(
          subtotal + serviceFee
        );
    }
  }

  // ==================================================
  // CHANGE QUANTITY
  // ==================================================

  function changeQuantity(name, change) {

    const cart =
      normalizeCart(getCart());

    const item =
      cart.find(
        (cartItem) =>
          cartItem.name === name
      );

    if (!item) {
      return;
    }

    item.quantity += change;

    // Never allow quantity below 1.
    if (item.quantity < 1) {
      item.quantity = 1;
    }

    saveCart(cart);

    renderCart();
  }

  // ==================================================
  // REMOVE ITEM
  // ==================================================

  function removeItem(name) {

    const cart =
      normalizeCart(getCart());

    const updatedCart =
      cart.filter(
        (item) =>
          item.name !== name
      );

    saveCart(updatedCart);

    renderCart();
  }

  // ==================================================
  // RENDER CART
  // ==================================================

  function renderCart() {

    const cart =
      normalizeCart(
        getCart()
      );

    // Clean storage
    saveCart(cart);

    updateCartCount(cart);
    updateHeading(cart);

    // ------------------------------
    // EMPTY
    // ------------------------------

    if (!cart.length) {

      if (cartItems) {
        cartItems.innerHTML = "";
      }

      if (cartEmpty) {
        cartEmpty.hidden = false;
      }

      if (clearCartButton) {
        clearCartButton.style.display =
          "none";
      }

      updateSummary(0);

      return;
    }

    // ------------------------------
    // ITEMS EXIST
    // ------------------------------

    if (cartEmpty) {
      cartEmpty.hidden = true;
    }

    if (clearCartButton) {
      clearCartButton.style.display =
        "";
    }

    let subtotal = 0;

    // ------------------------------
    // BUILD CART ITEMS
    // ------------------------------

    cartItems.innerHTML =
      cart.map((item) => {

        const product =
          products[item.name];

        const lineTotal =
          product.price *
          item.quantity;

        subtotal += lineTotal;

        return `
          <article class="cart-item">

            <a
              href="listing.html?item=${encodeURIComponent(
                item.name
              )}"
              class="cart-item-image"
              aria-label="View ${item.name}"
            >
              <img
                src="${product.image}"
                alt="${item.name}"
                width="150"
                height="125"
                loading="lazy"
                decoding="async"
              />
            </a>

            <div class="cart-item-info">

              <span class="cart-item-category">
                ${product.category}
              </span>

              <h3 class="cart-item-name">
                ${item.name}
              </h3>

              <div class="cart-item-meta">

                <span>
                  ${product.brand}
                </span>

                <span>
                  ${product.condition}
                </span>

              </div>

              <!-- QUANTITY -->
              <div class="cart-quantity">

                <button
                  type="button"
                  class="quantity-button"
                  data-quantity-minus="${encodeURIComponent(
                    item.name
                  )}"
                  aria-label="Decrease quantity"
                >
                  −
                </button>

                <span class="quantity-value">
                  ${item.quantity}
                </span>

                <button
                  type="button"
                  class="quantity-button"
                  data-quantity-plus="${encodeURIComponent(
                    item.name
                  )}"
                  aria-label="Increase quantity"
                >
                  +
                </button>

              </div>

            </div>

            <div class="cart-item-actions">

              <strong class="cart-item-price">
                ${formatMoney(lineTotal)}
              </strong>

              <button
                type="button"
                class="remove-item"
                data-remove="${encodeURIComponent(
                  item.name
                )}"
              >
                REMOVE
              </button>

            </div>

          </article>
        `;

      }).join("");

    // ==================================================
    // MINUS BUTTONS
    // ==================================================

    cartItems
      .querySelectorAll(
        "[data-quantity-minus]"
      )
      .forEach((button) => {

        button.addEventListener(
          "click",
          () => {

            const name =
              decodeURIComponent(
                button.dataset.quantityMinus
              );

            changeQuantity(
              name,
              -1
            );

          }
        );

      });

    // ==================================================
    // PLUS BUTTONS
    // ==================================================

    cartItems
      .querySelectorAll(
        "[data-quantity-plus]"
      )
      .forEach((button) => {

        button.addEventListener(
          "click",
          () => {

            const name =
              decodeURIComponent(
                button.dataset.quantityPlus
              );

            changeQuantity(
              name,
              1
            );

          }
        );

      });

    // ==================================================
    // REMOVE BUTTONS
    // ==================================================

    cartItems
      .querySelectorAll(
        "[data-remove]"
      )
      .forEach((button) => {

        button.addEventListener(
          "click",
          () => {

            const name =
              decodeURIComponent(
                button.dataset.remove
              );

            removeItem(name);

          }
        );

      });

    // ==================================================
    // SUMMARY
    // ==================================================

    updateSummary(subtotal);
  }

  // ==================================================
  // CLEAR CART
  // ==================================================

  if (clearCartButton) {

    clearCartButton.addEventListener(
      "click",
      () => {

        saveCart([]);

        renderCart();

      }
    );

  }

  // ==================================================
  // CHECKOUT
  // ==================================================

  if (checkoutButton) {

    checkoutButton.addEventListener(
      "click",
      () => {

        const cart =
          normalizeCart(
            getCart()
          );

        if (!cart.length) {
          return;
        }

        window.location.href =
          "checkout.html";
      }
    );

  }

  // ==================================================
  // START
  // ==================================================

  renderCart();
});