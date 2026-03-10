// =============================================
// WILLY STORE - Cloudflare Worker API
// =============================================

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname;

        // CORS headers
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        // Serve static assets (handled by [assets] in wrangler.toml)
        if (!path.startsWith('/api/')) {
            return env.ASSETS.fetch(request);
        }

        try {
            let response;

            // ---- AUTH ----
            if (path === '/api/auth/registro' && request.method === 'POST') {
                response = await handleRegistro(request, env);
            } else if (path === '/api/auth/login' && request.method === 'POST') {
                response = await handleLogin(request, env);
            } else if (path === '/api/auth/perfil' && request.method === 'GET') {
                response = await handlePerfil(request, env);
            }

            // ---- CATEGORIAS ----
            else if (path === '/api/categorias' && request.method === 'GET') {
                response = await handleGetCategorias(env);
            }

            // ---- PRODUCTOS (público) ----
            else if (path === '/api/productos' && request.method === 'GET') {
                response = await handleGetProductos(url, env);
            } else if (path.match(/^\/api\/productos\/\d+$/) && request.method === 'GET') {
                const id = path.split('/').pop();
                response = await handleGetProducto(id, env);
            }

            // ---- CARRITO ----
            else if (path === '/api/carrito' && request.method === 'GET') {
                response = await withAuth(request, env, handleGetCarrito);
            } else if (path === '/api/carrito' && request.method === 'POST') {
                response = await withAuth(request, env, handleAddCarrito);
            } else if (path.match(/^\/api\/carrito\/\d+$/) && request.method === 'PUT') {
                response = await withAuth(request, env, handleUpdateCarrito);
            } else if (path.match(/^\/api\/carrito\/\d+$/) && request.method === 'DELETE') {
                response = await withAuth(request, env, handleDeleteCarrito);
            }

            // ---- PEDIDOS ----
            else if (path === '/api/pedidos' && request.method === 'POST') {
                response = await withAuth(request, env, handleCreatePedido);
            } else if (path === '/api/pedidos' && request.method === 'GET') {
                response = await withAuth(request, env, handleGetPedidos);
            }

            // ---- ADMIN ----
            else if (path === '/api/admin/stats' && request.method === 'GET') {
                response = await withAdmin(request, env, handleAdminStats);
            } else if (path === '/api/admin/productos' && request.method === 'GET') {
                response = await withAdmin(request, env, handleAdminGetProductos);
            } else if (path === '/api/admin/productos' && request.method === 'POST') {
                response = await withAdmin(request, env, handleAdminCreateProducto);
            } else if (path.match(/^\/api\/admin\/productos\/\d+$/) && request.method === 'PUT') {
                response = await withAdmin(request, env, handleAdminUpdateProducto);
            } else if (path.match(/^\/api\/admin\/productos\/\d+\/estado$/) && request.method === 'PATCH') {
                response = await withAdmin(request, env, handleAdminToggleEstado);
            } else if (path.match(/^\/api\/admin\/productos\/\d+\/tallas$/) && request.method === 'POST') {
                response = await withAdmin(request, env, handleAdminAddTalla);
            } else if (path.match(/^\/api\/admin\/productos\/\d+\/tallas\/\d+$/) && request.method === 'PUT') {
                response = await withAdmin(request, env, handleAdminUpdateTalla);
            } else if (path.match(/^\/api\/admin\/productos\/\d+\/tallas\/\d+$/) && request.method === 'DELETE') {
                response = await withAdmin(request, env, handleAdminDeleteTalla);
            } else if (path === '/api/admin/pedidos' && request.method === 'GET') {
                response = await withAdmin(request, env, handleAdminGetPedidos);
            } else if (path.match(/^\/api\/admin\/pedidos\/\d+\/estado$/) && request.method === 'PATCH') {
                response = await withAdmin(request, env, handleAdminUpdatePedidoEstado);
            } else if (path.match(/^\/api\/admin\/productos\/\d+$/) && request.method === 'DELETE') {
                response = await withAdmin(request, env, handleAdminDeleteProducto);
            }

            else {
                response = json({ error: 'Ruta no encontrada' }, 404);
            }

            // Add CORS headers to response
            const newHeaders = new Headers(response.headers);
            Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));
            return new Response(response.body, { status: response.status, headers: newHeaders });

        } catch (err) {
            return json({ error: 'Error interno del servidor', details: err.message }, 500);
        }
    }
};

// =============================================
// HELPERS
// =============================================

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

