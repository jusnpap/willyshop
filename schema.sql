-- =============================================
-- WILLY STORE - Esquema Completo D1 (CORREGIDO)
-- =============================================

-- Eliminar tablas existentes para asegurar consistencia
DROP TABLE IF EXISTS items_pedido;
DROP TABLE IF EXISTS pedidos;
DROP TABLE IF EXISTS carrito;
DROP TABLE IF EXISTS colores;
DROP TABLE IF EXISTS tallas;
DROP TABLE IF EXISTS usuarios;
DROP TABLE IF EXISTS productos;
DROP TABLE IF EXISTS categorias;

-- 1. Categorías
CREATE TABLE categorias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  activa INTEGER DEFAULT 1
);

-- 2. Productos
CREATE TABLE productos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  precio REAL NOT NULL,
  precio_oferta REAL,
  categoria_id INTEGER,
  imagen_url TEXT,
  genero TEXT DEFAULT 'unisex', -- 'hombre', 'mujer', 'unisex'
  destacado INTEGER DEFAULT 0,
  nuevo INTEGER DEFAULT 0,
  estado TEXT DEFAULT 'activo', -- 'activo', 'suspendido'
  fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (categoria_id) REFERENCES categorias(id)
);

-- 3. Usuarios
CREATE TABLE usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, -- Corregido: antes era 'password'
  telefono TEXT,
  direccion TEXT,
  rol TEXT DEFAULT 'cliente', -- 'admin', 'cliente'
  fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tallas
CREATE TABLE tallas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id INTEGER,
  nombre TEXT NOT NULL, -- 'S', 'M', 'L', 'XL'
  stock INTEGER DEFAULT 0,
  FOREIGN KEY (producto_id) REFERENCES productos(id)
);

-- 5. Colores
CREATE TABLE colores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id INTEGER,
  nombre TEXT NOT NULL,
  hex_code TEXT,
  FOREIGN KEY (producto_id) REFERENCES productos(id)
);

-- 6. Carrito
CREATE TABLE carrito (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER,
  producto_id INTEGER,
  talla_id INTEGER,
  color_id INTEGER,
  cantidad INTEGER DEFAULT 1,
  fecha_agregado DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (producto_id) REFERENCES productos(id)
);

-- 7. Pedidos
CREATE TABLE pedidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER,
  total REAL NOT NULL,
  estado TEXT DEFAULT 'pendiente', -- 'pendiente', 'procesando', 'enviado', 'entregado', 'cancelado'
  nombre_envio TEXT,
  direccion_envio TEXT,
  telefono_envio TEXT,
  email_envio TEXT,
  notas TEXT,
  fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- 8. Items de Pedido
CREATE TABLE pedido_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id INTEGER,
  producto_id INTEGER,
  nombre_producto TEXT,
  talla TEXT,
  color TEXT,
  cantidad INTEGER,
  precio_unitario REAL,
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id)
);

-- =============================================
-- DATOS INICIALES (SEED DATA)
-- =============================================

-- Categorías
INSERT INTO categorias (id, nombre) VALUES 
(1, 'Sudaderas'), (2, 'Conjuntos'), (3, 'Suéteres'), (4, 'Chaquetas');

-- Usuario Admin (password: admin123)
-- El hash de 'admin123' usando la función simpleHash del worker
INSERT INTO usuarios (id, nombre, email, password_hash, rol) VALUES 
(1, 'Admin Willy', 'admin@willy.com', 'h_g10hvh', 'admin');

-- Productos (Basados en tus fotos)
INSERT INTO productos (id, nombre, descripcion, precio, precio_oferta, categoria_id, imagen_url, genero, destacado, nuevo) VALUES
(1, 'Sudadera Urban Black Patterns', 'Sudadera negra de corte moderno con patrones geométricos en las mangas. Estilo callejero premium con cuello alto.', 45.00, NULL, 1, 'assets/p1.png', 'unisex', 1, 1),
(2, 'Conjunto Tracksuit Blue & Beige', 'Conjunto deportivo de dos piezas en azul real y beige color-block. Máximo confort y estilo urbano.', 85.00, 75.00, 2, 'assets/p4.png', 'unisex', 1, 1),
(3, 'Sweater Forest Green Premium', 'Sweater de tejido suave en color verde bosque con puños y cuello en blanco crema. Elegancia casual.', 35.00, NULL, 3, 'assets/p2.png', 'mujer', 0, 1),
(4, 'Chaqueta Bomber Street Varsity', 'Chaqueta estilo bomber color negro con detalles deportivos en rayas blancas. Versátil y rebelde.', 65.00, NULL, 4, 'assets/p3.png', 'unisex', 1, 0);

-- Tallas para los productos
INSERT INTO tallas (producto_id, nombre, stock) VALUES
(1, 'S', 10), (1, 'M', 15), (1, 'L', 10),
(2, 'S', 8), (2, 'M', 12), (2, 'L', 8),
(3, 'S', 12), (3, 'M', 20), (3, 'L', 10),
(4, 'M', 15), (4, 'L', 15), (4, 'XL', 5);

-- Colores para los productos
INSERT INTO colores (producto_id, nombre, hex_code) VALUES
(1, 'Negro', '#000000'),
(2, 'Multi', '#0026ff'),
(3, 'Verde Bosque', '#2d5a27'),
(4, 'Negro Sport', '#1a1a1a');
