/**
 * WILLY STORE - Main SPA Application
 */

// --- State Management ---
const state = {
    user: JSON.parse(localStorage.getItem('willy_user')),
    token: localStorage.getItem('willy_token'),
    cart: [],
    categories: [],
    currentView: 'home',
    params: {}
};

// --- File Upload Helper (Base64 for D1) ---
async function handleFileUpload(input, targetId) {
    const file = input.files[0];
    if (!file) return;

    if (file.size > 1024 * 1024) { // 1MB limit for D1/Workers kv-like storage in base64
        showToast("La imagen es demasiado grande. El límite es 1MB.");
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById(targetId).value = e.target.result;
        showToast("Imagen cargada exitosamente.");
    };
    reader.readAsDataURL(file);
}

// --- API Helpers ---
const API = {
    async request(path, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...(state.token ? { 'Authorization': `Bearer ${state.token}` } : {}),
            ...options.headers
        };

        const response = await fetch(`/api${path}`, { ...options, headers });
        const data = await response.json();

        if (response.status === 401) {
            logout();
        }

        if (!response.ok) throw new Error(data.error || 'Algo salió mal');
        return data;
    },
    get: (path) => API.request(path),
    post: (path, body) => API.request(path, { method: 'POST', body: JSON.stringify(body) }),
    put: (path, body) => API.request(path, { method: 'PUT', body: JSON.stringify(body) }),
    patch: (path, body) => API.request(path, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (path) => API.request(path, { method: 'DELETE' })
};

// --- Utils ---
const formatPrice = (p) => new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(p);

function showToast(msg) {
    // Simple basic toast for now
    alert(msg);
}

// --- Router ---
function router() {
    const hash = window.location.hash || '#/';
    const path = hash.split('?')[0];
    const searchParams = new URLSearchParams(hash.split('?')[1] || '');

    state.params = Object.fromEntries(searchParams.entries());

    // Close panels on route change
    closePanels();

    if (path === '#/') renderHome();
    else if (path.startsWith('#/catalogo')) renderCatalog();
    else if (path.startsWith('#/producto/')) renderProduct(path.split('/').pop());
    else if (path === '#/checkout') renderCheckout();
    else if (path === '#/cuenta') renderAccount();
    else if (path === '#/nosotros') renderAbout();
    else if (path.startsWith('#/admin')) renderAdmin();
    else renderHome();

    // Update header style
    const header = document.getElementById('main-header');
    if (path === '#/') {
        header.classList.remove('scrolled');
    } else {
        header.classList.add('scrolled');
    }
}

// --- Authentication ---
async function login(email, password) {
    try {
        const data = await API.post('/auth/login', { email, password });
        state.user = data.user;
        state.token = data.token;
        localStorage.setItem('willy_user', JSON.stringify(data.user));
        localStorage.setItem('willy_token', data.token);
        closeModal('auth-modal');
        updateUI();
        router();
    } catch (err) {
        showToast(err.message);
    }
}

function logout() {
    state.user = null;
    state.token = null;
    localStorage.removeItem('willy_user');
    localStorage.removeItem('willy_token');
    updateUI();
    window.location.hash = '#/';
}

// --- UI Components ---

function updateUI() {
    const cartCount = document.getElementById('cart-count');
    const userBtn = document.getElementById('user-btn');

    // Update cart counter
    const totalItems = state.cart.reduce((sum, item) => sum + item.cantidad, 0);
    if (cartCount) {
        cartCount.innerText = totalItems;
        cartCount.style.display = totalItems > 0 ? 'flex' : 'none';
    }

    // Update user icon
    if (userBtn) {
        if (state.user) {
            userBtn.innerHTML = `<i class="fas fa-user"></i>`;
            userBtn.title = `Hola, ${state.user.nombre}`;
        } else {
            userBtn.innerHTML = `<i class="far fa-user"></i>`;
        }
    }

    initScrollReveal();
}

