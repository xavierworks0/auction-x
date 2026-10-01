/* =========================================================
   AUCTION X — CHECKOUT
   ========================================================= */

const CART_KEY = "auctionXCart";
const ORDER_KEY = "auctionXOrder";
const API_URL = "https://auction-x-api.onrender.com";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});


/* =========================================================
   PRODUCTS
   ========================================================= */

const products = [
  { id: "iphone-17-pro", title: "iPhone 17 Pro", price: 1200, image: "assets/images/iphone-17-pro.jpg" },
  { id: "iphone-17-pro-max", title: "iPhone 17 Pro Max", price: 1350, image: "assets/images/iphone-17-pro-max.jpg" },
  { id: "iphone-16-pro", title: "iPhone 16 Pro", price: 950, image: "assets/images/iphone-16-pro.jpg" },
  { id: "iphone-16-pro-max", title: "iPhone 16 Pro Max", price: 1050, image: "assets/images/iphone-16-pro-max.jpg" },
  { id: "iphone-16", title: "iPhone 16", price: 800, image: "assets/images/iphone-16.jpg" },
  { id: "iphone-15-pro", title: "iPhone 15 Pro", price: 650, image: "assets/images/iphone-15-pro.jpg" },
  { id: "iphone-14-pro", title: "iPhone 14 Pro", price: 520, image: "assets/images/iphone-14-pro.jpg" },
  { id: "galaxy-s26-ultra", title: "Galaxy S26 Ultra", price: 1100, image: "assets/images/galaxy-s26-ultra.jpg" },
  { id: "galaxy-z-fold", title: "Galaxy Z Fold", price: 1250, image: "assets/images/galaxy-z-fold.jpg" },
  { id: "macbook-air", title: "MacBook Air", price: 850, image: "assets/images/macbook-air.jpg" },
  { id: "rolex-watch", title: "Rolex Watch", price: 3200, image: "assets/images/rolex-watch.jpg" },
  { id: "cartier-watch", title: "Cartier Watch", price: 2800, image: "assets/images/cartier-watch.jpg" }
];


/* =========================================================
   HELPERS
   ========================================================= */

function getCart() {
  try {
    const stored = localStorage.getItem(CART_KEY);

    if (!stored) return [];

    const parsed = JSON.parse(stored);

    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Unable to read cart:", error);
    return [];
  }
}


function saveOrder(order) {
  try {
    localStorage.setItem(
      ORDER_KEY,
      JSON.stringify(order)
    );
  } catch (error) {
    console.error("Unable to save order:", error);
  }
}


function getApiUrl(path) {
  return `${API_URL}${path}`;
}


async function parseApiResponse(response) {
  let data = null;

  try {
    data = await response.json();
  } catch (error) {
    throw new Error("The server returned an invalid response.");
  }

  if (!response.ok || !data.success) {
    throw new Error(
      data?.message ||
      data?.error ||
      "The server could not complete your request."
    );
  }

  return data;
}


function findProduct(item) {
  if (!item) return null;

  const productId =
    item.productId ||
    item.id ||
    item.product_id;

  const productName =
    item.name ||
    item.title;

  return (
    products.find(
      (product) => product.id === productId
    ) ||
    products.find(
      (product) =>
        product.title.toLowerCase() ===
        String(productName || "").toLowerCase()
    ) ||
    null
  );
}


/* =========================================================
   PAYMENT METHOD
   ========================================================= */

let selectedPaymentMethod = "crypto";
let selectedCrypto = "btc";


function setPaymentMethod(method) {
  selectedPaymentMethod = method;

  document
    .querySelectorAll("[data-payment-method]")
    .forEach((element) => {
      element.classList.toggle(
        "active",
        element.dataset.paymentMethod === method
      );
    });

  const cryptoSection =
    document.getElementById("cryptoPaymentSection");

  const cardSection =
    document.getElementById("cardPaymentSection");

  if (cryptoSection) {
    cryptoSection.style.display =
      method === "crypto" ? "" : "none";
  }

  if (cardSection) {
    cardSection.style.display =
      method === "card" ? "" : "none";
  }
}


