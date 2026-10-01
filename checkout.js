const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const axios = require("axios");
const crypto = require("crypto");
const { Resend } = require("resend");

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 4242;

app.disable("x-powered-by");

/* =========================================================
   ENVIRONMENT
========================================================= */

const isProduction = process.env.NODE_ENV === "production";

const allowedOrigin =
  process.env.AUCTION_X_ORIGIN ||
  "http://localhost:5175";

const PUBLIC_API_URL =
  process.env.PUBLIC_API_URL ||
  `http://localhost:${PORT}`;

const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY;
const NOWPAYMENTS_IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ORDER_NOTIFICATION_EMAIL =
  process.env.ORDER_NOTIFICATION_EMAIL;

const resend = RESEND_API_KEY
  ? new Resend(RESEND_API_KEY)
  : null;

/* =========================================================
   SERVER-SIDE PRODUCT CATALOG
   NEVER TRUST PRICES FROM THE BROWSER
========================================================= */

const PRODUCT_CATALOG = new Map([
  ["iphone-17-pro", {
    title: "iPhone 17 Pro",
    price: 1200
  }],

  ["iphone-17-pro-max", {
    title: "iPhone 17 Pro Max",
    price: 1350
  }],

  ["iphone-16-pro", {
    title: "iPhone 16 Pro",
    price: 950
  }],

  ["iphone-16-pro-max", {
    title: "iPhone 16 Pro Max",
    price: 1050
  }],

  ["iphone-16", {
    title: "iPhone 16",
    price: 800
  }],

  ["iphone-15-pro", {
    title: "iPhone 15 Pro",
    price: 650
  }],

  ["iphone-14-pro", {
    title: "iPhone 14 Pro",
    price: 520
  }],

  ["galaxy-s26-ultra", {
    title: "Galaxy S26 Ultra",
    price: 1100
  }],

  ["galaxy-z-fold", {
    title: "Galaxy Z Fold",
    price: 1250
  }],

  ["macbook-air", {
    title: "MacBook Air",
    price: 850
  }],

  ["rolex-watch", {
    title: "Rolex Watch",
    price: 3200
  }],

  ["cartier-watch", {
    title: "Cartier Watch",
    price: 2800
  }]
]);

const SUPPORTED_CRYPTO = new Set([
  "btc",
  "sol",
  "usdterc20",
  "usdc"
]);

/* =========================================================
   DEVELOPMENT ORDER STORE
   IMPORTANT:
   This resets whenever the server restarts.
   Production should use a real database.
========================================================= */

const orders = new Map();

/* =========================================================
   SECURITY MIDDLEWARE
========================================================= */

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: {
      policy: "cross-origin"
    }
  })
);

app.use(
  cors({
    origin: allowedOrigin,
    methods: ["GET", "POST"],
    allowedHeaders: [
      "Content-Type",
      "x-nowpayments-sig"
    ],
    credentials: false
  })
);

app.use(express.json({
  limit: "100kb",
  strict: true
}));

/* =========================================================
   RATE LIMITERS
========================================================= */

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false
});

const orderLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many order attempts. Please try again later."
  }
});

const paymentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many payment attempts. Please try again later."
  }
});

const statusLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many payment status requests."
  }
});

app.use("/api/", apiLimiter);

/* =========================================================
   HELPERS
========================================================= */

function generateOrderId() {
  return `order_${crypto.randomBytes(16).toString("hex")}`;
}

function generateReference() {
  const random = crypto
    .randomBytes(6)
    .toString("hex")
    .toUpperCase();

  return `AX-${Date.now().toString(36).toUpperCase()}-${random}`;
}

