/* =========================================================
   AUCTION X — SECURE BACKEND
   ========================================================= */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const axios = require("axios");
const crypto = require("crypto");
const { Resend } = require("resend");


/* =========================================================
   APP
   ========================================================= */

const app = express();

const PORT =
  Number(process.env.PORT) || 4242;

const FRONTEND_ORIGIN =
  process.env.AUCTION_X_ORIGIN ||
  "http://localhost:5175";


/* =========================================================
   SERVICES
   ========================================================= */

const resend =
  process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;


/* =========================================================
   SECURITY
   ========================================================= */

app.disable("x-powered-by");


app.use(
  helmet({
    contentSecurityPolicy: false
  })
);


app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    credentials: false
  })
);


/* =========================================================
   REQUEST LIMITS
   ========================================================= */

const apiLimiter =
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: "Too many requests. Please try again later."
    }
  });


const paymentLimiter =
  rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: "Too many payment requests. Please try again later."
    }
  });


app.use(
  "/api/",
  apiLimiter
);


/* =========================================================
   BODY PARSING
   ========================================================= */

app.use(
  express.json({
    limit: "100kb",
    strict: true
  })
);


/* =========================================================
   SERVER-SIDE PRODUCT CATALOG
   =========================================================

   IMPORTANT:

   The browser is NOT trusted with prices.

   These are the authoritative prices used to
   calculate every order on the server.
   ========================================================= */

const PRODUCT_CATALOG = new Map([
  [
    "iphone-17-pro",
    {
      title: "iPhone 17 Pro",
      category: "Gadgets",
      brand: "Apple",
      condition: "Like New",
      price: 1200
    }
  ],

  [
    "iphone-17-pro-max",
    {
      title: "iPhone 17 Pro Max",
      category: "Gadgets",
      brand: "Apple",
      condition: "Like New",
      price: 1350
    }
  ],

  [
    "iphone-16-pro",
    {
      title: "iPhone 16 Pro",
      category: "Gadgets",
      brand: "Apple",
      condition: "Excellent",
      price: 950
    }
  ],

  [
    "iphone-16-pro-max",
    {
      title: "iPhone 16 Pro Max",
      category: "Gadgets",
      brand: "Apple",
      condition: "Excellent",
      price: 1050
    }
  ],

  [
    "iphone-16",
    {
      title: "iPhone 16",
      category: "Gadgets",
      brand: "Apple",
      condition: "Excellent",
      price: 800
    }
  ],

  [
    "iphone-15-pro",
    {
      title: "iPhone 15 Pro",
      category: "Gadgets",
      brand: "Apple",
      condition: "Good",
      price: 650
    }
  ],

  [
    "iphone-14-pro",
    {
      title: "iPhone 14 Pro",
      category: "Gadgets",
      brand: "Apple",
      condition: "Good",
      price: 520
    }
  ],

  [
    "galaxy-s26-ultra",
    {
      title: "Galaxy S26 Ultra",
      category: "Gadgets",
      brand: "Samsung",
      condition: "Like New",
      price: 1100
    }
  ],

  [
    "galaxy-z-fold",
    {
      title: "Galaxy Z Fold",
      category: "Gadgets",
      brand: "Samsung",
      condition: "Excellent",
      price: 1250
    }
  ],

  [
    "macbook-air",
    {
      title: "MacBook Air",
      category: "Gadgets",
      brand: "Apple",
      condition: "Excellent",
      price: 850
    }
  ],

  [
    "rolex-watch",
    {
      title: "Rolex Watch",
      category: "Luxury",
      brand: "Rolex",
      condition: "Excellent",
      price: 3200
    }
  ],

  [
    "cartier-watch",
    {
      title: "Cartier Watch",
      category: "Luxury",
      brand: "Cartier",
      condition: "Excellent",
      price: 2800
    }
  ]
]);


/* =========================================================
   SUPPORTED CRYPTOCURRENCIES
   ========================================================= */

const SUPPORTED_CRYPTO =
  new Set([
    "btc",
    "sol",
    "usdterc20",
    "usdc"
  ]);


/* =========================================================
   DEVELOPMENT ORDER STORE
   =========================================================

   IMPORTANT:

   This is secure enough for our current development
   architecture, but it is NOT a production database.

   Orders disappear when the server restarts.

   Later we should move this to PostgreSQL / MySQL /
   SQLite or another persistent database.
   ========================================================= */

const orders =
  new Map();


/* =========================================================
   HELPERS
   ========================================================= */