// Simple base64 JWT-like token
function createToken(payload) {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = btoa(JSON.stringify({ ...payload, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }));
    const sig = btoa(JSON.stringify({ v: 'willy_secret_' + payload.id }));
    return `${header}.${body}.${sig}`;
}

function verifyToken(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payload = JSON.parse(atob(parts[1]));
        if (payload.exp < Date.now()) return null;
        return payload;
    } catch {
        return null;
    }
}

function getUser(request) {
    const auth = request.headers.get('Authorization');
    if (!auth || !auth.startsWith('Bearer ')) return null;
    return verifyToken(auth.slice(7));
}

async function withAuth(request, env, handler) {
    const user = getUser(request);
    if (!user) return json({ error: 'No autorizado' }, 401);
    return handler(request, env, user);
}

async function withAdmin(request, env, handler) {
    const user = getUser(request);
    if (!user) return json({ error: 'No autorizado' }, 401);
    if (user.rol !== 'admin') return json({ error: 'Acceso denegado' }, 403);
    return handler(request, env, user);
}

// Simple hash (not cryptographic, but functional for demo)
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return 'h_' + Math.abs(hash).toString(36);
}

// =============================================
// AUTH HANDLERS
// =============================================

async function handleRegistro(request, env) {
    const { nombre, email, password } = await request.json();
    if (!nombre || !email || !password) {
        return json({ error: 'Nombre, email y contraseña son requeridos' }, 400);
    }
    const existing = await env.DB.prepare('SELECT id FROM usuarios WHERE email = ?').bind(email).first();
    if (existing) return json({ error: 'El email ya está registrado' }, 400);

    const password_hash = simpleHash(password);
    const result = await env.DB.prepare(
        'INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)'
    ).bind(nombre, email, password_hash, 'cliente').run();

    const user = { id: result.meta.last_row_id, nombre, email, rol: 'cliente' };
    const token = createToken(user);
    return json({ user, token }, 201);
}

async function handleLogin(request, env) {
    const { email, password } = await request.json();
    if (!email || !password) return json({ error: 'Email y contraseña requeridos' }, 400);

    const user = await env.DB.prepare('SELECT * FROM usuarios WHERE email = ?').bind(email).first();
    if (!user) return json({ error: 'Credenciales incorrectas' }, 401);

    const password_hash = simpleHash(password);
    // Also check plain-text for seeded admin
    if (user.password_hash !== password_hash && user.password_hash !== password + '_hashed') {
        return json({ error: 'Credenciales incorrectas' }, 401);
    }

    const payload = { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol };
    const token = createToken(payload);
    return json({ user: payload, token });
}

async function handlePerfil(request, env) {
    const userData = getUser(request);
    if (!userData) return json({ error: 'No autorizado' }, 401);
    const user = await env.DB.prepare('SELECT id, nombre, email, telefono, direccion, rol, fecha_creacion FROM usuarios WHERE id = ?')
        .bind(userData.id).first();
    if (!user) return json({ error: 'Usuario no encontrado' }, 404);
    return json(user);
}

// =============================================
// CATEGORIAS
// =============================================

async function handleGetCategorias(env) {
    const { results } = await env.DB.prepare('SELECT * FROM categorias WHERE activa = 1').all();
    return json(results);
}

// =============================================
// PRODUCTOS (público)
// =============================================

async function handleGetProductos(url, env) {
    const categoria = url.searchParams.get('categoria');
    const busqueda = url.searchParams.get('busqueda');
    const genero = url.searchParams.get('genero');
    const destacado = url.searchParams.get('destacado');
    const nuevo = url.searchParams.get('nuevo');
    const orden = url.searchParams.get('orden') || 'recientes';
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = `SELECT p.*, c.nombre as categoria_nombre FROM productos p 
               LEFT JOIN categorias c ON p.categoria_id = c.id 
               WHERE p.estado = 'activo'`;
    const params = [];

    if (categoria) {
        query += ' AND p.categoria_id = ?';
        params.push(categoria);
    }
    if (busqueda) {
        query += ' AND (p.nombre LIKE ? OR p.descripcion LIKE ?)';
        params.push(`%${busqueda}%`, `%${busqueda}%`);
    }
    if (genero) {
        query += ' AND (p.genero = ? OR p.genero = \'unisex\')';
        params.push(genero);
    }
    if (destacado === '1') {
        query += ' AND p.destacado = 1';
    }
    if (nuevo === '1') {
        query += ' AND p.nuevo = 1';
    }

    switch (orden) {
        case 'precio_asc': query += ' ORDER BY p.precio ASC'; break;
        case 'precio_desc': query += ' ORDER BY p.precio DESC'; break;
        case 'nombre': query += ' ORDER BY p.nombre ASC'; break;
        default: query += ' ORDER BY p.fecha_creacion DESC';
    }

    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = env.DB.prepare(query);
    const { results } = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();
    return json(results);
}