function isValidEmail(email) {
  return (
    typeof email === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

function cleanString(value, maxLength = 250) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function normalizeCrypto(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
}

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function safeOrder(order) {
  return {
    orderId: order.orderId,
    reference: order.reference,
    status: order.status,
    payment_status: order.payment_status,
    payment_method: order.payment_method,
    payment_provider: order.payment_provider,
    currency: order.currency,
    items: order.items,
    subtotal: order.subtotal,
    total: order.total,
    createdAt: order.createdAt,
    payment: order.paymentId
      ? {
          paymentId: order.paymentId,
          payment_status: order.providerStatus || null,
          pay_address: order.pay_address || null,
          pay_amount: order.pay_amount || null,
          pay_currency: order.pay_currency || null,
          expiration_estimate_date:
            order.expiration_estimate_date || null
        }
      : null
  };
}

function findOrderByPaymentId(paymentId) {
  for (const order of orders.values()) {
    if (String(order.paymentId) === String(paymentId)) {
      return order;
    }
  }

  return null;
}

function findOrderByReference(reference) {
  for (const order of orders.values()) {
    if (order.reference === reference) {
      return order;
    }
  }

  return null;
}

function sortObject(obj) {
  return Object.keys(obj)
    .sort()
    .reduce((result, key) => {
      result[key] = obj[key];
      return result;
    }, {});
}

function verifyNowPaymentsSignature(body, signature) {
  if (
    !NOWPAYMENTS_IPN_SECRET ||
    typeof signature !== "string"
  ) {
    return false;
  }

  const sortedBody = JSON.stringify(sortObject(body));

  const expectedSignature = crypto
    .createHmac("sha512", NOWPAYMENTS_IPN_SECRET)
    .update(sortedBody)
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature);
  const receivedBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    expectedBuffer,
    receivedBuffer
  );
}

/* =========================================================
   PAYMENT VALIDATION
========================================================= */

function providerAmountMatchesOrder(payment, order) {
  const providerAmount = Number(payment.price_amount);
  const orderAmount = Number(order.total);

  if (!Number.isFinite(providerAmount)) {
    return false;
  }

  return Math.abs(providerAmount - orderAmount) < 0.01;
}

function providerCurrencyMatchesOrder(payment, order) {
  return (
    String(payment.price_currency || "").toLowerCase() ===
    String(order.currency || "").toLowerCase()
  );
}

function providerCryptoMatchesOrder(payment, order) {
  if (!order.pay_currency) {
    return true;
  }

  return (
    String(payment.pay_currency || "").toLowerCase() ===
    String(order.pay_currency || "").toLowerCase()
  );
}

/* =========================================================
   EMAIL NOTIFICATION
========================================================= */

