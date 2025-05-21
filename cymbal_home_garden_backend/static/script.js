document.addEventListener('DOMContentLoaded', () => {
    const productListing = document.getElementById('product-listing');
    const nightModeToggle = document.getElementById('night-mode-toggle');
    const recommendedProductsGrid = document.getElementById('recommended-products-grid');
    const currentCustomerIdSpan = document.getElementById('current-customer-id'); // For displaying customer ID

    // Cart DOM Elements
    const cartModal = document.getElementById('cart-modal');
    const cartToggleBtn = document.getElementById('cart-toggle');
    const closeCartBtn = cartModal.querySelector('.close-button');
    const cartItemsContainer = document.getElementById('cart-items-container');
    const cartSubtotalEl = document.getElementById('cart-subtotal');
    const cartCountEl = document.getElementById('cart-count');
    const clearCartBtn = document.getElementById('clear-cart-btn');
    const cartCheckoutBtn = document.getElementById('checkout-btn');

    // Checkout Modal DOM Elements
    const checkoutModal = document.getElementById('checkout-modal'); // This seems to be the old one, Phase 1 uses checkout-modal-ph1
    const closeCheckoutModalBtn = document.getElementById('close-checkout-btn'); // Old one
    const shippingForm = document.getElementById('shipping-form'); // Old one
    const orderReviewSection = document.getElementById('order-review-section'); // Old one
    const confirmPlaceOrderBtn = document.getElementById('confirm-place-order-btn'); // Old one
    const backToShippingBtn = document.getElementById('back-to-shipping-btn'); // Old one
    
    const stepShippingEl = document.getElementById('step-shipping'); // Old one
    const stepPaymentEl = document.getElementById('step-payment'); // Old one
    const stepReviewEl = document.getElementById('step-review'); // Old one

    const reviewFullNameEl = document.getElementById('review-fullName'); // Old one
    const reviewAddressEl = document.getElementById('review-address'); // Old one
    const reviewCityPostalEl = document.getElementById('review-city-postal'); // Old one
    const reviewCountryEl = document.getElementById('review-country'); // Old one
    const reviewCartItemsEl = document.getElementById('review-cart-items'); // Old one
    const reviewSubtotalEl = document.getElementById('review-subtotal'); // Old one
    const reviewTotalEl = document.getElementById('review-total'); // Old one

    const DEFAULT_CUSTOMER_ID = "123";
    if(currentCustomerIdSpan) currentCustomerIdSpan.textContent = DEFAULT_CUSTOMER_ID; // Display it

    let localProductCache = {};
    let currentCartItemsData = []; // This holds the live cart data
    let currentCartItemIds = []; // Helper for recommendations

    // State for the multi-step checkout process
    let checkoutProcessState = {
        currentStep: null, // 'items', 'shipping', 'payment'
        selectedItems: [], // items from cart *selected* for checkout (for this phase, it's all cart items)
        shippingInfo: {
            method: null, // 'home' or 'pickup'
            address: { // if home delivery
                name: '',
                street: '',
                city: '',
                postalCode: '',
                country: ''
            },
            pickupLocation: null // if pick-up, e.g., "Downtown Store - 123 Main St, Anytown"
        },
        paymentInfo: {
            method: null, // 'savedCard' or 'newCard'
            savedCardId: null, // e.g., "visa-1234"
            newCardDetails: {
                cardNumber: '',
                expiryDate: '',
                cvv: '',
                cardholderName: ''
            }
        }
    };
    console.log("[Checkout] Initial checkoutProcessState:", JSON.parse(JSON.stringify(checkoutProcessState)));

    // --- Night Mode ---
    const THEME_STORAGE_KEY = 'websiteTheme';

    function applyTheme(theme) {
        console.log(`Applying theme: ${theme}`);
        if (theme === 'night') {
            document.body.classList.add('night-mode');
            if(nightModeToggle) nightModeToggle.textContent = 'Light Mode';
        } else {
            document.body.classList.remove('night-mode');
            if(nightModeToggle) nightModeToggle.textContent = 'Night Mode';
        }
        try {
            localStorage.setItem(THEME_STORAGE_KEY, theme);
            console.log(`Theme preference '${theme}' saved to localStorage.`);
        } catch (error) {
            console.error("Error saving theme to localStorage:", error);
        }
    }

    // On page load, apply saved theme
    try {
        const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        if (savedTheme) {
            console.log(`Found saved theme '${savedTheme}' in localStorage.`);
            applyTheme(savedTheme);
        } else {
            console.log("No saved theme found in localStorage. Defaulting to day mode.");
            applyTheme('day'); // Default to day mode if nothing is saved
        }
    } catch (error) {
        console.error("Error loading theme from localStorage:", error);
        applyTheme('day'); // Default to day mode on error
    }

    if(nightModeToggle) {
        nightModeToggle.addEventListener('click', () => {
            const isNightMode = document.body.classList.contains('night-mode');
            if (isNightMode) {
                applyTheme('day');
            } else {
                applyTheme('night');
            }
        });
    }

    // --- Cart Modal ---
    function openCartModal() { if(cartModal) cartModal.classList.add('show'); }
    function closeCartModal() { if(cartModal) cartModal.classList.remove('show'); }
    if(cartToggleBtn) cartToggleBtn.addEventListener('click', openCartModal);
    if(closeCartBtn) closeCartBtn.addEventListener('click', closeCartModal);
    window.addEventListener('click', (event) => {
        if (event.target === cartModal) closeCartModal();
    });

    // --- OLD Checkout Modal (To be removed or refactored if still used elsewhere) ---
    // The functions openCheckoutModal, closeCheckoutModal, updateCheckoutStepIndicator,
    // showShippingForm, showOrderReview, populateOrderReview and their event listeners
    // (lines ~99-211 in original file before Phase 1 changes) seem to belong to an older checkout system.
    // Phase 1 introduced 'checkout-modal-ph1' and its related logic.
    // For clarity, I'm keeping them for now but they are superseded by the Ph1/Ph2 logic below.
    // If they are truly unused, they should be cleaned up in a future refactor.
    function openCheckoutModal_OLD() { // Renamed to avoid conflict
        closeCartModal(); 
        showShippingForm_OLD(); 
        if(checkoutModal) checkoutModal.classList.add('show');
    }
    function closeCheckoutModal_OLD() { // Renamed
        if(checkoutModal) checkoutModal.classList.remove('show');
    }
    // if(cartCheckoutBtn) cartCheckoutBtn.addEventListener('click', openCheckoutModal_OLD); // This button now triggers new checkout
    if(closeCheckoutModalBtn) closeCheckoutModalBtn.addEventListener('click', closeCheckoutModal_OLD);
    window.addEventListener('click', (event) => {
        if (event.target === checkoutModal) closeCheckoutModal_OLD();
    });
    
    function updateCheckoutStepIndicator_OLD(activeStep) { // Renamed
        [stepShippingEl, stepPaymentEl, stepReviewEl].forEach(step => {
            if(step) step.classList.remove('active');
        });
        if(activeStep === 'shipping' && stepShippingEl) stepShippingEl.classList.add('active');
        if(activeStep === 'payment' && stepPaymentEl) stepPaymentEl.classList.add('active');
        if(activeStep === 'review' && stepReviewEl) stepReviewEl.classList.add('active');
    }

    function showShippingForm_OLD() { // Renamed
        if(shippingForm) shippingForm.style.display = 'block';
        if(orderReviewSection) orderReviewSection.style.display = 'none';
        updateCheckoutStepIndicator_OLD('shipping');
    }

    function showOrderReview_OLD() { // Renamed
        if(shippingForm) shippingForm.style.display = 'none';
        if(orderReviewSection) orderReviewSection.style.display = 'block';
        updateCheckoutStepIndicator_OLD('review');
        populateOrderReview_OLD();
    }

    if(shippingForm) {
        shippingForm.addEventListener('submit', (event) => {
            event.preventDefault();
            let isValid = true;
            const requiredFields = ['fullName', 'address', 'city', 'postalCode', 'country'];
            requiredFields.forEach(fieldId => {
                const input = shippingForm.querySelector(`#${fieldId}`);
                if (input && !input.value.trim()) {
                    alert(`Please fill out the ${input.previousElementSibling?.textContent?.replace(':','') || fieldId} field.`);
                    if(input) input.focus();
                    isValid = false;
                }
            });
            if (isValid) {
                showOrderReview_OLD();
            }
        });
    }
    if(backToShippingBtn) {
        backToShippingBtn.addEventListener('click', showShippingForm_OLD);
    }

    function populateOrderReview_OLD() { // Renamed
        if(reviewFullNameEl && shippingForm.fullName) reviewFullNameEl.textContent = shippingForm.fullName.value;
        if(reviewAddressEl && shippingForm.address) reviewAddressEl.textContent = shippingForm.address.value;
        if(reviewCityPostalEl && shippingForm.city && shippingForm.postalCode) reviewCityPostalEl.textContent = `${shippingForm.city.value}, ${shippingForm.postalCode.value}`;
        if(reviewCountryEl && shippingForm.country) reviewCountryEl.textContent = shippingForm.country.value;

        if(reviewCartItemsEl) {
            if (currentCartItemsData.length === 0) {
                reviewCartItemsEl.innerHTML = '<h4>Items:</h4><p>Your cart is empty.</p>';
            } else {
                let itemsHTML = '<h4>Items:</h4>';
                currentCartItemsData.forEach(item => {
                    itemsHTML += '<div class="review-item">' +
                        '<span class="name">' + (item.name || item.product_id) + ' (ID: ' + item.product_id + ', Qty: ' + item.quantity + ')</span>' +
                        '<span class="price">$' + ((item.price_per_unit || 0) * item.quantity).toFixed(2) + '</span>' +
                    '</div>';
                });
                reviewCartItemsEl.innerHTML = itemsHTML;
            }
        }
        const subtotal = currentCartItemsData.reduce((sum, item) => sum + ((item.price_per_unit || 0) * item.quantity), 0);
        if(reviewSubtotalEl) reviewSubtotalEl.textContent = subtotal.toFixed(2);
        if(reviewTotalEl) reviewTotalEl.textContent = subtotal.toFixed(2); // Assuming total is same as subtotal for now
    }
    
    if(confirmPlaceOrderBtn) {
        confirmPlaceOrderBtn.addEventListener('click', async () => {
            const shippingDetails = {
                fullName: shippingForm.fullName.value,
                address: shippingForm.address.value,
                city: shippingForm.city.value,
                postalCode: shippingForm.postalCode.value,
                country: shippingForm.country.value,
                paymentMethod: shippingForm.paymentMethod ? shippingForm.paymentMethod.value : "N/A" // Handle if not present
            };
            const orderData = {
                customer_id: DEFAULT_CUSTOMER_ID,
                items: currentCartItemsData,
                shipping_details: shippingDetails,
                total_amount: parseFloat(reviewTotalEl.textContent)
            };
            try {
                const result = await fetchAPI(`/api/checkout/place_order`, { 
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(orderData)
                });
                alert(result.message || `Order placed successfully! Order ID: ${result.order_id || 'SIMULATED'}`);
                await clearCart();
                closeCheckoutModal_OLD();
            } catch (error) {
                alert("There was an issue placing your order. Please try again.");
            }
        });
    }
    // --- End of OLD Checkout Modal Logic ---


    // --- API Helper ---
    async function fetchAPI(url, options = {}) {
        console.log(`AGENT ACTION: Calling ${options.method || 'GET'} ${url}`);
        if (options.body) {
            let payloadToLog = options.body;
            if (typeof options.body === 'string') {
                try {
                    payloadToLog = JSON.parse(options.body);
                } catch (e) {
                    console.warn("Could not parse options.body for logging, logging as string.");
                }
            }
            console.log("AGENT PAYLOAD:", payloadToLog);
        }
        try {
            const response = await fetch(url, options);
            const responseData = await response.json().catch(() => ({})); 
            console.log(`AGENT RESPONSE: Status ${response.status} from ${url}`, responseData);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}, message: ${responseData.message || response.statusText || 'Unknown error'}`);
            }
            return responseData;
        } catch (error) {
            console.error('API Error Details:', error);
            alert(`Error: ${error.message}`);
            throw error;
        }
    }

    // --- Cart Logic (Backend Integrated) ---
    async function fetchCart() {
        console.log("[Main Page DEBUG] fetchCart() called.");
        try {
            const data = await fetchAPI(`/api/cart/${DEFAULT_CUSTOMER_ID}`);
            console.log("[Main Page DEBUG] fetchCart() - API response received:", data);
            currentCartItemsData = data.items || [];
            currentCartItemIds = currentCartItemsData.map(item => item.product_id);
            console.log("[Main Page DEBUG] fetchCart() - Calling renderCartItems with:", currentCartItemsData);
            renderCartItems(currentCartItemsData);
            console.log("[Main Page DEBUG] fetchCart() - Calling calculateSubtotal.");
            calculateSubtotal(currentCartItemsData);
            updateCartCount(currentCartItemsData);
            console.log("[Main Page DEBUG] fetchCart() - Calling displayRecommendedProducts.");
            displayRecommendedProducts();
            console.log("[Main Page DEBUG] fetchCart() finished successfully.");
        } catch (error) {
            if(cartItemsContainer) cartItemsContainer.innerHTML = '<p>Error loading cart. Please try again.</p>';
        }
    }

    async function addToCart(productId) {
        const payload = {
            product_id: productId,
            quantity: 1 
        };
        try {
            await fetchAPI(`/api/cart/${DEFAULT_CUSTOMER_ID}/item`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            await fetchCart(); 
            openCartModal();
        } catch (error) { /* Handled by fetchAPI */ }
    }

    function renderCartItems(items) {
        console.log("[Main Page DEBUG] renderCartItems() called with items:", items);
        if (!cartItemsContainer) {
            console.error("[Main Page DEBUG] renderCartItems() - cartItemsContainer is null!");
            return;
        }
        if (!items || items.length === 0) {
            cartItemsContainer.innerHTML = '<p>Your cart is empty.</p>';
        } else {
            cartItemsContainer.innerHTML = '';
            items.forEach(item => {
                const itemEl = document.createElement('div');
                itemEl.classList.add('cart-item');
                itemEl.innerHTML =
                    '<div class="cart-item-details">' +
                        '<h4>' + (item.name || item.product_id) + '</h4>' +
                        '<p class="product-id-display">ID: ' + item.product_id + '</p>' + 
                        '<p>Price: $' + (item.price_per_unit || 0).toFixed(2) + ' x ' + item.quantity + '</p>' +
                    '</div>' +
                    '<div class="cart-item-actions">' +
                        '<button class="remove-from-cart-btn" data-product-id="' + item.product_id + '">&times;</button>' +
                    '</div>';
                cartItemsContainer.appendChild(itemEl);
            });
            cartItemsContainer.querySelectorAll('.remove-from-cart-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    removeProductFromCart(e.target.dataset.productId);
                });
            });
        }
    }

    function updateCartCount(items) {
        if(!cartCountEl) return;
        const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
        cartCountEl.textContent = totalItems;
    }

    function calculateSubtotal(items) {
        if(!cartSubtotalEl) return;
        const subtotal = items.reduce((sum, item) => sum + ((item.price_per_unit || 0) * item.quantity), 0);
        cartSubtotalEl.textContent = subtotal.toFixed(2);
    }

    async function removeProductFromCart(productId) {
        try {
            await fetchAPI(`/api/cart/${DEFAULT_CUSTOMER_ID}/item/${productId}`, { method: 'DELETE' });
            await fetchCart();
        } catch (error) { /* Handled by fetchAPI */ }
    }

    async function clearCart() {
        console.log("[Checkout] clearCart called. Clearing cart via API and refreshing.");
        try {
            await fetchAPI(`/api/cart/${DEFAULT_CUSTOMER_ID}/clear`, { method: 'DELETE' });
            await fetchCart(); // This will re-render cart display, update count, etc.
            console.log("[Checkout] Cart cleared and UI refreshed.");
        } catch (error) { 
            console.error("[Checkout] Error during clearCart:", error);
            /* fetchAPI already alerts */ 
        }
    }
    if(clearCartBtn) clearCartBtn.addEventListener('click', clearCart);

    // --- Product Display & Recommendations ---
    async function fetchInitialProducts() {
        try {
            const products = await fetchAPI('/api/products');
            localProductCache = {};
            products.forEach(p => localProductCache[p.id] = { id: p.id, name: p.name, price: p.price, description: p.description, image_url: p.image_url });
            displayProducts(products);
        } catch (error) {
            if(productListing) productListing.innerHTML = '<p>Error loading products. Please try again later.</p>';
        }
    }

    function displayProducts(productsData) {
        if (!productListing) return;
        if (!productsData || productsData.length === 0) {
            productListing.innerHTML = '<p>No products found.</p>';
            return;
        }
        productListing.innerHTML = '';
        productsData.forEach(product => {
            renderProductCard(product, productListing);
        });
    }

    function displayRecommendedProducts() {
        if (!recommendedProductsGrid || !localProductCache) return;
        const allProducts = Object.values(localProductCache);
        if (allProducts.length === 0) {
            recommendedProductsGrid.innerHTML = '<p>No recommendations available yet.</p>';
            return;
        }
        let recommendations = allProducts.filter(p => !currentCartItemIds.includes(p.id)).slice(0, 4);
        if (recommendations.length < 4) {
            recommendations = recommendations.concat(allProducts.filter(p => !recommendations.find(r => r.id === p.id)).slice(0, 4 - recommendations.length));
        }
        recommendations = [...new Map(recommendations.map(item => [item['id'], item])).values()].slice(0,4);
        recommendedProductsGrid.innerHTML = '';
        if (recommendations.length === 0 && allProducts.length > 0) {
             recommendations = allProducts.slice(0,4);
        }
        if (recommendations.length > 0) {
            recommendations.forEach(product => {
                renderProductCard(product, recommendedProductsGrid, true);
            });
        } else {
            recommendedProductsGrid.innerHTML = '<p>Explore our products!</p>';
        }
    }

    function renderProductCard(product, container, isRecommended = false) {
        const card = document.createElement('article');
        card.classList.add('product-card');
        if (isRecommended) card.classList.add('recommended-item');
        card.dataset.productId = product.id;
        const name = product.name || 'Unnamed Product';
        const price = product.price !== null && product.price !== undefined ? parseFloat(product.price).toFixed(2) : 'N/A';
        const description = product.description || 'No description available.';
        const imageUrl = product.image_url ? `/${product.image_url}` : 'https://via.placeholder.com/150?text=No+Image';
        let descSnippet = description.substring(0, 100) + (description.length > 100 ? '...' : '');
        if (isRecommended) {
            descSnippet = description.substring(0, 50) + (description.length > 50 ? '...' : '');
        }
        card.innerHTML =
            '<img src="' + imageUrl + '" alt="' + name + '">' +
            '<h3>' + name + '</h3>' +
            '<p class="product-id-display">ID: ' + product.id + '</p>' + 
            '<p class="price">$' + price + '</p>' +
            '<p class="description">' + descSnippet + '</p>' +
            '<button class="add-to-cart-btn" data-product-id="' + product.id + '">Add to Cart</button>';
        container.appendChild(card);
        card.querySelector('.add-to-cart-btn').addEventListener('click', (event) => {
            const productId = event.target.dataset.productId;
            addToCart(productId);
        });
    }

    // Initial Load
    async function initialLoad() {
        await fetchInitialProducts();
        await fetchCart();
    }
    initialLoad();

    // --- Message Listener for Agent Widget ---
    window.addEventListener('message', (event) => {
        console.log("[Main Page] Message event received. Origin:", event.origin, "Data:", event.data);
        const expectedWidgetOrigin = 'http://localhost:5000'; // Or your actual widget origin
        if (event.origin !== expectedWidgetOrigin) {
            console.warn(`[Main Page] Message received from unexpected origin: ${event.origin}. Expected: ${expectedWidgetOrigin}. Ignoring message.`);
            return;
        }
        console.log("[Main Page] Message origin validated successfully:", event.origin);

        if (!event.data) {
            console.log("[Main Page] Message data is null or undefined. Ignoring.");
            return;
        }

        if (event.data.type === "SET_WEBSITE_THEME" && typeof event.data.payload === 'string') {
            const newTheme = event.data.payload;
            console.log(`[Main Page] Received SET_WEBSITE_THEME from widget with theme: ${newTheme}`);
            applyTheme(newTheme);
            console.log(`[Main Page] applyTheme('${newTheme}') called.`);
        } else if (event.data.type === "REFRESH_CART_DISPLAY") { 
            console.log("[Main Page] Received REFRESH_CART_DISPLAY from widget. Event data:", event.data);
            console.log("[Main Page] Calling fetchCart() to refresh cart display.");
            fetchCart();
            console.log("[Main Page] fetchCart() call completed after REFRESH_CART_DISPLAY message.");
        } else if (event.data.type === 'initiate_checkout') {
            console.log("[Main Page] Received 'initiate_checkout' from widget. Calling showCheckoutModalPh1().");
            showCheckoutModalPh1(); // This is the new multi-step checkout
        } else if (event.data.type === "ui_command" && event.data.command_name) {
            // Handle UI commands from the agent widget (relayed from streaming_server.py)
            console.log(`[Main Page] Received 'ui_command': ${event.data.command_name}`, "Payload:", event.data.payload);
            // TODO: Implement actual UI updates based on command_name and payload
            // For now, just logging.
            // Example:
            // if (event.data.command_name === "display_shipping_options_ui") {
            //     // Code to show shipping options modal
            // } else if (event.data.command_name === "highlight_shipping_option_ui") {
            //     // Code to highlight shipping option event.data.payload.option_name
            // } // etc.
        } else {
            console.log("[Main Page] Received message is not a SET_WEBSITE_THEME, REFRESH_CART_DISPLAY, INITIATE_CHECKOUT, or UI_COMMAND instruction or payload is invalid:", event.data);
        }
    });

    // --- Phase 1 & 2: Multi-Step Checkout Modal Logic ---
    const checkoutModalPh1 = document.getElementById('checkout-modal-ph1');
    const checkoutModalTitlePh1 = document.getElementById('checkout-modal-title-ph1');
    const checkoutModalBodyPh1 = document.getElementById('checkout-modal-body-ph1');
    const closeCheckoutModalBtnPh1 = document.getElementById('checkout-modal-close-ph1'); // Header 'X'
    const cancelCheckoutBtnPh1 = document.getElementById('checkout-cancel-btn-ph1'); // Footer "Cancel"
    const backCheckoutBtnPh1 = document.getElementById('checkout-back-btn-ph1');     // Footer "Back"
    const nextCheckoutBtnPh1 = document.getElementById('checkout-next-btn-ph1');     // Footer "Next"

    // The cartCheckoutBtn (main cart "Checkout" button) should trigger the new modal
    if(cartCheckoutBtn) {
        cartCheckoutBtn.removeEventListener('click', openCheckoutModal_OLD); // Remove old listener if any
        cartCheckoutBtn.addEventListener('click', () => {
            console.log("[Cart] Main checkout button clicked, initiating Phase 1 checkout flow.");
            showCheckoutModalPh1();
        });
    }


    function showCheckoutModalPh1() {
        console.log("[Checkout] showCheckoutModalPh1 called. Initializing for Step 1 (Item Selection).");
        if (checkoutModalPh1) {
            // Initialize/reset state for a new checkout flow
            checkoutProcessState.currentStep = 'items';
            checkoutProcessState.selectedItems = []; // Will be populated from currentCartItemsData in Step 1
            checkoutProcessState.shippingInfo = {
                method: null,
                address: { name: '', street: '', city: '', postalCode: '', country: '' },
                pickupLocation: null
            };
            // paymentInfo will be handled in Phase 3
            console.log("[Checkout] State initialized for new checkout flow:", JSON.parse(JSON.stringify(checkoutProcessState)));

            checkoutModalPh1.style.display = 'flex';
            renderCheckoutStep1ItemSelection(); 
        } else {
            console.error("[Checkout] Checkout modal element 'checkout-modal-ph1' not found.");
        }
    }

    function hideCheckoutModalPh1() {
        console.log("[Checkout] hideCheckoutModalPh1 called. Hiding modal and resetting state.");
        if (checkoutModalPh1) {
            checkoutModalPh1.style.display = 'none';
        }
        if (checkoutModalBodyPh1) {
            checkoutModalBodyPh1.innerHTML = ''; 
        }
        if(checkoutModalTitlePh1) {
            checkoutModalTitlePh1.textContent = 'Checkout'; 
        }
        checkoutProcessState = { // Full reset
            currentStep: null, selectedItems: [],
            shippingInfo: { method: null, address: { name: '', street: '', city: '', postalCode: '', country: '' }, pickupLocation: null }
        };
        console.log("[Checkout] State fully reset on modal hide:", JSON.parse(JSON.stringify(checkoutProcessState)));
        if(nextCheckoutBtnPh1) nextCheckoutBtnPh1.onclick = null;
        if(backCheckoutBtnPh1) { backCheckoutBtnPh1.onclick = null; backCheckoutBtnPh1.style.display = 'none'; }
        console.log("[Checkout] Footer button onClick handlers cleared.");
    }

    if (closeCheckoutModalBtnPh1) {
        closeCheckoutModalBtnPh1.addEventListener('click', hideCheckoutModalPh1);
    }
    // Cancel button is handled by each step's render function to ensure it's always hideCheckoutModalPh1

    async function renderCheckoutStep1ItemSelection() {
        console.log("[Checkout] Rendering Step 1: Item Selection.");
        checkoutProcessState.currentStep = 'items';
        console.log("[Checkout] Current state for Step 1:", JSON.parse(JSON.stringify(checkoutProcessState)));

        if (!checkoutModalBodyPh1) {
            console.error("[Checkout] Modal body 'checkout-modal-body-ph1' not found for rendering items.");
            return;
        }
        if (checkoutModalTitlePh1) {
            checkoutModalTitlePh1.textContent = 'Step 1: Review Your Items';
        }
        
        // Ensure currentCartItemsData is fresh for review, though it should be from fetchCart
        console.log("[Checkout] Using currentCartItemsData for Step 1:", JSON.parse(JSON.stringify(currentCartItemsData)));

        if (!currentCartItemsData || currentCartItemsData.length === 0) {
            checkoutModalBodyPh1.innerHTML = '<p>Your cart is empty. Please add items to your cart to proceed.</p>';
            if(nextCheckoutBtnPh1) nextCheckoutBtnPh1.disabled = true;
            console.warn("[Checkout] Cart is empty for Step 1. Next button disabled.");
        } else {
            let itemsHtml = '<h3>Review Your Items</h3>';
            itemsHtml += '<ul class="checkout-item-list">';
            currentCartItemsData.forEach(item => {
                itemsHtml += `
                    <li class="checkout-item" data-product-id="${item.product_id}">
                        <span class="item-name">${item.name || `Product ID: ${item.product_id}`}</span>
                        <span class="item-quantity">Qty: ${item.quantity}</span>
                        <span class="item-price">$${((item.price_per_unit || 0) * item.quantity).toFixed(2)}</span>
                    </li>
                `;
            });
            itemsHtml += '</ul>';
            const subtotal = currentCartItemsData.reduce((sum, item) => sum + ((item.price_per_unit || 0) * item.quantity), 0);
            itemsHtml += `<p class="checkout-subtotal">Subtotal: $${subtotal.toFixed(2)}</p>`;
            checkoutModalBodyPh1.innerHTML = itemsHtml;
            if(nextCheckoutBtnPh1) nextCheckoutBtnPh1.disabled = false;
            console.log("[Checkout] Item selection screen rendered with cart items.");
        }

        if (nextCheckoutBtnPh1) {
            nextCheckoutBtnPh1.textContent = 'Next: Shipping';
            nextCheckoutBtnPh1.onclick = () => {
                console.log("[Checkout] Next button clicked from Item Selection.");
                if (!currentCartItemsData || currentCartItemsData.length === 0) {
                    alert("Your cart is empty. Please add items before proceeding.");
                    console.warn("[Checkout] Attempted to proceed to shipping with an empty cart.");
                    return;
                }
                checkoutProcessState.selectedItems = JSON.parse(JSON.stringify(currentCartItemsData));
                console.log("[Checkout] Items stored in state:", JSON.parse(JSON.stringify(checkoutProcessState.selectedItems)));
                renderShippingStep();
            };
            console.log("[Checkout] Next button configured for Step 1.");
        }
        if (backCheckoutBtnPh1) {
            backCheckoutBtnPh1.style.display = 'none'; 
            backCheckoutBtnPh1.onclick = null; 
            console.log("[Checkout] Back button hidden and handler cleared for Step 1.");
        }
        if (cancelCheckoutBtnPh1) { 
            cancelCheckoutBtnPh1.onclick = hideCheckoutModalPh1;
            console.log("[Checkout] Cancel button configured for Step 1.");
        }
        console.log("[Checkout] Item selection (Step 1) rendering complete.");
    }

    function renderShippingStep() {
        console.log("[Checkout] Rendering Step 2: Shipping Information.");
        checkoutProcessState.currentStep = 'shipping';
        console.log("[Checkout] Current state for Step 2:", JSON.parse(JSON.stringify(checkoutProcessState)));

        if (!checkoutModalBodyPh1) {
            console.error("[Checkout] Modal body 'checkout-modal-body-ph1' not found for rendering shipping step.");
            return;
        }
        if (checkoutModalTitlePh1) {
            checkoutModalTitlePh1.textContent = 'Step 2: Shipping Options';
        }

        const shipInfo = checkoutProcessState.shippingInfo;
        const addr = shipInfo.address;

        let shippingHtml = `
            <h3>Shipping Method</h3>
            <div class="shipping-method-options">
                <label>
                    <input type="radio" name="shippingMethod" value="home" ${shipInfo.method === 'home' ? 'checked' : ''}>
                    Home Delivery
                </label>
                <label>
                    <input type="radio" name="shippingMethod" value="pickup" ${shipInfo.method === 'pickup' ? 'checked' : ''}>
                    Pick-up Location
                </label>
            </div>

            <div id="home-delivery-details" style="display: ${shipInfo.method === 'home' ? 'block' : 'none'}; margin-top: 15px;">
                <h4>Home Delivery Address</h4>
                <label for="shipping-name">Full Name:</label>
                <input type="text" id="shipping-name" name="shipping-name" value="${addr.name || ''}" required>
                <label for="shipping-street">Street Address:</label>
                <input type="text" id="shipping-street" name="shipping-street" value="${addr.street || ''}" required>
                <label for="shipping-city">City:</label>
                <input type="text" id="shipping-city" name="shipping-city" value="${addr.city || ''}" required>
                <label for="shipping-postalCode">Postal Code:</label>
                <input type="text" id="shipping-postalCode" name="shipping-postalCode" value="${addr.postalCode || ''}" required>
                <label for="shipping-country">Country:</label>
                <input type="text" id="shipping-country" name="shipping-country" value="${addr.country || ''}" required>
            </div>

            <div id="pickup-location-details" style="display: ${shipInfo.method === 'pickup' ? 'block' : 'none'}; margin-top: 15px;">
                <h4>Select Pick-up Location</h4>
                <label>
                    <input type="radio" name="pickupLocation" value="Downtown Store - 123 Main St, Anytown" ${shipInfo.pickupLocation === "Downtown Store - 123 Main St, Anytown" ? 'checked' : ''}>
                    Downtown Store - 123 Main St, Anytown
                </label>
                <br>
                <label>
                    <input type="radio" name="pickupLocation" value="Northside Hub - 456 Oak Ave, Anytown" ${shipInfo.pickupLocation === "Northside Hub - 456 Oak Ave, Anytown" ? 'checked' : ''}>
                    Northside Hub - 456 Oak Ave, Anytown
                </label>
                <br>
                <label>
                    <input type="radio" name="pickupLocation" value="West End Collection - 789 Pine Rd, Anytown" ${shipInfo.pickupLocation === "West End Collection - 789 Pine Rd, Anytown" ? 'checked' : ''}>
                    West End Collection - 789 Pine Rd, Anytown
                </label>
            </div>
        `;
        checkoutModalBodyPh1.innerHTML = shippingHtml;
        console.log("[Checkout] Shipping options screen HTML rendered.");

        const shippingMethodRadios = checkoutModalBodyPh1.querySelectorAll('input[name="shippingMethod"]');
        const homeDeliveryDetailsDiv = checkoutModalBodyPh1.querySelector('#home-delivery-details');
        const pickupLocationDetailsDiv = checkoutModalBodyPh1.querySelector('#pickup-location-details');

        shippingMethodRadios.forEach(radio => {
            radio.addEventListener('change', (event) => {
                const selectedMethod = event.target.value;
                console.log(`[Checkout] Shipping method selected: ${selectedMethod}`);
                checkoutProcessState.shippingInfo.method = selectedMethod;
                if (selectedMethod === 'home') {
                    if(homeDeliveryDetailsDiv) homeDeliveryDetailsDiv.style.display = 'block';
                    if(pickupLocationDetailsDiv) pickupLocationDetailsDiv.style.display = 'none';
                    checkoutProcessState.shippingInfo.pickupLocation = null; // Clear pickup if home is chosen
                } else if (selectedMethod === 'pickup') {
                    if(homeDeliveryDetailsDiv) homeDeliveryDetailsDiv.style.display = 'none';
                    if(pickupLocationDetailsDiv) pickupLocationDetailsDiv.style.display = 'block';
                    // Clear address fields in state if switching to pickup
                    checkoutProcessState.shippingInfo.address = { name: '', street: '', city: '', postalCode: '', country: '' };
                }
                console.log("[Checkout] Shipping info in state updated:", JSON.parse(JSON.stringify(checkoutProcessState.shippingInfo)));
            });
        });
        
        const addressFields = ['name', 'street', 'city', 'postalCode', 'country'];
        addressFields.forEach(fieldKey => {
            const inputElement = checkoutModalBodyPh1.querySelector(`#shipping-${fieldKey}`);
            if (inputElement) {
                inputElement.addEventListener('input', (event) => {
                    checkoutProcessState.shippingInfo.address[fieldKey] = event.target.value;
                    console.log(`[Checkout] Address field '${fieldKey}' updated in state to: ${event.target.value}`);
                });
            }
        });

        const pickupRadios = checkoutModalBodyPh1.querySelectorAll('input[name="pickupLocation"]');
        pickupRadios.forEach(radio => {
            radio.addEventListener('change', (event) => {
                checkoutProcessState.shippingInfo.pickupLocation = event.target.value;
                console.log(`[Checkout] Pickup location selected in state: ${event.target.value}`);
            });
        });

        if (nextCheckoutBtnPh1) {
            nextCheckoutBtnPh1.textContent = 'Next: Payment';
            nextCheckoutBtnPh1.disabled = false; 
            nextCheckoutBtnPh1.onclick = () => {
                console.log("[Checkout] Next button clicked from Shipping Information.");
                const currentMethod = checkoutProcessState.shippingInfo.method;
                if (!currentMethod) {
                    alert("Please select a shipping method.");
                    console.warn("[Checkout] Validation failed: No shipping method selected.");
                    return;
                }

                if (currentMethod === 'home') {
                    const { name, street, city, postalCode, country } = checkoutProcessState.shippingInfo.address;
                    if (!name.trim() || !street.trim() || !city.trim() || !postalCode.trim() || !country.trim()) {
                        alert("Please fill out all address fields for home delivery.");
                        console.warn("[Checkout] Validation failed: Home delivery address incomplete.");
                        const fieldsToFocus = ['name', 'street', 'city', 'postalCode', 'country'];
                        for (const field of fieldsToFocus) {
                            if (!checkoutProcessState.shippingInfo.address[field].trim()) {
                                checkoutModalBodyPh1.querySelector(`#shipping-${field}`)?.focus();
                                break;
                            }
                        }
                        return;
                    }
                    console.log("[Checkout] Home delivery address validated and stored:", JSON.parse(JSON.stringify(checkoutProcessState.shippingInfo.address)));
                } else if (currentMethod === 'pickup') {
                    if (!checkoutProcessState.shippingInfo.pickupLocation) {
                        alert("Please select a pick-up location.");
                        console.warn("[Checkout] Validation failed: No pick-up location selected.");
                        return;
                    }
                    console.log("[Checkout] Pick-up location validated and stored:", checkoutProcessState.shippingInfo.pickupLocation);
                }
                console.log("[Checkout] Shipping information saved. Proceeding to Payment (Placeholder).");
                renderPaymentStep(); 
            };
            console.log("[Checkout] Next button configured for Step 2.");
        }
        if (backCheckoutBtnPh1) {
            backCheckoutBtnPh1.style.display = 'inline-block'; 
            backCheckoutBtnPh1.textContent = 'Back: Items';
            backCheckoutBtnPh1.onclick = () => {
                console.log("[Checkout] Back button clicked from Shipping. Returning to Item Selection.");
                renderCheckoutStep1ItemSelection();
            };
            console.log("[Checkout] Back button configured for Step 2.");
        }
        if (cancelCheckoutBtnPh1) { 
            cancelCheckoutBtnPh1.onclick = hideCheckoutModalPh1;
            console.log("[Checkout] Cancel button configured for Step 2.");
        }
        console.log("[Checkout] Shipping (Step 2) rendering complete with event listeners.");
    }

    function renderPaymentStep() {
        console.log("[Checkout] Rendering Step 3: Payment Information.");
        checkoutProcessState.currentStep = 'payment';
        // Ensure paymentInfo is initialized if not already
        if (!checkoutProcessState.paymentInfo) {
            checkoutProcessState.paymentInfo = {
                method: null,
                savedCardId: null,
                newCardDetails: { cardNumber: '', expiryDate: '', cvv: '', cardholderName: '' }
            };
            console.log("[Checkout] Initialized paymentInfo in state for Step 3.");
        }
        console.log("[Checkout] Current state for Step 3:", JSON.parse(JSON.stringify(checkoutProcessState)));

        if (!checkoutModalBodyPh1) {
            console.error("[Checkout] Modal body 'checkout-modal-body-ph1' not found for rendering payment step.");
            return;
        }
        if (checkoutModalTitlePh1) {
            checkoutModalTitlePh1.textContent = 'Step 3: Payment Information';
        }

        const payInfo = checkoutProcessState.paymentInfo;
        const newCard = payInfo.newCardDetails;

        let paymentHtml = `
            <h3>Payment Method</h3>
            <div class="payment-method-options">
                <label>
                    <input type="radio" name="paymentMethod" value="savedCard" ${payInfo.method === 'savedCard' ? 'checked' : ''}>
                    Use Saved Payment Card
                </label>
                <label>
                    <input type="radio" name="paymentMethod" value="newCard" ${payInfo.method === 'newCard' ? 'checked' : ''}>
                    Add New Payment Card
                </label>
            </div>

            <div id="saved-card-details" style="display: ${payInfo.method === 'savedCard' ? 'block' : 'none'}; margin-top: 15px;">
                <h4>Select Saved Card (Mocked)</h4>
                <label>
                    <input type="radio" name="savedCardOption" value="visa-1234" ${payInfo.savedCardId === 'visa-1234' ? 'checked' : ''}>
                    Visa ending in 1234
                </label>
                <br>
                <label>
                    <input type="radio" name="savedCardOption" value="mastercard-5678" ${payInfo.savedCardId === 'mastercard-5678' ? 'checked' : ''}>
                    Mastercard ending in 5678
                </label>
            </div>

            <div id="new-card-details" style="display: ${payInfo.method === 'newCard' ? 'block' : 'none'}; margin-top: 15px;">
                <h4>Add New Card Details (UI Only)</h4>
                <label for="card-number">Card Number:</label>
                <input type="text" id="card-number" name="card-number" value="${newCard.cardNumber || ''}" placeholder="Enter card number">
                <label for="card-expiry">Expiry Date (MM/YY):</label>
                <input type="text" id="card-expiry" name="card-expiry" value="${newCard.expiryDate || ''}" placeholder="MM/YY">
                <label for="card-cvv">CVV:</label>
                <input type="text" id="card-cvv" name="card-cvv" value="${newCard.cvv || ''}" placeholder="CVV">
                <label for="cardholder-name">Cardholder Name:</label>
                <input type="text" id="cardholder-name" name="cardholder-name" value="${newCard.cardholderName || ''}" placeholder="Enter cardholder name">
            </div>
        `;
        checkoutModalBodyPh1.innerHTML = paymentHtml;
        console.log("[Checkout] Payment options screen HTML rendered.");

        const paymentMethodRadios = checkoutModalBodyPh1.querySelectorAll('input[name="paymentMethod"]');
        const savedCardDetailsDiv = checkoutModalBodyPh1.querySelector('#saved-card-details');
        const newCardDetailsDiv = checkoutModalBodyPh1.querySelector('#new-card-details');

        paymentMethodRadios.forEach(radio => {
            radio.addEventListener('change', (event) => {
                const selectedMethod = event.target.value;
                console.log(`[Checkout] Payment method selected: ${selectedMethod}`);
                checkoutProcessState.paymentInfo.method = selectedMethod;
                if (selectedMethod === 'savedCard') {
                    if(savedCardDetailsDiv) savedCardDetailsDiv.style.display = 'block';
                    if(newCardDetailsDiv) newCardDetailsDiv.style.display = 'none';
                    // Clear new card details if switching to saved card
                    checkoutProcessState.paymentInfo.newCardDetails = { cardNumber: '', expiryDate: '', cvv: '', cardholderName: '' };
                } else if (selectedMethod === 'newCard') {
                    if(savedCardDetailsDiv) savedCardDetailsDiv.style.display = 'none';
                    if(newCardDetailsDiv) newCardDetailsDiv.style.display = 'block';
                    checkoutProcessState.paymentInfo.savedCardId = null; // Clear saved card if switching to new
                }
                console.log("[Checkout] Payment info in state updated:", JSON.parse(JSON.stringify(checkoutProcessState.paymentInfo)));
            });
        });

        const savedCardRadios = checkoutModalBodyPh1.querySelectorAll('input[name="savedCardOption"]');
        savedCardRadios.forEach(radio => {
            radio.addEventListener('change', (event) => {
                checkoutProcessState.paymentInfo.savedCardId = event.target.value;
                console.log(`[Checkout] Saved card selected in state: ${event.target.value}`);
            });
        });

        const newCardFields = {
            cardNumber: checkoutModalBodyPh1.querySelector('#card-number'),
            expiryDate: checkoutModalBodyPh1.querySelector('#card-expiry'),
            cvv: checkoutModalBodyPh1.querySelector('#card-cvv'),
            cardholderName: checkoutModalBodyPh1.querySelector('#cardholder-name')
        };

        for (const key in newCardFields) {
            if (newCardFields[key]) {
                newCardFields[key].addEventListener('input', (event) => {
                    checkoutProcessState.paymentInfo.newCardDetails[key] = event.target.value;
                    console.log(`[Checkout] New card field '${key}' updated in state to: ${event.target.value}`);
                });
            }
        }

        if (nextCheckoutBtnPh1) {
            nextCheckoutBtnPh1.textContent = 'Next: Order Review';
            nextCheckoutBtnPh1.disabled = false;
            nextCheckoutBtnPh1.onclick = () => {
                console.log("[Checkout] 'Next: Order Review' button clicked from Payment.");
                const currentPaymentMethod = checkoutProcessState.paymentInfo.method;

                if (!currentPaymentMethod) {
                    alert("Please select a payment method.");
                    console.warn("[Checkout] Validation failed: No payment method selected.");
                    return;
                }

                if (currentPaymentMethod === 'savedCard') {
                    if (!checkoutProcessState.paymentInfo.savedCardId) {
                        alert("Please select a saved card.");
                        console.warn("[Checkout] Validation failed: No saved card selected.");
                        return;
                    }
                    console.log("[Checkout] Saved card payment validated:", checkoutProcessState.paymentInfo.savedCardId);
                } else if (currentPaymentMethod === 'newCard') {
                    const { cardNumber, expiryDate, cvv, cardholderName } = checkoutProcessState.paymentInfo.newCardDetails;
                    if (!cardNumber.trim() || !expiryDate.trim() || !cvv.trim() || !cardholderName.trim()) {
                        alert("Please fill out all new card details.");
                        console.warn("[Checkout] Validation failed: New card details incomplete.");
                        // Optionally focus the first empty field
                        if (!cardholderName.trim()) newCardFields.cardholderName?.focus();
                        if (!cvv.trim()) newCardFields.cvv?.focus();
                        if (!expiryDate.trim()) newCardFields.expiryDate?.focus();
                        if (!cardNumber.trim()) newCardFields.cardNumber?.focus();
                        return;
                    }
                    // Basic MM/YY format check for expiry (can be more robust)
                    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiryDate.trim())) {
                        alert("Please enter expiry date in MM/YY format.");
                        console.warn("[Checkout] Validation failed: Invalid expiry date format.");
                        newCardFields.expiryDate?.focus();
                        return;
                    }
                    console.log("[Checkout] New card payment details validated (basic check).");
                }
                
                console.log("[Checkout] Payment information saved. Proceeding to Order Review.");
                console.log("[Checkout] Current Payment Info:", JSON.parse(JSON.stringify(checkoutProcessState.paymentInfo)));
                renderOrderReviewStep(); // Call the new function for Phase 4
            };
            console.log("[Checkout] Next button configured for Step 3 (Payment) to proceed to Order Review.");
        }

        if (backCheckoutBtnPh1) {
            backCheckoutBtnPh1.style.display = 'inline-block';
            backCheckoutBtnPh1.textContent = 'Back: Shipping';
            backCheckoutBtnPh1.onclick = () => {
                console.log("[Checkout] Back button clicked from Payment. Returning to Shipping.");
                renderShippingStep();
            };
            console.log("[Checkout] Back button configured for Step 3 (Payment).");
        }

        if (cancelCheckoutBtnPh1) {
            cancelCheckoutBtnPh1.onclick = hideCheckoutModalPh1;
            console.log("[Checkout] Cancel button configured for Step 3 (Payment).");
        }
        console.log("[Checkout] Payment (Step 3) rendering complete with event listeners.");
    }

    function renderOrderReviewStep() {
        console.log("[Checkout] Rendering Step 4: Order Review & Submit.");
        checkoutProcessState.currentStep = 'review';
        console.log("[Checkout] Current state for Step 4:", JSON.parse(JSON.stringify(checkoutProcessState)));

        if (!checkoutModalBodyPh1) {
            console.error("[Checkout] Modal body 'checkout-modal-body-ph1' not found for rendering order review.");
            return;
        }
        if (checkoutModalTitlePh1) {
            checkoutModalTitlePh1.textContent = 'Step 4: Order Review & Submit';
        }

        const { selectedItems, shippingInfo, paymentInfo } = checkoutProcessState;

        let reviewHtml = '<h3>Order Summary</h3>';

        // Items
        reviewHtml += '<h4>Items:</h4><ul class="checkout-item-list">';
        let subtotal = 0;
        selectedItems.forEach(item => {
            const itemTotal = (item.price_per_unit || 0) * item.quantity;
            subtotal += itemTotal;
            reviewHtml += `
                <li class="checkout-item">
                    <span class="item-name">${item.name || `Product ID: ${item.product_id}`} (Qty: ${item.quantity})</span>
                    <span class="item-price">$${itemTotal.toFixed(2)}</span>
                </li>
            `;
        });
        reviewHtml += `</ul><p class="checkout-subtotal"><strong>Subtotal: $${subtotal.toFixed(2)}</strong></p>`;
        console.log("[Checkout][Review] Items rendered. Subtotal:", subtotal);

        // Shipping
        reviewHtml += '<h4>Shipping Information:</h4>';
        if (shippingInfo.method === 'home') {
            reviewHtml += `<p>Method: Home Delivery</p>`;
            reviewHtml += `<p>Name: ${shippingInfo.address.name}</p>`;
            reviewHtml += `<p>Address: ${shippingInfo.address.street}, ${shippingInfo.address.city}, ${shippingInfo.address.postalCode}, ${shippingInfo.address.country}</p>`;
        } else if (shippingInfo.method === 'pickup') {
            reviewHtml += `<p>Method: Pick-up Location</p>`;
            reviewHtml += `<p>Location: ${shippingInfo.pickupLocation}</p>`;
        } else {
            reviewHtml += `<p>No shipping information selected.</p>`;
        }
        console.log("[Checkout][Review] Shipping information rendered:", JSON.parse(JSON.stringify(shippingInfo)));

        // Payment
        reviewHtml += '<h4>Payment Information:</h4>';
        if (paymentInfo.method === 'savedCard') {
            reviewHtml += `<p>Method: Saved Card</p>`;
            // Mocked display, e.g., "Visa ending in 1234"
            const cardDisplay = paymentInfo.savedCardId === 'visa-1234' ? 'Visa ending in 1234' :
                                paymentInfo.savedCardId === 'mastercard-5678' ? 'Mastercard ending in 5678' : 'Selected Saved Card';
            reviewHtml += `<p>Card: ${cardDisplay}</p>`;
        } else if (paymentInfo.method === 'newCard') {
            reviewHtml += `<p>Method: New Card</p>`;
            reviewHtml += `<p>Cardholder: ${paymentInfo.newCardDetails.cardholderName}</p>`;
            // Do not display full card details for security, just an indication.
            reviewHtml += `<p>Card Number: **** **** **** ${paymentInfo.newCardDetails.cardNumber.slice(-4)} (Last 4 digits shown for mock confirmation)</p>`;
        } else {
            reviewHtml += `<p>No payment information selected.</p>`;
        }
        console.log("[Checkout][Review] Payment information rendered:", JSON.parse(JSON.stringify(paymentInfo)));

        // Total (MVP: same as subtotal)
        const totalOrderAmount = subtotal; // For MVP, no extra shipping/taxes
        reviewHtml += `<h4 class="checkout-total-amount">Total Order Amount: $${totalOrderAmount.toFixed(2)}</h4>`;
        console.log("[Checkout][Review] Total order amount calculated:", totalOrderAmount);

        checkoutModalBodyPh1.innerHTML = reviewHtml;
        console.log("[Checkout][Review] Order review screen HTML rendered.");

        if (nextCheckoutBtnPh1) {
            nextCheckoutBtnPh1.textContent = 'Submit Order';
            nextCheckoutBtnPh1.disabled = false;
            nextCheckoutBtnPh1.onclick = () => {
                console.log("[Checkout][Review] 'Submit Order' button clicked.");
                handleOrderSubmission();
            };
            console.log("[Checkout][Review] Next button configured as 'Submit Order'.");
        }

        if (backCheckoutBtnPh1) {
            backCheckoutBtnPh1.style.display = 'inline-block';
            backCheckoutBtnPh1.textContent = 'Back: Payment';
            backCheckoutBtnPh1.onclick = () => {
                console.log("[Checkout][Review] Back button clicked. Returning to Payment Step.");
                renderPaymentStep();
            };
            console.log("[Checkout][Review] Back button configured to return to Payment Step.");
        }

        if (cancelCheckoutBtnPh1) {
            cancelCheckoutBtnPh1.onclick = hideCheckoutModalPh1;
            console.log("[Checkout][Review] Cancel button configured.");
        }
        console.log("[Checkout] Order Review (Step 4) rendering complete.");
    }

    async function handleOrderSubmission() {
        console.log("[Checkout][Submission][Phase 5] handleOrderSubmission called. Attempting to submit order.");
        console.log("[Checkout][Submission][Phase 5] Current checkout state:", JSON.parse(JSON.stringify(checkoutProcessState)));

        // 1. Gather Order Data
        const { selectedItems, shippingInfo, paymentInfo } = checkoutProcessState;

        // Calculate total amount (should ideally be already in state from review step, but recalculate for safety)
        const orderTotal = selectedItems.reduce((sum, item) => sum + ((item.price_per_unit || 0) * item.quantity), 0);
        checkoutProcessState.orderTotal = orderTotal; // Store it in state as well
        console.log("[Checkout][Submission][Phase 5] Calculated orderTotal:", orderTotal);

        // Construct shipping_details for the payload
        let apiShippingDetails = {
            method: shippingInfo.method
        };
        if (shippingInfo.method === 'home') {
            apiShippingDetails.address = {
                name: shippingInfo.address.name,
                street: shippingInfo.address.street,
                city: shippingInfo.address.city,
                postal_code: shippingInfo.address.postalCode, // Ensure key matches backend
                country: shippingInfo.address.country
            };
        } else if (shippingInfo.method === 'pickup') {
            apiShippingDetails.pickup_location_id = shippingInfo.pickupLocation; // Ensure key matches backend
        }
        console.log("[Checkout][Submission][Phase 5] Constructed apiShippingDetails:", JSON.parse(JSON.stringify(apiShippingDetails)));

        // Construct payment_details for the payload
        let apiPaymentDetails = {
            method: paymentInfo.method
        };
        if (paymentInfo.method === 'newCard') {
            apiPaymentDetails.card_info_last4 = paymentInfo.newCardDetails.cardNumber.slice(-4);
        } else if (paymentInfo.method === 'savedCard') {
            apiPaymentDetails.saved_card_id = paymentInfo.savedCardId;
            // Optionally derive last4 from savedCardId if needed, e.g. "visa-1234" -> "1234"
            if (paymentInfo.savedCardId && paymentInfo.savedCardId.includes('-')) {
                 apiPaymentDetails.card_info_last4 = paymentInfo.savedCardId.split('-').pop();
            }
        }
        console.log("[Checkout][Submission][Phase 5] Constructed apiPaymentDetails:", JSON.parse(JSON.stringify(apiPaymentDetails)));

        // 2. Construct the JSON payload
        const orderPayload = {
            customer_id: DEFAULT_CUSTOMER_ID, // Assuming DEFAULT_CUSTOMER_ID is available globally
            items: selectedItems.map(item => ({ // Ensure items have product_id, quantity, price_per_unit
                product_id: item.product_id,
                quantity: item.quantity,
                price_per_unit: item.price_per_unit || 0 // Ensure price_per_unit is present
            })),
            shipping_details: apiShippingDetails,
            payment_details: apiPaymentDetails,
            total_amount: orderTotal
        };
        console.log("[Checkout][Submission][Phase 5] Constructed orderPayload for API:", JSON.parse(JSON.stringify(orderPayload)));

        // 3. API Call
        try {
            console.log("[Checkout][Submission][Phase 5] Making POST request to /api/orders/place_order");
            const response = await fetch('/api/orders/place_order', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(orderPayload)
            });
            
            const responseData = await response.json();
            console.log("[Checkout][Submission][Phase 5] Received response from /api/orders/place_order. Status:", response.status, "Data:", responseData);

            if (response.ok) {
                // 4. Handle Success
                const mockOrderId = responseData.order_id;
                console.log("[Checkout][Submission][Phase 5] Order placed successfully. Mock Order ID:", mockOrderId);
                checkoutProcessState.currentStep = 'confirmation'; // Update step
                renderOrderConfirmationStep(mockOrderId);
                await clearCart(); // Clear cart after successful submission and rendering confirmation
                console.log("[Checkout][Submission][Phase 5] Cart cleared after successful order.");
            } else {
                // 5. Handle Error from API
                const errorMessage = responseData.message || `Error placing order. Status: ${response.status}`;
                console.error("[Checkout][Submission][Phase 5] API error:", errorMessage, "Response Data:", responseData);
                if (checkoutModalBodyPh1) {
                    const errorP = document.createElement('p');
                    errorP.style.color = 'red';
                    errorP.textContent = `There was an issue submitting your order: ${errorMessage}. Please try again.`;
                    // Prepend error to the review step content or a dedicated error area
                    const reviewContent = checkoutModalBodyPh1.querySelector('h3'); // Find a place to insert
                    if (reviewContent) {
                        reviewContent.insertAdjacentElement('afterend', errorP);
                    } else {
                        checkoutModalBodyPh1.insertAdjacentElement('afterbegin', errorP);
                    }
                }
                // Keep user on review step, allow them to try again or cancel.
                // Re-enable submit button if it was disabled
                if(nextCheckoutBtnPh1) nextCheckoutBtnPh1.disabled = false;
            }
        } catch (error) {
            // Handle network errors or other issues with fetch
            console.error("[Checkout][Submission][Phase 5] Network or other error during order submission:", error);
            if (checkoutModalBodyPh1) {
                const errorP = document.createElement('p');
                errorP.style.color = 'red';
                errorP.textContent = "There was a network issue submitting your order. Please check your connection and try again.";
                 const reviewContent = checkoutModalBodyPh1.querySelector('h3');
                if (reviewContent) {
                    reviewContent.insertAdjacentElement('afterend', errorP);
                } else {
                    checkoutModalBodyPh1.insertAdjacentElement('afterbegin', errorP);
                }
            }
            if(nextCheckoutBtnPh1) nextCheckoutBtnPh1.disabled = false; // Re-enable submit
        }
    }

    function renderOrderConfirmationStep(orderId) {
        console.log("[Checkout][Confirmation][Phase 5] Rendering Step 5: Order Confirmation. Order ID:", orderId);
        checkoutProcessState.currentStep = 'confirmation';

        if (!checkoutModalBodyPh1 || !checkoutModalTitlePh1 || !nextCheckoutBtnPh1 || !backCheckoutBtnPh1 || !cancelCheckoutBtnPh1) {
            console.error("[Checkout][Confirmation][Phase 5] Modal elements not found for rendering confirmation step.");
            return;
        }

        // Clear modal body
        checkoutModalBodyPh1.innerHTML = '';
        console.log("[Checkout][Confirmation][Phase 5] Modal body cleared.");

        // Update modal title
        checkoutModalTitlePh1.textContent = 'Step 5: Order Confirmed!';
        console.log("[Checkout][Confirmation][Phase 5] Modal title updated.");

        // Display success message and order ID
        const confirmationHtml = `
            <div class="order-confirmation-content" style="text-align: center; padding: 20px;">
                <h2>Thank you! Your order has been placed.</h2>
                <p>Your Order ID is: <strong>${orderId}</strong></p>
                <p>We've received your order and will process it shortly.</p>
            </div>
        `;
        checkoutModalBodyPh1.innerHTML = confirmationHtml;
        console.log("[Checkout][Confirmation][Phase 5] Confirmation HTML rendered.");

        // Update modal footer: Only "Close" button
        nextCheckoutBtnPh1.style.display = 'none'; // Hide "Submit Order" (or "Next")
        backCheckoutBtnPh1.style.display = 'none'; // Hide "Back"
        
        cancelCheckoutBtnPh1.textContent = 'Close'; // Rename "Cancel" to "Close"
        cancelCheckoutBtnPh1.onclick = () => {
            console.log("[Checkout][Confirmation][Phase 5] 'Close' button clicked. Hiding modal and resetting state.");
            hideCheckoutModalPh1(); // This function already resets the state
        };
        console.log("[Checkout][Confirmation][Phase 5] Modal footer updated for confirmation screen. 'Close' button configured.");
        console.log("[Checkout][Confirmation][Phase 5] Order Confirmation (Step 5) rendering complete.");
    }

    console.log("[Main Page] Script loaded. All initial event listeners should be set.");
});
