document.addEventListener('DOMContentLoaded', () => {
    const productListing = document.getElementById('product-listing');
    const nightModeToggle = document.getElementById('night-mode-toggle');
    const recommendedProductsGrid = document.getElementById('recommended-products-grid');
    const currentCustomerIdSpan = document.getElementById('current-customer-id'); 

    // Cart DOM Elements
    const cartModal = document.getElementById('cart-modal');
    const cartToggleBtn = document.getElementById('cart-toggle');
    const closeCartBtn = cartModal.querySelector('.close-button');
    const cartItemsContainer = document.getElementById('cart-items-container');
    const cartSubtotalEl = document.getElementById('cart-subtotal');
    const cartCountEl = document.getElementById('cart-count');
    const clearCartBtn = document.getElementById('clear-cart-btn');
    const cartCheckoutBtn = document.getElementById('checkout-btn');

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

    // --- Cart Modal ---
    function openCartModal() { if(cartModal) cartModal.classList.add('show'); }
    function closeCartModal() { if(cartModal) cartModal.classList.remove('show'); }
    if(cartToggleBtn) cartToggleBtn.addEventListener('click', openCartModal);
    if(closeCartBtn) closeCartBtn.addEventListener('click', closeCartModal);
    window.addEventListener('click', (event) => {
        if (event.target === cartModal) closeCartModal();
    });

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
        try {
            const data = await fetchAPI(`/api/cart/${DEFAULT_CUSTOMER_ID}`);
            currentCartItemsData = data.items || [];
            currentCartItemIds = currentCartItemsData.map(item => item.product_id);
            renderCartItems(currentCartItemsData);
            calculateSubtotal(currentCartItemsData);
            updateCartCount(currentCartItemsData);
            displayRecommendedProducts();
        } catch (error) {
            if(cartItemsContainer) cartItemsContainer.innerHTML = '<p>Error loading cart. Please try again.</p>';
        }
    }

    async function addToCart(productId) {
        try {
            await fetchAPI(`/api/cart/${DEFAULT_CUSTOMER_ID}/item`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ product_id: productId, quantity: 1 })
            });
            await fetchCart(); 
            openCartModal();
        } catch (error) { /* Handled by fetchAPI */ }
    }

    function renderCartItems(items) {
        if (!cartItemsContainer) return;
        if (!items || items.length === 0) {
            cartItemsContainer.innerHTML = '<p>Your cart is empty.</p>';
        } else {
            cartItemsContainer.innerHTML = '';
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
                cartItemsContainer.appendChild(itemEl);
            });
            cartItemsContainer.querySelectorAll('.remove-from-cart-btn').forEach(btn => {
                btn.addEventListener('click', (e) => removeProductFromCart(e.target.dataset.productId));
            });
        }
    }

    function updateCartCount(items) {
        if(!cartCountEl) return;
        cartCountEl.textContent = items.reduce((sum, item) => sum + item.quantity, 0);
    }

    function calculateSubtotal(items) {
        if(!cartSubtotalEl) return;
        cartSubtotalEl.textContent = items.reduce((sum, item) => sum + ((item.price_per_unit || 0) * item.quantity), 0).toFixed(2);
    }

    async function removeProductFromCart(productId) {
        try {
            await fetchAPI(`/api/cart/${DEFAULT_CUSTOMER_ID}/item/${productId}`, { method: 'DELETE' });
            await fetchCart();
        } catch (error) { /* Handled by fetchAPI */ }
    }

    async function clearCart() {
        try {
            await fetchAPI(`/api/cart/${DEFAULT_CUSTOMER_ID}/clear`, { method: 'DELETE' });
            await fetchCart();
        } catch (error) { console.error("[Checkout] Error during clearCart:", error); }
    }
    if(clearCartBtn) clearCartBtn.addEventListener('click', clearCart);

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
        card.querySelector('.add-to-cart-btn').addEventListener('click', (event) => addToCart(event.target.dataset.productId));
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
            console.log("[Main Page] Received REFRESH_CART_DISPLAY from widget.");
            fetchCart();
        } else if (event.data.type === "display_ui_component" && event.data.ui_element) {
            console.log(`[Main Page] Received 'display_ui_component' for element: ${event.data.ui_element}`, "Payload:", event.data.payload);
            handleDisplayUiComponent(event.data.ui_element, event.data.payload);
        } else {
            console.log("[Main Page] Received message not handled by current logic:", event.data);
        }
    });

    function handleDisplayUiComponent(uiElement, payload) {
        console.log(`[Checkout] handleDisplayUiComponent called with uiElement: ${uiElement}, payload:`, payload);
        showCheckoutModalPh1(); 

        switch (uiElement) {
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
    
    // --- Checkout Sidebar Logic ---
    if(cartCheckoutBtn) {
        // cartCheckoutBtn.removeEventListener('click', openCheckoutModal_OLD); // Not needed if openCheckoutModal_OLD is fully removed
        cartCheckoutBtn.addEventListener('click', () => {
            console.log("[Cart] Main checkout button clicked, initiating checkout flow.");
            checkoutProcessState = {
                currentStep: 'items', selectedItems: [],
                shippingInfo: { method: null, address: { name: '', street: '', city: '', postalCode: '', country: '' }, pickupLocation: null, previousPickupLocations: [] },
                paymentInfo: { method: null, savedCardId: null, newCardDetails: { cardNumber: '', expiryDate: '', cvv: '', cardholderName: '' }, previousPaymentMethods: [] },
                orderTotal: 0
            };
            console.log("[Checkout] State initialized for new user-initiated checkout flow:", JSON.parse(JSON.stringify(checkoutProcessState)));
            showCheckoutModalPh1(); 
            renderCheckoutStep1ItemSelection(); 
        });
    }

    function showCheckoutModalPh1() {
        if (checkoutModalPh1) checkoutModalPh1.style.display = 'flex';
        else console.error("[Checkout] Checkout modal element 'checkout-modal-ph1' not found.");
    }

    function hideCheckoutModalPh1() {
        if (checkoutModalPh1) checkoutModalPh1.style.display = 'none';
        if (checkoutModalBodyPh1) checkoutModalBodyPh1.innerHTML = ''; 
        if(checkoutModalTitlePh1) checkoutModalTitlePh1.textContent = 'Checkout'; 
        checkoutProcessState = { 
            currentStep: null, selectedItems: [],
            shippingInfo: { method: null, address: { name: '', street: '', city: '', postalCode: '', country: '' }, pickupLocation: null, previousPickupLocations: [] },
            paymentInfo: { method: null, savedCardId: null, newCardDetails: { cardNumber: '', expiryDate: '', cvv: '', cardholderName: '' }, previousPaymentMethods: [] },
            orderTotal: 0 
        };
        if(nextCheckoutBtnPh1) { nextCheckoutBtnPh1.onclick = null; nextCheckoutBtnPh1.textContent = 'Next'; nextCheckoutBtnPh1.disabled = false; }
        if(backCheckoutBtnPh1) { backCheckoutBtnPh1.onclick = null; backCheckoutBtnPh1.style.display = 'none'; }
        if(cancelCheckoutBtnPh1) { cancelCheckoutBtnPh1.onclick = hideCheckoutModalPh1; cancelCheckoutBtnPh1.textContent = 'Cancel';}
    }

    if (closeCheckoutModalBtnPh1) closeCheckoutModalBtnPh1.addEventListener('click', hideCheckoutModalPh1);
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

        checkoutModalBodyPh1.querySelectorAll('input[name="shippingMethod"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                shipInfo.method = e.target.value;
                homeDeliveryDiv.style.display = shipInfo.method === 'home' ? 'block' : 'none';
                
                if (shipInfo.method === 'pickup') {
                    if (hasPreviousPickupLocations) {
                        pickupLocationsDiv.style.display = 'block';
                        pickupPlaceholderDiv.style.display = 'none';
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
        });
        ['name', 'street', 'city', 'postalCode', 'country'].forEach(id => {
            checkoutModalBodyPh1.querySelector(`#shipping-${id}`)?.addEventListener('input', e => { addr[id] = e.target.value; });
        });
        checkoutModalBodyPh1.querySelectorAll('input[name="pickupLocationOption"]')?.forEach(radio => {
            radio.addEventListener('change', e => { shipInfo.pickupLocation = e.target.value; nextCheckoutBtnPh1.disabled = false; });
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

        checkoutModalBodyPh1.querySelectorAll('input[name="pickupLocationOption"]').forEach(radio => {
            radio.addEventListener('change', e => { 
                checkoutProcessState.shippingInfo.pickupLocation = e.target.value; 
                if(nextCheckoutBtnPh1) nextCheckoutBtnPh1.disabled = false;
            });
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

        checkoutModalBodyPh1.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
            radio.addEventListener('change', e => {
                payInfo.method = e.target.value;
                savedCardDiv.style.display = payInfo.method === 'savedCard' ? 'block' : 'none';
                newCardDiv.style.display = payInfo.method === 'newCard' ? 'block' : 'none';
                if (payInfo.method === 'savedCard') Object.keys(newCard).forEach(k => newCard[k] = ''); else payInfo.savedCardId = null;
                nextCheckoutBtnPh1.disabled = !(payInfo.method === 'newCard' || (payInfo.method === 'savedCard' && payInfo.savedCardId));
            });
        });
        checkoutModalBodyPh1.querySelectorAll('input[name="savedCardOption"]')?.forEach(radio => {
            radio.addEventListener('change', e => { payInfo.savedCardId = e.target.value; nextCheckoutBtnPh1.disabled = false; });
        });
        ['cardNumber', 'expiryDate', 'cvv', 'cardholderName'].forEach(id => {
            const inputId = id === 'cardNumber' ? 'card-number' : id === 'expiryDate' ? 'card-expiry' : id === 'cardholderName' ? 'cardholder-name' : `card-${id}`;
            checkoutModalBodyPh1.querySelector(`#${inputId}`)?.addEventListener('input', e => { newCard[id] = e.target.value; });
        });
        
        if(nextCheckoutBtnPh1) {
            nextCheckoutBtnPh1.textContent = 'Next: Review Order';
            nextCheckoutBtnPh1.disabled = !(payInfo.method === 'newCard' || (payInfo.method === 'savedCard' && payInfo.savedCardId));
            nextCheckoutBtnPh1.onclick = () => {
                if (payInfo.method === 'newCard' && Object.values(newCard).some(v => !v.trim())) { alert("Please fill all card details."); return; }
                if (payInfo.method === 'newCard' && !/^(0[1-9]|1[0-2])\/\d{2}$/.test(newCard.expiryDate.trim())) { alert("Please enter expiry date in MM/YY format."); return; }
                if (!payInfo.method || (payInfo.method === 'savedCard' && !payInfo.savedCardId) ) { alert("Please select a payment option."); return; }
                renderOrderReviewStep();
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
            nextCheckoutBtnPh1.onclick = handleOrderSubmission;
        }
        if(backCheckoutBtnPh1) {
            backCheckoutBtnPh1.style.display = 'inline-block';
            backCheckoutBtnPh1.textContent = 'Back: Payment';
            backCheckoutBtnPh1.onclick = () => renderPaymentStep(checkoutProcessState.paymentInfo.previousPaymentMethods);
        }
        if (cancelCheckoutBtnPh1) cancelCheckoutBtnPh1.onclick = hideCheckoutModalPh1;
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
        if(nextCheckoutBtnPh1) nextCheckoutBtnPh1.style.display = 'none';
        if(backCheckoutBtnPh1) backCheckoutBtnPh1.style.display = 'none';
        if(cancelCheckoutBtnPh1) {
            cancelCheckoutBtnPh1.textContent = 'Close';
            cancelCheckoutBtnPh1.onclick = hideCheckoutModalPh1;
        }
    }

    // Remove or comment out the OLD checkout modal logic if it's truly not needed elsewhere
    // For example, openCheckoutModal_OLD(), closeCheckoutModal_OLD(), etc.

    console.log("[Main Page] Script loaded.");
});
