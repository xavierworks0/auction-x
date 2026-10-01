/* =========================================================
   AUCTION X — CONFIRMATION / PAYMENT
   Secure client-side confirmation flow
   ========================================================= */

const CART_KEY = "auctionXCart";
const ORDER_KEY = "auctionXLastOrder";
const API_URL = "http://localhost:4242";


/* =========================================================
   PRODUCTS
   ========================================================= */

const products = [
  {
    id: "iphone-17-pro",
    title: "iPhone 17 Pro",
    category: "Gadgets",
    brand: "Apple",
    condition: "Like New",
    price: 1200,
    image: "assets/images/iphone-17-pro.jpg"
  },
  {
    id: "iphone-17-pro-max",
    title: "iPhone 17 Pro Max",
    category: "Gadgets",
    brand: "Apple",
    condition: "Like New",
    price: 1350,
    image: "assets/images/iphone-17-pro-max.jpg"
  },
  {
    id: "iphone-16-pro",
    title: "iPhone 16 Pro",
    category: "Gadgets",
    brand: "Apple",
    condition: "Excellent",
    price: 950,
    image: "assets/images/iphone-16-pro.jpg"
  },
  {
    id: "iphone-16-pro-max",
    title: "iPhone 16 Pro Max",
    category: "Gadgets",
    brand: "Apple",
    condition: "Excellent",
    price: 1050,
    image: "assets/images/iphone-16-pro-max.jpg"
  },
  {
    id: "iphone-16",
    title: "iPhone 16",
    category: "Gadgets",
    brand: "Apple",
    condition: "Excellent",
    price: 800,
    image: "assets/images/iphone-16.jpg"
  },
  {
    id: "iphone-15-pro",
    title: "iPhone 15 Pro",
    category: "Gadgets",
    brand: "Apple",
    condition: "Good",
    price: 650,
    image: "assets/images/iphone-15-pro.jpg"
  },
  {
    id: "iphone-14-pro",
    title: "iPhone 14 Pro",
    category: "Gadgets",
    brand: "Apple",
    condition: "Good",
    price: 520,
    image: "assets/images/iphone-14-pro.jpg"
  },
  {
    id: "galaxy-s26-ultra",
    title: "Galaxy S26 Ultra",
    category: "Gadgets",
    brand: "Samsung",
    condition: "Like New",
    price: 1100,
    image: "assets/images/galaxy-s26-ultra.jpg"
  },
  {
    id: "galaxy-z-fold",
    title: "Galaxy Z Fold",
    category: "Gadgets",
    brand: "Samsung",
    condition: "Excellent",
    price: 1250,
    image: "assets/images/galaxy-z-fold.jpg"
  },
  {
    id: "macbook-air",
    title: "MacBook Air",
    category: "Gadgets",
    brand: "Apple",
    condition: "Excellent",
    price: 850,
    image: "assets/images/macbook-air.jpg"
  },
  {
    id: "rolex-watch",
    title: "Rolex Watch",
    category: "Luxury",
    brand: "Rolex",
    condition: "Excellent",
    price: 3200,
    image: "assets/images/rolex-watch.jpg"
  },
  {
    id: "cartier-watch",
    title: "Cartier Watch",
    category: "Luxury",
    brand: "Cartier",
    condition: "Excellent",
    price: 2800,
    image: "assets/images/cartier-watch.jpg"
  }
];


/* =========================================================
   CURRENCY
   ========================================================= */

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});


/* =========================================================
   STORAGE
   ========================================================= */

const getOrder = () => {
  try {
    const raw = localStorage.getItem(ORDER_KEY);

    if (!raw) {
      return null;
    }

    return JSON.parse(raw);
  } catch (error) {
    console.error("Could not read saved order:", error);
    return null;
  }
};


const saveOrder = (order) => {
  if (!order) {
    return;
  }

  localStorage.setItem(
    ORDER_KEY,
    JSON.stringify(order)
  );
};


/* =========================================================
   PRODUCT HELPERS
   ========================================================= */

