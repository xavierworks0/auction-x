document.addEventListener("DOMContentLoaded", () => {
  /* =========================================
     ELEMENTS
  ========================================= */

  const searchInput = document.querySelector("#searchInput");
  const searchButton = document.querySelector("#searchButton");

  const categoryFilter = document.querySelector("#categoryFilter");
  const brandFilter = document.querySelector("#brandFilter");
  const typeFilter = document.querySelector("#typeFilter");
  const sortFilter = document.querySelector("#sortFilter");

  const brandPills = document.querySelectorAll(".brand-pill");
  const categoryCards = document.querySelectorAll("[data-category]");
  const productCards = document.querySelectorAll(".product-card");

  const productCount = document.querySelector("#productCount");
  const clearFilters = document.querySelector("#clearFilters");

  /* =========================================
     MARKETPLACE SETTINGS
  ========================================= */

  const MARKET_CURRENCY = "USD";
  const MARKET_LOCALE = "en-US";

  const usdFormatter = new Intl.NumberFormat(MARKET_LOCALE, {
    style: "currency",
    currency: MARKET_CURRENCY,
    maximumFractionDigits: 0,
  });

  function formatMoney(amount) {
    return usdFormatter.format(Number(amount) || 0);
  }

  /* =========================================
     PRODUCT DATA
  ========================================= */

  const productDetails = {
    "iPhone 17 Pro": {
      image: "assets/images/iphone-17-pro.jpg",
      category: "GADGETS",
      title: "iPhone 17 Pro",
      description:
        "Premium Apple smartphone listed in the AUCTION X global marketplace.",
      currentPrice: 1200,
      condition: "Like New",
      location: "United States",
      ends: "02h 18m",
      specs: ["Apple", "256GB", "Pro"],
    },

    "iPhone 17 Pro Max": {
      image: "assets/images/iphone-17-pro-max.jpg",
      category: "GADGETS",
      title: "iPhone 17 Pro Max",
      description:
        "Flagship Apple smartphone with a premium large-format design.",
      currentPrice: 1350,
      condition: "Like New",
      location: "United States",
      ends: "03h 42m",
      specs: ["Apple", "512GB", "Pro Max"],
    },

    "iPhone 16 Pro": {
      image: "assets/images/iphone-16-pro.jpg",
      category: "GADGETS",
      title: "iPhone 16 Pro",
      description:
        "Professional-grade Apple smartphone listed in the global marketplace.",
      currentPrice: 950,
      condition: "Excellent",
      location: "United States",
      ends: "01h 36m",
      specs: ["Apple", "256GB", "Pro"],
    },

    "iPhone 16 Pro Max": {
      image: "assets/images/iphone-16-pro-max.jpg",
      category: "GADGETS",
      title: "iPhone 16 Pro Max",
      description:
        "Large-format Apple flagship with a premium finish.",
      currentPrice: 1050,
      condition: "Excellent",
      location: "United States",
      ends: "04h 12m",
      specs: ["Apple", "256GB", "Pro Max"],
    },

    "iPhone 16": {
      image: "assets/images/iphone-16.jpg",
      category: "GADGETS",
      title: "iPhone 16",
      description:
        "Modern Apple smartphone with a clean, premium profile.",
      currentPrice: 800,
      condition: "Excellent",
      location: "United States",
      ends: "05h 20m",
      specs: ["Apple", "128GB", "iPhone"],
    },

    "iPhone 15 Pro": {
      image: "assets/images/iphone-15-pro.jpg",
      category: "GADGETS",
      title: "iPhone 15 Pro",
      description:
        "Previous-generation Apple Pro model listed in the global marketplace.",
      currentPrice: 650,
      condition: "Very Good",
      location: "United States",
      ends: "06h 15m",
      specs: ["Apple", "256GB", "Pro"],
    },

    "iPhone 14 Pro": {
      image: "assets/images/iphone-14-pro.jpg",
      category: "GADGETS",
      title: "iPhone 14 Pro",
      description:
        "Apple Pro smartphone with a premium marketplace presentation.",
      currentPrice: 520,
      condition: "Very Good",
      location: "United States",
      ends: "07h 08m",
      specs: ["Apple", "256GB", "Pro"],
    },

    "Galaxy S26 Ultra": {
      image: "assets/images/galaxy-s26-ultra.jpg",
      category: "GADGETS",
      title: "Galaxy S26 Ultra",
      description:
        "Samsung flagship smartphone presented as an AUCTION X marketplace listing.",
      currentPrice: 1100,
      condition: "Like New",
      location: "United States",
      ends: "02h 55m",
      specs: ["Samsung", "256GB", "Ultra"],
    },

    "Galaxy Z Fold": {
      image: "assets/images/galaxy-z-fold.jpg",
      category: "GADGETS",
      title: "Galaxy Z Fold",
      description:
        "Foldable Samsung smartphone with an expansive display experience.",
      currentPrice: 1250,
      condition: "Like New",
      location: "United States",
      ends: "03h 25m",
      specs: ["Samsung", "512GB", "Foldable"],
    },

    "MacBook Air": {
      image: "assets/images/macbook-air.jpg",
      category: "GADGETS",
      title: "MacBook Air",
      description:
        "Slim Apple laptop designed for everyday productivity and creative work.",
      currentPrice: 850,
      condition: "Excellent",
      location: "United States",
      ends: "08h 10m",
      specs: ["Apple", "MacBook", "Laptop"],
    },

    "Rolex Watch": {
      image: "assets/images/rolex-watch.jpg",
      category: "LUXURY",
      title: "Rolex Watch",
      description:
        "Luxury timepiece presented as a marketplace-listed asset.",
      currentPrice: 3200,
      condition: "Excellent",
      location: "United States",
      ends: "09h 30m",
      specs: ["Rolex", "Watch", "Luxury"],
    },

    "Cartier Watch": {
      image: "assets/images/cartier-watch.jpg",
      category: "LUXURY",
      title: "Cartier Watch",
      description:
        "Premium Cartier timepiece presented in the AUCTION X luxury catalog.",
      currentPrice: 2800,
      condition: "Excellent",
      location: "United States",
      ends: "10h 05m",
      specs: ["Cartier", "Watch", "Luxury"],
    },
  };

  /* =========================================
     FILTER STATE
  ========================================= */

  const activeFilters = {
    search: "",
    category: "all",
    brand: "all",
    type: "all",
    sort: "featured",
  };

  /* =========================================
     WATCHLIST
  ========================================= */

  const WATCHLIST_KEY = "auctionXWatchlist";

  function getWatchlist() {
    try {
      const saved = localStorage.getItem(WATCHLIST_KEY);

      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  function saveWatchlist(list) {
    try {
      localStorage.setItem(
        WATCHLIST_KEY,
        JSON.stringify(list)
      );
    } catch {
      // Ignore storage errors.
    }
  }

  /* =========================================
     FILTER HELPERS
  ========================================= */

  function updateBrandPills() {
    brandPills.forEach((pill) => {
      const pillBrand = pill.dataset.brand;

      pill.classList.toggle(
        "active",
        pillBrand === activeFilters.brand
      );
    });
  }

  function cardMatchesFilters(card) {
    const name =
      (card.dataset.name || "").toLowerCase();

    const category =
      (card.dataset.category || "").toLowerCase();

    const brand =
      (card.dataset.brand || "").toLowerCase();

    const type =
      (card.dataset.type || "").toLowerCase();

    const search =
      activeFilters.search.toLowerCase().trim();

    if (
      search &&
      !name.includes(search) &&
      !category.includes(search) &&
      !brand.includes(search) &&
      !type.includes(search)
    ) {
      return false;
    }

    if (
      activeFilters.category !== "all" &&
      category !== activeFilters.category
    ) {
      return false;
    }

    if (
      activeFilters.brand !== "all" &&
      brand !== activeFilters.brand
    ) {
      return false;
    }

    if (
      activeFilters.type !== "all" &&
      type !== activeFilters.type
    ) {
      return false;
    }

    return true;
  }

  function applySort(cards) {
    const sorted = [...cards];

    if (activeFilters.sort === "low") {
      sorted.sort(
        (a, b) =>
          Number(a.dataset.price || 0) -
          Number(b.dataset.price || 0)
      );
    }

    if (activeFilters.sort === "high") {
      sorted.sort(
        (a, b) =>
          Number(b.dataset.price || 0) -
          Number(a.dataset.price || 0)
      );
    }

    if (activeFilters.sort === "newest") {
      sorted.sort(
        (a, b) =>
          Number(b.dataset.index || 0) -
          Number(a.dataset.index || 0)
      );
    }

    return sorted;
  }

  function applyFilters() {
    const visibleCards = [];

    productCards.forEach((card) => {
      const matches = cardMatchesFilters(card);

      card.style.display = matches ? "" : "none";

      if (matches) {
        visibleCards.push(card);
      }
    });

    const sortedCards = applySort(visibleCards);

    const grid = document.querySelector(".product-grid");

    if (grid) {
      sortedCards.forEach((card) => {
        grid.appendChild(card);
      });
    }

    if (productCount) {
      productCount.textContent =
        `${visibleCards.length} ${
          visibleCards.length === 1
            ? "listing"
            : "listings"
        }`;
    }
  }

  /* =========================================
     SEARCH
  ========================================= */

  function runMarketplaceSearch() {
    activeFilters.search =
      searchInput?.value || "";

    applyFilters();
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      activeFilters.search =
        searchInput.value;

      applyFilters();
    });
  }

  if (searchButton) {
    searchButton.addEventListener(
      "click",
      runMarketplaceSearch
    );
  }

  /* =========================================
     CATEGORY FILTER
  ========================================= */

  if (categoryFilter) {
    categoryFilter.addEventListener("change", () => {
      activeFilters.category =
        categoryFilter.value;

      applyFilters();
    });
  }

  /* =========================================
     BRAND FILTER
  ========================================= */

  if (brandFilter) {
    brandFilter.addEventListener("change", () => {
      activeFilters.brand =
        brandFilter.value;

      updateBrandPills();
      applyFilters();
    });
  }

  /* =========================================
     TYPE FILTER
  ========================================= */

  if (typeFilter) {
    typeFilter.addEventListener("change", () => {
      activeFilters.type =
        typeFilter.value;

      applyFilters();
    });
  }

  /* =========================================
     SORT
  ========================================= */

  if (sortFilter) {
    sortFilter.addEventListener("change", () => {
      activeFilters.sort =
        sortFilter.value;

      applyFilters();
    });
  }

  /* =========================================
     BRAND PILLS
  ========================================= */

  brandPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      const brand =
        pill.dataset.brand || "all";

      activeFilters.brand = brand;

      if (brandFilter) {
        brandFilter.value = brand;
      }

      updateBrandPills();
      applyFilters();
    });
  });

  /* =========================================
     CATEGORY CARDS
  ========================================= */

  categoryCards.forEach((card) => {
    card.addEventListener("click", () => {
      const category =
        card.dataset.category;

      if (!category || !categoryFilter) {
        return;
      }

      categoryFilter.value = category;
      activeFilters.category = category;

      applyFilters();

      document
        .querySelector("#auctions")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    });
  });

  /* =========================================
     RESET FILTERS
  ========================================= */

  function resetFilters() {
    activeFilters.search = "";
    activeFilters.category = "all";
    activeFilters.brand = "all";
    activeFilters.type = "all";
    activeFilters.sort = "featured";

    if (searchInput) {
      searchInput.value = "";
    }

    if (categoryFilter) {
      categoryFilter.value = "all";
    }

    if (brandFilter) {
      brandFilter.value = "all";
    }

    if (typeFilter) {
      typeFilter.value = "all";
    }

    if (sortFilter) {
      sortFilter.value = "featured";
    }

    updateBrandPills();
    applyFilters();
  }

  if (clearFilters) {
    clearFilters.addEventListener(
      "click",
      resetFilters
    );
  }

  /* =========================================
     LISTING PAGE NAVIGATION
  ========================================= */

  document
    .querySelectorAll(".view-lot")
    .forEach((button) => {
      button.addEventListener(
        "click",
        (event) => {
          event.preventDefault();

          const card =
            button.closest(".product-card");

          if (!card) return;

          const productName =
            card.dataset.name;

          if (!productName) return;

          window.location.href =
            `listing.html?item=${encodeURIComponent(
              productName
            )}`;
        }
      );
    });

  /* =========================================
     NAVIGATION
  ========================================= */

  document
    .querySelectorAll('a[href^="#"]')
    .forEach((link) => {
      link.addEventListener(
        "click",
        (event) => {
          const targetId =
            link.getAttribute("href");

          if (
            !targetId ||
            targetId === "#"
          ) {
            return;
          }

          const target =
            document.querySelector(targetId);

          if (!target) return;

          event.preventDefault();

          target.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      );
    });

  /* =========================================
     GLOBAL SEARCH
  ========================================= */

  const searchDialog =
    document.querySelector("#searchDialog");

  const openSearch =
    document.querySelector("#openSearch");

  const closeSearch =
    document.querySelector("#closeSearch");

  const globalSearchInput =
    document.querySelector(
      "#globalSearchInput"
    );

  const globalSearchResults =
    document.querySelector(
      "#globalSearchResults"
    );

  const globalSearchCount =
    document.querySelector(
      "#globalSearchCount"
    );

  const globalSearchForm =
    document.querySelector(
      "#globalSearchForm"
    );

  const searchProducts =
    Object.values(productDetails).map(
      (product) => ({
        name: product.title,
        brand: product.specs[0],
        category: product.category,
        image: product.image,
        price: product.currentPrice,
      })
    );

  function renderGlobalSearch(
    query = ""
  ) {
    if (
      !globalSearchResults ||
      !globalSearchCount
    ) {
      return;
    }

    const term =
      query.trim().toLowerCase();

    const results =
      searchProducts.filter(
        (product) => {
          if (!term) return true;

          return (
            product.name
              .toLowerCase()
              .includes(term) ||
            product.brand
              .toLowerCase()
              .includes(term) ||
            product.category
              .toLowerCase()
              .includes(term)
          );
        }
      );

    globalSearchCount.textContent =
      `${results.length} ${
        results.length === 1
          ? "item"
          : "items"
      }`;

    if (!results.length) {
      globalSearchResults.innerHTML = `
        <div class="search-empty">
          No listings found for "${query}".
        </div>
      `;

      return;
    }

    globalSearchResults.innerHTML =
      results
        .map(
          (product) => `
            <a
              href="listing.html?item=${encodeURIComponent(
                product.name
              )}"
              class="global-search-result"
            >

              <img
                src="${product.image}"
                alt="${product.name}"
                width="54"
                height="54"
                loading="lazy"
                decoding="async"
              />

              <div class="global-search-result-info">

                <div class="global-search-result-name">
                  ${product.name}
                </div>

                <div class="global-search-result-meta">
                  ${product.brand}
                  ·
                  ${product.category}
                </div>

              </div>

              <div class="global-search-result-price">
                ${formatMoney(product.price)}
              </div>

            </a>
          `
        )
        .join("");
  }

  if (
    openSearch &&
    searchDialog
  ) {
    openSearch.addEventListener(
      "click",
      () => {
        searchDialog.showModal();

        requestAnimationFrame(() => {
          globalSearchInput?.focus();
        });

        renderGlobalSearch("");
      }
    );
  }

  if (
    closeSearch &&
    searchDialog
  ) {
    closeSearch.addEventListener(
      "click",
      () => {
        searchDialog.close();
      }
    );
  }

  if (globalSearchInput) {
    globalSearchInput.addEventListener(
      "input",
      () => {
        renderGlobalSearch(
          globalSearchInput.value
        );
      }
    );
  }

  if (globalSearchForm) {
    globalSearchForm.addEventListener(
      "submit",
      (event) => {
        event.preventDefault();
      }
    );
  }

  document
    .querySelectorAll("[data-search]")
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          const value =
            button.dataset.search || "";

          if (globalSearchInput) {
            globalSearchInput.value =
              value;

            renderGlobalSearch(value);

            globalSearchInput.focus();
          }
        }
      );
    });

  /* =========================================
     INITIALIZE
  ========================================= */

  productCards.forEach(
    (card, index) => {
      card.dataset.index = index;
    }
  );

  updateBrandPills();
  applyFilters();
});