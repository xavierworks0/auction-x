const CART_KEY = "auctionXCart";
const ORDER_KEY = "auctionXLastOrder";

/* =========================================================
   API
   ========================================================= */

const API_URL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:4242"
    : "https://auction-x-api.onrender.com";

const getApiUrl = (path) => {
  return `${API_URL}${path}`;
};


/* =========================================================
   PRODUCTS
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
   CURRENCY
   ========================================================= */

const currencyFormatter =
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  });


/* =========================================================
   LOCAL STORAGE
   ========================================================= */

const getCart = () => {
  try {
    return (
      JSON.parse(
        localStorage.getItem(CART_KEY)
      ) || []
    );
  } catch {
    return [];
  }
};

const saveOrder = (order) => {
  localStorage.setItem(
    ORDER_KEY,
    JSON.stringify(order)
  );
};

const getOrder = () => {
  try {
    return JSON.parse(
      localStorage.getItem(ORDER_KEY)
    );
  } catch {
    return null;
  }
};


/* =========================================================
   PRODUCT HELPERS
   ========================================================= */

const findProduct = (name) => {
  return products.find(
    (product) =>
      product.title === name
  );
};

const findProductById = (id) => {
  return products.find(
    (product) =>
      product.id === id
  );
};


/* =========================================================
   CART CALCULATION
   ========================================================= */

const calculateSubtotal = (cart) => {
  return cart.reduce(
    (total, item) => {
      const product =
        findProduct(item.name);

      if (!product) {
        return total;
      }

      const quantity = Math.max(
        1,
        Number(item.quantity || 1)
      );

      return (
        total +
        product.price * quantity
      );
    },
    0
  );
};


/* =========================================================
   PAYMENT METHOD UI
   ========================================================= */

let selectedPaymentMethod = "crypto";
let selectedCrypto = "btc";

const cardPaymentOption =
  document.getElementById(
    "cardPaymentOption"
  );

const cryptoPaymentOption =
  document.getElementById(
    "cryptoPaymentOption"
  );

const cryptoOptions =
  document.getElementById(
    "cryptoOptions"
  );

const cryptoCurrencyButtons =
  document.querySelectorAll(
    ".crypto-currency"
  );


const setPaymentMethod = (
  method
) => {
  selectedPaymentMethod = method;

  cardPaymentOption?.classList.toggle(
    "active",
    method === "card"
  );

  cryptoPaymentOption?.classList.toggle(
    "active",
    method === "crypto"
  );

  if (cryptoOptions) {
    cryptoOptions.hidden =
      method !== "crypto";
  }
};


cardPaymentOption?.addEventListener(
  "click",
  () => {
    setPaymentMethod("card");
  }
);


cryptoPaymentOption?.addEventListener(
  "click",
  () => {
    setPaymentMethod("crypto");
  }
);


cryptoCurrencyButtons.forEach(
  (button) => {
    button.addEventListener(
      "click",
      () => {
        cryptoCurrencyButtons.forEach(
          (item) => {
            item.classList.remove(
              "active"
            );
          }
        );

        button.classList.add(
          "active"
        );

        selectedCrypto =
          button.dataset.crypto ||
          "btc";
      }
    );
  }
);


/* =========================================================
   CHECKOUT SUMMARY
   ========================================================= */