async function sendOrderNotification(order) {
  if (!resend || !ORDER_NOTIFICATION_EMAIL) {
    console.warn(
      "Order notification skipped: Resend is not configured."
    );

    return false;
  }

  if (order.notificationSent) {
    return true;
  }

  const itemRows = order.items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 0;">
            ${item.title}
          </td>
          <td style="padding:8px 0;text-align:center;">
            ${item.quantity}
          </td>
          <td style="padding:8px 0;text-align:right;">
            $${item.lineTotal.toFixed(2)}
          </td>
        </tr>
      `
    )
    .join("");

  const customer = order.customer;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:700px;margin:auto;">
      <h1>AUCTION X — New Paid Order</h1>

      <p>
        <strong>Reference:</strong>
        ${order.reference}
      </p>

      <p>
        <strong>Order ID:</strong>
        ${order.orderId}
      </p>

      <hr />

      <h2>Customer</h2>

      <p>
        <strong>Name:</strong> ${customer.fullName}<br>
        <strong>Email:</strong> ${customer.email}<br>
        <strong>Phone:</strong> ${customer.phone}<br>
        <strong>Country:</strong> ${customer.country}<br>
        <strong>State:</strong> ${customer.state}<br>
        <strong>Address:</strong> ${customer.address}<br>
        <strong>Postal Code:</strong> ${customer.postalCode}
      </p>

      <hr />

      <h2>Items</h2>

      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="text-align:left;">Product</th>
            <th>Qty</th>
            <th style="text-align:right;">Total</th>
          </tr>
        </thead>

        <tbody>
          ${itemRows}
        </tbody>
      </table>

      <hr />

      <h2>Total: $${order.total.toFixed(2)} USD</h2>

      <p>
        <strong>Payment:</strong>
        ${order.pay_currency || "Crypto"}
      </p>

      <p>
        <strong>Status:</strong>
        ${order.payment_status}
      </p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: "AUCTION X <onboarding@resend.dev>",
      to: ORDER_NOTIFICATION_EMAIL,
      subject: `AUCTION X — Paid Order ${order.reference}`,
      html
    });

    order.notificationSent = true;

    return true;
  } catch (error) {
    console.error(
      "Order notification failed:",
      error.message
    );

    return false;
  }
}

/* =========================================================
   APPLY PROVIDER PAYMENT STATUS
========================================================= */

async function applyProviderPaymentStatus(
  order,
  payment
) {
  if (!order || !payment) {
    return {
      success: false,
      reason: "Order or payment missing."
    };
  }

  order.providerStatus =
    payment.payment_status || null;

  if (payment.pay_amount !== undefined) {
    order.pay_amount = payment.pay_amount;
  }

  if (payment.pay_currency) {
    order.pay_currency =
      String(payment.pay_currency).toLowerCase();
  }

  if (payment.pay_address) {
    order.pay_address = payment.pay_address;
  }

  if (payment.expiration_estimate_date) {
    order.expiration_estimate_date =
      payment.expiration_estimate_date;
  }

  const status = String(
    payment.payment_status || ""
  ).toLowerCase();

  if (status === "finished") {
    const amountValid =
      providerAmountMatchesOrder(payment, order);

    const currencyValid =
      providerCurrencyMatchesOrder(payment, order);

    const cryptoValid =
      providerCryptoMatchesOrder(payment, order);

    if (
      !amountValid ||
      !currencyValid ||
      !cryptoValid
    ) {
      order.status = "suspicious";
      order.payment_status = "verification_failed";

      console.error(
        `Payment verification failed for ${order.reference}`
      );

      return {
        success: false,
        reason: "Payment verification failed."
      };
    }

    order.status = "paid";
    order.payment_status = "finished";

    if (!order.paidAt) {
      order.paidAt = new Date().toISOString();
    }

    await sendOrderNotification(order);

    return {
      success: true,
      paid: true
    };
  }

  order.payment_status = status || "waiting";

  if (
    status === "failed" ||
    status === "expired" ||
    status === "refunded"
  ) {
    order.status = status;
  }

  return {
    success: true,
    paid: false
  };
}

/* =========================================================
   HEALTH
========================================================= */

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "AUCTION X API",
    environment: isProduction
      ? "production"
      : "development",
    time: new Date().toISOString(),
    integrations: {
      nowpayments: Boolean(NOWPAYMENTS_API_KEY),
      resend: Boolean(RESEND_API_KEY),
      notificationEmail: Boolean(
        ORDER_NOTIFICATION_EMAIL
      )
    }
  });
});

/* =========================================================
   CREATE SERVER-SIDE ORDER
========================================================= */

app.post(
  "/api/orders/create",
  orderLimiter,
  (req, res) => {
    try {
      const {
        customer,
        items
      } = req.body || {};

      if (
        !customer ||
        typeof customer !== "object"
      ) {
        return res.status(400).json({
          error: "Customer information is required."
        });
      }

      if (!Array.isArray(items)) {
        return res.status(400).json({
          error: "Order items are required."
        });
      }

      if (
        items.length < 1 ||
        items.length > 20
      ) {
        return res.status(400).json({
          error: "Order must contain between 1 and 20 items."
        });
      }

      const fullName =
        cleanString(customer.fullName, 100);

      const email =
        cleanString(customer.email, 160).toLowerCase();

      const phone =
        cleanString(customer.phone, 40);

      const country =
        cleanString(customer.country, 80);

      const address =
        cleanString(customer.address, 250);

      const postalCode =
        cleanString(customer.postalCode, 30);

      const state =
        cleanString(customer.state, 100);

      if (!fullName) {
        return res.status(400).json({
          error: "Full name is required."
        });
      }

      if (!isValidEmail(email)) {
        return res.status(400).json({
          error: "A valid email is required."
        });
      }

      if (!phone) {
        return res.status(400).json({
          error: "Phone number is required."
        });
      }

      if (!country) {
        return res.status(400).json({
          error: "Country is required."
        });
      }

      if (!address) {
        return res.status(400).json({
          error: "Address is required."
        });
      }

      const serverItems = [];
      let subtotal = 0;

      for (const item of items) {
        const productId =
          cleanString(item?.productId, 100);

        const product =
          PRODUCT_CATALOG.get(productId);

        if (!product) {
          return res.status(400).json({
            error: `Invalid product: ${productId}`
          });
        }

        const quantity =
          Number(item?.quantity);

        if (
          !Number.isInteger(quantity) ||
          quantity < 1 ||
          quantity > 20
        ) {
          return res.status(400).json({
            error: `Invalid quantity for ${product.title}.`
          });
        }

        const lineTotal =
          roundMoney(
            product.price * quantity
          );

        serverItems.push({
          productId,
          title: product.title,
          price: product.price,
          quantity,
          lineTotal
        });

        subtotal =
          roundMoney(subtotal + lineTotal);
      }

      const total = subtotal;

      const orderId =
        generateOrderId();

      const reference =
        generateReference();

      const order = {
        orderId,
        reference,

        status: "pending",
        payment_status: "waiting",

        payment_method: "crypto",
        payment_provider: "nowpayments",

        currency: "USD",

        customer: {
          fullName,
          email,
          phone,
          country,
          address,
          postalCode,
          state
        },

        items: serverItems,

        subtotal,
        total,

        createdAt:
          new Date().toISOString(),

        paymentId: null,
        providerStatus: null,
        pay_currency: null,
        pay_amount: null,
        pay_address: null,

        paymentCreating: false,
        notificationSent: false
      };

      orders.set(orderId, order);

      console.log(
        `Order created: ${reference} — $${total.toFixed(2)}`
      );

      return res.status(201).json({
        success: true,
        order: safeOrder(order)
      });
    } catch (error) {
      console.error(
        "Order creation error:",
        error.message
      );

      return res.status(500).json({
        error: "Unable to create order."
      });
    }
  }
);

/* =========================================================
   CREATE NOWPAYMENTS CRYPTO PAYMENT
========================================================= */

app.post(
  "/api/crypto/create",
  paymentLimiter,
  async (req, res) => {
    let order = null;

    try {
      if (!NOWPAYMENTS_API_KEY) {
        return res.status(503).json({
          error: "Crypto payments are not configured."
        });
      }

      const {
        order_id,
        pay_currency
      } = req.body || {};

      if (
        typeof order_id !== "string" ||
        !order_id.trim()
      ) {
        return res.status(400).json({
          error: "Order ID is required."
        });
      }

      const cryptoCurrency =
        normalizeCrypto(pay_currency);

      if (
        !SUPPORTED_CRYPTO.has(
          cryptoCurrency
        )
      ) {
        return res.status(400).json({
          error: "Unsupported cryptocurrency."
        });
      }

      order = orders.get(
        order_id.trim()
      );

      if (!order) {
        return res.status(404).json({
          error: "Order not found."
        });
      }

      if (
        order.status === "paid"
      ) {
        return res.status(409).json({
          error: "This order has already been paid."
        });
      }

      /* Idempotency:
         don't create another provider payment
         for the same order.
      */

      if (order.paymentId) {
        return res.json({
          success: true,
          order: safeOrder(order),
          payment: {
            payment_id: order.paymentId,
            pay_currency: order.pay_currency,
            pay_amount: order.pay_amount,
            pay_address: order.pay_address,
            payment_status:
              order.providerStatus || "waiting"
          }
        });
      }

      if (order.paymentCreating) {
        return res.status(409).json({
          error: "Payment is already being created."
        });
      }

      order.paymentCreating = true;
      order.pay_currency = cryptoCurrency;

      const response =
        await axios.post(
          "https://api.nowpayments.io/v1/payment",
          {
            price_amount: order.total,
            price_currency: "usd",

            pay_currency: cryptoCurrency,

            order_id: order.reference,

            order_description:
              `AUCTION X order ${order.reference}`,

            customer_email:
              order.customer.email,

            ipn_callback_url:
              `${PUBLIC_API_URL}/api/crypto/ipn`
          },
          {
            headers: {
              "x-api-key":
                NOWPAYMENTS_API_KEY,
              "Content-Type":
                "application/json"
            },
            timeout: 15000
          }
        );

      const payment =
        response.data;

      if (!payment?.payment_id) {
        throw new Error(
          "NOWPayments did not return a payment ID."
        );
      }

      order.paymentId =
        String(payment.payment_id);

      order.providerStatus =
        payment.payment_status || "waiting";

      order.pay_currency =
        String(
          payment.pay_currency ||
          cryptoCurrency
        ).toLowerCase();

      order.pay_amount =
        payment.pay_amount ?? null;

      order.pay_address =
        payment.pay_address ?? null;

      order.expiration_estimate_date =
        payment.expiration_estimate_date ??
        null;

      order.paymentCreating = false;

      console.log(
        `Crypto payment created for ${order.reference}`
      );

      return res.status(201).json({
        success: true,

        order: safeOrder(order),

        payment: {
          payment_id:
            payment.payment_id,

          payment_status:
            payment.payment_status ||
            "waiting",

          pay_currency:
            payment.pay_currency,

          pay_amount:
            payment.pay_amount,

          pay_address:
            payment.pay_address,

          expiration_estimate_date:
            payment.expiration_estimate_date ||
            null
        }
      });
    } catch (error) {
      if (order) {
        order.paymentCreating = false;
      }

      const providerMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error.message;

      console.error(
        "Crypto creation failed:",
        providerMessage
      );

      return res.status(502).json({
        error:
          "Unable to create cryptocurrency payment."
      });
    }
  }
);

/* =========================================================
   CHECK CRYPTO PAYMENT STATUS
========================================================= */

app.get(
  "/api/crypto/status/:paymentId",
  statusLimiter,
  async (req, res) => {
    try {
      if (!NOWPAYMENTS_API_KEY) {
        return res.status(503).json({
          error: "Crypto payments are not configured."
        });
      }

      const paymentId =
        String(req.params.paymentId || "").trim();

      if (!paymentId) {
        return res.status(400).json({
          error: "Payment ID is required."
        });
      }

      const order =
        findOrderByPaymentId(paymentId);

      if (!order) {
        return res.status(404).json({
          error: "Payment not found."
        });
      }

      const response =
        await axios.get(
          `https://api.nowpayments.io/v1/payment/${encodeURIComponent(paymentId)}`,
          {
            headers: {
              "x-api-key":
                NOWPAYMENTS_API_KEY
            },
            timeout: 15000
          }
        );

      const payment =
        response.data;

      await applyProviderPaymentStatus(
        order,
        payment
      );

      return res.json({
        success: true,

        payment: {
          payment_id:
            payment.payment_id,

          payment_status:
            payment.payment_status,

          pay_currency:
            payment.pay_currency,

          pay_amount:
            payment.pay_amount,

          pay_address:
            payment.pay_address,

          price_amount:
            payment.price_amount,

          price_currency:
            payment.price_currency
        },

        order: {
          orderId:
            order.orderId,

          reference:
            order.reference,

          status:
            order.status,

          payment_status:
            order.payment_status
        }
      });
    } catch (error) {
      console.error(
        "Crypto status error:",
        error?.response?.data ||
        error.message
      );

      return res.status(502).json({
        error:
          "Unable to check payment status."
      });
    }
  }
);

