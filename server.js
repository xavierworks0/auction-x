/* =========================================================
   AUCTION X — SECURE POSTGRESQL BACKEND
   ========================================================= */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const axios = require("axios");
const crypto = require("crypto");
const { Resend } = require("resend");
const { Pool } = require("pg");

/* =========================================================
   APP
   ========================================================= */

const app = express();

const PORT = Number(process.env.PORT) || 4242;

const FRONTEND_ORIGIN =
  process.env.AUCTION_X_ORIGIN ||
  "http://localhost:5175";

/* =========================================================
   DATABASE
   ========================================================= */

if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL is missing from .env."
  );

  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on("error", (error) => {
  console.error(
    "Unexpected PostgreSQL pool error:",
    error.message
  );
});

/* =========================================================
   DATABASE INITIALIZATION
   ========================================================= */

async function initializeDatabase() {
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,

        reference VARCHAR(100) UNIQUE NOT NULL,

        status VARCHAR(50) NOT NULL DEFAULT 'pending',

        payment_method VARCHAR(30) NOT NULL,

        crypto_currency VARCHAR(30),

        customer JSONB NOT NULL,

        items JSONB NOT NULL,

        subtotal NUMERIC(12, 2) NOT NULL,

        total NUMERIC(12, 2) NOT NULL,

        currency VARCHAR(10) NOT NULL DEFAULT 'USD',

        payment_id VARCHAR(150),

        payment_status VARCHAR(100),

        pay_address TEXT,

        pay_amount NUMERIC(30, 18),

        pay_currency VARCHAR(50),

        price_amount NUMERIC(30, 18),

        price_currency VARCHAR(50),

        expiration_estimate_date TIMESTAMPTZ,

        paid_at TIMESTAMPTZ,

        payment_creation_in_progress BOOLEAN NOT NULL DEFAULT FALSE,

        notification_sent BOOLEAN NOT NULL DEFAULT FALSE,

        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_payment_id
      ON orders(payment_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_status
      ON orders(status);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_created_at
      ON orders(created_at DESC);
    `);

    console.log("PostgreSQL: CONNECTED");
    console.log("Database: READY");
  } finally {
    client.release();
  }
}

/* =========================================================
   DATABASE HELPERS
   ========================================================= */

const normalizeDbOrder = (row) => {
  if (!row) {
    return null;
  }

  return {
    reference: row.reference,

    status: row.status,

    payment_method:
      row.payment_method,

    crypto_currency:
      row.crypto_currency || null,

    customer:
      row.customer || {},

    items:
      row.items || [],

    subtotal:
      Number(row.subtotal),

    total:
      Number(row.total),

    currency:
      row.currency || "USD",

    payment_id:
      row.payment_id || null,

    payment_status:
      row.payment_status || null,

    pay_address:
      row.pay_address || null,

    pay_amount:
      row.pay_amount !== null &&
      row.pay_amount !== undefined
        ? Number(row.pay_amount)
        : null,

    pay_currency:
      row.pay_currency || null,

    price_amount:
      row.price_amount !== null &&
      row.price_amount !== undefined
        ? Number(row.price_amount)
        : null,

    price_currency:
      row.price_currency || null,

    expiration_estimate_date:
      row.expiration_estimate_date
        ? new Date(
            row.expiration_estimate_date
          ).toISOString()
        : null,

    paid_at:
      row.paid_at
        ? new Date(row.paid_at).toISOString()
        : null,

    payment_creation_in_progress:
      Boolean(
        row.payment_creation_in_progress
      ),

    notification_sent:
      Boolean(row.notification_sent),

    created_at:
      row.created_at
        ? new Date(row.created_at).toISOString()
        : null
  };
};

const getOrderByReference = async (
  reference
) => {
  const result = await pool.query(
    `
      SELECT *
      FROM orders
      WHERE reference = $1
      LIMIT 1
    `,
    [reference]
  );

  return normalizeDbOrder(
    result.rows[0]
  );
};

const getOrderByPaymentId = async (
  paymentId
) => {
  const result = await pool.query(
    `
      SELECT *
      FROM orders
      WHERE payment_id = $1
      LIMIT 1
    `,
    [String(paymentId)]
  );

  return normalizeDbOrder(
    result.rows[0]
  );
};

const insertOrder = async (
  order
) => {
  await pool.query(
    `
      INSERT INTO orders (
        reference,
        status,
        payment_method,
        crypto_currency,
        customer,
        items,
        subtotal,
        total,
        currency,
        payment_id,
        payment_status,
        pay_address,
        pay_amount,
        pay_currency,
        price_amount,
        price_currency,
        expiration_estimate_date,
        paid_at,
        payment_creation_in_progress,
        notification_sent,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5::jsonb,
        $6::jsonb,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        $15,
        $16,
        $17,
        $18,
        $19,
        $20,
        NOW(),
        NOW()
      )
    `,
    [
      order.reference,
      order.status,
      order.payment_method,
      order.crypto_currency,
      JSON.stringify(order.customer),
      JSON.stringify(order.items),
      order.subtotal,
      order.total,
      order.currency,
      order.payment_id,
      order.payment_status,
      order.pay_address,
      order.pay_amount,
      order.pay_currency,
      order.price_amount,
      order.price_currency,
      order.expiration_estimate_date,
      order.paid_at,
      order.payment_creation_in_progress,
      order.notification_sent
    ]
  );
};

const updateOrder = async (
  order
) => {
  await pool.query(
    `
      UPDATE orders
      SET
        status = $2,
        payment_method = $3,
        crypto_currency = $4,
        customer = $5::jsonb,
        items = $6::jsonb,
        subtotal = $7,
        total = $8,
        currency = $9,
        payment_id = $10,
        payment_status = $11,
        pay_address = $12,
        pay_amount = $13,
        pay_currency = $14,
        price_amount = $15,
        price_currency = $16,
        expiration_estimate_date = $17,
        paid_at = $18,
        payment_creation_in_progress = $19,
        notification_sent = $20,
        updated_at = NOW()
      WHERE reference = $1
    `,
    [
      order.reference,
      order.status,
      order.payment_method,
      order.crypto_currency,
      JSON.stringify(order.customer),
      JSON.stringify(order.items),
      order.subtotal,
      order.total,
      order.currency,
      order.payment_id,
      order.payment_status,
      order.pay_address,
      order.pay_amount,
      order.pay_currency,
      order.price_amount,
      order.price_currency,
      order.expiration_estimate_date,
      order.paid_at,
      order.payment_creation_in_progress,
      order.notification_sent
    ]
  );
};

/* =========================================================
   APP SERVICES
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
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: {
      policy: "cross-origin"
    }
  })
);

const ALLOWED_ORIGINS = [
  FRONTEND_ORIGIN,
  "http://localhost:5175"
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without an Origin header.
      // Useful for health checks and server-to-server requests.
      if (!origin) {
        return callback(null, true);
      }

      if (ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error("Not allowed by CORS")
      );
    },

    methods: [
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "OPTIONS"
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization"
    ],

    credentials: false
  })
);

/* =========================================================
   RATE LIMITING
   ========================================================= */

const apiLimiter =
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error:
        "Too many requests. Please try again later."
    }
  });

const paymentLimiter =
  rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error:
        "Too many payment requests. Please try again later."
    }
  });

const statusLimiter =
  rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error:
        "Too many status requests. Please try again later."
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
   HELPERS
   ========================================================= */

const isValidEmail = (email) => {
  return (
    typeof email === "string" &&
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email
    )
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

const sortObject = (
  object
) => {
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

const escapeHtml = (
  value
) => {
  return String(value ?? "")
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
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
const sendNewOrderNotification = async (order) => {
  if (!resend) {
    console.warn(
      "Resend is not configured. New-order email skipped."
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

  const itemsHtml = order.items
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
    const result = await resend.emails.send({
      from:
        "AUCTION X <onboarding@resend.dev>",

      to:
        [destination],

      subject:
        `AUCTION X — New Order — ${order.reference}`,

      html: `
        <div
          style="
            font-family:Arial,sans-serif;
            max-width:700px;
            margin:auto;
            color:#111;
          "
        >
          <h1>AUCTION X</h1>

          <h2>New Order Received</h2>

          <p>
            A new order has been created on AUCTION X.
          </p>

          <p>
            <strong>
              Order:
              ${escapeHtml(order.reference)}
            </strong>
          </p>

          <hr>

          <h3>Customer</h3>

          <p>
            ${escapeHtml(order.customer.name)}<br>
            ${escapeHtml(order.customer.email)}<br>
            ${escapeHtml(order.customer.phone)}
          </p>

          <h3>Delivery Address</h3>

          <p>
            ${escapeHtml(order.customer.address)}<br>
            ${escapeHtml(order.customer.city)}<br>
            ${escapeHtml(order.customer.state)}<br>
            ${escapeHtml(order.customer.country)}<br>
            ${escapeHtml(order.customer.postalCode)}
          </p>

          <h3>Order Items</h3>

          <table
            style="
              width:100%;
              border-collapse:collapse;
            "
          >
            <thead>
              <tr>
                <th align="left">Item</th>
                <th align="left">Qty</th>
                <th align="left">Total</th>
              </tr>
            </thead>

            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <hr>

          <p>
            <strong>
              Order Total:
              $${Number(order.total).toLocaleString("en-US")}
            </strong>
          </p>

          <p>
            Payment Method:
            ${escapeHtml(order.payment_method)}
          </p>

          ${
            order.crypto_currency
              ? `
                <p>
                  Cryptocurrency:
                  ${escapeHtml(order.crypto_currency)}
                </p>
              `
              : ""
          }

          <p>
            Order Status:
            ${escapeHtml(order.status)}
          </p>

          <hr>

          <p>
            This notification was generated automatically by AUCTION X.
          </p>
        </div>
      `
    });

    console.log(
      `New-order email sent for ${order.reference}`,
      result?.data?.id || ""
    );

  } catch (error) {
    console.error(
      `New-order email failed for ${order.reference}:`,
      error.message
    );
  }
};
/* =========================================================
   ORDER SERIALIZATION
   ========================================================= */

const publicOrder = (
  order
) => {
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
        order.customer?.name || "",

      email:
        order.customer?.email || "",

      phone:
        order.customer?.phone || "",

      address:
        order.customer?.address || "",

      city:
        order.customer?.city || "",

      state:
        order.customer?.state || "",

      country:
        order.customer?.country || "",

      postalCode:
        order.customer?.postalCode || ""
    },

    items:
      order.items || [],

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
   HEALTH
   ========================================================= */

app.get(
  "/api/health",
  async (
    req,
    res
  ) => {
    try {
      await pool.query(
        "SELECT 1"
      );

      return res.json({
        success: true,
        service:
          "AUCTION X API",
        status:
          "online",
        database:
          "connected"
      });
    } catch (error) {
      return res.status(503).json({
        success: false,
        service:
          "AUCTION X API",
        status:
          "online",
        database:
          "disconnected"
      });
    }
  }
);

/* =========================================================
   TEST EMAIL
   ========================================================= */

app.get(
  "/api/test-email",
  async (
    req,
    res
  ) => {
    if (
      process.env.NODE_ENV ===
      "production"
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
        message:
          "Test email sent.",
        id:
          result?.data?.id ||
          null
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
  async (
    req,
    res
  ) => {
    try {
      const body =
        req.body || {};

      const customer =
        body.customer || {};

      const rawItems =
        Array.isArray(
          body.items
        )
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
        !isValidEmail(
          email
        )
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
          !Number.isInteger(
            quantity
          )
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
        paymentMethod !==
          "crypto" &&
        paymentMethod !==
          "card"
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
        paymentMethod ===
        "crypto"
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

      await insertOrder(
  order
);

console.log(
  `Order created: ${reference}`
);

await sendNewOrderNotification(
  order
);

return res
  .status(201)
        .json({
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
  async (
    req,
    res
  ) => {
    let order = null;

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

      order =
        await getOrderByReference(
          orderId
        );

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
        order.status ===
        "paid"
      ) {
        const error =
          safeError(
            "This order has already been paid."
          );

        return res
          .status(error.status)
          .json(error.body);
      }

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

      /*
        Atomic database lock.

        This prevents two requests from creating
        two NOWPayments payments for one order.
      */

      const lockResult =
        await pool.query(
          `
            UPDATE orders
            SET
              payment_creation_in_progress = TRUE,
              updated_at = NOW()
            WHERE
              reference = $1
              AND payment_id IS NULL
              AND payment_creation_in_progress = FALSE
            RETURNING *
          `,
          [order.reference]
        );

      if (
        lockResult.rowCount === 0
      ) {
        const latestOrder =
          await getOrderByReference(
            order.reference
          );

        if (
          latestOrder?.payment_id
        ) {
          return res.json({
            success: true,

            payment: {
              payment_id:
                latestOrder.payment_id,

              payment_status:
                latestOrder.payment_status,

              pay_address:
                latestOrder.pay_address,

              pay_amount:
                latestOrder.pay_amount,

              pay_currency:
                latestOrder.pay_currency,

              price_amount:
                latestOrder.price_amount,

              price_currency:
                latestOrder.price_currency,

              expiration_estimate_date:
                latestOrder.expiration_estimate_date,

              order_id:
                latestOrder.reference
            }
          });
        }

        return res.status(409).json({
          success: false,
          error:
            "Payment creation is already in progress."
        });
      }

      order =
        normalizeDbOrder(
          lockResult.rows[0]
        );

      if (
        !process.env.NOWPAYMENTS_API_KEY
      ) {
        await pool.query(
          `
            UPDATE orders
            SET
              payment_creation_in_progress = FALSE,
              updated_at = NOW()
            WHERE reference = $1
          `,
          [order.reference]
        );

        return res.status(500).json({
          success: false,
          error:
            "NOWPayments is not configured on the server."
        });
      }

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
                  process.env
                    .NOWPAYMENTS_API_KEY,

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

        order.payment_creation_in_progress =
          false;

        await updateOrder(
          order
        );

        console.log(
          `Crypto payment created for ${order.reference}`
        );

        return res
          .status(201)
          .json({
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
      } catch (paymentError) {
        await pool.query(
          `
            UPDATE orders
            SET
              payment_creation_in_progress = FALSE,
              updated_at = NOW()
            WHERE reference = $1
          `,
          [order.reference]
        );

        throw paymentError;
      }
    } catch (error) {
      console.error(
        "Crypto payment creation failed:",
        error.response?.data ||
          error.message
      );

      return res
        .status(
          error.response?.status ||
            500
        )
        .json({
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
  statusLimiter,
  async (
    req,
    res
  ) => {
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

      const matchingOrder =
        await getOrderByPaymentId(
          paymentId
        );

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
                process.env
                  .NOWPAYMENTS_API_KEY
            },

            timeout: 15000
          }
        );

      const payment =
        response.data;

      if (!payment) {
        return res.status(502).json({
          success: false,
          error:
            "Payment provider returned no payment data."
        });
      }

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

      /* ===================================================
         VERIFY FINISHED PAYMENT
         =================================================== */

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

          if (
            !matchingOrder.notification_sent
          ) {
            matchingOrder.notification_sent =
              true;

            await updateOrder(
              matchingOrder
            );

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

      await updateOrder(
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

      return res
        .status(
          error.response?.status ||
            500
        )
        .json({
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
  async (
    req,
    res
  ) => {
    try {
      const receivedSignature =
        req.headers[
          "x-nowpayments-sig"
        ];

      const secret =
        process.env
          .NOWPAYMENTS_IPN_SECRET;

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
          .update(
            bodyString
          )
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
          ? await getOrderByReference(
              orderId
            )
          : null;

      if (
        !order &&
        paymentId
      ) {
        order =
          await getOrderByPaymentId(
            paymentId
          );
      }

      if (!order) {
        return res.status(404).json({
          success: false,
          error:
            "Order not found."
        });
      }

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

      /* ===================================================
         VERIFY FINISHED PAYMENT
         =================================================== */

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

          await updateOrder(
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

        order.status =
          "paid";

        order.paid_at =
          new Date().toISOString();

        if (
          !order.notification_sent
        ) {
          order.notification_sent =
            true;

          await updateOrder(
            order
          );

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

      await updateOrder(
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
   ========================================================= */

app.post(
  "/api/payment/initialize",
  paymentLimiter,
  async (
    req,
    res
  ) => {
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
        await getOrderByReference(
          orderId
        );

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
          callbackUrl ||
          undefined,

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
          payment?.data
            ?.authorization_url ||
          null,

        access_code:
          payment?.data
            ?.access_code ||
          null,

        reference:
          payment?.data
            ?.reference ||
          order.reference
      });
    } catch (error) {
      console.error(
        "Paystack initialization failed:",
        error.response?.data ||
          error.message
      );

      return res
        .status(
          error.response?.status ||
            500
        )
        .json({
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
  statusLimiter,
  async (
    req,
    res
  ) => {
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
        await getOrderByReference(
          reference
        );

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

        if (
          !order.notification_sent
        ) {
          order.notification_sent =
            true;

          await updateOrder(
            order
          );

          await sendPaidOrderNotification(
            order
          );
        } else {
          await updateOrder(
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

      return res
        .status(
          error.response?.status ||
            500
        )
        .json({
          success: false,
          error:
            "Unable to verify payment."
        });
    }
  }
);

/* =========================================================
   404
   ========================================================= */

app.use(
  (
    req,
    res
  ) => {
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
  (
    error,
    req,
    res,
    next
  ) => {
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

async function startServer() {
  try {
    await initializeDatabase();

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
          "PostgreSQL: CONNECTED"
        );

        console.log(
          "Database persistence: ENABLED"
        );

        console.log(
          "======================================"
        );
      }
    );
  } catch (error) {
    console.error(
      "Database startup failed:",
      error.message
    );

    await pool.end();

    process.exit(1);
  }
}

startServer();

/* =========================================================
   GRACEFUL SHUTDOWN
   ========================================================= */

const shutdown = async (
  signal
) => {
  console.log(
    `${signal} received. Shutting down AUCTION X API...`
  );

  await pool.end();

  process.exit(0);
};

process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);

process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);