function closePanels() {
    document.getElementById('cart-panel').classList.remove('active');
    document.getElementById('menu-panel').classList.remove('active');
    document.getElementById('account-panel').classList.remove('active');
    document.getElementById('overlay').classList.remove('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function openAccountPanel() {
    const container = document.getElementById('account-menu-content');
    const isAdmin = state.user && state.user.rol === 'admin';

    container.innerHTML = `
        <div style="padding: 20px 0;">
            <div style="margin-bottom: 30px; text-align: center;">
                <div style="width: 60px; height: 60px; background: #eee; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px; font-size: 24px; color: var(--primary);">
                    <i class="fas fa-user"></i>
                </div>
                <h4 style="margin: 0; font-size: 18px;">${state.user.nombre}</h4>
                <p style="margin: 5px 0 0; font-size: 12px; color: var(--gray-medium);">${state.user.email}</p>
            </div>
            
            <ul class="mobile-nav" style="border-top: 1px solid #eee; padding-top: 20px;">
                <li><a href="#/cuenta"><i class="fas fa-user-edit" style="width: 25px;"></i> EDITAR INFORMACIÓN</a></li>
                ${isAdmin ? `<li><a href="#/admin" style="color: var(--primary); font-weight: 700;"><i class="fas fa-user-shield" style="width: 25px;"></i> PANEL DE ADMIN</a></li>` : ''}
                <li><a href="#/nosotros"><i class="fas fa-info-circle" style="width: 25px;"></i> SOBRE NOSOTROS</a></li>
                <li style="margin-top: 20px; border-top: 1px solid #eee; padding-top: 20px;">
                    <a href="javascript:void(0)" onclick="logout()" style="color: #c62828;"><i class="fas fa-sign-out-alt" style="width: 25px;"></i> CERRAR SESIÓN</a>
                </li>
            </ul>
        </div>
    `;

    document.getElementById('account-panel').classList.add('active');
    document.getElementById('overlay').classList.add('active');
}

// --- Views Rendering ---

async function renderHome() {
    const container = document.getElementById('main-content');
    container.innerHTML = `
        <section class="hero">
            <div class="hero-bg" style="background-image: url('https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?q=80&w=2070')"></div>
            <div class="hero-content">
                <h1 class="hero-title animate-fade-up">Spring / Summer</h1>
                <p style="margin-bottom: 30px; letter-spacing: 2px;" class="animate-fade-up">COLECCIÓN 2026</p>
                <div style="display: flex; gap: 20px; justify-content: center;" class="animate-fade-up">
                    <a href="#/catalogo?genero=mujer" class="btn-premium">Ver Mujer</a>
                    <a href="#/catalogo?genero=hombre" class="btn-premium">Ver Hombre</a>
                </div>
            </div>
        </section>

        <section class="container" style="margin-top: 80px;">
            <h2 class="section-title">Categorías</h2>
            <div class="categories-grid" id="home-categories">
                <p style="text-align: center; grid-column: 1/-1;">Cargando categorías...</p>
            </div>
        </section>
    `;

    try {
        const cats = await API.get('/categorias');
        const catGrid = document.getElementById('home-categories');
        if (cats && cats.length > 0) {
            catGrid.innerHTML = cats.map(c => `
                <div class="category-card reveal reveal-up" onclick="window.location.hash='#/catalogo?categoria=${c.id}'" style="cursor: pointer;">
                    <img src="${c.imagen_url || 'https://images.unsplash.com/photo-1523381235312-70b92eb49a8d?q=80&w=2070'}" alt="${c.nombre}">
                    <div class="category-content">
                        <h3>${c.nombre}</h3>
                        <button class="btn-outline">DESCUBRIR</button>
                    </div>
                </div>
            `).join('');
            initScrollReveal();
        }
        else {
            catGrid.innerHTML = '<p style="text-align: center; grid-column: 1/-1;">No hay categorías disponibles.</p>';
        }
    } catch (e) {
        console.error('Error loading categories:', e);
        document.getElementById('home-categories').innerHTML = '<p style="text-align: center; grid-column: 1/-1;">Error al cargar categorías.</p>';
    }
}

async function renderCatalog() {
    const container = document.getElementById('main-content');
    const { genero, categoria, nuevo, busqueda } = state.params;

    let title = 'Catálogo';
    if (genero) title = genero === 'mujer' ? 'Mujer' : 'Hombre';
    if (nuevo) title = 'Novedades';
    if (busqueda) title = `Resultados: ${busqueda}`;

    container.innerHTML = `
        <div class="container" style="margin-top: 120px;">
            <h1 class="section-title" style="margin-top: 0; text-align: left;">${title}</h1>
            <div class="products-grid" id="products-list">
                <p>Cargando productos...</p>
            </div>
        </div>
    `;

    try {
        const query = new URLSearchParams(state.params).toString();
        const products = await API.get(`/productos?${query}`);
        const list = document.getElementById('products-list');

        if (products.length === 0) {
            list.innerHTML = '<p>No se encontraron productos en esta sección.</p>';
            return;
        }

        list.innerHTML = products.map((p, i) => `
            <div class="product-card reveal reveal-up" style="transition-delay: ${i * 0.1}s">
                <a href="#/producto/${p.id}">
                    <div class="product-img-wrapper">
                        <img src="${p.imagen_url}" class="product-img" loading="lazy">
                        <div class="product-badges">
                            ${p.nuevo ? '<span class="badge badge-new">Nuevo</span>' : ''}
                            ${p.precio_oferta ? '<span class="badge badge-sale">Oferta</span>' : ''}
                        </div>
                    </div>
                    <div class="product-info">
                        <h3 class="product-name">${p.nombre}</h3>
                        <p class="product-price">
                            ${p.precio_oferta ? `<span class="price-old">${formatPrice(p.precio)}</span><span class="price-new">${formatPrice(p.precio_oferta)}</span>` : formatPrice(p.precio)}
                        </p>
                    </div>
                </a>
            </div>
        `).join('');
        initScrollReveal();
    } catch (err) {
        document.getElementById('products-list').innerHTML = `<p>Error: ${err.message}</p>`;
    }
}

async function renderProduct(id) {
    const container = document.getElementById('main-content');
    container.innerHTML = `<div class="container" style="margin-top: 120px;"><p>Cargando...</p></div>`;

    try {
        const p = await API.get(`/productos/${id}`);
        container.innerHTML = `
            <div class="container" style="margin-top: 120px;">
                <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 60px;">
                    <div class="product-gallery">
                        <img src="${p.imagen_url}" style="width: 100%; height: 800px; object-fit: cover;">
                        <!-- Extra images would go here -->
                    </div>
                    <div class="product-details">
                        <div style="position: sticky; top: 120px;">
                            <span style="font-size: 12px; color: var(--gray-medium); text-transform: uppercase;">${p.categoria_nombre} | ${p.genero}</span>
                            <h1 style="font-size: 32px; font-weight: 300; margin: 10px 0; text-transform: uppercase; letter-spacing: 2px;">${p.nombre}</h1>
                            <p style="font-size: 20px; font-weight: 600; margin-bottom: 30px;">
                                ${p.precio_oferta ? `<span class="price-old">${formatPrice(p.precio)}</span><span class="price-new">${formatPrice(p.precio_oferta)}</span>` : formatPrice(p.precio)}
                            </p>
                            
                            <p style="color: var(--gray-dark); margin-bottom: 40px; font-size: 14px; line-height: 1.8;">${p.descripcion}</p>

                            <div class="selectors" style="margin-bottom: 40px;">
                                <div style="margin-bottom: 20px;">
                                    <label>Talla</label>
                                    <div style="display: flex; gap: 10px;" id="size-selector">
                                        ${p.tallas.map(t => `<button class="size-btn ${t.stock <= 0 ? 'disabled' : ''}" data-id="${t.id}" ${t.stock <= 0 ? 'disabled' : ''} style="padding: 10px 20px; border: 1px solid #ddd;">${t.nombre}</button>`).join('')}
                                    </div>
                                </div>
                                ${p.colores.length > 0 ? `
                                <div>
                                    <label>Color</label>
                                    <div style="display: flex; gap: 10px;" id="color-selector">
                                        ${p.colores.map(c => `<button class="color-dot" data-id="${c.id}" title="${c.nombre}" style="width: 30px; height: 30px; border-radius: 50%; background: ${c.hex_code}; border: 2px solid #fff; box-shadow: 0 0 0 1px #ddd;"></button>`).join('')}
                                    </div>
                                </div>` : ''}
                            </div>

                            <button class="btn-dark btn-premium" style="width: 100%;" id="add-to-cart-btn" ${p.tallas.every(t => t.stock <= 0) ? 'disabled' : ''}>
                                ${p.tallas.every(t => t.stock <= 0) ? 'Agotado' : 'Añadir a la Cesta'}
                            </button>
                            
                            <div style="margin-top: 40px; padding-top: 40px; border-top: 1px solid var(--gray-light); font-size: 12px; color: var(--gray-medium);">
                                <p><i class="fas fa-shipping-fast" style="margin-right: 10px;"></i> Envíos gratuitos en pedidos superiores a $50</p>
                                <p style="margin-top: 10px;"><i class="fas fa-undo" style="margin-right: 10px;"></i> Devoluciones gratuitas hasta 30 días</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Selectors Logic
        let selectedTalla = null;
        let selectedColor = p.colores[0]?.id || null;

        document.querySelectorAll('.size-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.size-btn').forEach(b => b.style.borderColor = '#ddd');
                btn.style.borderColor = 'var(--primary)';
                selectedTalla = btn.dataset.id;
            };
        });

        document.querySelectorAll('.color-dot').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.color-dot').forEach(b => b.style.transform = 'scale(1)');
                btn.style.transform = 'scale(1.2)';
                selectedColor = btn.dataset.id;

                // Switch Image if the color has one
                const colorData = p.colores.find(c => c.id == selectedColor);
                if (colorData && colorData.imagen_url) {
                    document.querySelector('.product-gallery img').src = colorData.imagen_url;
                } else {
                    document.querySelector('.product-gallery img').src = p.imagen_url;
                }
            };
        });

        document.getElementById('add-to-cart-btn').onclick = async () => {
            if (!state.user) {
                openAuthModal();
                return;
            }
            if (!selectedTalla && p.tallas.length > 0) {
                showToast('Por favor selecciona una talla');
                return;
            }
            try {
                await API.post('/carrito', {
                    producto_id: p.id,
                    talla_id: selectedTalla,
                    color_id: selectedColor,
                    cantidad: 1
                });
                await loadCart();
                document.getElementById('cart-panel').classList.add('active');
                document.getElementById('overlay').classList.add('active');
            } catch (err) {
                showToast(err.message);
            }
        };

    } catch (err) {
        container.innerHTML = `<div class="container" style="margin-top: 120px;"><p>Error: ${err.message}</p></div>`;
    }
}

// --- Cart Logic ---

async function loadCart() {
    if (!state.user) return;
    try {
        state.cart = await API.get('/carrito');
        renderCartUI();
        updateUI();
    } catch (e) { }
}

function renderCartUI() {
    const list = document.getElementById('cart-items');
    const totalVal = document.getElementById('cart-total-val');

    if (state.cart.length === 0) {
        list.innerHTML = '<p style="text-align: center; margin-top: 40px; color: var(--gray-medium);">El carrito está vacío</p>';
        totalVal.innerText = '$0.00';
        return;
    }

    let total = 0;
    list.innerHTML = state.cart.map(item => {
        const precio = item.precio_oferta || item.precio;
        total += precio * item.cantidad;
        return `
            <div class="cart-item">
                <img src="${item.imagen_url}" class="cart-item-img">
                <div class="cart-item-info">
                    <h4 class="cart-item-name">${item.nombre}</h4>
                    <p class="cart-item-meta">${item.talla_nombre || ''} ${item.color_nombre ? '| ' + item.color_nombre : ''}</p>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 14px; font-weight: 600;">${formatPrice(precio)}</span>
                        <div style="display: flex; gap: 10px; align-items: center;">
                            <button onclick="updateCartQty(${item.id}, ${item.cantidad - 1})"><i class="fas fa-minus"></i></button>
                            <span style="font-size: 13px;">${item.cantidad}</span>
                            <button onclick="updateCartQty(${item.id}, ${item.cantidad + 1})"><i class="fas fa-plus"></i></button>
                        </div>
                        <button onclick="removeFromCart(${item.id})" style="color: var(--gray-medium);"><i class="far fa-trash-alt"></i></button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    totalVal.innerText = formatPrice(total);
}

async function updateCartQty(id, qty) {
    if (qty < 1) return removeFromCart(id);
    try {
        await API.put(`/carrito/${id}`, { cantidad: qty });
        await loadCart();
    } catch (e) { }
}

async function removeFromCart(id) {
    try {
        await API.delete(`/carrito/${id}`);
        await loadCart();
    } catch (e) { }
}

async function renderCheckout() {
    if (!state.user) {
        openAuthModal();
        return;
    }
    if (state.cart.length === 0) {
        window.location.hash = '#/';
        return;
    }

    const container = document.getElementById('main-content');
    const total = state.cart.reduce((sum, item) => sum + (item.precio_oferta || item.precio) * item.cantidad, 0);

    container.innerHTML = `
        <div class="container" style="margin-top: 120px; max-width: 1000px;">
            <h1 class="section-title" style="text-align: left;">Finalizar Compra</h1>
            <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 40px;" class="animate-fade-up">
                <div style="background: var(--gray-light); padding: 30px; border-radius: 4px;">
                    <h3 style="margin-bottom: 20px; text-transform: uppercase; font-size: 16px;">Datos de Envío</h3>
                    <form id="checkout-form">
                        <div class="form-group">
                            <label>Nombre Completo</label>
                            <input type="text" id="ship-name" value="${state.user.nombre}" required>
                        </div>
                        <div class="form-group">
                             <label>Dirección Exacta</label>
                             <input type="text" id="ship-address" value="${state.user.direccion || ''}" required>
                        </div>
                        <div class="form-group">
                             <label>Teléfono de Contacto</label>
                             <input type="text" id="ship-phone" value="${state.user.telefono || ''}" required>
                        </div>
                        <div class="form-group">
                             <label>Notas adicionales (Opcional)</label>
                             <textarea id="ship-notes" rows="2"></textarea>
                        </div>
                        
                        <div style="margin-top: 30px; padding: 20px; background: #fff; border-left: 4px solid var(--primary);">
                            <p style="font-size: 13px;">Pagarás un total de <strong>${formatPrice(total)}</strong> mediante <strong>Transferencia Bancaria o Efectivo</strong> al recibir (contra entrega).</p>
                        </div>
                    </form>
                </div>
                
                <div>
                    <div style="background: #fff; border: 1px solid #eee; padding: 30px; position: sticky; top: 120px;">
                        <h3 style="margin-bottom: 20px; text-transform: uppercase; font-size: 14px;">Resumen del Pedido</h3>
                        <div style="max-height: 300px; overflow-y: auto; margin-bottom: 20px;">
                            ${state.cart.map(item => `
                                <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 13px;">
                                    <span>${item.cantidad}x ${item.nombre}</span>
                                    <span>${formatPrice((item.precio_oferta || item.precio) * item.cantidad)}</span>
                                </div>
                            `).join('')}
                        </div>
                        <div style="border-top: 1px solid #eee; padding-top: 15px; display: flex; justify-content: space-between; font-weight: 700;">
                            <span>TOTAL</span>
                            <span>${formatPrice(total)}</span>
                        </div>
                        <button type="submit" form="checkout-form" class="btn-dark btn-premium" style="width: 100%; margin-top: 30px;">Confirmar Pedido</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('checkout-form').onsubmit = async (e) => {
        e.preventDefault();
        try {
            const orderData = {
                nombre_envio: document.getElementById('ship-name').value,
                direccion_envio: document.getElementById('ship-address').value,
                telefono_envio: document.getElementById('ship-phone').value,
                email_envio: state.user.email, // Add email field
                notas: document.getElementById('ship-notes').value,
                total: total
            };

            const res = await API.post('/pedidos', orderData);
            showToast('¡Pedido realizado con éxito!');
            state.cart = []; // Limpiar carrito local
            router(); // Redirigir (a home o cuenta)
            window.location.hash = '#/cuenta';
        } catch (err) {
            showToast(err.message);
        }
    };
}

async function renderAccount() {
    if (!state.user) {
        window.location.hash = '#/';
        return;
    }

    const container = document.getElementById('main-content');
    container.innerHTML = `
        <div class="container" style="margin-top: 120px; max-width: 800px;">
            <h1 class="section-title" style="text-align: left;">Mi Información</h1>
            
            <div id="account-view" class="animate-fade-up">
                <div style="background: var(--gray-light); padding: 40px; border-radius: 4px;">
                    <form id="profile-form">
                        <div class="form-group">
                            <label>Nombre Completo</label>
                            <input type="text" id="prof-name" value="${state.user.nombre}" required>
                        </div>
                        <div class="form-group">
                            <label>Email</label>
                            <input type="email" value="${state.user.email}" disabled style="background: #eee; cursor: not-allowed;">
                        </div>
                        <div class="form-group">
                            <label>Teléfono</label>
                            <input type="text" id="prof-phone" value="${state.user.telefono || ''}" placeholder="Ej: +593 ...">
                        </div>
                        <div class="form-group">
                            <label>Dirección de Envío</label>
                            <textarea id="prof-address" rows="3" placeholder="Tu dirección principal...">${state.user.direccion || ''}</textarea>
                        </div>
                        
                        <div style="display: flex; gap: 20px; margin-top: 30px;">
                            <button type="submit" class="btn-dark btn-premium" style="flex: 1;">Guardar Cambios</button>
                            <button type="button" onclick="logout()" class="btn-premium" style="color: #c62828; border-color: #c62828;">Cerrar Sesión</button>
                        </div>
                    </form>
                </div>

                <div style="margin-top: 60px;">
                    <h2 style="font-size: 18px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 15px;">Mis Pedidos Recientes</h2>
                    <div id="user-orders-list">
                        <p style="color: var(--gray-medium);">Cargando pedidos...</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Order list logic
    try {
        const orders = await API.get('/pedidos');
        const list = document.getElementById('user-orders-list');
        if (orders.length === 0) {
            list.innerHTML = '<p style="color: var(--gray-medium);">Aún no has realizado ningún pedido.</p>';
        } else {
            list.innerHTML = orders.map(o => `
                <div style="border: 1px solid #eee; padding: 20px; margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <span style="font-weight: 700; font-size: 14px;">PEDIDO #${o.id}</span>
                        <span style="text-transform: uppercase; font-size: 11px; padding: 3px 8px; border-radius: 10px; background: #eee;">${o.estado}</span>
                    </div>
                    <div style="font-size: 13px; color: var(--gray-medium);">
                        ${new Date(o.fecha).toLocaleDateString()} | Total: ${formatPrice(o.total)}
                    </div>
                </div>
            `).join('');
        }
    } catch (e) {
        document.getElementById('user-orders-list').innerHTML = '<p>No se pudieron cargar los pedidos.</p>';
    }

    // Profile form logic
    document.getElementById('profile-form').onsubmit = async (e) => {
        e.preventDefault();
        // This would call a PATCH /api/auth/perfil in a real app
        showToast('Perfil actualizado correctamente (Demo)');
    };
}

async function renderAbout() {
    const container = document.getElementById('main-content');
    container.innerHTML = `
        <div class="container" style="margin-top: 120px; max-width: 800px;">
            <h1 class="section-title" style="text-align: left;">Sobre Nosotros</h1>
            <div id="about-content" class="animate-fade-up" style="line-height: 2; font-size: 16px; color: var(--gray-dark);">
                Cargando...
            </div>
            <div style="margin-top: 60px;">
                <img src="https://images.unsplash.com/photo-1534452203293-494d7ddbf7e0?q=80&w=2070" style="width: 100%; height: 400px; object-fit: cover; border-radius: 4px;">
            </div>
        </div>
    `;

    try {
        const ajustes = await API.get('/ajustes');
        document.getElementById('about-content').innerText = ajustes.quienes_somos || 'Willy Shop - Tu estilo, tu firma.';
    } catch (e) {
        document.getElementById('about-content').innerText = 'Error al cargar información.';
    }
}

// --- Admin Views ---

async function renderAdmin() {
    if (!state.user || state.user.rol !== 'admin') {
        window.location.hash = '#/';
        return;
    }

    const subview = window.location.hash.split('/')[2] || 'dash';
    const container = document.getElementById('main-content');
    container.innerHTML = `
        <div class="admin-container">
            <aside class="admin-sidebar">
                <h2 style="font-size: 18px; margin-bottom: 40px; text-transform: uppercase;">Admin Panel</h2>
                <a href="#/admin" class="admin-nav-item ${subview === 'dash' ? 'active' : ''}">Dashboard</a>
                <a href="#/admin/productos" class="admin-nav-item ${subview === 'productos' ? 'active' : ''}">Productos</a>
                <a href="#/admin/pedidos" class="admin-nav-item ${subview === 'pedidos' ? 'active' : ''}">Pedidos</a>
                <a href="#/admin/nosotros" class="admin-nav-item ${subview === 'nosotros' ? 'active' : ''}">Nosotros</a>
                <div style="margin-top: 40px;">
                    <button onclick="logout()" class="admin-nav-item" style="width: 100%; text-align: left;">Cerrar Sesión</button>
                </div>
            </aside>
            <main class="admin-main" id="admin-subview">
                <!-- Subview content here -->
            </main>
        </div>
    `;

    if (subview === 'dash') renderAdminDash();
    else if (subview === 'productos') renderAdminProducts();
    else if (subview === 'pedidos') renderAdminOrders();
    else if (subview === 'nosotros') renderAdminAbout();
}

async function renderAdminOrders() {
    const sub = document.getElementById('admin-subview');
    sub.innerHTML = '<h1>Pedidos</h1><p>Cargando pedidos...</p>';

    try {
        const orders = await API.get('/admin/pedidos');
        sub.innerHTML = `
            <h1 style="margin-bottom: 40px;">Gestión de Pedidos</h1>
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="text-align: left; border-bottom: 2px solid #ddd;">
                    <th style="padding: 15px;">ID</th>
                    <th>Cliente</th>
                    <th>Fecha</th>
                    <th>Total</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${orders.map(o => `
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 15px;">#${o.id}</td>
                            <td>
                                <strong>${o.nombre_envio}</strong><br>
                                <span style="font-size: 11px; color: #888;">${o.telefono_envio}</span>
                            </td>
                            <td>${new Date(o.fecha).toLocaleDateString()}</td>
                            <td>${formatPrice(o.total)}</td>
                            <td>
                                <select onchange="updateOrderStatus(${o.id}, this.value)" style="padding: 5px; font-size: 12px;">
                                    <option value="pendiente" ${o.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                                    <option value="procesando" ${o.estado === 'procesando' ? 'selected' : ''}>Procesando</option>
                                    <option value="enviado" ${o.estado === 'enviado' ? 'selected' : ''}>Enviado</option>
                                    <option value="entregado" ${o.estado === 'entregado' ? 'selected' : ''}>Entregado</option>
                                    <option value="cancelado" ${o.estado === 'cancelado' ? 'selected' : ''}>Cancelado</option>
                                </select>
                            </td>
                            <td>
                                <button onclick="viewOrderDetails(${o.id})" title="Ver detalles"><i class="fas fa-eye"></i></button>
                            </td>
                        </tr>
                    `).join('')}
            </tbody>
        </table>
`;
    } catch (e) {
        sub.innerHTML = `<p>Error: ${e.message}</p>`;
    }
}

async function updateOrderStatus(id, status) {
    try {
        await API.patch(`/admin/pedidos/${id}/estado`, { estado: status });
        showToast('Estado de pedido actualizado');
    } catch (e) {
        showToast(e.message);
    }
}

async function renderAdminAbout() {
    const sub = document.getElementById('admin-subview');
    sub.innerHTML = '<h1>Editar Quiénes Somos</h1><p>Cargando...</p>';

    try {
        const ajustes = await API.get('/ajustes');
        sub.innerHTML = `
            <h1 style="margin-bottom: 40px;">Editar Quiénes Somos</h1>
            <div style="max-width: 600px;">
                <form id="admin-about-form">
                    <div class="form-group">
                        <label>Contenido Principal</label>
                        <textarea id="about-text" rows="10" required>${ajustes.quienes_somos || ''}</textarea>
                    </div>
                    <button type="submit" class="btn-dark btn-premium">Guardar Cambios</button>
                </form>
            </div>
        `;

        document.getElementById('admin-about-form').onsubmit = async (e) => {
            e.preventDefault();
            const text = document.getElementById('about-text').value;
            try {
                await API.put('/ajustes', { quienes_somos: text });
                showToast('Información actualizada correctamente');
            } catch (err) {
                showToast(err.message);
            }
        };
    } catch (e) {
        sub.innerHTML = '<p>Error al cargar ajustes.</p>';
    }
}

async function renderAdminDash() {
    const sub = document.getElementById('admin-subview');
    sub.innerHTML = '<p>Cargando estadísticas...</p>';

    try {
        const stats = await API.get('/admin/stats');
        sub.innerHTML = `
            <h1 style="margin-bottom: 40px;">Dashboard</h1>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-val">${stats.ventasTotales ? formatPrice(stats.ventasTotales) : '$0'}</div>
                    <div class="stat-label">Ventas Totales</div>
                </div>
                <div class="stat-card">
                    <div class="stat-val">${stats.totalPedidos}</div>
                    <div class="stat-label">Pedidos</div>
                </div>
                <div class="stat-card">
                    <div class="stat-val">${stats.totalProductos}</div>
                    <div class="stat-label">Productos</div>
                </div>
                <div class="stat-card">
                    <div class="stat-val">${stats.pedidosPendientes}</div>
                    <div class="stat-label">Pendientes</div>
                </div>
            </div>
            <!-- More metrics could go here -->
        `;
    } catch (e) {
        sub.innerHTML = `<p>Error: ${e.message}</p>`;
    }
}

async function renderAdminProducts() {
    const sub = document.getElementById('admin-subview');
    sub.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px;">
            <h1>Productos</h1>
            <button class="btn-dark" style="padding: 10px 20px;" onclick="openAddProductModal()">+ Nuevo Producto</button>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="text-align: left; border-bottom: 2px solid #ddd;">
                    <th style="padding: 15px;">Producto</th>
                    <th>Categoría</th>
                    <th>Precio</th>
                    <th>Estado</th>
                    <th>Tallas/Stock</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody id="admin-product-list">
                <!-- Products here -->
            </tbody>
        </table>
    `;

    try {
        const products = await API.get('/admin/productos');
        const list = document.getElementById('admin-product-list');
        list.innerHTML = products.map(p => {
            const tallasArr = p.tallas_info ? p.tallas_info.split('|').map(t => {
                const [n, s, id] = t.split(':');
                return `<span title="ID: ${id}" style="font-size: 10px; background: #eee; padding: 2px 5px; margin-right: 2px;">${n}:${s}</span>`;
            }).join('') : 'Sin tallas';

            return `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 15px; display: flex; align-items: center; gap: 10px;">
                        <img src="${p.imagen_url}" style="width: 40px; height: 50px; object-fit: cover;">
                        <div>
                            <div style="font-weight: 600; font-size: 14px;">${p.nombre}</div>
                            <div style="font-size: 11px; color: #888;">ID: ${p.id}</div>
                        </div>
                    </td>
                    <td>${p.categoria_nombre || 'S/C'}</td>
                    <td>${formatPrice(p.precio)}</td>
                    <td>
                        <span style="padding: 3px 8px; border-radius: 10px; font-size: 10px; text-transform: uppercase; background: ${p.estado === 'activo' ? '#e1f5fe' : '#ffebee'}; color: ${p.estado === 'activo' ? '#01579b' : '#c62828'};">
                            ${p.estado}
                        </span>
                    </td>
                    <td>${tallasArr}</td>
                    <td>
                        <button onclick="toggleProductStatus(${p.id}, '${p.estado}')" title="${p.estado === 'activo' ? 'Suspender' : 'Activar'}">
                            <i class="fas ${p.estado === 'activo' ? 'fa-eye-slash' : 'fa-eye'}"></i>
                        </button>
                        <button onclick="editProduct(${p.id})" style="margin: 0 10px;"><i class="fas fa-edit"></i></button>
                        <button onclick="deleteProduct(${p.id})" style="color: #c62828;"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) { }
}

async function toggleProductStatus(id, current) {
    const next = current === 'activo' ? 'suspendido' : 'activo';
    if (!confirm(`¿Deseas ${next === 'activo' ? 'activar' : 'suspender'} este producto?`)) return;
    try {
        await API.patch(`/admin/productos/${id}/estado`, { estado: next });
        renderAdminProducts();
    } catch (e) { showToast(e.message); }
}

async function deleteProduct(id) {
    if (!confirm('¿Seguro que quieres eliminar este producto? Esta acción no se puede deshacer.')) return;
    try {
        await API.delete(`/admin/productos/${id}`);
        renderAdminProducts();
    } catch (e) { showToast(e.message); }
}

async function viewOrderDetails(id) {
    try {
        const orders = await API.get('/admin/pedidos');
        const o = orders.find(x => x.id === id);
        if (!o) return;

        sub = document.getElementById('admin-subview'); // Re-use sub to show details
        const currentHtml = sub.innerHTML;

        sub.innerHTML = `
            <button onclick="renderAdminOrders()" style="margin-bottom: 20px; background: none; border: none; cursor: pointer; text-decoration: underline;"><i class="fas fa-arrow-left"></i> Volver a la lista</button>
            <div style="background: #fff; padding: 40px; border: 1px solid #eee; border-radius: 4px; box-shadow: 0 5px 15px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 1px solid #eee; padding-bottom: 20px;">
                    <div>
                        <h2 style="font-size: 24px; margin-bottom: 5px;">Pedido #${o.id}</h2>
                        <span style="font-size: 13px; color: #888;">Realizado el ${new Date(o.fecha).toLocaleDateString()}</span>
                    </div>
                    <div style="text-align: right;">
                        <div style="text-transform: uppercase; font-size: 11px; letter-spacing: 1px; color: #888; margin-bottom: 5px;">Estado Actual</div>
                        <span style="padding: 5px 15px; background: #000; color: #fff; text-transform: uppercase; font-size: 11px; font-weight: 700; border-radius: 20px;">${o.estado}</span>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 60px;">
                    <div>
                        <h3 style="font-size: 14px; text-transform: uppercase; color: #000; letter-spacing: 1px; margin-bottom: 20px; border-bottom: 2px solid #000; display: inline-block;">Datos de Envío</h3>
                        <div style="line-height: 1.8; font-size: 14px;">
                            <p><strong>Nombre:</strong> ${o.nombre_envio}</p>
                            <p><strong>Dirección:</strong> ${o.direccion_envio}</p>
                            <p><strong>Teléfono:</strong> ${o.telefono_envio}</p>
                            <p><strong>Email:</strong> ${o.email_envio || 'N/A'}</p>
                            ${o.notas ? `<div style="margin-top: 20px; padding: 15px; background: #f9f9f9; border-radius: 4px;"><strong>Notas:</strong><br>${o.notas}</div>` : ''}
                        </div>
                    </div>
                    <div>
                        <h3 style="font-size: 14px; text-transform: uppercase; color: #000; letter-spacing: 1px; margin-bottom: 20px; border-bottom: 2px solid #000; display: inline-block;">Resumen de Items</h3>
                        <div style="margin-bottom: 30px;">
                            ${o.items.map(i => `
                                <div style="display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 14px;">
                                    <span>${i.cantidad}x ${i.nombre_producto} <span style="color: #888;">(${i.talla || 'Única'})</span></span>
                                    <strong>${formatPrice(i.precio_unitario * i.cantidad)}</strong>
                                </div>
                            `).join('')}
                        </div>
                        <div style="border-top: 1px solid #eee; padding-top: 20px; display: flex; justify-content: space-between; font-size: 18px; font-weight: 800;">
                            <span>TOTAL</span>
                            <span>${formatPrice(o.total)}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } catch (e) { showToast(e.message); }
}

async function editProduct(id) {
    openProductModal(id);
}

async function openAddProductModal() {
    openProductModal();
}

async function openProductModal(id = null) {
    let p = { nombre: '', descripcion: '', precio: '', categoria_id: 1, genero: 'unisex', imagen_url: '', tallas: [], colores: [] };
    if (id) {
        try {
            p = await API.get(`/productos/${id}`);
        } catch (e) { return showToast(e.message); }
    }

    const modal = document.getElementById('auth-modal');
    const forms = document.getElementById('auth-forms');
    const cats = await API.get('/categorias');

    forms.innerHTML = `
        <h2 style="margin-bottom: 20px;">${id ? 'Editar' : 'Nuevo'} Producto</h2>
        <form id="product-form" style="max-height: 80vh; overflow-y: auto; padding-right: 15px;">
            <div class="form-group"><label>Nombre</label><input type="text" id="p-nombre" value="${p.nombre}" required></div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div class="form-group"><label>Precio</label><input type="number" step="0.01" id="p-precio" value="${p.precio}" required></div>
                <div class="form-group"><label>Categoría</label>
                    <select id="p-cat">
                        ${cats.map(c => `<option value="${c.id}" ${p.categoria_id == c.id ? 'selected' : ''}>${c.nombre}</option>`).join('')}
                    </select>
                </div>
            </div>

            <div class="form-group">
                <label>Imagen Principal</label>
                <div style="display: flex; gap: 10px;">
                    <input type="text" id="p-img" value="${p.imagen_url}" placeholder="URL o sube archivo" style="flex: 1;">
                    <input type="file" id="p-file" style="display: none;" onchange="handleFileUpload(this, 'p-img')">
                    <button type="button" class="btn-outline" onclick="document.getElementById('p-file').click()" style="padding: 5px 10px; font-size: 11px;">Subir</button>
                </div>
            </div>
            
            <div class="form-group">
                <label>Tallas y Stock</label>
                <div id="tallas-container">
                    ${p.tallas.map((t, i) => `
                        <div class="talla-row" style="display: flex; gap: 10px; margin-bottom: 10px;">
                            <input type="text" placeholder="Nombre (S, M, L...)" value="${t.nombre}" class="t-nombre" style="flex: 2;">
                            <input type="number" placeholder="Stock" value="${t.stock}" class="t-stock" style="flex: 1;">
                            <button type="button" onclick="this.parentElement.remove()" style="color: red; background: none; border: none; font-size: 18px; cursor: pointer;">&times;</button>
                        </div>
                    `).join('')}
                </div>
                <button type="button" class="btn-outline" style="font-size: 11px; padding: 5px 10px;" onclick="addTallaRow()">+ Añadir Talla</button>
            </div>

            <div class="form-group">
                <label>Colores e Imágenes</label>
                <div id="colores-container">
                    ${p.colores.map((c, i) => `
                        <div class="color-row" style="display: grid; grid-template-columns: 100px 1fr 30px; gap: 10px; margin-bottom: 10px; background: #f9f9f9; padding: 15px; border-radius: 4px; align-items: start;">
                            <div>
                                <input type="text" placeholder="Nombre" value="${c.nombre}" class="c-nombre" style="margin-bottom: 5px;">
                                <input type="color" value="${c.hex_code}" class="c-hex" style="height: 35px; width: 100%; cursor: pointer;">
                            </div>
                            <div>
                                <input type="text" placeholder="Imagen URL específica" value="${c.imagen_url || ''}" class="c-img" id="c-img-${i}" style="margin-bottom: 5px;">
                                <input type="file" style="display: none;" onchange="handleFileUpload(this, 'c-img-${i}')" id="c-file-${i}">
                                <button type="button" class="btn-outline" onclick="document.getElementById('c-file-${i}').click()" style="padding: 3px 8px; font-size: 10px;">Subir Imagen Color</button>
                            </div>
                            <button type="button" onclick="this.parentElement.remove()" style="color: red; background: none; border: none; font-size: 20px; cursor: pointer; padding: 0;">&times;</button>
                        </div>
                    `).join('')}
                </div>
                <button type="button" class="btn-outline" style="font-size: 11px; padding: 5px 10px;" onclick="addColorRow()">+ Añadir Color</button>
            </div>

            <div class="form-group"><label>Descripción</label><textarea id="p-desc">${p.descripcion || ''}</textarea></div>
            
            <div style="display: flex; gap: 10px; margin-top: 30px; position: sticky; bottom: 0; background: #fff; padding: 20px 0;">
                <button type="submit" class="btn-dark btn-premium" style="flex: 1;">Guardar Producto</button>
                <button type="button" onclick="closeModal('auth-modal')" class="btn-premium" style="flex: 1;">Cancelar</button>
            </div>
        </form>
    `;

    // Helpers
    window.addTallaRow = () => {
        const div = document.createElement('div');
        div.className = 'talla-row';
        div.style.display = 'flex';
        div.style.gap = '10px';
        div.style.marginBottom = '10px';
        div.innerHTML = `
            <input type="text" placeholder="Nombre" class="t-nombre" style="flex: 2;">
            <input type="number" placeholder="Stock" value="0" class="t-stock" style="flex: 1;">
            <button type="button" onclick="this.parentElement.remove()" style="color: red;">&times;</button>
        `;
        document.getElementById('tallas-container').appendChild(div);
    };

    window.addColorRow = () => {
        const idx = document.querySelectorAll('.color-row').length;
        const div = document.createElement('div');
        div.className = 'color-row';
        div.style.display = 'grid';
        div.style.gridTemplateColumns = '100px 1fr 30px';
        div.style.gap = '10px';
        div.style.marginBottom = '10px';
        div.style.background = '#f9f9f9';
        div.style.padding = '15px';
        div.style.borderRadius = '4px';
        div.style.alignItems = 'start';
        div.innerHTML = `
            <div>
                <input type="text" placeholder="Nombre" class="c-nombre" style="margin-bottom: 5px;">
                <input type="color" value="#000000" class="c-hex" style="height: 35px; width: 100%; cursor: pointer;">
            </div>
            <div>
                <input type="text" placeholder="Imagen URL" class="c-img" id="c-img-${idx}" style="margin-bottom: 5px;">
                <input type="file" style="display: none;" onchange="handleFileUpload(this, 'c-img-${idx}')" id="c-file-${idx}">
                <button type="button" class="btn-outline" onclick="document.getElementById('c-file-${idx}').click()" style="padding: 3px 8px; font-size: 10px;">Subir Imagen Color</button>
            </div>
            <button type="button" onclick="this.parentElement.remove()" style="color: red; background: none; border: none; font-size: 20px; cursor: pointer; padding: 0;">&times;</button>
        `;
        document.getElementById('colores-container').appendChild(div);
    };

    document.getElementById('product-form').onsubmit = async (e) => {
        e.preventDefault();

        const tallas = Array.from(document.querySelectorAll('.talla-row')).map(row => ({
            nombre: row.querySelector('.t-nombre').value,
            stock: parseInt(row.querySelector('.t-stock').value) || 0
        }));

        const colores = Array.from(document.querySelectorAll('.color-row')).map(row => ({
            nombre: row.querySelector('.c-nombre').value,
            hex_code: row.querySelector('.c-hex').value,
            imagen_url: row.querySelector('.c-img').value
        }));

        const data = {
            nombre: document.getElementById('p-nombre').value,
            precio: parseFloat(document.getElementById('p-precio').value),
            categoria_id: parseInt(document.getElementById('p-cat').value),
            imagen_url: document.getElementById('p-img').value,
            descripcion: document.getElementById('p-desc').value,
            genero: p.genero,
            tallas,
            colores
        };

        try {
            if (id) await API.put(`/admin/productos/${id}`, data);
            else await API.post('/admin/productos', data);

            showToast('Producto guardado correctamente');
            closeModal('auth-modal');
            renderAdminProducts();
        } catch (err) { showToast(err.message); }
    };

    modal.classList.add('active');
}

// --- Auth Modal Helpers ---

function openAuthModal() {
    const modal = document.getElementById('auth-modal');
    const container = document.getElementById('auth-forms');

    container.innerHTML = `
        <h2 style="text-align: center; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 30px;">Iniciar Sesión</h2>
        <form id="login-form">
            <div class="form-group">
                <label>Email</label>
                <input type="email" id="login-email" required>
            </div>
            <div class="form-group">
                <label>Contraseña</label>
                <input type="password" id="login-pass" required>
            </div>
            <button class="btn-dark btn-premium" style="width: 100%;" type="submit">Entrar</button>
        </form>
        <p style="text-align: center; margin-top: 20px; font-size: 12px;">¿No tienes cuenta? <a href="javascript:void(0)" onclick="showRegister()" style="text-decoration: underline;">Regístrate</a></p>
    `;

    document.getElementById('login-form').onsubmit = (e) => {
        e.preventDefault();
        login(document.getElementById('login-email').value, document.getElementById('login-pass').value);
    };

    modal.classList.add('active');
}

function showRegister() {
    const container = document.getElementById('auth-forms');
    container.innerHTML = `
        <h2 style="text-align: center; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 30px;">Crear Cuenta</h2>
        <form id="reg-form">
            <div class="form-group">
                <label>Nombre Completo</label>
                <input type="text" id="reg-name" required>
            </div>
            <div class="form-group">
                <label>Email</label>
                <input type="email" id="reg-email" required>
            </div>
            <div class="form-group">
                <label>Contraseña</label>
                <input type="password" id="reg-pass" required>
            </div>
            <button class="btn-dark btn-premium" style="width: 100%;" type="submit">Registrarse</button>
        </form>
        <p style="text-align: center; margin-top: 20px; font-size: 12px;">¿Ya tienes cuenta? <a href="javascript:void(0)" onclick="openAuthModal()" style="text-decoration: underline;">Inicia Sesión</a></p>
    `;

    document.getElementById('reg-form').onsubmit = async (e) => {
        e.preventDefault();
        try {
            const name = document.getElementById('reg-name').value;
            const email = document.getElementById('reg-email').value;
            const pass = document.getElementById('reg-pass').value;
            const data = await API.post('/auth/registro', { nombre: name, email, password: pass });
            state.user = data.user;
            state.token = data.token;
            localStorage.setItem('willy_user', JSON.stringify(data.user));
            localStorage.setItem('willy_token', data.token);
            closeModal('auth-modal');
            updateUI();
            router();
        } catch (err) {
            showToast(err.message);
        }
    };
}

// function updateUI() was here, moved to top

function initScrollReveal() {
    if (!('IntersectionObserver' in window)) {
        document.querySelectorAll('.reveal').forEach(el => el.classList.add('active'));
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.05 });

    const items = document.querySelectorAll('.reveal:not(.active)');
    items.forEach(el => observer.observe(el));

    // Safety Fallback: Force reveal after 2 seconds if something went wrong
    setTimeout(() => {
        document.querySelectorAll('.reveal:not(.active)').forEach(el => el.classList.add('active'));
    }, 2000);
}

// --- Initialization ---

window.addEventListener('hashchange', router);

document.addEventListener('DOMContentLoaded', () => {
    router();
    updateUI();
    loadCart();

    // Event Listeners
    document.getElementById('cart-btn').onclick = () => {
        if (!state.user) {
            openAuthModal();
            return;
        }
        document.getElementById('cart-panel').classList.add('active');
        document.getElementById('overlay').classList.add('active');
    };

    document.getElementById('checkout-btn').onclick = () => {
        closePanels();
        window.location.hash = '#/checkout';
    };

    document.getElementById('close-cart').onclick = closePanels;
    document.getElementById('overlay').onclick = closePanels;
    document.getElementById('menu-toggle').onclick = () => {
        closePanels();
        document.getElementById('menu-panel').classList.add('active');
        document.getElementById('overlay').classList.add('active');
    };
    document.getElementById('close-menu').onclick = closePanels;

    document.getElementById('user-btn').onclick = () => {
        if (state.user) openAccountPanel();
        else openAuthModal();
    };

    document.getElementById('close-account').onclick = closePanels;

    // Global scroll listener for header effect
    window.addEventListener('scroll', () => {
        const header = document.getElementById('main-header');
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else if (window.location.hash === '#/' || window.location.hash === '') {
            header.classList.remove('scrolled');
        }
    });
});

// Exposed globally for onclicks
window.updateCartQty = updateCartQty;
window.removeFromCart = removeFromCart;
window.toggleProductStatus = toggleProductStatus;
window.deleteProduct = deleteProduct;
window.editProduct = editProduct;
window.openAddProductModal = openAddProductModal;
window.updateOrderStatus = updateOrderStatus;
window.viewOrderDetails = viewOrderDetails;
window.showRegister = showRegister;
window.openAuthModal = openAuthModal;
window.logout = logout;