/* =========================================================
   NOWPAYMENTS IPN WEBHOOK
========================================================= */

app.post(
  "/api/crypto/ipn",
  async (req, res) => {
    try {
      const signature =
        req.headers["x-nowpayments-sig"];

      if (
        !verifyNowPaymentsSignature(
          req.body,
          signature
        )
      ) {
        console.warn(
          "Rejected invalid NOWPayments IPN signature."
        );

        return res.status(401).json({
          error: "Invalid signature."
        });
      }

      const payment =
        req.body || {};

      let order = null;

      if (payment.order_id) {
        order =
          findOrderByReference(
            String(payment.order_id)
          );
      }

      if (!order && payment.payment_id) {
        order =
          findOrderByPaymentId(
            String(payment.payment_id)
          );
      }

      if (!order) {
        return res.status(404).json({
          error: "Order not found."
        });
      }

      if (payment.payment_id) {
        order.paymentId =
          String(payment.payment_id);
      }

      await applyProviderPaymentStatus(
        order,
        payment
      );

      console.log(
        `IPN processed for ${order.reference}: ${order.payment_status}`
      );

      return res.json({
        received: true
      });
    } catch (error) {
      console.error(
        "IPN processing error:",
        error.message
      );

      return res.status(500).json({
        error: "IPN processing failed."
      });
    }
  }
);