const renderCheckout = () => {
  const cart = getCart();

  const itemsContainer =
    document.getElementById(
      "checkoutItems"
    );

  const subtotalElement =
    document.getElementById(
      "checkoutSubtotal"
    );

  const totalElement =
    document.getElementById(
      "checkoutTotal"
    );

  if (!itemsContainer) {
    return;
  }

  if (!cart.length) {
    itemsContainer.innerHTML = `
      <div class="checkout-empty">
        <p>Your cart is empty.</p>
        <a href="index.html">
          Return to marketplace →
        </a>
      </div>
    `;

    if (subtotalElement) {
      subtotalElement.textContent =
        currencyFormatter.format(0);
    }

    if (totalElement) {
      totalElement.textContent =
        currencyFormatter.format(0);
    }

    return;
  }

  let subtotal = 0;

  itemsContainer.innerHTML =
    cart
      .map((item) => {
        const product =
          findProduct(item.name);

        if (!product) {
          return "";
        }

        const quantity =
          Math.max(
            1,
            Number(
              item.quantity || 1
            )
          );

        const lineTotal =
          product.price *
          quantity;

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
              <strong>
                ${product.title}
              </strong>

              <span>
                Qty ${quantity}
              </span>
            </div>

            <div class="checkout-item-price">
              ${currencyFormatter.format(
                lineTotal
              )}
            </div>

          </div>
        `;
      })
      .join("");

  if (subtotalElement) {
    subtotalElement.textContent =
      currencyFormatter.format(
        subtotal
      );
  }

  if (totalElement) {
    totalElement.textContent =
      currencyFormatter.format(
        subtotal
      );
  }
};


/* =========================================================
   CREATE SERVER ORDER
   ========================================================= */

const createServerOrder =
  async ({
    formData,
    cart,
    paymentMethod,
    cryptoCurrency
  }) => {

    const fullName =
      formData
        .get("fullName")
        ?.trim() || "";

    const email =
      formData
        .get("email")
        ?.trim() || "";

    const phone =
      formData
        .get("phone")
        ?.trim() || "";

    const country =
      formData
        .get("country")
        ?.trim() || "";

    const address =
      formData
        .get("address")
        ?.trim() || "";

    const postalCode =
      formData
        .get("postalCode")
        ?.trim() || "";

    const state =
      formData
        .get("state")
        ?.trim() || "";

    /*
      The current checkout form does not
      appear to have a dedicated city field.

      Until one is added to checkout.html,
      use the state as a fallback so the
      backend receives the required field.
    */

    const city =
      formData
        .get("city")
        ?.trim() ||
      state;

    const items =
      cart.map((item) => {
        const product =
          findProduct(item.name);

        if (!product) {
          return null;
        }

        return {
          productId:
            product.id,

          quantity:
            Math.max(
              1,
              Number(
                item.quantity || 1
              )
            )
        };
      })
      .filter(Boolean);

    const response =
      await fetch(
        getApiUrl(
          "/api/orders/create"
        ),
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            paymentMethod,

            cryptoCurrency:
              paymentMethod ===
              "crypto"
                ? cryptoCurrency
                : null,

            customer: {
              name: fullName,
              email,
              phone,
              address,
              city,
              state,
              country,
              postalCode
            },

            items
          })
        }
      );

    let data;

    try {
      data =
        await response.json();
    } catch {
      throw new Error(
        "The AUCTION X API returned an invalid response."
      );
    }

    if (
      !response.ok ||
      !data.success ||
      !data.order
    ) {
      throw new Error(
        data.error ||
        "Unable to create your order."
      );
    }

    return data.order;
  };


/* =========================================================
   CARD PAYMENT
   ========================================================= */

const initializeCardPayment =
  async ({
    email,
    reference
  }) => {

    const response =
      await fetch(
        getApiUrl(
          "/api/payment/initialize"
        ),
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            email,
            reference,

            callback_url:
              `${window.location.origin}/confirmation.html`
          })
        }
      );

    let data;

    try {
      data =
        await response.json();
    } catch {
      throw new Error(
        "Invalid payment server response."
      );
    }

    if (
      !response.ok ||
      !data.success
    ) {
      throw new Error(
        data.error ||
        "Unable to initialize card payment."
      );
    }

    return data;
  };


/* =========================================================
   CRYPTO PAYMENT
   ========================================================= */

const cryptoCurrencyMap = {
  btc: "btc",
  sol: "sol",
  usdt: "usdterc20",
  usdc: "usdc"
};


const createCryptoPayment =
  async ({
    reference,
    crypto
  }) => {

    const payCurrency =
      cryptoCurrencyMap[
        crypto
      ];

    if (!payCurrency) {
      throw new Error(
        "Unsupported cryptocurrency selected."
      );
    }

    const response =
      await fetch(
        getApiUrl(
          "/api/crypto/create"
        ),
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            order_id:
              reference,

            pay_currency:
              payCurrency
          })
        }
      );

    let data;

    try {
      data =
        await response.json();
    } catch {
      throw new Error(
        "Invalid NOWPayments server response."
      );
    }

    if (
      !response.ok ||
      !data.success ||
      !data.payment
    ) {
      throw new Error(
        data.error ||
        "Unable to create crypto payment."
      );
    }

    return data;
  };


/* =========================================================
   FORM
   ========================================================= */

const checkoutForm =
  document.getElementById(
    "checkoutForm"
  );


checkoutForm?.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();

    const submitButton =
      checkoutForm.querySelector(
        'button[type="submit"]'
      );

    const cart =
      getCart();

    if (!cart.length) {
      alert(
        "Your cart is empty."
      );

      return;
    }

    const formData =
      new FormData(
        checkoutForm
      );

    const fullName =
      formData
        .get("fullName")
        ?.trim();

    const email =
      formData
        .get("email")
        ?.trim();

    const phone =
      formData
        .get("phone")
        ?.trim();

    const country =
      formData
        .get("country")
        ?.trim();

    const address =
      formData
        .get("address")
        ?.trim();

    const postalCode =
      formData
        .get("postalCode")
        ?.trim();

    const state =
      formData
        .get("state")
        ?.trim();

    if (
      !fullName ||
      !email ||
      !phone ||
      !country ||
      !address ||
      !postalCode ||
      !state
    ) {
      alert(
        "Please complete all delivery information."
      );

      return;
    }


    if (
      selectedPaymentMethod ===
      "crypto" &&
      !cryptoCurrencyMap[
        selectedCrypto
      ]
    ) {
      alert(
        "Please select a supported cryptocurrency."
      );

      return;
    }


    if (submitButton) {
      submitButton.disabled = true;

      submitButton.dataset.originalText =
        submitButton.textContent;

      submitButton.textContent =
        "Creating Order...";
    }


    try {

      /* ===================================================
         STEP 1 — CREATE SERVER ORDER
         =================================================== */

      const serverOrder =
        await createServerOrder({
          formData,
          cart,
          paymentMethod:
            selectedPaymentMethod,
          cryptoCurrency:
            selectedPaymentMethod ===
            "crypto"
              ? selectedCrypto
              : null
        });


      console.log(
        "AUCTION X SERVER ORDER CREATED:",
        serverOrder
      );


      /*
        Always use the server-generated
        reference.

        Do NOT use a locally generated
        reference here.
      */

      const reference =
        serverOrder.reference;


      saveOrder({
        ...serverOrder,

        payment_provider:
          selectedPaymentMethod ===
          "crypto"
            ? "nowpayments"
            : "paystack"
      });


      /* ===================================================
         STEP 2 — CARD
         =================================================== */

      if (
        selectedPaymentMethod ===
        "card"
      ) {

        const payment =
          await initializeCardPayment({
            email,
            reference
          });


        const updatedOrder = {
          ...serverOrder,

          payment_method:
            "card",

          payment_provider:
            "paystack",

          payment_authorization_url:
            payment.authorization_url,

          payment_reference:
            payment.reference
        };


        saveOrder(
          updatedOrder
        );


        if (
          !payment.authorization_url
        ) {
          throw new Error(
            "Payment authorization URL was not returned."
          );
        }


        window.location.href =
          payment.authorization_url;

        return;
      }


      /* ===================================================
         STEP 3 — CRYPTO
         =================================================== */

      if (
        selectedPaymentMethod ===
        "crypto"
      ) {

        if (submitButton) {
          submitButton.textContent =
            "Creating Crypto Payment...";
        }


        const payment =
          await createCryptoPayment({
            reference,
            crypto:
              selectedCrypto
          });


        console.log(
          "AUCTION X NOWPAYMENTS RESPONSE:",
          payment
        );


        const paymentData =
          payment.payment;


        if (
          !paymentData ||
          !paymentData.payment_id ||
          !paymentData.pay_address ||
          !paymentData.pay_amount ||
          !paymentData.pay_currency
        ) {

          console.error(
            "Incomplete NOWPayments response:",
            payment
          );

          throw new Error(
            "NOWPayments created the payment, but the payment address information was not returned."
          );
        }


        const updatedOrder = {
          ...serverOrder,

          payment_method:
            "crypto",

          payment_provider:
            "nowpayments",

          crypto_currency:
            selectedCrypto,

          payment_id:
            paymentData.payment_id,

          payment_status:
            paymentData.payment_status,

          pay_address:
            paymentData.pay_address,

          pay_amount:
            paymentData.pay_amount,

          pay_currency:
            paymentData.pay_currency,

          price_amount:
            paymentData.price_amount,

          price_currency:
            paymentData.price_currency,

          expiration_estimate_date:
            paymentData.expiration_estimate_date
        };


        saveOrder(
          updatedOrder
        );


        console.log(
          "AUCTION X CRYPTO PAYMENT CREATED:",
          updatedOrder
        );


        /*
          The confirmation page can now
          read auctionXLastOrder and
          display the payment details.
        */

        window.location.href =
          "confirmation.html";

        return;
      }

      throw new Error(
        "Unsupported payment method."
      );

    } catch (error) {

      console.error(
        "AUCTION X CHECKOUT ERROR:",
        error
      );

      alert(
        error.message ||
        "Something went wrong while creating your order."
      );

      if (submitButton) {
        submitButton.disabled =
          false;

        submitButton.textContent =
          submitButton.dataset
            .originalText ||
          "Continue to Payment";
      }
    }
  }
);


/* =========================================================
   INITIALIZE
   ========================================================= */

renderCheckout();

setPaymentMethod(
  selectedPaymentMethod
);