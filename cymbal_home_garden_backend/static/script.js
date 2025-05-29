document.addEventListener('DOMContentLoaded', () => {
    const productListing = document.getElementById('product-listing');
    const nightModeToggle = document.getElementById('night-mode-toggle');
    const recommendedProductsGrid = document.getElementById('recommended-products-grid');
    const currentCustomerIdSpan = document.getElementById('current-customer-id'); 

    // Cart DOM Elements (Old Modal - some might be repurposed or removed)
    // const cartModal = document.getElementById('cart-modal'); // Commented out, modal removed
    // const cartToggleBtn = document.getElementById('cart-toggle'); // Commented out, header button removed
    // const closeCartBtn = cartModal.querySelector('.close-button'); // Commented out
    // const cartItemsContainer = document.getElementById('cart-items-container'); // Old modal items container
    // const cartSubtotalEl = document.getElementById('cart-subtotal'); // Old modal subtotal
    // const cartCountEl = document.getElementById('cart-count'); // Old modal count

    // New Left Sidebar Cart DOM Elements
    const leftSidebarCart = document.getElementById('left-sidebar-cart');
    const cartSidebarToggleBtn = document.getElementById('cart-sidebar-toggle-btn');
    const cartSidebarItemsContainer = document.getElementById('cart-sidebar-items-container');
    const cartSidebarSubtotalEl = document.getElementById('cart-sidebar-subtotal');
    const cartSidebarItemCountEl = document.getElementById('cart-sidebar-item-count');
    const clearCartSidebarBtn = document.getElementById('cart-sidebar-clear-btn');
    // const cartSidebarCheckoutBtn = document.getElementById('cart-sidebar-checkout-btn'); // REMOVED
    
    console.log("[Cart Init] Sidebar cart elements:", { leftSidebarCart, cartSidebarToggleBtn, cartSidebarItemsContainer, cartSidebarSubtotalEl, cartSidebarItemCountEl, clearCartSidebarBtn }); // REMOVED cartSidebarCheckoutBtn from log

    // New Checkout Review Modal DOM Elements
    const checkoutReviewModal = document.getElementById('checkout-review-modal');
    const closeCheckoutReviewModalBtn = checkoutReviewModal ? checkoutReviewModal.querySelector('.checkout-modal-close-btn') : null;
    const checkoutModalItemsContainer = document.getElementById('checkout-modal-items-container');
    const checkoutModalSubtotalEl = document.getElementById('checkout-modal-subtotal');
    const checkoutModalModifyBtn = document.getElementById('checkout-modal-modify-btn');
    const checkoutModalProceedBtn = document.getElementById('checkout-modal-proceed-btn');

    // Shipping Modal DOM Elements
    const checkoutShippingModal = document.getElementById('checkout-shipping-modal');
    const closeCheckoutShippingModalBtn = checkoutShippingModal ? checkoutShippingModal.querySelector('.checkout-modal-close-btn') : null;
    const shippingHomeDeliveryOpt = document.getElementById('shipping-home-delivery');
    const shippingPickupPointOpt = document.getElementById('shipping-pickup-point');
    const shippingRadioHome = document.getElementById('shipping-radio-home');
    const shippingRadioPickup = document.getElementById('shipping-radio-pickup');
    const pickupLocationsListContainer = document.getElementById('pickup-locations-list');
    const shippingBackBtn = document.getElementById('shipping-back-btn');
    const shippingContinueBtn = document.getElementById('shipping-continue-btn');

    // Payment Modal DOM Elements
    const checkoutPaymentModal = document.getElementById('checkout-payment-modal');
    const closeCheckoutPaymentModalBtn = checkoutPaymentModal ? checkoutPaymentModal.querySelector('.checkout-modal-close-btn') : null;
    const paymentRadioSaved = document.getElementById('payment-radio-saved');
    const paymentRadioNew = document.getElementById('payment-radio-new');
    const savedCardDetailsDiv = document.getElementById('saved-card-details');
    const newCardFormDiv = document.getElementById('new-card-form');
    const saveCardBtn = document.getElementById('save-card-btn');
    const paymentBackBtn = document.getElementById('payment-back-btn');
    const paymentConfirmBtn = document.getElementById('payment-confirm-btn');


    // Checkout Modal (Sidebar) DOM Elements - REMOVED
    const DEFAULT_CUSTOMER_ID = "123";
    if(currentCustomerIdSpan) currentCustomerIdSpan.textContent = DEFAULT_CUSTOMER_ID;

    let localProductCache = {};
    let currentCartItemsData = [];
    let currentCartItemIds = [];
    let cachedCartDataForModals = null; // To store cart data for reopening review modal

    const staticPickupLocations = [
        { name: 'Cymbal Store Downtown', address: '123 Main St, Anytown, USA' },
        { name: 'Cymbal Garden Center North', address: '789 Oak Ave, Anytown, USA' },
        { name: 'Partner Locker Hub', address: '456 Pine Rd, Anytown, USA' }
    ];
    let currentShippingSelection = {};

    // --- Left Sidebar Cart Logic ---
    function toggleCartSidebar() {
        if (!leftSidebarCart) {
            console.error("[Cart Sidebar] Sidebar element not found for toggle.");
            return;
        }
        const isCollapsed = leftSidebarCart.classList.toggle('collapsed');
        document.body.classList.toggle('cart-sidebar-expanded', !isCollapsed);
        console.log(`[Cart Sidebar] Toggled. Now ${isCollapsed ? 'collapsed' : 'expanded'}. Body class 'cart-sidebar-expanded' is ${!isCollapsed}.`);
        if (cartSidebarToggleBtn) {
            cartSidebarToggleBtn.innerHTML = isCollapsed ? '>' : '<'; // Update button text/icon
        }
    }

    if (cartSidebarToggleBtn) {
        console.log("[Cart Init] Adding click listener to sidebar toggle button.");
        cartSidebarToggleBtn.addEventListener('click', toggleCartSidebar);
    } else {
        console.warn("[Cart Init] Sidebar toggle button not found.");
    }
    
    // Ensure sidebar is expanded by default if not explicitly collapsed by a class on load
    if (leftSidebarCart && !leftSidebarCart.classList.contains('collapsed')) {
        document.body.classList.add('cart-sidebar-expanded');
        console.log("[Cart Init] Sidebar initially expanded. Added 'cart-sidebar-expanded' to body.");
         if (cartSidebarToggleBtn) cartSidebarToggleBtn.innerHTML = '<';
    }


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
        } catch (error) {
            console.error("Error saving theme to localStorage:", error);
        }
    }
    try {
        const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        if (savedTheme) applyTheme(savedTheme); else applyTheme('day');
    } catch (error) {
        console.error("Error loading theme from localStorage:", error);
        applyTheme('day'); 
    }
    if(nightModeToggle) {
        nightModeToggle.addEventListener('click', () => {
            applyTheme(document.body.classList.contains('night-mode') ? 'day' : 'night');
        });
    }

    // --- Cart Modal (Old - To be removed or commented out) ---
    // function openCartModal() { if(cartModal) cartModal.classList.add('show'); }
    // function closeCartModal() { if(cartModal) cartModal.classList.remove('show'); }
    // if(cartToggleBtn) cartToggleBtn.addEventListener('click', openCartModal);
    // if(closeCartBtn) closeCartBtn.addEventListener('click', closeCartModal);
    // window.addEventListener('click', (event) => {
    //     if (event.target === cartModal) closeCartModal();
    // });

    // --- API Helper ---
    async function fetchAPI(url, options = {}) {
        console.log(`AGENT ACTION: Calling ${options.method || 'GET'} ${url}`);
        if (options.body) {
            let payloadToLog = options.body;
            if (typeof options.body === 'string') {
                try { payloadToLog = JSON.parse(options.body); } catch (e) { /* ignore */ }
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
        console.log("[Cart] Fetching cart data...");
        try {
            const data = await fetchAPI(`/api/cart/${DEFAULT_CUSTOMER_ID}`);
            console.log("[Cart] Cart data received:", data);
            currentCartItemsData = data.items || [];
            currentCartItemIds = currentCartItemsData.map(item => item.product_id);
            renderCartItems(currentCartItemsData); // Will now render to sidebar
            calculateSubtotal(currentCartItemsData); // Will now update sidebar subtotal
            updateCartCount(currentCartItemsData); // Will now update sidebar count
            displayRecommendedProducts();
            const subtotal = currentCartItemsData.reduce((sum, item) => sum + ((item.price_per_unit || 0) * item.quantity), 0);
            return { items: currentCartItemsData, subtotal: subtotal }; // Return the necessary data
        } catch (error) {
            console.error("[Cart] Error fetching cart:", error);
            if(cartSidebarItemsContainer) cartSidebarItemsContainer.innerHTML = '<p>Error loading cart. Please try again.</p>';
            throw error; // Re-throw error so it can be caught by caller
        }
    }

    // New animation function
    function animateItemToCart(sourceElementRect, targetElementRect, imageUrl) {
        console.log(`[Animation] Starting fly-to-cart. Source:`, sourceElementRect, `Target:`, targetElementRect, `Image: ${imageUrl}`);
        if (!imageUrl || !sourceElementRect || !targetElementRect) {
            console.error("[Animation] Missing data for animation:", {imageUrl, sourceElementRect, targetElementRect});
            return;
        }

        const flyingImage = document.createElement('div');
        flyingImage.classList.add('flying-item-animation'); // Use class from style.css
        flyingImage.style.backgroundImage = `url(${imageUrl})`;
        
        // Initial position and size (near source element, e.g., agent widget)
        const initialSize = 50; // px
        flyingImage.style.left = `${sourceElementRect.left + (sourceElementRect.width / 2) - (initialSize / 2)}px`;
        flyingImage.style.top = `${sourceElementRect.top + (sourceElementRect.height / 2) - (initialSize / 2)}px`;
        flyingImage.style.width = `${initialSize}px`;
        flyingImage.style.height = `${initialSize}px`;
        flyingImage.style.opacity = '1';
        
        document.body.appendChild(flyingImage);
        console.log("[Animation] Flying image appended to body:", flyingImage);

        // Target position and size (near cart sidebar icon or a specific point in sidebar)
        const finalSize = 20; // px, smaller as it "enters" the cart
        const targetX = targetElementRect.left + (targetElementRect.width / 4); // Adjust to target a specific part of the sidebar
        const targetY = targetElementRect.top + (targetElementRect.height / 4);

        // Force reflow to apply initial styles before transition
        void flyingImage.offsetWidth;

        // Apply target styles to trigger CSS transition
        flyingImage.style.left = `${targetX}px`;
        flyingImage.style.top = `${targetY}px`;
        flyingImage.style.width = `${finalSize}px`;
        flyingImage.style.height = `${finalSize}px`;
        flyingImage.style.opacity = '0';
        // transform: scale(0.1) could also be used if preferred over width/height transition for shrinking

        flyingImage.addEventListener('transitionend', () => {
            console.log("[Animation] Fly-to-cart animation ended. Removing element.");
            flyingImage.remove();
        }, { once: true });
    }

    async function addToCart(productId, event) { // event parameter might be null if called by agent
        console.log(`[Product Card Add] Adding product ${productId} to cart. Attempting animation.`);

        if (event && event.target) { // Ensure event and event.target are available for user clicks
            const sourceElementRect = event.target.getBoundingClientRect();
            const targetElement = document.getElementById('left-sidebar-cart');
            if (targetElement) {
                const targetElementRect = targetElement.getBoundingClientRect();
                let imageUrl = 'https://via.placeholder.com/150?text=No+Image'; // Default
                const product = localProductCache[productId];
                if (product && product.image_url) {
                    imageUrl = `/${product.image_url}`;
                } else {
                    // Fallback: Try to get image from the card DOM
                    const card = event.target.closest('.product-card');
                    if (card) {
                        const imgElement = card.querySelector('img');
                        if (imgElement && imgElement.src) {
                            imageUrl = imgElement.src;
                        }
                    }
                }
                animateItemToCart(sourceElementRect, targetElementRect, imageUrl);
            } else {
                console.warn("[Animation] Target cart element 'left-sidebar-cart' not found for user click animation.");
            }
        } else {
            console.log("[Product Card Add] Event or event.target not available, skipping user click animation (likely agent call or test).");
        }

        try {
            await fetchAPI(`/api/cart/${DEFAULT_CUSTOMER_ID}/item`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ product_id: productId, quantity: 1 })
            });
            await fetchCart(); // Fetches cart and updates sidebar display

            // Ensure sidebar is visible if it was collapsed
            if (leftSidebarCart && leftSidebarCart.classList.contains('collapsed')) {
                console.log("[Cart] Sidebar was collapsed, expanding it after item add.");
                toggleCartSidebar(); // Use the new toggle function
            }
        } catch (error) {
            console.error(`[Product Card Add] Error adding product ${productId}:`, error);
            // fetchAPI handles user-facing alerts
        }
    }

    function renderCartItems(items) {
        // Now targets the sidebar's item container
        if (!cartSidebarItemsContainer) {
            console.error("[Cart Render] Sidebar cart items container not found.");
            return;
        }
        console.log("[Cart Render] Rendering items in sidebar:", items);
        if (!items || items.length === 0) {
            cartSidebarItemsContainer.innerHTML = '<p>Your cart is empty.</p>';
        } else {
            cartSidebarItemsContainer.innerHTML = '';
            items.forEach(item => {
                const itemEl = document.createElement('div');
                itemEl.classList.add('cart-item');
                itemEl.innerHTML =
                    `<div class="cart-item-details">
                        <h4>${item.name || item.product_id}</h4>
                        <p class="product-id-display">ID: ${item.product_id}</p>
                        <p>Price: $${(item.price_per_unit || 0).toFixed(2)} x ${item.quantity}</p>
                    </div>
                    <div class="cart-item-actions">
                        <button class="remove-from-cart-btn" data-product-id="${item.product_id}">&times;</button>
                    </div>`;
                cartSidebarItemsContainer.appendChild(itemEl);
            });
            cartSidebarItemsContainer.querySelectorAll('.remove-from-cart-btn').forEach(btn => {
                btn.addEventListener('click', (e) => removeProductFromCart(e.target.dataset.productId));
            });
        }
    }

    function updateCartCount(items) {
        // Now targets the sidebar's count element
        if(!cartSidebarItemCountEl) {
            console.warn("[Cart Count] Sidebar item count element not found.");
            return;
        }
        const count = items.reduce((sum, item) => sum + item.quantity, 0);
        cartSidebarItemCountEl.textContent = count;
        console.log(`[Cart Count] Updated sidebar cart count to: ${count}`);
    }

    function calculateSubtotal(items) {
        // Now targets the sidebar's subtotal element
        if(!cartSidebarSubtotalEl) {
            console.warn("[Cart Subtotal] Sidebar subtotal element not found.");
            return;
        }
        const subtotal = items.reduce((sum, item) => sum + ((item.price_per_unit || 0) * item.quantity), 0).toFixed(2);
        cartSidebarSubtotalEl.textContent = subtotal;
        console.log(`[Cart Subtotal] Updated sidebar subtotal to: $${subtotal}`);
    }

    async function removeProductFromCart(productId) {
        console.log(`[Cart] Removing product ${productId} from cart.`);
        try {
            await fetchAPI(`/api/cart/${DEFAULT_CUSTOMER_ID}/item/${productId}`, { method: 'DELETE' });
            await fetchCart();
        } catch (error) {
            console.error(`[Cart] Error removing product ${productId}:`, error);
            /* Handled by fetchAPI */
        }
    }

    async function clearCart() {
        console.log("[Cart] Clearing all items from cart.");
        try {
            await fetchAPI(`/api/cart/${DEFAULT_CUSTOMER_ID}/clear`, { method: 'DELETE' });
            await fetchCart();
        } catch (error) {
            console.error("[Cart] Error clearing cart:", error);
        }
    }
    // Update to use the new sidebar clear button
    if(clearCartSidebarBtn) {
        console.log("[Cart Init] Adding click listener to sidebar clear cart button.");
        clearCartSidebarBtn.addEventListener('click', clearCart);
    } else {
        console.warn("[Cart Init] Sidebar clear cart button not found.");
    }

    // --- Product Display & Recommendations ---
    async function fetchInitialProducts() {
        try {
            const products = await fetchAPI('/api/products');
            localProductCache = {};
            products.forEach(p => localProductCache[p.id] = p);
            displayProducts(products);
        } catch (error) {
            if(productListing) productListing.innerHTML = '<p>Error loading products. Please try again later.</p>';
        }
    }

    function displayProducts(productsData) {
        if (!productListing || !productsData || productsData.length === 0) {
            if(productListing) productListing.innerHTML = '<p>No products found.</p>';
            return;
        }
        productListing.innerHTML = '';
        productsData.forEach(product => renderProductCard(product, productListing));
    }

    function displayRecommendedProducts() {
        if (!recommendedProductsGrid || !localProductCache) return;
        const allProducts = Object.values(localProductCache);
        if (allProducts.length === 0) {
            recommendedProductsGrid.innerHTML = '<p>No recommendations available yet.</p>'; return;
        }
        let recommendations = allProducts.filter(p => !currentCartItemIds.includes(p.id)).slice(0, 4);
        if (recommendations.length < 4) {
            recommendations = recommendations.concat(allProducts.filter(p => !recommendations.find(r => r.id === p.id)).slice(0, 4 - recommendations.length));
        }
        recommendations = [...new Map(recommendations.map(item => [item['id'], item])).values()].slice(0,4);
        recommendedProductsGrid.innerHTML = '';
        if (recommendations.length === 0 && allProducts.length > 0) recommendations = allProducts.slice(0,4);
        
        if (recommendations.length > 0) {
            recommendations.forEach(product => renderProductCard(product, recommendedProductsGrid, true));
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
        const imageUrl = product.image_url ? `/${product.image_url}` : 'https://picsum.photos/seed/productimg/300/300';
        let descSnippet = description.substring(0, isRecommended ? 50 : 100) + (description.length > (isRecommended ? 50 : 100) ? '...' : '');
        
        card.innerHTML =
            `<img src="${imageUrl}" alt="${name}">
            <h3>${name}</h3>
            <p class="product-id-display">ID: ${product.id}</p>
            <p class="price">$${price}</p>
            <p class="description">${descSnippet}</p>
            <button class="add-to-cart-btn" data-product-id="${product.id}">Add to Cart</button>`;
        container.appendChild(card);
        // Pass the event to addToCart
        card.querySelector('.add-to-cart-btn').addEventListener('click', (event) => addToCart(event.target.dataset.productId, event));
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
        const expectedWidgetOrigin = 'http://localhost:5000';
        if (event.origin !== expectedWidgetOrigin) {
            console.warn(`[Main Page] Message received from unexpected origin: ${event.origin}. Expected: ${expectedWidgetOrigin}. Ignoring message.`);
            return;
        }
        if (!event.data) {
            console.log("[Main Page] Message data is null or undefined. Ignoring.");
            return;
        }

        if (event.data.type === "SET_WEBSITE_THEME" && typeof event.data.payload === 'string') {
            const newTheme = event.data.payload;
            console.log(`[Main Page] Received SET_WEBSITE_THEME from widget with theme: ${newTheme}`);
            applyTheme(newTheme);
        } else if (event.data.type === "REFRESH_CART_DISPLAY") {
            console.log("[Main Page] Received REFRESH_CART_DISPLAY from widget. Data:", event.data);
            fetchCart(); // This will update the sidebar cart display

            if (event.data.added_item_details && event.data.added_item_details.image_url) {
                console.log("[Main Page] Item added via agent, attempting animation. Details:", event.data.added_item_details);
                const agentWidgetElement = document.querySelector('.agent-widget'); // Standard selector for agent widget
                const sidebarCartElement = document.getElementById('left-sidebar-cart');

                if (agentWidgetElement && sidebarCartElement) {
                    const sourceRect = agentWidgetElement.getBoundingClientRect();
                    const targetRect = sidebarCartElement.getBoundingClientRect(); // Or a specific element within the sidebar
                    
                    // Ensure sidebar is visible for animation target
                    if (leftSidebarCart && leftSidebarCart.classList.contains('collapsed')) {
                        console.log("[Animation] Sidebar was collapsed, expanding it for animation target.");
                        toggleCartSidebar();
                    }
                    
                    animateItemToCart(sourceRect, targetRect, event.data.added_item_details.image_url);
                } else {
                    console.error("[Animation] Could not find agent widget or sidebar cart element for animation.", {agentWidgetElement, sidebarCartElement});
                }
            } else {
                console.log("[Main Page] REFRESH_CART_DISPLAY received, but no added_item_details with image_url for animation.");
            }
        } else if (event.data.type === "ui_command" && event.data.command_name) { // Changed to match agent_widget.js
            console.log(`[Main Page] Received 'ui_command' for command: ${event.data.command_name}`, "Payload:", event.data.payload);
            handleDisplayUiComponent(event.data.command_name, event.data.payload); // Pass command_name as uiElement
        } else if (event.data.type === 'show_checkout_modal_command' && event.data.cart) {
            console.log("[Main Page] Received 'show_checkout_modal_command' from widget. Cart data:", event.data.cart);
            openCheckoutReviewModal(event.data.cart);
        } else if (event.data.type === 'show_shipping_modal_command') {
            console.log("[Main Page] Received 'show_shipping_modal_command' from widget.");
            openCheckoutShippingModal();
        } else if (event.data.type === 'show_payment_modal_command') {
            console.log("[Main Page] Received 'show_payment_modal_command' from widget.");
            openCheckoutPaymentModal();
        } else if (event.data.type === 'ui_select_shipping_home_delivery') {
            console.log("[Main Page] Received 'ui_select_shipping_home_delivery' from widget.");
            if(shippingRadioHome) shippingRadioHome.checked = true;
            updateShippingSelectionUI({ type: 'home_delivery' });
            hidePickupLocationsList();
        } else if (event.data.type === 'ui_show_pickup_locations') {
            console.log("[Main Page] Received 'ui_show_pickup_locations' from widget.");
            if(shippingRadioPickup) shippingRadioPickup.checked = true;
            updateShippingSelectionUI({ type: 'pickup_initiated' });
            displayPickupLocationsList();
        } else if (event.data.type === 'ui_select_pickup_address' && event.data.address_index !== undefined) {
            console.log(`[Main Page] Received 'ui_select_pickup_address' for index ${event.data.address_index} from widget.`);
            const selectedLocation = staticPickupLocations[event.data.address_index];
            if (selectedLocation) {
                updateShippingSelectionUI({ type: 'pickup_address', index: event.data.address_index, name: selectedLocation.name, address: selectedLocation.address });
                // Also visually check the radio button for the specific pickup location if they exist
                const pickupRadio = document.getElementById(`pickup-location-radio-${event.data.address_index}`);
                if (pickupRadio) pickupRadio.checked = true;
            }
        } else if (event.data.type === 'order_confirmed_refresh_cart_command') {
            console.log("[Main Page] Received 'order_confirmed_refresh_cart_command' from widget. Data:", event.data.data);
            // Close any open checkout modals
            if (checkoutPaymentModal && checkoutPaymentModal.style.display !== 'none') {
                closeCheckoutPaymentModal();
            }
            if (checkoutShippingModal && checkoutShippingModal.style.display !== 'none') {
                closeCheckoutShippingModal();
            }
            if (checkoutReviewModal && checkoutReviewModal.style.display !== 'none') {
                closeCheckoutReviewModal();
            }
            // Refresh cart (will be empty as backend clears it)
            fetchCart();
            // Show confirmation message
            const confirmationMessage = event.data.data?.message || "Your order has been submitted successfully!";
            const orderIdMessage = event.data.data?.order_id ? ` Order ID: ${event.data.data.order_id}` : "";
            alert(confirmationMessage + orderIdMessage); 
            // TODO: Replace alert with a more integrated UI notification
        } else if (event.data.type === 'agent_initiated_checkout_cancel') {
            console.log("[Main Page] Received 'agent_initiated_checkout_cancel' from widget.");
            if (checkoutReviewModal && checkoutReviewModal.style.display !== 'none') {
                closeCheckoutReviewModal(); // This will also trigger state reset and postMessage
            }
            if (checkoutShippingModal && checkoutShippingModal.style.display !== 'none') {
                closeCheckoutShippingModal(); // This will also trigger state reset and postMessage
            }
            if (checkoutPaymentModal && checkoutPaymentModal.style.display !== 'none') {
                closeCheckoutPaymentModal(); // This will also trigger state reset and postMessage
            }
            // Explicitly reset state here as well, in case no modal was open or for clarity
            currentShippingSelection = {};
            cachedCartDataForModals = null;
            console.log("[Main Page] Checkout state reset due to agent-initiated cancellation.");
        } else {
            console.log("[Main Page] Received message not handled by current logic:", event.data);
        }
    });

    function handleDisplayUiComponent(uiElement, payload) { // uiElement here is actually command_name
        console.log(`[Main Page] handleDisplayUiComponent called with command_name (as uiElement): ${uiElement}, payload:`, payload);

        switch (uiElement) { // uiElement here is actually command_name
            default:
                console.error(`[Main Page] Unknown/unhandled uiElement received in handleDisplayUiComponent: ${uiElement}`);
        }
    }
    
    // --- Checkout Review Modal Functions ---
    function populateCheckoutModal(cartData) {
        console.log("[Checkout Modal] Attempting to POPULATE review modal. Received Cart data:", JSON.stringify(cartData));
        if (!checkoutModalItemsContainer || !checkoutModalSubtotalEl) {
            console.error("Checkout modal item/subtotal elements not found for populate.");
            return;
        }
        cachedCartDataForModals = cartData; // Cache for reopening
        if (!cartData || !cartData.items || cartData.items.length === 0) {
            checkoutModalItemsContainer.innerHTML = '<p>Your cart is currently empty.</p>';
            checkoutModalSubtotalEl.textContent = '0.00';
            if(checkoutModalProceedBtn) checkoutModalProceedBtn.disabled = true;
            return;
        }

        checkoutModalItemsContainer.innerHTML = ''; // Clear previous items
        cartData.items.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.classList.add('checkout-modal-item');
            itemEl.innerHTML = `
                <span class="checkout-modal-item-name">${item.name || item.product_id}</span>
                <span class="checkout-modal-item-qty">Qty: ${item.quantity}</span>
                <span class="checkout-modal-item-price">$${(item.price_per_unit * item.quantity).toFixed(2)}</span>
            `;
            checkoutModalItemsContainer.appendChild(itemEl);
        });
        checkoutModalSubtotalEl.textContent = (cartData.subtotal || 0).toFixed(2);
        if(checkoutModalProceedBtn) checkoutModalProceedBtn.disabled = false;
    }

    function openCheckoutReviewModal(cartData) {
        console.log("[Checkout Modal] Attempting to OPEN review modal. Received Cart data:", JSON.stringify(cartData));
        if (!checkoutReviewModal) {
            console.error("Checkout review modal element not found. Cannot open.");
            return;
        }
        console.log("[Checkout Modal] Opening review modal. Cart data (confirmed):", cartData);
        populateCheckoutModal(cartData); // This will also cache cartData
        
        checkoutReviewModal.classList.remove('popping-out');
        checkoutReviewModal.classList.add('popping-in');
        checkoutReviewModal.style.display = 'flex';
    }

    function closeCheckoutReviewModal() {
        return new Promise((resolve) => {
            if (!checkoutReviewModal) {
                resolve();
                return;
            }
            checkoutReviewModal.classList.remove('popping-in');
            checkoutReviewModal.classList.add('popping-out');
            
            window.parent.postMessage({ type: 'checkout_cancelled', modalId: 'checkout-review-modal' }, '*');
            currentShippingSelection = {};
            cachedCartDataForModals = null;
            console.log("[Checkout Review Modal] Closed. State reset. Notified agent.");

            setTimeout(() => {
                checkoutReviewModal.style.display = 'none';
                checkoutReviewModal.classList.remove('popping-out');
                resolve();
            }, 300);
        });
    }

    if (closeCheckoutReviewModalBtn) closeCheckoutReviewModalBtn.addEventListener('click', closeCheckoutReviewModal);
    if (checkoutModalModifyBtn) {
        checkoutModalModifyBtn.addEventListener('click', () => {
            console.log("[Checkout Modal] Modify Cart button clicked.");
            // Note: Modify doesn't fully cancel checkout, just closes review to allow cart changes.
            // If a full cancel is desired here, it would need the same logic as closeCheckoutReviewModal.
            // For now, keeping it as just closing the review modal.
            closeCheckoutReviewModal(); 
        });
    }
    if (checkoutModalProceedBtn) {
        checkoutModalProceedBtn.addEventListener('click', async () => {
            console.log("[Checkout Review Modal] Proceed button clicked. Opening shipping modal.");
            await closeCheckoutReviewModal();
            openCheckoutShippingModal(); // Transition to shipping modal
        });
    }

    // --- Shipping Modal Functions ---
    function resetShippingModalUI() {
        if(shippingRadioHome) shippingRadioHome.checked = false;
        if(shippingRadioPickup) shippingRadioPickup.checked = false;
        hidePickupLocationsList();
        // Clear visual selection cues
        document.querySelectorAll('.shipping-option.selected, .pickup-location-option.selected').forEach(el => {
            el.classList.remove('selected');
        });
        currentShippingSelection = {};
        if(shippingContinueBtn) shippingContinueBtn.disabled = true; // Disable continue until a choice is made
    }

    function updateShippingSelectionUI(selection) {
        currentShippingSelection = selection;
        console.log("[Shipping Modal] Current selection updated:", currentShippingSelection);

        // Remove 'selected' class from all options first
        document.querySelectorAll('.shipping-option.selected, .pickup-location-option.selected').forEach(el => {
            el.classList.remove('selected');
        });
        
        if (selection.type === 'home_delivery' && shippingHomeDeliveryOpt) {
            shippingHomeDeliveryOpt.classList.add('selected');
        } else if (selection.type === 'pickup_initiated' && shippingPickupPointOpt) {
            shippingPickupPointOpt.classList.add('selected');
        } else if (selection.type === 'pickup_address' && selection.index !== undefined) {
            if(shippingPickupPointOpt) shippingPickupPointOpt.classList.add('selected'); // Keep main pickup option selected
            const selectedPickupEl = document.querySelector(`.pickup-location-option[data-index="${selection.index}"]`);
            if (selectedPickupEl) selectedPickupEl.classList.add('selected');
        }
        if(shippingContinueBtn) shippingContinueBtn.disabled = !(currentShippingSelection.type === 'home_delivery' || currentShippingSelection.type === 'pickup_address');
    }

    function displayPickupLocationsList() {
        if (!pickupLocationsListContainer) return;
        pickupLocationsListContainer.innerHTML = '<h4>Select a Pickup Location:</h4>'; // Title for the list
        staticPickupLocations.forEach((location, index) => {
            const locEl = document.createElement('div');
            locEl.classList.add('pickup-location-option');
            locEl.dataset.index = index;
            locEl.innerHTML = `
                <input type="radio" name="pickup_location_radio" value="${index}" id="pickup-location-radio-${index}" style="display:none;">
                <span class="location-name">${location.name}</span>
                <span class="location-address">${location.address}</span>
            `;
            locEl.addEventListener('click', () => {
                // Visually check the hidden radio for form semantics if ever needed, and for styling
                const radio = locEl.querySelector('input[type="radio"]');
                if(radio) radio.checked = true;
                
                updateShippingSelectionUI({ type: 'pickup_address', index: index, name: location.name, address: location.address });
                window.parent.postMessage({ type: 'pickup_address_chosen', address_text: `${location.name} - ${location.address}`, address_index: index }, '*');
            });
            pickupLocationsListContainer.appendChild(locEl);
        });
        pickupLocationsListContainer.style.display = 'block';
    }

    function hidePickupLocationsList() {
        if (pickupLocationsListContainer) {
            pickupLocationsListContainer.style.display = 'none';
            pickupLocationsListContainer.innerHTML = '<p>Loading pickup locations...</p>'; // Reset content
        }
    }

    function openCheckoutShippingModal() {
        if (!checkoutShippingModal) {
            console.error("Checkout shipping modal element not found.");
            return;
        }
        console.log("[Shipping Modal] Opening shipping modal.");
        resetShippingModalUI();
        checkoutShippingModal.classList.remove('popping-out');
        checkoutShippingModal.classList.add('popping-in');
        checkoutShippingModal.style.display = 'flex';
    }

    function closeCheckoutShippingModal() {
        return new Promise((resolve) => {
            if (!checkoutShippingModal) {
                resolve();
                return;
            }
            checkoutShippingModal.classList.remove('popping-in');
            checkoutShippingModal.classList.add('popping-out');

            window.parent.postMessage({ type: 'checkout_cancelled', modalId: 'checkout-shipping-modal' }, '*');
            currentShippingSelection = {};
            cachedCartDataForModals = null; // Shipping selection is part of checkout flow, so reset cart cache too
            console.log("[Checkout Shipping Modal] Closed. State reset. Notified agent.");
            
            setTimeout(() => {
                checkoutShippingModal.style.display = 'none';
                checkoutShippingModal.classList.remove('popping-out');
                resolve();
            }, 300);
        });
    }

    if (closeCheckoutShippingModalBtn) closeCheckoutShippingModalBtn.addEventListener('click', closeCheckoutShippingModal);

    if (shippingHomeDeliveryOpt) {
        shippingHomeDeliveryOpt.addEventListener('click', () => {
            if(shippingRadioHome) shippingRadioHome.checked = true; // Ensure radio is checked
            updateShippingSelectionUI({ type: 'home_delivery' });
            hidePickupLocationsList();
            window.parent.postMessage({ type: 'shipping_option_chosen', choice: 'home_delivery' }, '*');
        });
    }
    if (shippingPickupPointOpt) {
        shippingPickupPointOpt.addEventListener('click', () => {
            if(shippingRadioPickup) shippingRadioPickup.checked = true; // Ensure radio is checked
            updateShippingSelectionUI({ type: 'pickup_initiated' });
            displayPickupLocationsList();
            window.parent.postMessage({ type: 'shipping_option_chosen', choice: 'pickup_initiated' }, '*');
        });
    }

    if (shippingBackBtn) {
        console.log("[Init] shippingBackBtn element FOUND. Attaching listener.");
        shippingBackBtn.addEventListener('click', async () => {
            console.log("[Shipping Modal] Back to Cart Review button CLICKED. Starting process.");
            await closeCheckoutShippingModal();
            console.log("[Shipping Modal] closeCheckoutShippingModal awaited.");
            try {
                console.log("[Shipping Modal] cachedCartDataForModals before decision:", JSON.stringify(cachedCartDataForModals));
                let cartDataToDisplay;
                if (cachedCartDataForModals) {
                    cartDataToDisplay = cachedCartDataForModals;
                    console.log("[Shipping Modal] Using cachedCartDataForModals.");
                } else {
                    console.log("[Shipping Modal] No cached data, attempting to fetchCart().");
                    cartDataToDisplay = await fetchCart();
                    console.log("[Shipping Modal] fetchCart() result:", JSON.stringify(cartDataToDisplay));
                }
                console.log("[Shipping Modal] cartDataToDisplay before opening review modal:", JSON.stringify(cartDataToDisplay));
                openCheckoutReviewModal(cartDataToDisplay);
            } catch (error) {
                console.error("[Shipping Modal] Error in Back to Cart Review button logic:", error);
                openCheckoutReviewModal({ items: [], subtotal: 0 }); // Fallback
            }
            window.parent.postMessage({ type: 'shipping_flow_interrupted', reason: 'back_to_cart_review' }, '*');
        });
    } else {
        console.error("[Init] shippingBackBtn element NOT FOUND. Listener NOT attached.");
    }
    if (shippingContinueBtn) {
        shippingContinueBtn.addEventListener('click', async () => { // Made this function async
            console.log("[Shipping Modal] Continue to Payment button clicked. Current selection:", currentShippingSelection);
            if (!currentShippingSelection.type || (currentShippingSelection.type === 'pickup_initiated')) {
                alert("Please select a shipping option or a specific pickup location.");
                return;
            }
            // alert("Proceeding to payment is not yet implemented."); // Will be handled by opening payment modal
            await closeCheckoutShippingModal();
            openCheckoutPaymentModal();
        });
    }

    // --- Payment Modal Functions ---
    function resetPaymentModalUI() {
        if (paymentRadioSaved) paymentRadioSaved.checked = true;
        if (savedCardDetailsDiv) savedCardDetailsDiv.style.display = 'block';
        if (newCardFormDiv) {
            newCardFormDiv.style.display = 'none';
            const inputs = newCardFormDiv.querySelectorAll('input[type="text"]');
            inputs.forEach(input => input.value = '');
        }
        // Potentially disable confirm button until a valid state
        if(paymentConfirmBtn) paymentConfirmBtn.disabled = false; // Default to enabled if saved card is an option
    }

    function openCheckoutPaymentModal() {
        if (!checkoutPaymentModal) {
            console.error("Checkout payment modal element not found.");
            return;
        }
        console.log("[Payment Modal] Opening payment modal.");
        resetPaymentModalUI();
        checkoutPaymentModal.classList.remove('popping-out');
        checkoutPaymentModal.classList.add('popping-in');
        checkoutPaymentModal.style.display = 'flex';
    }

    function closeCheckoutPaymentModal() {
        return new Promise((resolve) => {
            if (!checkoutPaymentModal) {
                resolve();
                return;
            }
            checkoutPaymentModal.classList.remove('popping-in');
            checkoutPaymentModal.classList.add('popping-out');

            window.parent.postMessage({ type: 'checkout_cancelled', modalId: 'checkout-payment-modal' }, '*');
            currentShippingSelection = {};
            cachedCartDataForModals = null;
            console.log("[Checkout Payment Modal] Closed. State reset. Notified agent.");

            setTimeout(() => {
                checkoutPaymentModal.style.display = 'none';
                checkoutPaymentModal.classList.remove('popping-out');
                resolve();
            }, 300);
        });
    }

    if (closeCheckoutPaymentModalBtn) closeCheckoutPaymentModalBtn.addEventListener('click', closeCheckoutPaymentModal);

    if (paymentRadioSaved) {
        paymentRadioSaved.addEventListener('change', () => {
            if (paymentRadioSaved.checked) {
                if (savedCardDetailsDiv) savedCardDetailsDiv.style.display = 'block';
                if (newCardFormDiv) newCardFormDiv.style.display = 'none';
                if(paymentConfirmBtn) paymentConfirmBtn.disabled = false;
            }
        });
    }

    if (paymentRadioNew) {
        paymentRadioNew.addEventListener('change', () => {
            if (paymentRadioNew.checked) {
                if (savedCardDetailsDiv) savedCardDetailsDiv.style.display = 'none';
                if (newCardFormDiv) newCardFormDiv.style.display = 'block';
                // Could disable confirm button until card is "saved"
                if(paymentConfirmBtn) paymentConfirmBtn.disabled = true; 
            }
        });
    }

    if (saveCardBtn) {
        saveCardBtn.addEventListener('click', () => {
            // Simulate saving card
            const cardNumberInput = document.getElementById('card-number');
            if (cardNumberInput && cardNumberInput.value.trim() !== "") {
                alert("Card details saved (simulated). You can now confirm payment.");
                // Update saved card details display (optional, for more realism)
                // For now, just enable confirm button
                if(paymentConfirmBtn) paymentConfirmBtn.disabled = false;
                // Optionally, switch back to "Use Saved Card" view
                // if(paymentRadioSaved) paymentRadioSaved.checked = true;
                // if (savedCardDetailsDiv) savedCardDetailsDiv.style.display = 'block';
                // if (newCardFormDiv) newCardFormDiv.style.display = 'none';
            } else {
                alert("Please enter card details.");
            }
        });
    }

    if (paymentBackBtn) {
        paymentBackBtn.addEventListener('click', async () => {
            await closeCheckoutPaymentModal();
            openCheckoutShippingModal(); // Go back to shipping
        });
    }

    if (paymentConfirmBtn) {
        paymentConfirmBtn.addEventListener('click', async () => { // Make async
            console.log("[Payment Modal] Confirm Payment button clicked.");
            
            // Gather data for the order
            const customerId = DEFAULT_CUSTOMER_ID;
            const itemsToOrder = cachedCartDataForModals ? cachedCartDataForModals.items : [];
            const orderSubtotal = cachedCartDataForModals ? cachedCartDataForModals.subtotal : 0;

            // Construct shipping details from currentShippingSelection
            let shippingDetailsPayload = {
                type: currentShippingSelection.type || "N/A",
                address: "N/A",
                notes: "No specific shipping notes."
            };
            if (currentShippingSelection.type === 'home_delivery') {
                shippingDetailsPayload.address = "User's home address (placeholder)"; // Placeholder
            } else if (currentShippingSelection.type === 'pickup_address') {
                shippingDetailsPayload.address = `${currentShippingSelection.name}, ${currentShippingSelection.address}`;
            }

            const orderPayload = {
                customer_id: customerId,
                items: itemsToOrder,
                shipping_details: shippingDetailsPayload,
                total_amount: parseFloat(orderSubtotal) // Ensure it's a number
            };

            console.log("[Payment Modal] Order Payload for API:", orderPayload);

            try {
                const result = await fetchAPI('/api/checkout/place_order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(orderPayload)
                });

                if (result.status === "success") {
                    alert(`Order Submitted Successfully! Your Order ID: ${result.order_id}`);
                    await closeCheckoutPaymentModal();
                    await fetchCart(); // Refresh cart display (will be empty)
                    // Optionally, navigate to a dedicated order confirmation page or show a more persistent message
                } else {
                    alert(`Order submission failed: ${result.message || 'Unknown error'}`);
                }
            } catch (error) {
                console.error("[Payment Modal] Error submitting order:", error);
                alert(`Error submitting order: ${error.message}`);
            }
        });
    }
    
    console.log("[Main Page] Script loaded.");
});