/* =========================================================
   PAYSTACK
   CARD PAYMENTS ARE CURRENTLY DISABLED
========================================================= */

app.post(
  "/api/payment/initialize",
  paymentLimiter,
  (req, res) => {
    return res.status(503).json({
      error:
        "Card payments are currently unavailable. Please use cryptocurrency."
    });
  }
);

/* =========================================================
   DEVELOPMENT EMAIL TEST
   DISABLED IN PRODUCTION
========================================================= */

app.get(
  "/api/test-email",
  async (req, res) => {
    if (isProduction) {
      return res.status(404).json({
        error: "Not found."
      });
    }

    if (
      !resend ||
      !ORDER_NOTIFICATION_EMAIL
    ) {
      return res.status(503).json({
        error:
          "Resend is not configured."
      });
    }

    try {
      const result =
        await resend.emails.send({
          from:
            "AUCTION X <onboarding@resend.dev>",

          to:
            ORDER_NOTIFICATION_EMAIL,

          subject:
            "AUCTION X — Email Test",

          html: `
            <div style="font-family:Arial,sans-serif;">
              <h1>AUCTION X</h1>
              <p>
                Email notifications are working correctly.
              </p>
              <p>
                Test time:
                ${new Date().toISOString()}
              </p>
            </div>
          `
        });

      return res.json({
        success: true,
        message: "Test email sent.",
        id: result?.data?.id || null
      });
    } catch (error) {
      console.error(
        "Test email failed:",
        error.message
      );

      return res.status(500).json({
        error: "Test email failed."
      });
    }
  }
);