function setCryptoCurrency(currency) {
  selectedCrypto = currency;

  document
    .querySelectorAll("[data-crypto]")
    .forEach((element) => {
      element.classList.toggle(
        "active",
        element.dataset.crypto === currency
      );
    });
}


/* =========================================================
   CRYPTO MAP
   ========================================================= */

const cryptoCurrencyMap = {
  btc: "btc",
  sol: "sol",
  usdt: "usdterc20",
  usdc: "usdc"
};


/* =========================================================
   RENDER CHECKOUT
   ========================================================= */

function renderCheckout() {
  const cart = getCart();

  const itemsContainer =
    document.getElementById("checkoutItems");

  const subtotalElement =
    document.getElementById("subtotal");

  const totalElement =
    document.getElementById("total");

  let subtotal = 0;

  if (!itemsContainer) return;

  itemsContainer.innerHTML = cart
    .map((item) => {
      const product = findProduct(item);

      if (!product) return "";

      const quantity =
        Math.max(1, Number(item.quantity || 1));

      const lineTotal =
        product.price * quantity;

      subtotal += lineTotal;

      return `
        <div class="checkout-item">
          <div class="checkout-item-image">
            <img
              src="${product.image}"
              alt="${product.title}"
            />
          </div>

          <div class="checkout-item-info">
            <strong>${product.title}</strong>
            <span>Qty ${quantity}</span>
          </div>

          <div class="checkout-item-price">
            ${currencyFormatter.format(lineTotal)}
          </div>
        </div>
      `;
    })
    .join("");

  if (subtotalElement) {
    subtotalElement.textContent =
      currencyFormatter.format(subtotal);
  }

  if (totalElement) {
    totalElement.textContent =
      currencyFormatter.format(subtotal);
  }
}


/* =========================================================
   CALCULATE CART TOTAL
   ========================================================= */

function calculateCartTotal() {
  const cart = getCart();

  return cart.reduce((total, item) => {
    const product = findProduct(item);

    if (!product) return total;

    const quantity =
      Math.max(1, Number(item.quantity || 1));

    return total + product.price * quantity;
  }, 0);
}


/* =========================================================
   CREATE SERVER ORDER
   ========================================================= */

async function createServerOrder({
  customer,
  items,
  paymentMethod,
  cryptoCurrency
}) {
  const payload = {
    paymentMethod,

    cryptoCurrency:
      paymentMethod === "crypto"
        ? cryptoCurrency
        : null,

    customer: {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      city: customer.city,
      state: customer.state,
      country: customer.country,
      postalCode: customer.postalCode
    },

    items
  };

  console.log(
    "AUCTION X — Creating server order:",
    payload
  );

  const response = await fetch(
    getApiUrl("/api/orders/create"),
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify(payload)
    }
  );

  const data =
    await parseApiResponse(response);

  console.log(
    "AUCTION X — Server order created:",
    data
  );

  return data;
}


/* =========================================================
   CREATE CRYPTO PAYMENT
   ========================================================= */

async function createCryptoPayment({
  amount,
  reference,
  email,
  crypto
}) {
  const payCurrency =
    cryptoCurrencyMap[crypto];

  if (!payCurrency) {
    throw new Error(
      "Unsupported cryptocurrency selected."
    );
  }

  const payload = {
    amount,
    pay_currency: payCurrency,
    order_id: reference,
    customer_email: email
  };

  console.log(
    "AUCTION X — Creating crypto payment:",
    payload
  );

  const response = await fetch(
    getApiUrl("/api/crypto/create"),
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify(payload)
    }
  );

  const data =
    await parseApiResponse(response);

  console.log(
    "AUCTION X — Crypto payment created:",
    data
  );

  return data;
}