async function handleGetProducto(id, env) {
    const producto = await env.DB.prepare(
        `SELECT p.*, c.nombre as categoria_nombre FROM productos p 
     LEFT JOIN categorias c ON p.categoria_id = c.id WHERE p.id = ?`
    ).bind(id).first();

    if (!producto) return json({ error: 'Producto no encontrado' }, 404);

    const { results: tallas } = await env.DB.prepare(
        'SELECT * FROM tallas WHERE producto_id = ? ORDER BY id'
    ).bind(id).all();

    const { results: colores } = await env.DB.prepare(
        'SELECT * FROM colores WHERE producto_id = ? ORDER BY id'
    ).bind(id).all();

    return json({ ...producto, tallas, colores });
}

// =============================================
// CARRITO
// =============================================

async function handleGetCarrito(request, env, user) {
    const { results } = await env.DB.prepare(`
    SELECT c.*, p.nombre, p.precio, p.precio_oferta, p.imagen_url,
           t.nombre as talla_nombre, co.nombre as color_nombre, co.hex_code
    FROM carrito c
    JOIN productos p ON c.producto_id = p.id
    LEFT JOIN tallas t ON c.talla_id = t.id
    LEFT JOIN colores co ON c.color_id = co.id
    WHERE c.usuario_id = ?
    ORDER BY c.fecha_agregado DESC
  `).bind(user.id).all();
    return json(results);
}

async function handleAddCarrito(request, env, user) {
    const { producto_id, talla_id, color_id, cantidad } = await request.json();
    if (!producto_id) return json({ error: 'Producto requerido' }, 400);

    // Check if same item already in cart
    const existing = await env.DB.prepare(
        `SELECT id, cantidad FROM carrito WHERE usuario_id = ? AND producto_id = ? 
     AND (talla_id = ? OR (talla_id IS NULL AND ? IS NULL))
     AND (color_id = ? OR (color_id IS NULL AND ? IS NULL))`
    ).bind(user.id, producto_id, talla_id, talla_id, color_id, color_id).first();

    if (existing) {
        await env.DB.prepare('UPDATE carrito SET cantidad = cantidad + ? WHERE id = ?')
            .bind(cantidad || 1, existing.id).run();
        return json({ message: 'Cantidad actualizada', id: existing.id });
    }

    const result = await env.DB.prepare(
        'INSERT INTO carrito (usuario_id, producto_id, talla_id, color_id, cantidad) VALUES (?, ?, ?, ?, ?)'
    ).bind(user.id, producto_id, talla_id || null, color_id || null, cantidad || 1).run();

    return json({ message: 'Agregado al carrito', id: result.meta.last_row_id }, 201);
}

async function handleUpdateCarrito(request, env, user) {
    const id = request.url.split('/').pop();
    const { cantidad } = await request.json();
    if (!cantidad || cantidad < 1) return json({ error: 'Cantidad inválida' }, 400);

    await env.DB.prepare('UPDATE carrito SET cantidad = ? WHERE id = ? AND usuario_id = ?')
        .bind(cantidad, id, user.id).run();
    return json({ message: 'Actualizado' });
}

async function handleDeleteCarrito(request, env, user) {
    const id = request.url.split('/').pop();
    await env.DB.prepare('DELETE FROM carrito WHERE id = ? AND usuario_id = ?')
        .bind(id, user.id).run();
    return json({ message: 'Eliminado del carrito' });
}

// =============================================
// PEDIDOS
// =============================================