const findProduct = (item) => {
  if (!item) {
    return null;
  }

  const productId =
    item.productId ||
    item.id;

  if (productId) {
    const byId = products.find(
      (product) => product.id === productId
    );

    if (byId) {
      return byId;
    }
  }

  const name =
    item.name ||
    item.title;

  if (!name) {
    return null;
  }

  return products.find(
    (product) =>
      product.title.toLowerCase() ===
      String(name).toLowerCase()
  ) || null;
};


/* =========================================================
   HTML ESCAPE
   ========================================================= */

const escapeHtml = (value) => {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};


/* =========================================================
   ELEMENTS
   ========================================================= */

const orderReferenceElement =
  document.getElementById("orderReference");

const orderStatusElement =
  document.getElementById("orderStatus");

const orderItemsElement =
  document.getElementById("confirmationItems");

const orderItemCountElement =
  document.getElementById("confirmationItemCount");

const orderSubtotalElement =
  document.getElementById("confirmationSubtotal");

const orderTotalElement =
  document.getElementById("confirmationTotal");

const paymentContainer =
  document.getElementById("paymentDetails");

const confirmationMessageElement =
  document.getElementById("confirmationMessage");


/* =========================================================
   PAGE MESSAGING
   ========================================================= */

const setConfirmationMessage = (order) => {
  if (!confirmationMessageElement) {
    return;
  }

  if (
    order?.status === "paid" ||
    order?.payment_status === "finished"
  ) {
    confirmationMessageElement.textContent =
      "Your payment has been confirmed and your order is now moving into processing.";

    return;
  }

  if (
    order?.payment_status === "failed" ||
    order?.payment_status === "expired"
  ) {
    confirmationMessageElement.textContent =
      "This payment could not be completed. Please review the payment status below.";

    return;
  }

  confirmationMessageElement.textContent =
    "Your order has been received. Complete the payment using the details below.";
};


/* =========================================================
   STATUS LABELS
   ========================================================= */

const getStatusLabel = (status) => {
  const labels = {
    waiting: "Payment required",
    confirming: "Confirming payment",
    confirmed: "Payment confirmed",
    sending: "Processing payment",
    partially_paid: "Partially paid",
    finished: "Payment complete",
    failed: "Payment failed",
    refunded: "Payment refunded",
    expired: "Payment expired"
  };

  return labels[status] || "Payment required";
};


const getStatusMessage = (status) => {
  const messages = {
    waiting:
      "Continue with your selected payment method to start processing.",

    confirming:
      "Your transaction is being confirmed.",

    confirmed:
      "Your payment has been confirmed.",

    sending:
      "Your payment is being processed.",

    partially_paid:
      "A partial payment has been detected.",

    finished:
      "Your payment has been confirmed and your order is moving into processing.",

    failed:
      "The payment could not be completed.",

    refunded:
      "This payment has been refunded.",

    expired:
      "This payment request has expired."
  };

  return (
    messages[status] ||
    "Continue with payment to get your order started."
  );
};


/* =========================================================
   RENDER ORDER
   ========================================================= */