const isValidEmail = (email) => {
  return (
    typeof email === "string" &&
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
};


const normalizeString = (
  value,
  maxLength = 200
) => {
  if (
    typeof value !== "string"
  ) {
    return "";
  }

  return value
    .trim()
    .slice(0, maxLength);
};


const generateOrderReference = () => {

  const random =
    crypto
      .randomBytes(6)
      .toString("hex")
      .toUpperCase();

  const timestamp =
    Date.now()
      .toString(36)
      .toUpperCase();

  return `AX-${timestamp}-${random}`;
};


const sortObject = (object) => {

  return Object.keys(object)
    .sort()
    .reduce(
      (result, key) => {

        result[key] =
          object[key];

        return result;
      },
      {}
    );
};


const escapeHtml = (value) => {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};


const safeError = (
  message,
  status = 400
) => {

  return {
    status,
    body: {
      success: false,
      error: message
    }
  };
};


/* =========================================================
   ORDER SERIALIZATION
   ========================================================= */

const publicOrder = (order) => {

  if (!order) {
    return null;
  }

  return {
    reference:
      order.reference,

    status:
      order.status,

    payment_method:
      order.payment_method,

    crypto_currency:
      order.crypto_currency || null,

    customer: {
      name:
        order.customer.name,

      email:
        order.customer.email,

      phone:
        order.customer.phone,

      address:
        order.customer.address,

      city:
        order.customer.city,

      state:
        order.customer.state,

      country:
        order.customer.country,

      postalCode:
        order.customer.postalCode
    },

    items:
      order.items,

    subtotal:
      order.subtotal,

    total:
      order.total,

    currency:
      order.currency,

    payment_id:
      order.payment_id || null,

    payment_status:
      order.payment_status || null,

    pay_address:
      order.pay_address || null,

    pay_amount:
      order.pay_amount || null,

    pay_currency:
      order.pay_currency || null,

    price_amount:
      order.price_amount || null,

    price_currency:
      order.price_currency || null,

    expiration_estimate_date:
      order.expiration_estimate_date || null,

    paid_at:
      order.paid_at || null,

    created_at:
      order.created_at
  };
};


/* =========================================================
   EMAIL NOTIFICATION
   ========================================================= */

const sendPaidOrderNotification = async (
  order
) => {

  if (!resend) {

    console.warn(
      "Resend is not configured. Paid-order email skipped."
    );

    return;
  }


  const destination =
    process.env.ORDER_NOTIFICATION_EMAIL;


  if (!destination) {

    console.warn(
      "ORDER_NOTIFICATION_EMAIL is not configured."
    );

    return;
  }


  const itemsHtml =
    order.items
      .map(
        (item) => `
          <tr>
            <td style="padding:8px 0;">
              ${escapeHtml(item.title)}
            </td>

            <td style="padding:8px 0;">
              ${item.quantity}
            </td>

            <td style="padding:8px 0;">
              $${Number(item.lineTotal).toLocaleString("en-US")}
            </td>
          </tr>
        `
      )
      .join("");


  try {

    await resend.emails.send({
      from:
        "AUCTION X <onboarding@resend.dev>",

      to:
        [destination],

      subject:
        `AUCTION X — Payment Confirmed — ${order.reference}`,

      html: `
        <div style="
          font-family:Arial,sans-serif;
          max-width:700px;
          margin:auto;
          color:#111;
        ">

          <h1>
            AUCTION X
          </h1>

          <h2>
            Payment Confirmed
          </h2>

          <p>
            Order <strong>
              ${escapeHtml(order.reference)}
            </strong>
            has been verified as paid.
          </p>

          <hr>

          <h3>
            Customer
          </h3>

          <p>
            ${escapeHtml(order.customer.name)}<br>
            ${escapeHtml(order.customer.email)}<br>
            ${escapeHtml(order.customer.phone)}
          </p>

          <h3>
            Delivery
          </h3>

          <p>
            ${escapeHtml(order.customer.address)}<br>
            ${escapeHtml(order.customer.city)}<br>
            ${escapeHtml(order.customer.state)}<br>
            ${escapeHtml(order.customer.country)}<br>
            ${escapeHtml(order.customer.postalCode)}
          </p>

          <h3>
            Items
          </h3>

          <table
            style="
              width:100%;
              border-collapse:collapse;
            "
          >
            <thead>
              <tr>
                <th align="left">
                  Item
                </th>

                <th align="left">
                  Qty
                </th>

                <th align="left">
                  Total
                </th>
              </tr>
            </thead>

            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <hr>

          <p>
            <strong>
              Total:
              $${Number(order.total).toLocaleString("en-US")}
            </strong>
          </p>

          <p>
            Payment:
            ${escapeHtml(
              order.pay_currency || "Crypto"
            )}
          </p>

          <p>
            Payment ID:
            ${escapeHtml(
              order.payment_id || "—"
            )}
          </p>

        </div>
      `
    });


    console.log(
      `Paid-order notification sent for ${order.reference}`
    );

  } catch (error) {

    console.error(
      "Resend notification failed:",
      error.message
    );
  }
};


/* =========================================================
   HEALTH
   ========================================================= */

app.get(
  "/api/health",
  (req, res) => {

    res.json({
      success: true,
      service: "AUCTION X API",
      status: "online"
    });
  }
);


/* =========================================================
   TEST EMAIL
   ========================================================= */

app.get(
  "/api/test-email",
  async (req, res) => {

    if (
      process.env.NODE_ENV === "production"
    ) {

      return res.status(404).json({
        success: false,
        error: "Not found."
      });
    }


    if (!resend) {

      return res.status(500).json({
        success: false,
        error:
          "RESEND_API_KEY is not configured."
      });
    }


    const destination =
      process.env.ORDER_NOTIFICATION_EMAIL;


    if (!destination) {

      return res.status(500).json({
        success: false,
        error:
          "ORDER_NOTIFICATION_EMAIL is not configured."
      });
    }


    try {

      const result =
        await resend.emails.send({

          from:
            "AUCTION X <onboarding@resend.dev>",

          to:
            [destination],

          subject:
            "AUCTION X — Email Test",

          html: `
            <div
              style="
                font-family:Arial,sans-serif;
                padding:30px;
              "
            >

              <h1>
                AUCTION X
              </h1>

              <p>
                Resend email delivery is working.
              </p>

              <p>
                This is a development test.
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
        success: false,
        error:
          "Email delivery failed."
      });
    }
  }
);


/* =========================================================
   CREATE ORDER
   ========================================================= */

app.post(
  "/api/orders/create",
  paymentLimiter,
  (req, res) => {

    try {

      const body =
        req.body || {};


      const customer =
        body.customer || {};


      const rawItems =
        Array.isArray(body.items)
          ? body.items
          : [];


      /* ===================================================
         CUSTOMER VALIDATION
         =================================================== */

      const name =
        normalizeString(
          customer.name,
          100
        );


      const email =
        normalizeString(
          customer.email,
          254
        );


      const phone =
        normalizeString(
          customer.phone,
          50
        );


      const address =
        normalizeString(
          customer.address,
          300
        );


      const city =
        normalizeString(
          customer.city,
          100
        );


      const state =
        normalizeString(
          customer.state,
          100
        );


      const country =
        normalizeString(
          customer.country,
          100
        );


      const postalCode =
        normalizeString(
          customer.postalCode,
          30
        );


      if (
        !name ||
        !email ||
        !phone ||
        !address ||
        !city ||
        !state ||
        !country ||
        !postalCode
      ) {

        const error =
          safeError(
            "Complete all required delivery information."
          );

        return res
          .status(error.status)
          .json(error.body);
      }


      if (
        !isValidEmail(email)
      ) {

        const error =
          safeError(
            "Please provide a valid email address."
          );

        return res
          .status(error.status)
          .json(error.body);
      }


      /* ===================================================
         ITEM VALIDATION
         =================================================== */

      if (
        rawItems.length < 1 ||
        rawItems.length > 20
      ) {

        const error =
          safeError(
            "Order must contain between 1 and 20 listings."
          );

        return res
          .status(error.status)
          .json(error.body);
      }


      const calculatedItems = [];


      let subtotal = 0;


      for (
        const item of rawItems
      ) {

        const productId =
          normalizeString(
            item?.productId ||
            item?.id,
            100
          );


        const product =
          PRODUCT_CATALOG.get(
            productId
          );


        if (!product) {

          const error =
            safeError(
              "One or more selected listings are no longer available."
            );

          return res
            .status(error.status)
            .json(error.body);
        }


        let quantity =
          Number(
            item?.quantity
          );


        if (
          !Number.isInteger(quantity)
        ) {
          quantity = 1;
        }


        quantity =
          Math.min(
            10,
            Math.max(
              1,
              quantity
            )
          );


        const lineTotal =
          product.price *
          quantity;


        subtotal +=
          lineTotal;


        calculatedItems.push({
          productId,
          title:
            product.title,
          category:
            product.category,
          brand:
            product.brand,
          condition:
            product.condition,
          unitPrice:
            product.price,
          quantity,
          lineTotal
        });
      }


      /* ===================================================
         PAYMENT METHOD
         =================================================== */

      const paymentMethod =
        normalizeString(
          body.paymentMethod,
          30
        ).toLowerCase();


      if (
        paymentMethod !== "crypto" &&
        paymentMethod !== "card"
      ) {

        const error =
          safeError(
            "Unsupported payment method."
          );

        return res
          .status(error.status)
          .json(error.body);
      }


      let cryptoCurrency =
        null;


      if (
        paymentMethod === "crypto"
      ) {

        cryptoCurrency =
          normalizeString(
            body.cryptoCurrency,
            30
          ).toLowerCase();


        if (
          !SUPPORTED_CRYPTO.has(
            cryptoCurrency
          )
        ) {

          const error =
            safeError(
              "Unsupported cryptocurrency."
            );

          return res
            .status(error.status)
            .json(error.body);
        }
      }


      /* ===================================================
         CREATE SERVER ORDER
         =================================================== */

      const reference =
        generateOrderReference();


      const order = {

        reference,

        status:
          "pending",

        payment_method:
          paymentMethod,

        crypto_currency:
          cryptoCurrency,

        customer: {
          name,
          email,
          phone,
          address,
          city,
          state,
          country,
          postalCode
        },

        items:
          calculatedItems,

        subtotal,

        total:
          subtotal,

        currency:
          "USD",

        payment_id:
          null,

        payment_status:
          null,

        pay_address:
          null,

        pay_amount:
          null,

        pay_currency:
          null,

        price_amount:
          null,

        price_currency:
          null,

        expiration_estimate_date:
          null,

        paid_at:
          null,

        payment_creation_in_progress:
          false,

        notification_sent:
          false,

        created_at:
          new Date().toISOString()
      };


      orders.set(
        reference,
        order
      );


      console.log(
        `Order created: ${reference}`
      );


      return res.status(201).json({
        success: true,
        order:
          publicOrder(order)
      });

    } catch (error) {

      console.error(
        "Order creation error:",
        error.message
      );


      return res.status(500).json({
        success: false,
        error:
          "Unable to create order."
      });
    }
  }
);


/* =========================================================
   CREATE CRYPTO PAYMENT
   ========================================================= */

app.post(
  "/api/crypto/create",
  paymentLimiter,
  async (req, res) => {

    try {

      const orderId =
        normalizeString(
          req.body?.order_id,
          100
        );


      const payCurrency =
        normalizeString(
          req.body?.pay_currency,
          30
        ).toLowerCase();


      if (!orderId) {

        const error =
          safeError(
            "Order reference is required."
          );

        return res
          .status(error.status)
          .json(error.body);
      }


      if (
        !SUPPORTED_CRYPTO.has(
          payCurrency
        )
      ) {

        const error =
          safeError(
            "Unsupported cryptocurrency."
          );

        return res
          .status(error.status)
          .json(error.body);
      }


      const order =
        orders.get(orderId);


      if (!order) {

        const error =
          safeError(
            "Order not found.",
            404
          );

        return res
          .status(error.status)
          .json(error.body);
      }


      if (
        order.payment_method !==
        "crypto"
      ) {

        const error =
          safeError(
            "This order is not configured for crypto payment."
          );

        return res
          .status(error.status)
          .json(error.body);
      }


      if (
        order.status === "paid"
      ) {

        const error =
          safeError(
            "This order has already been paid."
          );

        return res
          .status(error.status)
          .json(error.body);
      }


      /*
        Prevent duplicate NOWPayments
        creation requests.
      */

      if (
        order.payment_creation_in_progress
      ) {

        return res.status(409).json({
          success: false,
          error:
            "Payment creation is already in progress."
        });
      }


      /*
        If a payment already exists,
        return it instead of creating
        another payment.
      */

      if (
        order.payment_id
      ) {

        return res.json({
          success: true,
          payment: {
            payment_id:
              order.payment_id,

            payment_status:
              order.payment_status,

            pay_address:
              order.pay_address,

            pay_amount:
              order.pay_amount,

            pay_currency:
              order.pay_currency,

            price_amount:
              order.price_amount,

            price_currency:
              order.price_currency,

            expiration_estimate_date:
              order.expiration_estimate_date,

            order_id:
              order.reference
          }
        });
      }


      if (
        !process.env.NOWPAYMENTS_API_KEY
      ) {

        return res.status(500).json({
          success: false,
          error:
            "NOWPayments is not configured on the server."
        });
      }


      order.payment_creation_in_progress =
        true;


      try {

        const payload = {

          price_amount:
            order.total,

          price_currency:
            "usd",

          pay_currency:
            payCurrency,

          order_id:
            order.reference,

          order_description:
            `AUCTION X order ${order.reference}`,

          customer_email:
            order.customer.email
        };


        const response =
          await axios.post(
            "https://api.nowpayments.io/v1/payment",
            payload,
            {
              headers: {
                "x-api-key":
                  process.env.NOWPAYMENTS_API_KEY,

                "Content-Type":
                  "application/json"
              },

              timeout: 15000
            }
          );


        const payment =
          response.data;


        if (
          !payment?.payment_id
        ) {

          throw new Error(
            "NOWPayments did not return a payment ID."
          );
        }


        /*
          Store provider data server-side.
        */

        order.payment_id =
          String(
            payment.payment_id
          );

        order.payment_status =
          payment.payment_status ||
          "waiting";

        order.pay_address =
          payment.pay_address ||
          null;

        order.pay_amount =
          payment.pay_amount ||
          null;

        order.pay_currency =
          payment.pay_currency ||
          payCurrency;

        order.price_amount =
          payment.price_amount ||
          order.total;

        order.price_currency =
          payment.price_currency ||
          "usd";

        order.expiration_estimate_date =
          payment.expiration_estimate_date ||
          null;


        orders.set(
          order.reference,
          order
        );


        console.log(
          `Crypto payment created for ${order.reference}`
        );


        return res.status(201).json({

          success: true,

          payment: {
            payment_id:
              order.payment_id,

            payment_status:
              order.payment_status,

            pay_address:
              order.pay_address,

            pay_amount:
              order.pay_amount,

            pay_currency:
              order.pay_currency,

            price_amount:
              order.price_amount,

            price_currency:
              order.price_currency,

            expiration_estimate_date:
              order.expiration_estimate_date,

            order_id:
              order.reference
          }
        });

      } finally {

        order.payment_creation_in_progress =
          false;
      }

    } catch (error) {

      console.error(
        "Crypto payment creation failed:",
        error.response?.data ||
        error.message
      );


      return res.status(
        error.response?.status || 500
      ).json({
        success: false,
        error:
          "Unable to create the crypto payment."
      });
    }
  }
);


/* =========================================================
   CRYPTO PAYMENT STATUS
   ========================================================= */

app.get(
  "/api/crypto/status/:paymentId",
  async (req, res) => {

    try {

      const paymentId =
        normalizeString(
          req.params.paymentId,
          100
        );


      if (!paymentId) {

        return res.status(400).json({
          success: false,
          error:
            "Payment ID is required."
        });
      }


      /*
        IMPORTANT:

        Do not allow the browser to query
        arbitrary NOWPayments payment IDs.

        First find the payment in our own
        server-side order store.
      */

      let matchingOrder =
        null;


      for (
        const order of orders.values()
      ) {

        if (
          String(
            order.payment_id
          ) === paymentId
        ) {

          matchingOrder =
            order;

          break;
        }
      }


      if (!matchingOrder) {

        return res.status(404).json({
          success: false,
          error:
            "Payment not associated with an AUCTION X order."
        });
      }


      if (
        !process.env.NOWPAYMENTS_API_KEY
      ) {

        return res.status(500).json({
          success: false,
          error:
            "NOWPayments is not configured."
        });
      }


      const response =
        await axios.get(
          `https://api.nowpayments.io/v1/payment/${encodeURIComponent(
            paymentId
          )}`,
          {
            headers: {
              "x-api-key":
                process.env.NOWPAYMENTS_API_KEY
            },

            timeout: 15000
          }
        );


      const payment =
        response.data;


      if (
        !payment
      ) {

        return res.status(502).json({
          success: false,
          error:
            "Payment provider returned no payment data."
        });
      }


      /*
        Store latest provider state.
      */

      matchingOrder.payment_status =
        payment.payment_status ||
        matchingOrder.payment_status;

      matchingOrder.pay_address =
        payment.pay_address ||
        matchingOrder.pay_address;

      matchingOrder.pay_amount =
        payment.pay_amount ||
        matchingOrder.pay_amount;

      matchingOrder.pay_currency =
        payment.pay_currency ||
        matchingOrder.pay_currency;

      matchingOrder.price_amount =
        payment.price_amount ||
        matchingOrder.price_amount;

      matchingOrder.price_currency =
        payment.price_currency ||
        matchingOrder.price_currency;

      matchingOrder.expiration_estimate_date =
        payment.expiration_estimate_date ||
        matchingOrder.expiration_estimate_date;


      /*
        IMPORTANT:

        The client is not allowed to
        decide that payment is complete.

        The server verifies the provider
        amount before marking the order paid.
      */

      if (
        payment.payment_status ===
        "finished"
      ) {

        const providerAmount =
          Number(
            payment.price_amount
          );


        const expectedAmount =
          Number(
            matchingOrder.total
          );


        const providerCurrency =
          String(
            payment.price_currency ||
            ""
          ).toLowerCase();


        const amountMatches =
          Number.isFinite(
            providerAmount
          ) &&
          Math.abs(
            providerAmount -
            expectedAmount
          ) < 0.01;


        const currencyMatches =
          providerCurrency ===
          "usd";


        if (
          amountMatches &&
          currencyMatches
        ) {

          matchingOrder.status =
            "paid";

          matchingOrder.paid_at =
            payment.updated_at ||
            new Date().toISOString();


          /*
            Send the order notification
            only after verified payment.
          */

          if (
            !matchingOrder.notification_sent
          ) {

            matchingOrder.notification_sent =
              true;


            await sendPaidOrderNotification(
              matchingOrder
            );
          }

        } else {

          console.error(
            `Payment amount/currency mismatch for ${matchingOrder.reference}`
          );


          matchingOrder.status =
            "payment_review";
        }
      }


      orders.set(
        matchingOrder.reference,
        matchingOrder
      );


      return res.json({
        success: true,

        payment: {

          payment_id:
            matchingOrder.payment_id,

          payment_status:
            matchingOrder.payment_status,

          pay_address:
            matchingOrder.pay_address,

          pay_amount:
            matchingOrder.pay_amount,

          pay_currency:
            matchingOrder.pay_currency,

          price_amount:
            matchingOrder.price_amount,

          price_currency:
            matchingOrder.price_currency,

          expiration_estimate_date:
            matchingOrder.expiration_estimate_date,

          order_id:
            matchingOrder.reference,

          /*
            This is our server-side status,
            not a client-created status.
          */

          order_status:
            matchingOrder.status,

          paid_at:
            matchingOrder.paid_at
        }
      });

    } catch (error) {

      console.error(
        "Crypto status request failed:",
        error.response?.data ||
        error.message
      );


      return res.status(
        error.response?.status || 500
      ).json({
        success: false,
        error:
          "Unable to retrieve payment status."
      });
    }
  }
);


/* =========================================================
   NOWPAYMENTS IPN
   ========================================================= */

app.post(
  "/api/crypto/ipn",
  async (req, res) => {

    try {

      const receivedSignature =
        req.headers[
          "x-nowpayments-sig"
        ];


      const secret =
        process.env.NOWPAYMENTS_IPN_SECRET;


      if (
        !receivedSignature ||
        !secret
      ) {

        return res.status(401).json({
          success: false,
          error:
            "Invalid IPN configuration."
        });
      }


      const sortedBody =
        sortObject(
          req.body
        );


      const bodyString =
        JSON.stringify(
          sortedBody
        );


      const expectedSignature =
        crypto
          .createHmac(
            "sha512",
            secret
          )
          .update(bodyString)
          .digest("hex");


      const receivedBuffer =
        Buffer.from(
          receivedSignature,
          "utf8"
        );


      const expectedBuffer =
        Buffer.from(
          expectedSignature,
          "utf8"
        );


      if (
        receivedBuffer.length !==
        expectedBuffer.length ||
        !crypto.timingSafeEqual(
          receivedBuffer,
          expectedBuffer
        )
      ) {

        console.warn(
          "Rejected invalid NOWPayments IPN signature."
        );


        return res.status(401).json({
          success: false,
          error:
            "Invalid signature."
        });
      }


      const paymentId =
        String(
          req.body?.payment_id ||
          ""
        );


      const orderId =
        String(
          req.body?.order_id ||
          ""
        );


      let order =
        orderId
          ? orders.get(orderId)
          : null;


      if (
        !order &&
        paymentId
      ) {

        for (
          const candidate of orders.values()
        ) {

          if (
            String(
              candidate.payment_id
            ) === paymentId
          ) {

            order =
              candidate;

            break;
          }
        }
      }


      if (!order) {

        return res.status(404).json({
          success: false,
          error:
            "Order not found."
        });
      }


      /*
        Payment must belong to this order.
      */

      if (
        order.payment_id &&
        paymentId &&
        String(
          order.payment_id
        ) !== paymentId
      ) {

        return res.status(400).json({
          success: false,
          error:
            "Payment does not match order."
        });
      }


      const paymentStatus =
        String(
          req.body?.payment_status ||
          ""
        ).toLowerCase();


      order.payment_status =
        paymentStatus;


      order.pay_address =
        req.body?.pay_address ||
        order.pay_address ||
        null;

      order.pay_amount =
        req.body?.pay_amount ||
        order.pay_amount ||
        null;

      order.pay_currency =
        req.body?.pay_currency ||
        order.pay_currency ||
        null;

      order.price_amount =
        req.body?.price_amount ||
        order.price_amount ||
        null;

      order.price_currency =
        req.body?.price_currency ||
        order.price_currency ||
        null;


      /* =====================================================
         VERIFY FINISHED PAYMENT
         ===================================================== */

      if (
        paymentStatus ===
        "finished"
      ) {

        const receivedAmount =
          Number(
            req.body?.price_amount
          );


        const expectedAmount =
          Number(
            order.total
          );


        const receivedCurrency =
          String(
            req.body?.price_currency ||
            ""
          ).toLowerCase();


        const amountMatches =
          Number.isFinite(
            receivedAmount
          ) &&
          Math.abs(
            receivedAmount -
            expectedAmount
          ) < 0.01;


        const currencyMatches =
          receivedCurrency ===
          "usd";


        if (
          !amountMatches ||
          !currencyMatches
        ) {

          order.status =
            "payment_review";


          orders.set(
            order.reference,
            order
          );


          console.error(
            `IPN payment mismatch for ${order.reference}`
          );


          return res.status(400).json({
            success: false,
            error:
              "Payment verification failed."
          });
        }


        /*
          Only now is the order officially paid.
        */

        order.status =
          "paid";


        order.paid_at =
          new Date().toISOString();


        if (
          !order.notification_sent
        ) {

          order.notification_sent =
            true;


          await sendPaidOrderNotification(
            order
          );
        }
      }


      if (
        paymentStatus ===
        "failed"
      ) {

        order.status =
          "failed";
      }


      if (
        paymentStatus ===
        "expired"
      ) {

        order.status =
          "expired";
      }


      if (
        paymentStatus ===
        "refunded"
      ) {

        order.status =
          "refunded";
      }


      orders.set(
        order.reference,
        order
      );


      return res.json({
        success: true
      });

    } catch (error) {

      console.error(
        "NOWPayments IPN error:",
        error.message
      );


      return res.status(500).json({
        success: false,
        error:
          "IPN processing failed."
      });
    }
  }
);


/* =========================================================
   PAYSTACK INITIALIZE
   =========================================================

   Card payments are currently disabled in the
   frontend, but this endpoint is still hardened.
   ========================================================= */

app.post(
  "/api/payment/initialize",
  paymentLimiter,
  async (req, res) => {

    try {

      const orderId =
        normalizeString(
          req.body?.order_id,
          100
        );


      if (!orderId) {

        return res.status(400).json({
          success: false,
          error:
            "Order reference is required."
        });
      }


      const order =
        orders.get(orderId);


      if (!order) {

        return res.status(404).json({
          success: false,
          error:
            "Order not found."
        });
      }


      if (
        order.payment_method !==
        "card"
      ) {

        return res.status(400).json({
          success: false,
          error:
            "This order is not configured for card payment."
        });
      }


      if (
        !process.env.PAYSTACK_SECRET_KEY
      ) {

        return res.status(500).json({
          success: false,
          error:
            "Paystack is not configured."
        });
      }


      const callbackUrl =
        normalizeString(
          req.body?.callback_url,
          500
        );


      const payload = {

        email:
          order.customer.email,

        amount:
          Math.round(
            order.total * 100
          ),

        currency:
          "USD",

        reference:
          order.reference,

        callback_url:
          callbackUrl || undefined,

        metadata: {
          order_reference:
            order.reference
        }
      };


      const response =
        await axios.post(
          "https://api.paystack.co/transaction/initialize",
          payload,
          {
            headers: {
              Authorization:
                `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,

              "Content-Type":
                "application/json"
            },

            timeout: 15000
          }
        );


      const payment =
        response.data;


      return res.json({
        success: true,

        authorization_url:
          payment?.data?.authorization_url ||
          null,

        access_code:
          payment?.data?.access_code ||
          null,

        reference:
          payment?.data?.reference ||
          order.reference
      });

    } catch (error) {

      console.error(
        "Paystack initialization failed:",
        error.response?.data ||
        error.message
      );


      return res.status(
        error.response?.status || 500
      ).json({
        success: false,
        error:
          "Unable to initialize card payment."
      });
    }
  }
);