async function handleCreatePedido(request, env, user) {
    const { nombre_envio, direccion_envio, telefono_envio, email_envio, notas } = await request.json();
    if (!nombre_envio || !direccion_envio || !telefono_envio || !email_envio) {
        return json({ error: 'Datos de envío incompletos' }, 400);
    }

    // Get cart items
    const { results: items } = await env.DB.prepare(`
    SELECT c.*, p.precio, p.precio_oferta, p.nombre as nombre_producto,
           t.nombre as talla_nombre, co.nombre as color_nombre
    FROM carrito c
    JOIN productos p ON c.producto_id = p.id
    LEFT JOIN tallas t ON c.talla_id = t.id
    LEFT JOIN colores co ON c.color_id = co.id
    WHERE c.usuario_id = ?
  `).bind(user.id).all();

    if (items.length === 0) return json({ error: 'El carrito está vacío' }, 400);

    const total = items.reduce((sum, item) => {
        const precio = item.precio_oferta || item.precio;
        return sum + (precio * item.cantidad);
    }, 0);

    // Create order
    const orderResult = await env.DB.prepare(
        `INSERT INTO pedidos (usuario_id, total, nombre_envio, direccion_envio, telefono_envio, email_envio, notas) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(user.id, total, nombre_envio, direccion_envio, telefono_envio, email_envio, notas || '').run();

    const pedidoId = orderResult.meta.last_row_id;

    // Create order items
    for (const item of items) {
        const precio = item.precio_oferta || item.precio;
        await env.DB.prepare(
            `INSERT INTO pedido_items (pedido_id, producto_id, nombre_producto, talla, color, cantidad, precio_unitario) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(pedidoId, item.producto_id, item.nombre_producto, item.talla_nombre || '', item.color_nombre || '', item.cantidad, precio).run();

        // Decrease stock
        if (item.talla_id) {
            await env.DB.prepare('UPDATE tallas SET stock = MAX(0, stock - ?) WHERE id = ?')
                .bind(item.cantidad, item.talla_id).run();
        }
    }

    // Clear cart
    await env.DB.prepare('DELETE FROM carrito WHERE usuario_id = ?').bind(user.id).run();

    return json({ message: 'Pedido creado', pedido_id: pedidoId, total }, 201);
}

async function handleGetPedidos(request, env, user) {
    const { results: pedidos } = await env.DB.prepare(
        'SELECT * FROM pedidos WHERE usuario_id = ? ORDER BY fecha DESC'
    ).bind(user.id).all();

    for (const pedido of pedidos) {
        const { results: items } = await env.DB.prepare(
            'SELECT * FROM pedido_items WHERE pedido_id = ?'
        ).bind(pedido.id).all();
        pedido.items = items;
    }

    return json(pedidos);
}

// =============================================
// ADMIN HANDLERS
// =============================================

async function handleAdminStats(request, env) {
    const totalProductos = await env.DB.prepare('SELECT COUNT(*) as count FROM productos').first();
    const productosActivos = await env.DB.prepare("SELECT COUNT(*) as count FROM productos WHERE estado = 'activo'").first();
    const totalPedidos = await env.DB.prepare('SELECT COUNT(*) as count FROM pedidos').first();
    const totalUsuarios = await env.DB.prepare('SELECT COUNT(*) as count FROM usuarios').first();
    const ventasTotales = await env.DB.prepare('SELECT COALESCE(SUM(total), 0) as total FROM pedidos').first();
    const pedidosPendientes = await env.DB.prepare("SELECT COUNT(*) as count FROM pedidos WHERE estado = 'pendiente'").first();

    return json({
        totalProductos: totalProductos.count,
        productosActivos: productosActivos.count,
        totalPedidos: totalPedidos.count,
        totalUsuarios: totalUsuarios.count,
        ventasTotales: ventasTotales.total,
        pedidosPendientes: pedidosPendientes.count
    });
}

async function handleAdminGetProductos(request, env) {
    const { results } = await env.DB.prepare(`
    SELECT p.*, c.nombre as categoria_nombre,
    (SELECT GROUP_CONCAT(t.nombre || ':' || t.stock || ':' || t.id, '|') FROM tallas t WHERE t.producto_id = p.id) as tallas_info
    FROM productos p
    LEFT JOIN categorias c ON p.categoria_id = c.id
    ORDER BY p.fecha_creacion DESC
  `).all();
    return json(results);
}