const renderOrder = (order) => {
  if (!order) {
    if (orderStatusElement) {
      orderStatusElement.textContent =
        "No active order found.";
    }

    if (confirmationMessageElement) {
      confirmationMessageElement.textContent =
        "We could not find an active order. Return to the marketplace to begin a new order.";
    }

    if (orderItemsElement) {
      orderItemsElement.innerHTML = `
        <div class="confirmation-empty">
          <span>NO ACTIVE ORDER</span>

          <p>
            There is no active order attached to this session.
          </p>

          <a href="index.html#auctions">
            Browse Marketplace →
          </a>
        </div>
      `;
    }

    return;
  }


  setConfirmationMessage(order);


  /* =======================================================
     ORDER REFERENCE
     ======================================================= */

  if (orderReferenceElement) {
    orderReferenceElement.textContent =
      order.reference || "—";
  }


  /* =======================================================
     PAYMENT STATUS
     ======================================================= */

  if (orderStatusElement) {

    if (
      order.status === "paid" ||
      order.payment_status === "finished"
    ) {

      orderStatusElement.textContent =
        "Payment received";

    } else if (
      order.payment_status
    ) {

      orderStatusElement.textContent =
        getStatusLabel(
          order.payment_status
        );

    } else {

      orderStatusElement.textContent =
        "Payment required";
    }
  }


  /* =======================================================
     SERVER TOTAL
     ======================================================= */

  if (orderTotalElement) {

    orderTotalElement.textContent =
      currencyFormatter.format(
        Number(order.total || 0)
      );
  }


  if (!orderItemsElement) {
    return;
  }


  const items =
    Array.isArray(order.items)
      ? order.items
      : [];


  /* =======================================================
     EMPTY ORDER
     ======================================================= */

  if (!items.length) {

    orderItemsElement.innerHTML = `
      <div class="confirmation-empty">

        <span>
          NO SELECTED LISTINGS
        </span>

        <p>
          There are no items attached to this order.
        </p>

        <a href="index.html#auctions">
          Browse Marketplace →
        </a>

      </div>
    `;

    if (orderItemCountElement) {
      orderItemCountElement.textContent =
        "0 Listings";
    }

    return;
  }


  /* =======================================================
     ITEMS
     ======================================================= */

  let totalQuantity = 0;
  let displaySubtotal = 0;


  const renderedItems =
    items.map((item) => {

      const product =
        findProduct(item);

      if (!product) {
        return "";
      }


      const quantity =
        Math.min(
          10,
          Math.max(
            1,
            Number(item.quantity) || 1
          )
        );


      totalQuantity += quantity;


      /*
        This subtotal is display-only.
        The authoritative total comes
        from the server order.
      */

      const lineTotal =
        product.price * quantity;


      displaySubtotal += lineTotal;


      return `
        <article class="confirmation-item">

          <a
            href="listing.html?id=${encodeURIComponent(
              product.id
            )}"
            class="confirmation-item-image"
          >
            <img
              src="${escapeHtml(product.image)}"
              alt="${escapeHtml(product.title)}"
              loading="lazy"
            />
          </a>


          <div class="confirmation-item-info">

            <span class="confirmation-item-category">
              ${escapeHtml(product.category)}
            </span>

            <h3 class="confirmation-item-name">
              ${escapeHtml(product.title)}
            </h3>

            <div class="confirmation-item-meta">

              <span>
                ${escapeHtml(product.brand)}
              </span>

              <span>
                ${escapeHtml(product.condition)}
              </span>

              <span>
                Qty ${quantity}
              </span>

            </div>

          </div>


          <strong class="confirmation-item-price">
            ${currencyFormatter.format(lineTotal)}
          </strong>

        </article>
      `;
    });


  orderItemsElement.innerHTML =
    renderedItems.join("");


  /* =======================================================
     ITEM COUNT
     ======================================================= */

  if (orderItemCountElement) {

    orderItemCountElement.textContent =
      `${totalQuantity} ${
        totalQuantity === 1
          ? "Listing"
          : "Listings"
      }`;
  }


  /* =======================================================
     SUBTOTAL
     ======================================================= */

  if (orderSubtotalElement) {

    const subtotal =
      Number.isFinite(
        Number(order.subtotal)
      )
        ? Number(order.subtotal)
        : displaySubtotal;


    orderSubtotalElement.textContent =
      currencyFormatter.format(
        subtotal
      );
  }
};


/* =========================================================
   CRYPTO PAYMENT PANEL
   ========================================================= */