/* =========================================================
   PAYSTACK VERIFY
   ========================================================= */

app.get(
  "/api/payment/verify/:reference",
  async (req, res) => {

    try {

      const reference =
        normalizeString(
          req.params.reference,
          100
        );


      if (!reference) {

        return res.status(400).json({
          success: false,
          error:
            "Payment reference is required."
        });
      }


      const order =
        orders.get(reference);


      if (!order) {

        return res.status(404).json({
          success: false,
          error:
            "Order not found."
        });
      }


      if (
        !process.env.PAYSTACK_SECRET_KEY
      ) {

        return res.status(500).json({
          success: false,
          error:
            "Paystack is not configured."
        });
      }


      const response =
        await axios.get(
          `https://api.paystack.co/transaction/verify/${encodeURIComponent(
            reference
          )}`,
          {
            headers: {
              Authorization:
                `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
            },

            timeout: 15000
          }
        );


      const transaction =
        response.data?.data;


      if (!transaction) {

        return res.status(502).json({
          success: false,
          error:
            "Paystack returned no transaction."
        });
      }


      const providerAmount =
        Number(
          transaction.amount
        ) / 100;


      const expectedAmount =
        Number(
          order.total
        );


      const amountMatches =
        Number.isFinite(
          providerAmount
        ) &&
        Math.abs(
          providerAmount -
          expectedAmount
        ) < 0.01;


      const currencyMatches =
        String(
          transaction.currency ||
          ""
        ).toUpperCase() ===
        "USD";


      const successful =
        transaction.status ===
        "success";


      if (
        successful &&
        amountMatches &&
        currencyMatches
      ) {

        order.status =
          "paid";

        order.payment_status =
          "success";

        order.paid_at =
          transaction.paid_at ||
          new Date().toISOString();


        orders.set(
          order.reference,
          order
        );


        if (
          !order.notification_sent
        ) {

          order.notification_sent =
            true;


          await sendPaidOrderNotification(
            order
          );
        }
      }


      return res.json({

        success: true,

        status:
          successful &&
          amountMatches &&
          currencyMatches
            ? "success"
            : transaction.status,

        paid_at:
          transaction.paid_at ||
          null,

        currency:
          transaction.currency ||
          null,

        order_status:
          order.status
      });

    } catch (error) {

      console.error(
        "Paystack verification failed:",
        error.response?.data ||
        error.message
      );


      return res.status(
        error.response?.status || 500
      ).json({
        success: false,
        error:
          "Unable to verify payment."
      });
    }
  }
);


/* =========================================================
   REMOVE PUBLIC CLIENT-SIDE ORDER NOTIFICATION
   =========================================================

   We intentionally DO NOT expose:

   POST /api/orders/notify

   anymore.

   A browser must never be able to tell the server:
   "I paid."

   Only verified provider payment status can
   trigger an order notification.
   ========================================================= */


/* =========================================================
   404
   ========================================================= */

app.use(
  (req, res) => {

    res.status(404).json({
      success: false,
      error:
        "Endpoint not found."
    });
  }
);


/* =========================================================
   GLOBAL ERROR HANDLER
   ========================================================= */

app.use(
  (error, req, res, next) => {

    console.error(
      "Unhandled server error:",
      error.message
    );


    if (
      res.headersSent
    ) {
      return next(error);
    }


    res.status(500).json({
      success: false,
      error:
        "Internal server error."
    });
  }
);


/* =========================================================
   START SERVER
   ========================================================= */

app.listen(
  PORT,
  () => {

    console.log(
      "======================================"
    );

    console.log(
      "AUCTION X API"
    );

    console.log(
      "======================================"
    );

    console.log(
      `Server: http://localhost:${PORT}`
    );

    console.log(
      `Frontend: ${FRONTEND_ORIGIN}`
    );

    console.log(
      `Products: ${PRODUCT_CATALOG.size}`
    );

    console.log(
      `Crypto: ${[
        ...SUPPORTED_CRYPTO
      ].join(", ")}`
    );

    console.log(
      "Security middleware: ENABLED"
    );

    console.log(
      "Server-side pricing: ENABLED"
    );

    console.log(
      "======================================"
    );
  }
);