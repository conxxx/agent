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
    const cartSidebarCheckoutBtn = document.getElementById('cart-sidebar-checkout-btn');
    
    console.log("[Cart Init] Sidebar cart elements:", { leftSidebarCart, cartSidebarToggleBtn, cartSidebarItemsContainer, cartSidebarSubtotalEl, cartSidebarItemCountEl, clearCartSidebarBtn, cartSidebarCheckoutBtn });

    // Checkout Modal (Sidebar) DOM Elements
    const checkoutModalPh1 = document.getElementById('checkout-modal-ph1');
    const checkoutModalTitlePh1 = document.getElementById('checkout-modal-title-ph1');
    const checkoutModalBodyPh1 = document.getElementById('checkout-modal-body-ph1');
    const closeCheckoutModalBtnPh1 = document.getElementById('checkout-modal-close-ph1'); 
    const cancelCheckoutBtnPh1 = document.getElementById('checkout-cancel-btn-ph1'); 
    const backCheckoutBtnPh1 = document.getElementById('checkout-back-btn-ph1');     
    const nextCheckoutBtnPh1 = document.getElementById('checkout-next-btn-ph1');     

    const DEFAULT_CUSTOMER_ID = "123";
    if(currentCustomerIdSpan) currentCustomerIdSpan.textContent = DEFAULT_CUSTOMER_ID;

    let localProductCache = {};
    let currentCartItemsData = []; 
    let currentCartItemIds = []; 

    let checkoutProcessState = {
        currentStep: null, 
        selectedItems: [], 
        shippingInfo: {
            method: null, 
            address: { name: '', street: '', city: '', postalCode: '', country: '' },
            pickupLocation: null,
            previousPickupLocations: [] 
        },
        paymentInfo: {
            method: null, 
            savedCardId: null, 
            newCardDetails: { cardNumber: '', expiryDate: '', cvv: '', cardholderName: '' },
            previousPaymentMethods: []
        },
        orderTotal: 0
    };
    console.log("[Checkout] Initial checkoutProcessState:", JSON.parse(JSON.stringify(checkoutProcessState)));

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
        } catch (error) {
            console.error("[Cart] Error fetching cart:", error);
            if(cartSidebarItemsContainer) cartSidebarItemsContainer.innerHTML = '<p>Error loading cart. Please try again.</p>';
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
        console.log(`[Product Card Add] Adding product ${productId} to cart. NO ANIMATION from product card click.`);
        // Animation logic for product card clicks is REMOVED as per plan.
        // The 'event' parameter is kept for now, but its usage for animation is removed.

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
        const imageUrl = product.image_url ? `/${product.image_url}` : 'https://via.placeholder.com/150?text=No+Image';
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
        } else {
            console.log("[Main Page] Received message not handled by current logic:", event.data);
        }
    });

    function handleDisplayUiComponent(uiElement, payload) { // uiElement here is actually command_name
        console.log(`[Checkout] handleDisplayUiComponent called with command_name (as uiElement): ${uiElement}, payload:`, payload);
        showCheckoutModalPh1(); 

        switch (uiElement) { // uiElement here is actually command_name
            case "checkout_item_selection":
                renderCheckoutStep1ItemSelection(payload && payload.items ? payload.items : currentCartItemsData);
                break;
            case "shipping_options":
                renderShippingStep();
                break;
            case "pickup_locations":
                checkoutProcessState.shippingInfo.previousPickupLocations = payload && payload.locations ? payload.locations : [];
                renderPickupLocationsStep(checkoutProcessState.shippingInfo.previousPickupLocations);
                break;
            case "payment_methods":
                checkoutProcessState.paymentInfo.previousPaymentMethods = payload && payload.methods ? payload.methods : [];
                renderPaymentStep(checkoutProcessState.paymentInfo.previousPaymentMethods);
                break;
            case "order_confirmation":
                const orderId = payload && payload.details && payload.details.orderId ? payload.details.orderId : (payload && payload.details ? JSON.stringify(payload.details) : "N/A");
                renderOrderConfirmationStep(orderId);
                break;
            default:
                console.error(`[Checkout] Unknown uiElement received: ${uiElement}`);
                if (checkoutModalBodyPh1) {
                    checkoutModalBodyPh1.innerHTML = `<p>Error: Received an unknown UI component name: ${uiElement}.</p>`;
                }
        }
    }
    
    // --- Checkout Sidebar Logic (triggered from new sidebar checkout button) ---
    if(cartSidebarCheckoutBtn) {
        console.log("[Cart Init] Adding click listener to sidebar checkout button.");
        cartSidebarCheckoutBtn.addEventListener('click', () => {
            console.log("[Cart Sidebar] Checkout button clicked, initiating checkout flow.");
            // Reset checkout state (same as before, just ensuring it's logged for the new button)
            checkoutProcessState = {
                currentStep: 'items', selectedItems: [],
                shippingInfo: { method: null, address: { name: '', street: '', city: '', postalCode: '', country: '' }, pickupLocation: null, previousPickupLocations: [] },
                paymentInfo: { method: null, savedCardId: null, newCardDetails: { cardNumber: '', expiryDate: '', cvv: '', cardholderName: '' }, previousPaymentMethods: [] },
                orderTotal: 0
            };
            console.log("[Checkout] State initialized for new checkout flow from sidebar:", JSON.parse(JSON.stringify(checkoutProcessState)));
            showCheckoutModalPh1(); // This is the existing checkout modal, not a new sidebar for checkout
            renderCheckoutStep1ItemSelection();
        });
    } else {
        console.warn("[Cart Init] Sidebar checkout button not found.");
    }

    function showCheckoutModalPh1() {
        if (!checkoutModalPh1) {
            console.error("[Checkout] Checkout modal element 'checkout-modal-ph1' not found.");
            return;
        }
        console.log("[Checkout] Showing modal with pop-in animation.");
        checkoutModalPh1.classList.remove('popping-out'); // Remove pop-out if it was there
        checkoutModalPh1.classList.add('popping-in');
        checkoutModalPh1.style.display = 'flex'; // Set display to flex to make it visible for animation

        // Optional: Remove 'popping-in' after animation to prevent re-triggering if called again
        // However, 'animation-fill-mode: forwards' handles keeping the final state.
        // If issues arise, an event listener for 'animationend' can remove 'popping-in'.
    }

    function hideCheckoutModalPh1() {
        if (!checkoutModalPh1) {
            console.error("[Checkout] Checkout modal element 'checkout-modal-ph1' not found for hiding.");
            return;
        }
        console.log("[Checkout] Hiding modal with pop-out animation.");
        checkoutModalPh1.classList.remove('popping-in'); // Remove pop-in if it was there
        checkoutModalPh1.classList.add('popping-out');

        // Listen for animation end to set display: none
        checkoutModalPh1.addEventListener('animationend', function handleAnimationEnd() {
            console.log("[Checkout] Pop-out animation ended. Setting display to none.");
            checkoutModalPh1.style.display = 'none';
            checkoutModalPh1.classList.remove('popping-out'); // Clean up class
            
            // Clean up modal content and state after it's hidden
            if (checkoutModalBodyPh1) checkoutModalBodyPh1.innerHTML = ''; 
            if(checkoutModalTitlePh1) checkoutModalTitlePh1.textContent = 'Checkout'; 
            checkoutProcessState = { 
                currentStep: null, selectedItems: [],
                shippingInfo: { method: null, address: { name: '', street: '', city: '', postalCode: '', country: '' }, pickupLocation: null, previousPickupLocations: [] },
                paymentInfo: { method: null, savedCardId: null, newCardDetails: { cardNumber: '', expiryDate: '', cvv: '', cardholderName: '' }, previousPaymentMethods: [] },
                orderTotal: 0 
            };
            if(nextCheckoutBtnPh1) { nextCheckoutBtnPh1.onclick = null; nextCheckoutBtnPh1.textContent = 'Next'; nextCheckoutBtnPh1.disabled = false; nextCheckoutBtnPh1.style.display = 'inline-block';}
            if(backCheckoutBtnPh1) { backCheckoutBtnPh1.onclick = null; backCheckoutBtnPh1.style.display = 'none'; }
            // Restore cancel button's original purpose if it was changed (e.g. in confirmation step)
            if(cancelCheckoutBtnPh1) { cancelCheckoutBtnPh1.textContent = 'Cancel'; cancelCheckoutBtnPh1.onclick = hideCheckoutModalPh1; }


            checkoutModalPh1.removeEventListener('animationend', handleAnimationEnd); // Clean up listener
        }, { once: true }); // Ensure the listener runs only once
    }

    // Original content reset logic, now moved into the animationend handler for hideCheckoutModalPh1
    /*
    function hideCheckoutModalPh1_OLD_CONTENT_RESET_LOGIC() {
        // if (checkoutModalPh1) checkoutModalPh1.style.display = 'none'; // This is now handled by animationend
        // if (checkoutModalBodyPh1) checkoutModalBodyPh1.innerHTML = ''; 
        // if(checkoutModalTitlePh1) checkoutModalTitlePh1.textContent = 'Checkout'; 
        // checkoutProcessState = { 
        //     currentStep: null, selectedItems: [],
        //     shippingInfo: { method: null, address: { name: '', street: '', city: '', postalCode: '', country: '' }, pickupLocation: null, previousPickupLocations: [] },
        //     paymentInfo: { method: null, savedCardId: null, newCardDetails: { cardNumber: '', expiryDate: '', cvv: '', cardholderName: '' }, previousPaymentMethods: [] },
        //     orderTotal: 0 
        // };
        // if(nextCheckoutBtnPh1) { nextCheckoutBtnPh1.onclick = null; nextCheckoutBtnPh1.textContent = 'Next'; nextCheckoutBtnPh1.disabled = false; }
        // if(backCheckoutBtnPh1) { backCheckoutBtnPh1.onclick = null; backCheckoutBtnPh1.style.display = 'none'; }
        // if(cancelCheckoutBtnPh1) { cancelCheckoutBtnPh1.onclick = hideCheckoutModalPh1; cancelCheckoutBtnPh1.textContent = 'Cancel';}
    }
    */

    if (closeCheckoutModalBtnPh1) closeCheckoutModalBtnPh1.addEventListener('click', hideCheckoutModalPh1);
    // Cancel button's initial behavior is to hide. It might be changed by renderOrderConfirmationStep.
    if (cancelCheckoutBtnPh1) cancelCheckoutBtnPh1.addEventListener('click', hideCheckoutModalPh1); 


    function renderCheckoutStep1ItemSelection(itemsToShow) {
        checkoutProcessState.currentStep = 'items';
        const itemsToDisplay = (itemsToShow && itemsToShow.length > 0) ? itemsToShow : currentCartItemsData;
        console.log("[Checkout] Step 1: Item Selection. Items:", itemsToDisplay);

        if (!checkoutModalBodyPh1 || !checkoutModalTitlePh1) return;
        checkoutModalTitlePh1.textContent = 'Step 1: Review Your Items';
        
        if (!itemsToDisplay || itemsToDisplay.length === 0) {
            checkoutModalBodyPh1.innerHTML = '<p>Your cart is empty. Please add items to proceed.</p>';
            if(nextCheckoutBtnPh1) nextCheckoutBtnPh1.disabled = true;
            checkoutProcessState.selectedItems = []; 
        } else {
            let itemsHtml = '<h3>Review Your Items</h3><ul class="checkout-item-list">';
            itemsToDisplay.forEach(item => {
                const itemName = item.name || (localProductCache[item.product_id]?.name || `Product ID: ${item.product_id}`);
                const pricePerUnit = item.price_per_unit || (localProductCache[item.product_id]?.price || 0);
                itemsHtml += `
                    <li class="checkout-item" data-product-id="${item.product_id}">
                        <span class="item-name">${itemName}</span>
                        <span class="item-quantity">Qty: ${item.quantity}</span>
                        <span class="item-price">$${(pricePerUnit * item.quantity).toFixed(2)}</span>
                    </li>`;
            });
            itemsHtml += '</ul>';
            const subtotal = itemsToDisplay.reduce((sum, item) => sum + ((item.price_per_unit || (localProductCache[item.product_id]?.price || 0)) * item.quantity), 0);
            itemsHtml += `<p class="checkout-subtotal">Subtotal: $${subtotal.toFixed(2)}</p>`;
            checkoutModalBodyPh1.innerHTML = itemsHtml;
            if(nextCheckoutBtnPh1) nextCheckoutBtnPh1.disabled = false;
            checkoutProcessState.selectedItems = JSON.parse(JSON.stringify(itemsToDisplay.map(item => ({
                ...item, price_per_unit: item.price_per_unit || (localProductCache[item.product_id]?.price || 0)
            }))));
        }

        if (nextCheckoutBtnPh1) {
            nextCheckoutBtnPh1.textContent = 'Next: Shipping';
            nextCheckoutBtnPh1.onclick = () => renderShippingStep();
        }
        if (backCheckoutBtnPh1) backCheckoutBtnPh1.style.display = 'none';
        if (cancelCheckoutBtnPh1) cancelCheckoutBtnPh1.onclick = hideCheckoutModalPh1;
    }

    function renderShippingStep() {
        checkoutProcessState.currentStep = 'shipping';
        console.log("[Checkout] Step 2: Shipping Options. State:", checkoutProcessState.shippingInfo);

        if (!checkoutModalBodyPh1 || !checkoutModalTitlePh1) return;
        checkoutModalTitlePh1.textContent = 'Step 2: Shipping Options';

        const shipInfo = checkoutProcessState.shippingInfo;
        const addr = shipInfo.address;
        const hasPreviousPickupLocations = shipInfo.previousPickupLocations && shipInfo.previousPickupLocations.length > 0;

        let shippingHtml = `
            <h3>Shipping Method</h3>
            <div class="shipping-method-options">
                <label><input type="radio" name="shippingMethod" value="home" ${shipInfo.method === 'home' ? 'checked' : ''}> Home Delivery</label>
                <label><input type="radio" name="shippingMethod" value="pickup" ${shipInfo.method === 'pickup' ? 'checked' : ''}> Store Pick-up</label>
            </div>
            <div id="home-delivery-details" style="display: ${shipInfo.method === 'home' ? 'block' : 'none'};">
                <h4>Home Delivery Address</h4>
                <label for="shipping-name">Full Name:</label><input type="text" id="shipping-name" value="${addr.name || ''}">
                <label for="shipping-street">Street:</label><input type="text" id="shipping-street" value="${addr.street || ''}">
                <label for="shipping-city">City:</label><input type="text" id="shipping-city" value="${addr.city || ''}">
                <label for="shipping-postalCode">Postal Code:</label><input type="text" id="shipping-postalCode" value="${addr.postalCode || ''}">
                <label for="shipping-country">Country:</label><input type="text" id="shipping-country" value="${addr.country || ''}">
            </div>`;
        
        if (shipInfo.method === 'pickup' && hasPreviousPickupLocations) {
            shippingHtml += `<div id="pickup-location-details-container" style="display: block;"><h4>Select Pick-up Location</h4>`;
            shipInfo.previousPickupLocations.forEach(loc => {
                shippingHtml += `<label><input type="radio" name="pickupLocationOption" value="${loc}" ${shipInfo.pickupLocation === loc ? 'checked' : ''}> ${loc}</label><br>`;
            });
            shippingHtml += `</div>`;
        } else {
            shippingHtml += `<div id="pickup-location-details-container" style="display: none;"></div>`; // Empty placeholder
        }
        
        shippingHtml += `<div id="pickup-message-placeholder" style="display: ${shipInfo.method === 'pickup' && !hasPreviousPickupLocations ? 'block' : 'none'};">
                            <p>Agent will provide pickup locations if this option is chosen.</p>
                         </div>`;
        checkoutModalBodyPh1.innerHTML = shippingHtml;

        const homeDeliveryDiv = checkoutModalBodyPh1.querySelector('#home-delivery-details');
        let pickupLocationsDiv = checkoutModalBodyPh1.querySelector('#pickup-location-details-container');
        const pickupPlaceholderDiv = checkoutModalBodyPh1.querySelector('#pickup-message-placeholder');

        // Function to clear selection animation from other options
        function clearSelectionAnimation(selector) {
            checkoutModalBodyPh1.querySelectorAll(selector).forEach(el => {
                const parentLabel = el.closest('label');
                if (parentLabel) {
                    parentLabel.classList.remove('option-selected-visual-cue');
                }
            });
        }

        checkoutModalBodyPh1.querySelectorAll('input[name="shippingMethod"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                clearSelectionAnimation('input[name="shippingMethod"]');
                clearSelectionAnimation('input[name="pickupLocationOption"]'); // Also clear pickup if method changes
                const parentLabel = e.target.closest('label');
                if (parentLabel) {
                    parentLabel.classList.add('option-selected-visual-cue');
                }

                shipInfo.method = e.target.value;
                homeDeliveryDiv.style.display = shipInfo.method === 'home' ? 'block' : 'none';
                
                if (shipInfo.method === 'pickup') {
                    if (hasPreviousPickupLocations) {
                        pickupLocationsDiv.style.display = 'block';
                        pickupPlaceholderDiv.style.display = 'none';
                        // If there are previous locations, a selection is needed.
                        // Check if one is already selected from checkoutProcessState
                        const currentlySelectedPickup = checkoutModalBodyPh1.querySelector('input[name="pickupLocationOption"]:checked');
                        if (currentlySelectedPickup) {
                            currentlySelectedPickup.closest('label').classList.add('option-selected-visual-cue');
                        }
                    } else {
                        pickupLocationsDiv.style.display = 'none';
                        pickupPlaceholderDiv.style.display = 'block';
                    }
                } else {
                    pickupLocationsDiv.style.display = 'none';
                    pickupPlaceholderDiv.style.display = 'none';
                }
                if (shipInfo.method === 'home') shipInfo.pickupLocation = null; else Object.keys(addr).forEach(k => addr[k] = '');
                nextCheckoutBtnPh1.disabled = !(shipInfo.method === 'home' || (shipInfo.method === 'pickup' && (shipInfo.pickupLocation || !hasPreviousPickupLocations)));
            });
            // Apply initial selection glow if a method is already selected
            if (radio.checked) {
                const parentLabel = radio.closest('label');
                if (parentLabel) parentLabel.classList.add('option-selected-visual-cue');
            }
        });
        ['name', 'street', 'city', 'postalCode', 'country'].forEach(id => {
            checkoutModalBodyPh1.querySelector(`#shipping-${id}`)?.addEventListener('input', e => { addr[id] = e.target.value; });
        });
        checkoutModalBodyPh1.querySelectorAll('input[name="pickupLocationOption"]')?.forEach(radio => {
            radio.addEventListener('change', e => {
                clearSelectionAnimation('input[name="pickupLocationOption"]');
                const parentLabel = e.target.closest('label');
                if (parentLabel) {
                    parentLabel.classList.add('option-selected-visual-cue');
                }
                shipInfo.pickupLocation = e.target.value;
                nextCheckoutBtnPh1.disabled = false;
            });
             // Apply initial selection glow if a pickup location is already selected
            if (radio.checked) {
                const parentLabel = radio.closest('label');
                if (parentLabel) parentLabel.classList.add('option-selected-visual-cue');
            }
        });
        
        if(nextCheckoutBtnPh1) {
            nextCheckoutBtnPh1.textContent = 'Next';
            nextCheckoutBtnPh1.disabled = !(shipInfo.method === 'home' || (shipInfo.method === 'pickup' && (shipInfo.pickupLocation || !hasPreviousPickupLocations)));
            nextCheckoutBtnPh1.onclick = () => {
                if (shipInfo.method === 'home') {
                    if (Object.values(addr).some(v => !v.trim())) { alert("Please fill all address fields."); return; }
                    renderPaymentStep();
                } else if (shipInfo.method === 'pickup') {
                    if (hasPreviousPickupLocations && !shipInfo.pickupLocation) { alert("Please select a pickup location."); return; }
                    if (shipInfo.pickupLocation || !hasPreviousPickupLocations) renderPaymentStep();
                    else alert("Waiting for agent to provide pickup locations.");
                } else {
                    alert("Please select a shipping method.");
                }
            };
        }
        if(backCheckoutBtnPh1) {
            backCheckoutBtnPh1.style.display = 'inline-block';
            backCheckoutBtnPh1.textContent = 'Back: Items';
            backCheckoutBtnPh1.onclick = () => renderCheckoutStep1ItemSelection(checkoutProcessState.selectedItems);
        }
        if (cancelCheckoutBtnPh1) cancelCheckoutBtnPh1.onclick = hideCheckoutModalPh1;
    }

    function renderPickupLocationsStep(locations = []) {
        checkoutProcessState.currentStep = 'pickup_location';
        checkoutProcessState.shippingInfo.method = 'pickup'; 
        console.log("[Checkout] Step 2b: Pick-up Locations. Locations:", locations);

        if (!checkoutModalBodyPh1 || !checkoutModalTitlePh1) return;
        checkoutModalTitlePh1.textContent = 'Step 2b: Select Pick-up Location';
        checkoutProcessState.shippingInfo.previousPickupLocations = locations;

        let pickupHtml = `<h3>Select Pick-up Location</h3>`;
        if (!locations || locations.length === 0) {
            pickupHtml += `<p>No pick-up locations available. Please select home delivery or ask the agent for help.</p>`;
            if(nextCheckoutBtnPh1) nextCheckoutBtnPh1.disabled = true;
        } else {
            pickupHtml += `<div id="pickup-location-options">`;
            locations.forEach(loc => {
                const isChecked = checkoutProcessState.shippingInfo.pickupLocation === loc;
                pickupHtml += `<label><input type="radio" name="pickupLocationOption" value="${loc}" ${isChecked ? 'checked' : ''}> ${loc}</label><br>`;
            });
            pickupHtml += `</div>`;
            if(nextCheckoutBtnPh1) nextCheckoutBtnPh1.disabled = !checkoutProcessState.shippingInfo.pickupLocation;
        }
        checkoutModalBodyPh1.innerHTML = pickupHtml;

        // Function to clear selection animation from other options
        function clearPickupSelectionAnimation() {
            checkoutModalBodyPh1.querySelectorAll('input[name="pickupLocationOption"]').forEach(el => {
                const parentLabel = el.closest('label');
                if (parentLabel) {
                    parentLabel.classList.remove('option-selected-visual-cue');
                }
            });
        }

        checkoutModalBodyPh1.querySelectorAll('input[name="pickupLocationOption"]').forEach(radio => {
            radio.addEventListener('change', e => { 
                clearPickupSelectionAnimation();
                const parentLabel = e.target.closest('label');
                if (parentLabel) {
                    parentLabel.classList.add('option-selected-visual-cue');
                }
                checkoutProcessState.shippingInfo.pickupLocation = e.target.value; 
                if(nextCheckoutBtnPh1) nextCheckoutBtnPh1.disabled = false;
            });
            // Apply initial selection glow if a location is already selected
            if (radio.checked) {
                const parentLabel = radio.closest('label');
                if (parentLabel) parentLabel.classList.add('option-selected-visual-cue');
            }
        });

        if(nextCheckoutBtnPh1) {
            nextCheckoutBtnPh1.textContent = 'Next: Payment';
            nextCheckoutBtnPh1.onclick = () => {
                if (!checkoutProcessState.shippingInfo.pickupLocation) { alert("Please select a pick-up location."); return; }
                renderPaymentStep();
            };
        }
        if(backCheckoutBtnPh1) {
            backCheckoutBtnPh1.style.display = 'inline-block';
            backCheckoutBtnPh1.textContent = 'Back: Shipping Method';
            backCheckoutBtnPh1.onclick = () => renderShippingStep();
        }
        if (cancelCheckoutBtnPh1) cancelCheckoutBtnPh1.onclick = hideCheckoutModalPh1;
    }

    function renderPaymentStep(paymentMethodsPayload) { 
        checkoutProcessState.currentStep = 'payment';
        console.log("[Checkout] Step 3: Payment Info. Payload:", paymentMethodsPayload, "State:", checkoutProcessState.paymentInfo);
        
        if (!checkoutProcessState.paymentInfo) { 
            checkoutProcessState.paymentInfo = { method: null, savedCardId: null, newCardDetails: { cardNumber: '', expiryDate: '', cvv: '', cardholderName: '' }, previousPaymentMethods: [] };
        }
        if (paymentMethodsPayload) checkoutProcessState.paymentInfo.previousPaymentMethods = paymentMethodsPayload;

        if (!checkoutModalBodyPh1 || !checkoutModalTitlePh1) return;
        checkoutModalTitlePh1.textContent = 'Step 3: Payment Information';

        const payInfo = checkoutProcessState.paymentInfo;
        const newCard = payInfo.newCardDetails;
        
        let paymentHtml = `
            <h3>Payment Method</h3>
            <div class="payment-method-options">
                <label><input type="radio" name="paymentMethod" value="savedCard" ${payInfo.method === 'savedCard' ? 'checked' : ''}> Use Saved Card</label>
                <label><input type="radio" name="paymentMethod" value="newCard" ${payInfo.method === 'newCard' ? 'checked' : ''}> Add New Card</label>
            </div>
            <div id="saved-card-details" style="display: ${payInfo.method === 'savedCard' ? 'block' : 'none'};">
                <h4>Select Saved Card</h4>
                <label><input type="radio" name="savedCardOption" value="visa-1234" ${payInfo.savedCardId === 'visa-1234' ? 'checked' : ''}> Visa ****1234</label><br>
                <label><input type="radio" name="savedCardOption" value="mastercard-5678" ${payInfo.savedCardId === 'mastercard-5678' ? 'checked' : ''}> Mastercard ****5678</label>
            </div>
            <div id="new-card-details" style="display: ${payInfo.method === 'newCard' ? 'block' : 'none'};">
                <h4>New Card Details</h4>
                <label for="card-number">Card Number:</label><input type="text" id="card-number" value="${newCard.cardNumber || ''}">
                <label for="card-expiry">Expiry (MM/YY):</label><input type="text" id="card-expiry" value="${newCard.expiryDate || ''}">
                <label for="card-cvv">CVV:</label><input type="text" id="card-cvv" value="${newCard.cvv || ''}">
                <label for="cardholder-name">Name:</label><input type="text" id="cardholder-name" value="${newCard.cardholderName || ''}">
            </div>`;
        checkoutModalBodyPh1.innerHTML = paymentHtml;

        const savedCardDiv = checkoutModalBodyPh1.querySelector('#saved-card-details');
        const newCardDiv = checkoutModalBodyPh1.querySelector('#new-card-details');

        // Function to clear selection animation from other options
        function clearPaymentSelectionAnimation(selector) {
            checkoutModalBodyPh1.querySelectorAll(selector).forEach(el => {
                const parentLabel = el.closest('label');
                if (parentLabel) {
                    parentLabel.classList.remove('option-selected-visual-cue');
                }
            });
        }

        checkoutModalBodyPh1.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
            radio.addEventListener('change', e => {
                clearPaymentSelectionAnimation('input[name="paymentMethod"]');
                clearPaymentSelectionAnimation('input[name="savedCardOption"]'); // Also clear saved card if method changes

                const parentLabel = e.target.closest('label');
                if (parentLabel) {
                    parentLabel.classList.add('option-selected-visual-cue');
                }

                payInfo.method = e.target.value;
                savedCardDiv.style.display = payInfo.method === 'savedCard' ? 'block' : 'none';
                newCardDiv.style.display = payInfo.method === 'newCard' ? 'block' : 'none';
                if (payInfo.method === 'savedCard') {
                    Object.keys(newCard).forEach(k => newCard[k] = '');
                    // Check if a saved card is already selected to apply glow
                    const currentlySelectedSavedCard = checkoutModalBodyPh1.querySelector('input[name="savedCardOption"]:checked');
                    if (currentlySelectedSavedCard) {
                        currentlySelectedSavedCard.closest('label').classList.add('option-selected-visual-cue');
                    }
                } else {
                    payInfo.savedCardId = null;
                }
                nextCheckoutBtnPh1.disabled = !(payInfo.method === 'newCard' || (payInfo.method === 'savedCard' && payInfo.savedCardId));
            });
            // Apply initial selection glow if a payment method is already selected
            if (radio.checked) {
                const parentLabel = radio.closest('label');
                if (parentLabel) parentLabel.classList.add('option-selected-visual-cue');
            }
        });
        checkoutModalBodyPh1.querySelectorAll('input[name="savedCardOption"]')?.forEach(radio => {
            radio.addEventListener('change', e => { 
                clearPaymentSelectionAnimation('input[name="savedCardOption"]');
                const parentLabel = e.target.closest('label');
                if (parentLabel) {
                    parentLabel.classList.add('option-selected-visual-cue');
                }

                payInfo.savedCardId = e.target.value; 
                nextCheckoutBtnPh1.disabled = false; 
                console.log('[Checkout] Dispatching checkoutPaymentSelected event (savedCard): ', payInfo.savedCardId);
                document.dispatchEvent(new CustomEvent('checkoutPaymentSelected', {
                    detail: { // Corrected: payload is in event.detail
                        method: "savedCard",
                        id: payInfo.savedCardId,
                        display_name: e.target.parentElement.textContent.trim()
                    }
                }));
            });
            // Apply initial selection glow if a saved card is already selected
            if (radio.checked) {
                const parentLabel = radio.closest('label');
                if (parentLabel) parentLabel.classList.add('option-selected-visual-cue');
            }
        });
        ['cardNumber', 'expiryDate', 'cvv', 'cardholderName'].forEach(id => {
            const inputId = id === 'cardNumber' ? 'card-number' : id === 'expiryDate' ? 'card-expiry' : id === 'cardholderName' ? 'cardholder-name' : `card-${id}`;
            checkoutModalBodyPh1.querySelector(`#${inputId}`)?.addEventListener('input', e => { newCard[id] = e.target.value; });
        });
        
        if(nextCheckoutBtnPh1) {
            nextCheckoutBtnPh1.textContent = 'Next: Review Order';
            nextCheckoutBtnPh1.disabled = !(payInfo.method === 'newCard' || (payInfo.method === 'savedCard' && payInfo.savedCardId));
            nextCheckoutBtnPh1.onclick = () => {
                if (payInfo.method === 'newCard') {
                    // Validations for new card
                    if (Object.values(newCard).some(v => !v.trim())) { alert("Please fill all card details."); return; }
                    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(newCard.expiryDate.trim())) { alert("Please enter expiry date in MM/YY format."); return; }
                    
                    console.log('[Checkout] Dispatching checkoutPaymentSelected event (newCard).');
                    document.dispatchEvent(new CustomEvent('checkoutPaymentSelected', {
                        detail: { // Corrected: payload is in event.detail
                            method: "newCard",
                            status: "filled_and_validated"
                        }
                    }));
                    renderOrderReviewStep(); // Proceed to next step
                } else if (payInfo.method === 'savedCard' && payInfo.savedCardId) {
                    // For saved card, event was already dispatched on selection. Just proceed.
                    renderOrderReviewStep();
                } else {
                    // If no valid method is selected (should be caught by button disable logic, but as a fallback)
                    alert("Please select a payment option.");
                }
            };
        }
        if(backCheckoutBtnPh1) {
            backCheckoutBtnPh1.style.display = 'inline-block';
            backCheckoutBtnPh1.textContent = 'Back: Shipping';
            backCheckoutBtnPh1.onclick = () => {
                if (checkoutProcessState.shippingInfo.method === 'pickup') {
                     renderPickupLocationsStep(checkoutProcessState.shippingInfo.previousPickupLocations || []);
                } else { 
                    renderShippingStep();
                }
            };
        }
        if (cancelCheckoutBtnPh1) cancelCheckoutBtnPh1.onclick = hideCheckoutModalPh1;
    }

    function renderOrderReviewStep() {
        checkoutProcessState.currentStep = 'review';
        console.log("[Checkout] Step 4: Order Review. State:", checkoutProcessState);

        if (!checkoutModalBodyPh1 || !checkoutModalTitlePh1) return;
        checkoutModalTitlePh1.textContent = 'Step 4: Order Review & Submit';

        const { selectedItems, shippingInfo, paymentInfo } = checkoutProcessState;
        let reviewHtml = '<h3>Order Summary</h3><h4>Items:</h4><ul class="checkout-item-list">';
        let subtotal = 0;
        selectedItems.forEach(item => {
            const itemPrice = item.price_per_unit || (localProductCache[item.product_id]?.price || 0);
            const itemQuantity = item.quantity || 0;
            const itemTotal = itemPrice * itemQuantity;
            subtotal += itemTotal;
            reviewHtml += `<li class="checkout-item"><span class="item-name">${item.name || `ID: ${item.product_id}`} (Qty: ${itemQuantity})</span><span class="item-price">$${itemTotal.toFixed(2)}</span></li>`;
        });
        reviewHtml += `</ul><p class="checkout-subtotal"><strong>Subtotal: $${subtotal.toFixed(2)}</strong></p><h4>Shipping:</h4>`;
        if (shippingInfo.method === 'home') {
            reviewHtml += `<p>Home Delivery: ${shippingInfo.address.name}, ${shippingInfo.address.street}, ${shippingInfo.address.city}, ${shippingInfo.address.postalCode}, ${shippingInfo.address.country}</p>`;
        } else if (shippingInfo.method === 'pickup') {
            reviewHtml += `<p>Pick-up at: ${shippingInfo.pickupLocation}</p>`;
        }
        reviewHtml += `<h4>Payment:</h4>`;
        if (paymentInfo.method === 'savedCard') reviewHtml += `<p>Saved Card: ${paymentInfo.savedCardId.includes('visa') ? 'Visa ****1234' : 'Mastercard ****5678'}</p>`;
        else if (paymentInfo.method === 'newCard') reviewHtml += `<p>New Card: **** **** **** ${paymentInfo.newCardDetails.cardNumber.slice(-4)}</p>`;
        
        checkoutProcessState.orderTotal = subtotal;
        reviewHtml += `<h4 class="checkout-total-amount">Total: $${checkoutProcessState.orderTotal.toFixed(2)}</h4>`;
        checkoutModalBodyPh1.innerHTML = reviewHtml;

        if(nextCheckoutBtnPh1) {
            nextCheckoutBtnPh1.textContent = 'Submit Order';
            nextCheckoutBtnPh1.disabled = false;
            nextCheckoutBtnPh1.style.display = 'inline-block'; // Ensure it's visible
            nextCheckoutBtnPh1.onclick = handleOrderSubmission;
        }
        if(backCheckoutBtnPh1) {
            backCheckoutBtnPh1.style.display = 'inline-block';
            backCheckoutBtnPh1.textContent = 'Back: Payment';
            backCheckoutBtnPh1.onclick = () => renderPaymentStep(checkoutProcessState.paymentInfo.previousPaymentMethods);
        }
        // cancelCheckoutBtnPh1.onclick is managed by hideCheckoutModalPh1 or confirmation step
    }

    async function handleOrderSubmission() {
        console.log("[Checkout][Submission] Submitting order. State:", checkoutProcessState);
        const { selectedItems, shippingInfo, paymentInfo, orderTotal } = checkoutProcessState;
        let apiShipping = { method: shippingInfo.method };
        if (shippingInfo.method === 'home') apiShipping.address = { ...shippingInfo.address, postal_code: shippingInfo.address.postalCode };
        else apiShipping.pickup_location_id = shippingInfo.pickupLocation;
        
        let apiPayment = { method: paymentInfo.method };
        if (paymentInfo.method === 'newCard') apiPayment.card_info_last4 = paymentInfo.newCardDetails.cardNumber.slice(-4);
        else if (paymentInfo.method === 'savedCard') {
            apiPayment.saved_card_id = paymentInfo.savedCardId;
            if(paymentInfo.savedCardId) apiPayment.card_info_last4 = paymentInfo.savedCardId.split('-').pop();
        }

        const orderPayload = {
            customer_id: DEFAULT_CUSTOMER_ID,
            items: selectedItems.map(item => ({ product_id: item.product_id, quantity: item.quantity, price_per_unit: item.price_per_unit || 0 })),
            shipping_details: apiShipping, payment_details: apiPayment, total_amount: orderTotal
        };
        try {
            const response = await fetchAPI('/api/orders/place_order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(orderPayload) });
            renderOrderConfirmationStep(response.order_id || response.orderId || "N/A");
            await clearCart();
        } catch (error) {
            if (checkoutModalBodyPh1) checkoutModalBodyPh1.innerHTML += `<p style="color:red;">Error: ${error.message}</p>`;
            if(nextCheckoutBtnPh1) nextCheckoutBtnPh1.disabled = false;
        }
    }

    function renderOrderConfirmationStep(orderId) {
        checkoutProcessState.currentStep = 'confirmation';
        console.log("[Checkout][Confirmation] Order Confirmed. ID:", orderId);
        if (!checkoutModalBodyPh1 || !checkoutModalTitlePh1) return;
        checkoutModalTitlePh1.textContent = 'Order Confirmed!';
        checkoutModalBodyPh1.innerHTML = 
            `<div class="order-confirmation-content" style="text-align:center;padding:20px;">
                <h2>Thank you!</h2>
                <p>Your Order ID is: <strong>${orderId}</strong></p>
            </div>`;
        if(nextCheckoutBtnPh1) nextCheckoutBtnPh1.style.display = 'none'; // Hide Next button
        if(backCheckoutBtnPh1) backCheckoutBtnPh1.style.display = 'none'; // Hide Back button
        if(cancelCheckoutBtnPh1) { // Change Cancel to Close
            cancelCheckoutBtnPh1.textContent = 'Close';
            // Ensure this click still triggers the pop-out animation
            cancelCheckoutBtnPh1.onclick = hideCheckoutModalPh1; 
        }
    }

    // Remove or comment out the OLD checkout modal logic if it's truly not needed elsewhere
    // For example, openCheckoutModal_OLD(), closeCheckoutModal_OLD(), etc.

    console.log("[Main Page] Script loaded.");
});