/* =========================================================
   UNKNOWN API ROUTES
========================================================= */

app.use("/api/", (req, res) => {
  return res.status(404).json({
    error: "API route not found."
  });
});

/* =========================================================
   GLOBAL ERROR HANDLER
========================================================= */

app.use(
  (error, req, res, next) => {
    console.error(
      "Unhandled server error:",
      error.message
    );

    if (error.type === "entity.too.large") {
      return res.status(413).json({
        error: "Request body is too large."
      });
    }

    return res.status(500).json({
      error:
        "An unexpected server error occurred."
    });
  }
);

/* =========================================================
   START SERVER
========================================================= */

app.listen(PORT, () => {
  console.log("");
  console.log("====================================");
  console.log("       AUCTION X API SERVER");
  console.log("====================================");
  console.log(`Port: ${PORT}`);
  console.log(`Origin: ${allowedOrigin}`);
  console.log(
    `NOWPayments: ${
      NOWPAYMENTS_API_KEY
        ? "configured"
        : "NOT configured"
    }`
  );
  console.log(
    `Resend: ${
      RESEND_API_KEY
        ? "configured"
        : "NOT configured"
    }`
  );
  console.log(
    `Environment: ${
      isProduction
        ? "production"
        : "development"
    }`
  );
  console.log("====================================");
  console.log("");
});