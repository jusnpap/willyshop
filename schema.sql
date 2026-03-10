-- Updating schema.sql with real images from assets
-- Logo: assets/logo.png
-- Products: assets/p1.jpg, assets/p2.jpg, assets/p3.jpg, assets/p4.jpg

DELETE FROM tallas;
DELETE FROM colores;
DELETE FROM productos;

INSERT INTO productos (id, nombre, descripcion, precio, precio_oferta, categoria_id, imagen_url, genero, destacado, nuevo) VALUES
  (1, 'Sudadera Urban Black Patterns', 'Sudadera negra de corte moderno con patrones geométricos en las mangas. Estilo callejero premium.', 45.00, NULL, 1, 'assets/p1.png', 'unisex', 1, 1),
  (2, 'Sweater Forest Green Classic', 'Sweater de algodón en color verde bosque con puños blancos en contraste. Elegancia casual.', 35.00, 29.99, 1, 'assets/p2.png', 'mujer', 1, 1),
  (3, 'Chaqueta Bomber Midnight Black', 'Chaqueta estilo bomber color negro profundo. Minimalismo y versatilidad.', 65.00, NULL, 4, 'assets/p3.png', 'unisex', 1, 0),
  (4, 'Conjunto Tracksuit Royal Blue', 'Conjunto deportivo de dos piezas en azul real y beige. Máximo confort y estilo.', 89.99, 75.00, 2, 'assets/p4.png', 'unisex', 0, 1);

-- Re-insert tallas
INSERT INTO tallas (producto_id, nombre, stock) VALUES
  (1, 'S', 15), (1, 'M', 20), (1, 'L', 10),
  (2, 'S', 12), (2, 'M', 18), (2, 'L', 8),
  (3, 'M', 15), (3, 'L', 12), (3, 'XL', 5),
  (4, 'S', 10), (4, 'M', 15), (4, 'L', 10);

-- Re-insert colores
INSERT INTO colores (producto_id, nombre, hex_code) VALUES
  (1, 'Negro', '#000000'),
  (2, 'Verde', '#2d5a27'),
  (3, 'Negro', '#000000'),
  (4, 'Azul Rey', '#0026ff');