const renderCryptoPayment = (order) => {

  if (!paymentContainer) {
    return;
  }


  const payAmount =
    order.pay_amount || "—";


  const payCurrency =
    String(
      order.pay_currency || ""
    ).toUpperCase();


  const payAddress =
    order.pay_address || "";


  const status =
    order.status === "paid"
      ? "finished"
      : order.payment_status || "waiting";


  const statusLabel =
    getStatusLabel(status);


  const statusMessage =
    getStatusMessage(status);


  const addressDisplay =
    payAddress
      ? payAddress
      : "Generating payment address…";


  const isFinished =
    status === "finished";


  const isFailed =
    status === "failed" ||
    status === "expired" ||
    status === "refunded";


  paymentContainer.innerHTML = `

    <div class="crypto-payment-panel">

      <div class="crypto-payment-top">

        <div>

          <span class="crypto-payment-eyebrow">
            ${
              isFinished
                ? "PAYMENT CONFIRMED"
                : isFailed
                  ? "PAYMENT UPDATE"
                  : "CONTINUE WITH PAYMENT"
            }
          </span>

          <h2>
            ${
              isFinished
                ? "Payment received."
                : isFailed
                  ? "Payment requires attention."
                  : "Continue with payment."
            }
          </h2>

          <p>
            ${
              isFinished
                ? "Your payment has been confirmed and your order is now moving into processing."
                : isFailed
                  ? "The current payment request is no longer active. Please return to checkout if you need to create a new payment."
                  : "Your order is ready to begin. Send the exact amount below to complete payment and start processing."
            }
          </p>

        </div>


        <div
          class="crypto-payment-status crypto-status-${escapeHtml(status)}"
          data-status="${escapeHtml(status)}"
        >

          <span
            class="status-dot ${
              isFinished
                ? "complete"
                : ""
            }"
          ></span>

          <div class="crypto-status-copy">

            <strong id="cryptoStatusLabel">
              ${escapeHtml(statusLabel)}
            </strong>

            <span id="cryptoStatusMessage">
              ${escapeHtml(statusMessage)}
            </span>

          </div>

        </div>

      </div>


      <div class="crypto-payment-amount">

        <span>
          AMOUNT TO SEND
        </span>

        <strong>

          ${escapeHtml(payAmount)}

          <small>
            ${escapeHtml(payCurrency || "—")}
          </small>

        </strong>

      </div>


      <div class="crypto-payment-network">

        <span>
          PAYMENT ASSET
        </span>

        <strong>
          ${escapeHtml(payCurrency || "—")}
        </strong>

      </div>


      <div class="crypto-payment-address">

        <div class="crypto-address-head">

          <span>
            PAYMENT ADDRESS
          </span>

          <button
            type="button"
            id="copyCryptoAddress"
            ${
              payAddress && !isFinished && !isFailed
                ? ""
                : "disabled"
            }
          >
            ${
              isFinished
                ? "Paid"
                : isFailed
                  ? "Unavailable"
                  : "Copy"
            }
          </button>

        </div>


        <div class="crypto-address-content">

          <div class="crypto-address-box">

            <span id="cryptoAddressText">
              ${escapeHtml(addressDisplay)}
            </span>

          </div>


          <div class="crypto-qr">

            ${
              payAddress && !isFinished && !isFailed
                ? `
                  <img
                    src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                      payAddress
                    )}"
                    alt="Crypto payment QR code"
                    loading="lazy"
                  />
                `
                : isFinished
                  ? `
                    <div class="crypto-qr-loading">
                      <small>
                        PAYMENT CONFIRMED
                      </small>
                    </div>
                  `
                  : `
                    <div class="crypto-qr-loading">

                      <span></span>

                      <small>
                        ${
                          isFailed
                            ? "PAYMENT UNAVAILABLE"
                            : "GENERATING QR"
                        }
                      </small>

                    </div>
                  `
            }

          </div>

        </div>

      </div>


      <div class="crypto-payment-warning">

        <strong>
          ${
            isFinished
              ? "Payment received"
              : isFailed
                ? "Payment request inactive"
                : "Important"
          }
        </strong>

        <p>

          ${
            isFinished
              ? "Your payment has been completed successfully. AUCTION X can now move the order into processing."
              : isFailed
                ? "Do not send funds to an expired or failed payment address. Return to checkout to create a new payment request."
                : `Send only ${
                    escapeHtml(
                      payCurrency ||
                      "the selected cryptocurrency"
                    )
                  } to this address using the correct network. Sending a different asset or using the wrong network can cause the payment to fail.`
          }

        </p>

      </div>


      <div class="crypto-payment-footer">

        <span>
          Payment ID
        </span>

        <strong>
          ${escapeHtml(order.payment_id || "—")}
        </strong>

      </div>

    </div>
  `;


  /* =======================================================
     COPY ADDRESS
     ======================================================= */

  const copyButton =
    document.getElementById(
      "copyCryptoAddress"
    );


  copyButton?.addEventListener(
    "click",
    async () => {

      if (!payAddress) {
        return;
      }


      try {

        await navigator.clipboard.writeText(
          payAddress
        );


        copyButton.textContent =
          "Copied";


        setTimeout(() => {

          if (
            document.body.contains(copyButton)
          ) {
            copyButton.textContent =
              "Copy";
          }

        }, 1800);

      } catch (error) {

        console.error(
          "Copy address failed:",
          error
        );


        try {

          const temporary =
            document.createElement(
              "textarea"
            );


          temporary.value =
            payAddress;


          temporary.style.position =
            "fixed";


          temporary.style.opacity =
            "0";


          document.body.appendChild(
            temporary
          );


          temporary.select();


          document.execCommand(
            "copy"
          );


          temporary.remove();


          copyButton.textContent =
            "Copied";


          setTimeout(() => {

            if (
              document.body.contains(copyButton)
            ) {
              copyButton.textContent =
                "Copy";
            }

          }, 1800);

        } catch (fallbackError) {

          console.error(
            "Clipboard fallback failed:",
            fallbackError
          );
        }
      }
    }
  );
};