/* =========================================================
   CARD PAYMENT
   ========================================================= */

async function initializeCardPayment({
  email,
  amount,
  reference
}) {
  const response = await fetch(
    getApiUrl("/api/payment/initialize"),
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        email,
        amount,
        reference,
        callback_url:
          `${window.location.origin}/confirmation.html`
      })
    }
  );

  return parseApiResponse(response);
}


/* =========================================================
   CHECKOUT FORM
   ========================================================= */

const checkoutForm =
  document.getElementById("checkoutForm");


checkoutForm?.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    const submitButton =
      checkoutForm.querySelector(
        'button[type="submit"]'
      );

    try {

      /* -----------------------------------------
         CART CHECK
         ----------------------------------------- */

      const cart = getCart();

      if (!cart.length) {
        alert("Your cart is empty.");
        return;
      }


      /* -----------------------------------------
         REQUIRED FIELD CHECK
         ----------------------------------------- */

      const requiredInputs =
        checkoutForm.querySelectorAll(
          "input[required], select[required], textarea[required]"
        );

      let missingField = null;

      requiredInputs.forEach((input) => {
        const value =
          String(input.value || "").trim();

        if (!value && !missingField) {
          missingField = input;
        }
      });

      if (missingField) {
        missingField.focus();

        alert(
          `Please complete your ${
            missingField.name ||
            missingField.id ||
            "required information"
          }.`
        );

        return;
      }


      /* -----------------------------------------
         FORM DATA
         ----------------------------------------- */

      const formData =
        new FormData(checkoutForm);


      /* -----------------------------------------
         CUSTOMER DATA
         ----------------------------------------- */

      const customer = {
        name: String(
          formData.get("fullName") || ""
        ).trim(),

        email: String(
          formData.get("email") || ""
        ).trim(),

        phone: String(
          formData.get("phone") || ""
        ).trim(),

        address: String(
          formData.get("address") || ""
        ).trim(),

        city: String(
          formData.get("city") || ""
        ).trim(),

        state: String(
          formData.get("state") || ""
        ).trim(),

        country: String(
          formData.get("country") || ""
        ).trim(),

        postalCode: String(
          formData.get("postalCode") || ""
        ).trim()
      };


      /* -----------------------------------------
         CUSTOMER VALIDATION
         ----------------------------------------- */

      for (const [field, value] of Object.entries(customer)) {
        if (!value) {
          const input =
            checkoutForm.querySelector(
              `[name="${field}"], #${field}`
            );

          input?.focus();

          throw new Error(
            `Please complete your ${field}.`
          );
        }
      }


      /* -----------------------------------------
         EMAIL VALIDATION
         ----------------------------------------- */

      const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailPattern.test(customer.email)) {
        throw new Error(
          "Please enter a valid email address."
        );
      }


      /* -----------------------------------------
         PAYMENT VALIDATION
         ----------------------------------------- */

      if (
        !["crypto", "card"].includes(
          selectedPaymentMethod
        )
      ) {
        throw new Error(
          "Please select a valid payment method."
        );
      }

      if (
        selectedPaymentMethod === "crypto" &&
        !cryptoCurrencyMap[selectedCrypto]
      ) {
        throw new Error(
          "Please select a valid cryptocurrency."
        );
      }


      /* -----------------------------------------
         DISABLE BUTTON
         ----------------------------------------- */

      if (submitButton) {
        submitButton.disabled = true;

        submitButton.dataset.originalText =
          submitButton.textContent;

        submitButton.textContent =
          "PROCESSING...";
      }


      /* -----------------------------------------
         CART ITEMS
         ----------------------------------------- */

      const serverItems =
        cart
          .map((item) => {
            const product =
              findProduct(item);

            if (!product) {
              return null;
            }

            return {
              productId: product.id,
              title: product.title,
              quantity: Math.max(
                1,
                Number(item.quantity || 1)
              )
            };
          })
          .filter(Boolean);


      if (!serverItems.length) {
        throw new Error(
          "No valid products were found in your cart."
        );
      }


      /* -----------------------------------------
         TOTAL
         ----------------------------------------- */

      const amount =
        calculateCartTotal();

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error(
          "Unable to calculate your order total."
        );
      }


      /* -----------------------------------------
         CREATE SERVER ORDER
         ----------------------------------------- */

      const serverOrder =
        await createServerOrder({
          customer,
          items: serverItems,

          paymentMethod:
            selectedPaymentMethod,

          cryptoCurrency:
            selectedPaymentMethod === "crypto"
              ? selectedCrypto
              : null
        });


      const order =
        serverOrder.order;


      if (!order || !order.reference) {
        throw new Error(
          "The server created an invalid order."
        );
      }


      /* -----------------------------------------
         CRYPTO PAYMENT
         ----------------------------------------- */

      if (
        selectedPaymentMethod === "crypto"
      ) {

        const payment =
          await createCryptoPayment({
            amount,
            reference:
              order.reference,
            email:
              customer.email,
            crypto:
              selectedCrypto
          });


        const paymentData =
          payment.payment || payment;


        /* ---------------------------------------
           SAVE ORDER
           --------------------------------------- */

        const updatedOrder = {
          ...order,

          customer,

          items: serverItems,

          paymentMethod: "crypto",

          cryptoCurrency:
            selectedCrypto,

          payment: {
            payment_id:
              paymentData.payment_id || null,

            payment_status:
              paymentData.payment_status ||
              "waiting",

            pay_address:
              paymentData.pay_address || null,

            pay_amount:
              paymentData.pay_amount || null,

            pay_currency:
              paymentData.pay_currency ||
              cryptoCurrencyMap[
                selectedCrypto
              ],

            price_amount:
              paymentData.price_amount ||
              amount,

            price_currency:
              paymentData.price_currency ||
              "usd"
          }
        };


        saveOrder(updatedOrder);


        /* ---------------------------------------
           REDIRECT
           --------------------------------------- */

        window.location.href =
          "confirmation.html";

        return;
      }


      /* -----------------------------------------
         CARD PAYMENT
         ----------------------------------------- */

      if (
        selectedPaymentMethod === "card"
      ) {

        const payment =
          await initializeCardPayment({
            email:
              customer.email,

            amount,

            reference:
              order.reference
          });


        saveOrder({
          ...order,

          customer,

          items: serverItems,

          paymentMethod: "card",

          payment
        });


        if (
          payment.authorization_url
        ) {
          window.location.href =
            payment.authorization_url;

          return;
        }

        throw new Error(
          "Card payment could not be initialized."
        );
      }


    } catch (error) {

      console.error(
        "AUCTION X CHECKOUT ERROR:",
        error
      );

      alert(
        error?.message ||
        "Unable to process your order. Please try again."
      );

      if (submitButton) {
        submitButton.disabled = false;

        submitButton.textContent =
          submitButton.dataset.originalText ||
          "CONTINUE TO PAYMENT";
      }
    }
  }
);


/* =========================================================
   PAYMENT METHOD EVENTS
   ========================================================= */

document
  .querySelectorAll("[data-payment-method]")
  .forEach((element) => {
    element.addEventListener(
      "click",
      () => {
        setPaymentMethod(
          element.dataset.paymentMethod
        );
      }
    );
  });


/* =========================================================
   CRYPTO EVENTS
   ========================================================= */

document
  .querySelectorAll("[data-crypto]")
  .forEach((element) => {
    element.addEventListener(
      "click",
      () => {
        setCryptoCurrency(
          element.dataset.crypto
        );
      }
    );
  });


/* =========================================================
   INITIAL STATE
   ========================================================= */

renderCheckout();

setPaymentMethod("crypto");

setCryptoCurrency("btc");