async function handleAdminCreateProducto(request, env) {
    const data = await request.json();
    const { nombre, descripcion, precio, precio_oferta, categoria_id, imagen_url, genero, destacado, nuevo, tallas, colores } = data;

    if (!nombre || !precio) return json({ error: 'Nombre y precio son requeridos' }, 400);

    const result = await env.DB.prepare(
        `INSERT INTO productos (nombre, descripcion, precio, precio_oferta, categoria_id, imagen_url, genero, destacado, nuevo) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(nombre, descripcion || '', precio, precio_oferta || null, categoria_id || null, imagen_url || '', genero || 'unisex', destacado ? 1 : 0, nuevo ? 1 : 0).run();

    const productoId = result.meta.last_row_id;

    // Add sizes
    if (tallas && tallas.length > 0) {
        for (const talla of tallas) {
            await env.DB.prepare('INSERT INTO tallas (producto_id, nombre, stock) VALUES (?, ?, ?)')
                .bind(productoId, talla.nombre, talla.stock || 0).run();
        }
    }

    // Add colors
    if (colores && colores.length > 0) {
        for (const color of colores) {
            await env.DB.prepare('INSERT INTO colores (producto_id, nombre, hex_code) VALUES (?, ?, ?)')
                .bind(productoId, color.nombre, color.hex_code || '#000000').run();
        }
    }

    return json({ message: 'Producto creado', id: productoId }, 201);
}

async function handleAdminUpdateProducto(request, env) {
    const id = request.url.split('/').pop();
    const data = await request.json();
    const { nombre, descripcion, precio, precio_oferta, categoria_id, imagen_url, genero, destacado, nuevo } = data;

    await env.DB.prepare(
        `UPDATE productos SET nombre = ?, descripcion = ?, precio = ?, precio_oferta = ?, 
     categoria_id = ?, imagen_url = ?, genero = ?, destacado = ?, nuevo = ? WHERE id = ?`
    ).bind(nombre, descripcion || '', precio, precio_oferta || null, categoria_id || null, imagen_url || '', genero || 'unisex', destacado ? 1 : 0, nuevo ? 1 : 0, id).run();

    return json({ message: 'Producto actualizado' });
}

async function handleAdminToggleEstado(request, env) {
    const parts = request.url.split('/');
    const id = parts[parts.length - 2];
    const { estado } = await request.json();

    if (!['activo', 'suspendido'].includes(estado)) {
        return json({ error: 'Estado inválido' }, 400);
    }

    await env.DB.prepare('UPDATE productos SET estado = ? WHERE id = ?').bind(estado, id).run();
    return json({ message: `Producto ${estado}` });
}

async function handleAdminAddTalla(request, env) {
    const parts = request.url.split('/');
    const productoId = parts[parts.length - 2];
    const { nombre, stock } = await request.json();

    if (!nombre) return json({ error: 'Nombre de talla requerido' }, 400);

    const result = await env.DB.prepare('INSERT INTO tallas (producto_id, nombre, stock) VALUES (?, ?, ?)')
        .bind(productoId, nombre, stock || 0).run();

    return json({ message: 'Talla agregada', id: result.meta.last_row_id }, 201);
}

async function handleAdminUpdateTalla(request, env) {
    const parts = request.url.split('/');
    const tallaId = parts.pop();
    parts.pop(); // remove 'tallas'
    const { nombre, stock } = await request.json();

    await env.DB.prepare('UPDATE tallas SET nombre = ?, stock = ? WHERE id = ?')
        .bind(nombre, stock, tallaId).run();

    return json({ message: 'Talla actualizada' });
}

async function handleAdminDeleteTalla(request, env) {
    const parts = request.url.split('/');
    const tallaId = parts.pop();

    await env.DB.prepare('DELETE FROM tallas WHERE id = ?').bind(tallaId).run();
    return json({ message: 'Talla eliminada' });
}

async function handleAdminGetPedidos(request, env) {
    const { results: pedidos } = await env.DB.prepare(`
    SELECT p.*, u.nombre as usuario_nombre, u.email as usuario_email
    FROM pedidos p
    LEFT JOIN usuarios u ON p.usuario_id = u.id
    ORDER BY p.fecha DESC
  `).all();

    for (const pedido of pedidos) {
        const { results: items } = await env.DB.prepare(
            'SELECT * FROM pedido_items WHERE pedido_id = ?'
        ).bind(pedido.id).all();
        pedido.items = items;
    }

    return json(pedidos);
}

async function handleAdminUpdatePedidoEstado(request, env) {
    const parts = request.url.split('/');
    const id = parts[parts.length - 2];
    const { estado } = await request.json();

    const estados = ['pendiente', 'procesando', 'enviado', 'entregado', 'cancelado'];
    if (!estados.includes(estado)) return json({ error: 'Estado inválido' }, 400);

    await env.DB.prepare('UPDATE pedidos SET estado = ? WHERE id = ?').bind(estado, id).run();
    return json({ message: 'Estado actualizado' });
}

async function handleAdminDeleteProducto(request, env) {
    const id = request.url.split('/').pop();
    await env.DB.prepare('DELETE FROM tallas WHERE producto_id = ?').bind(id).run();
    await env.DB.prepare('DELETE FROM colores WHERE producto_id = ?').bind(id).run();
    await env.DB.prepare('DELETE FROM productos WHERE id = ?').bind(id).run();
    return json({ message: 'Producto eliminado' });
}