/* =========================================================
   PAYMENT COMPLETE
   ========================================================= */

const showPaymentComplete = (order) => {

  if (orderStatusElement) {
    orderStatusElement.textContent =
      "Payment received";
  }


  if (confirmationMessageElement) {
    confirmationMessageElement.textContent =
      "Your payment has been confirmed and your order is now moving into processing.";
  }


  renderCryptoPayment({
    ...order,
    status: "paid",
    payment_status: "finished"
  });
};


/* =========================================================
   SECURE CRYPTO STATUS CHECK
   ========================================================= */

const checkCryptoStatus = async () => {

  const localOrder =
    getOrder();


  if (
    !localOrder ||
    localOrder.payment_method !== "crypto" ||
    !localOrder.payment_id
  ) {
    return;
  }


  /*
    Never use localStorage alone as proof
    that a payment is complete.

    The server must verify the payment
    against the payment provider.
  */

  try {

    const response =
      await fetch(
        `${API_URL}/api/crypto/status/${encodeURIComponent(
          localOrder.payment_id
        )}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json"
          }
        }
      );


    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }


    if (
      !response.ok ||
      !data?.success ||
      !data?.payment
    ) {

      console.error(
        "Secure payment status check failed."
      );

      return;
    }


    const payment =
      data.payment;


    const paymentStatus =
      String(
        payment.payment_status ||
        "waiting"
      ).toLowerCase();


    /*
      The server should return the payment
      that belongs to this order.

      We update only payment information
      received from our server.
    */

    const updatedOrder = {
      ...localOrder,

      payment_status:
        paymentStatus,

      pay_address:
        payment.pay_address ||
        localOrder.pay_address ||
        null,

      pay_amount:
        payment.pay_amount ||
        localOrder.pay_amount ||
        null,

      pay_currency:
        payment.pay_currency ||
        localOrder.pay_currency ||
        null,

      price_amount:
        payment.price_amount ||
        localOrder.price_amount ||
        null,

      price_currency:
        payment.price_currency ||
        localOrder.price_currency ||
        null,

      expiration_estimate_date:
        payment.expiration_estimate_date ||
        localOrder.expiration_estimate_date ||
        null
    };


    /* =====================================================
       PAYMENT FINISHED
       ===================================================== */

    if (
      paymentStatus === "finished"
    ) {

      /*
        Only the verified server response
        can trigger this UI state.
      */

      updatedOrder.status =
        "paid";


      updatedOrder.paid_at =
        payment.updated_at ||
        new Date().toISOString();


      saveOrder(
        updatedOrder
      );


      localStorage.removeItem(
        CART_KEY
      );


      renderOrder(
        updatedOrder
      );


      showPaymentComplete(
        updatedOrder
      );


      console.log(
        "AUCTION X payment verified by server."
      );


      return;
    }


    /* =====================================================
       PAYMENT FAILED / EXPIRED
       ===================================================== */

    if (
      paymentStatus === "failed" ||
      paymentStatus === "expired" ||
      paymentStatus === "refunded"
    ) {

      updatedOrder.status =
        paymentStatus;


      saveOrder(
        updatedOrder
      );


      renderOrder(
        updatedOrder
      );


      renderCryptoPayment(
        updatedOrder
      );


      return;
    }


    /* =====================================================
       PAYMENT STILL PENDING
       ===================================================== */

    saveOrder(
      updatedOrder
    );


    renderOrder(
      updatedOrder
    );


    renderCryptoPayment(
      updatedOrder
    );

  } catch (error) {

    /*
      Network failure should not mark
      the order as paid or failed.
    */

    console.error(
      "Crypto status check error:",
      error
    );
  }
};


/* =========================================================
   PAYSTACK RETURN
   ========================================================= */

const handlePaystackReturn = async () => {

  const order =
    getOrder();


  if (
    !order ||
    order.payment_method !== "card"
  ) {
    return;
  }


  const params =
    new URLSearchParams(
      window.location.search
    );


  const reference =
    params.get("reference") ||
    params.get("trxref");


  if (!reference) {
    return;
  }


  try {

    const response =
      await fetch(
        `${API_URL}/api/payment/verify/${encodeURIComponent(
          reference
        )}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json"
          }
        }
      );


    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }


    if (
      !response.ok ||
      !data?.success
    ) {

      console.error(
        "Paystack verification failed."
      );

      return;
    }


    /*
      The backend must verify:
      - reference
      - order
      - amount
      - currency
      - transaction status

      The frontend does not decide
      whether the payment is valid.
    */

    if (
      data.status === "success"
    ) {

      const updatedOrder = {
        ...order,

        status: "paid",

        payment_status: "success",

        paid_at:
          data.paid_at ||
          new Date().toISOString(),

        paid_currency:
          data.currency ||
          null
      };


      saveOrder(
        updatedOrder
      );


      localStorage.removeItem(
        CART_KEY
      );


      renderOrder(
        updatedOrder
      );


      if (confirmationMessageElement) {

        confirmationMessageElement.textContent =
          "Your payment has been confirmed and your order is now moving into processing.";
      }

    }

  } catch (error) {

    console.error(
      "Paystack verification error:",
      error
    );
  }
};


/* =========================================================
   INITIALIZE
   ========================================================= */

const initializeConfirmation = async () => {

  const order =
    getOrder();


  renderOrder(
    order
  );


  if (!order) {
    return;
  }


  /* =======================================================
     CRYPTO
     ======================================================= */

  if (
    order.payment_method === "crypto"
  ) {

    renderCryptoPayment(
      order
    );


    await checkCryptoStatus();


    /*
      Continue polling while the payment
      has not reached a terminal state.
    */

    const currentOrder =
      getOrder();


    const currentStatus =
      currentOrder?.payment_status;


    const terminalStatuses = [
      "finished",
      "failed",
      "expired",
      "refunded"
    ];


    if (
      currentOrder &&
      !terminalStatuses.includes(
        currentStatus
      )
    ) {

      setInterval(
        checkCryptoStatus,
        8000
      );
    }


    return;
  }


  /* =======================================================
     CARD
     ======================================================= */

  if (
    order.payment_method === "card"
  ) {

    await handlePaystackReturn();

    return;
  }
};


/* =========================================================
   START
   ========================================================= */

initializeConfirmation();