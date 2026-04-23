-- BASE DE DATOS: POS CALLETANO RESTAURANT
-- TABLA USUARIOS
CREATE TABLE usuarios (
    id_usuario SERIAL PRIMARY KEY,
    nombre VARCHAR(100),
    email VARCHAR(100),
    password VARCHAR(255),
    rol VARCHAR(20) CHECK (rol IN ('MOZO','CAJERO','ADMIN'))
);

-- TABLA CATEGORIAS
CREATE TABLE categorias (
    id_categoria SERIAL PRIMARY KEY,
    nombre VARCHAR(100),
    etiqueta_col1 VARCHAR(50),
    etiqueta_col2 VARCHAR(50)
);

-- TABLA PRODUCTOS
CREATE TABLE productos (
    id_producto SERIAL PRIMARY KEY,
    id_categoria INT,
    nombre VARCHAR(100),
    precio_unico DECIMAL(10,2),
    precio_col1 DECIMAL(10,2),
    precio_col2 DECIMAL(10,2),
    disponible BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (id_categoria) REFERENCES categorias(id_categoria)
);

-- TABLA MENU DIARIO
CREATE TABLE menu_diario (
    id_menu SERIAL PRIMARY KEY,
    fecha DATE,
    modo_domingo BOOLEAN,
    refresco VARCHAR(100)
);

-- TABLA MENU DIARIO PLATOS
CREATE TABLE menu_diario_platos (
    id_plato_menu SERIAL PRIMARY KEY,
    id_menu INT,
    tipo VARCHAR(20) CHECK (tipo IN ('ENTRADA','SEGUNDO')),
    nombre VARCHAR(100),
    precio DECIMAL(10,2),
    FOREIGN KEY (id_menu) REFERENCES menu_diario(id_menu)
);

-- TABLA MESAS
CREATE TABLE mesas (
    id_mesa INT PRIMARY KEY,
    numero INT,
    estado VARCHAR(20) CHECK (estado IN ('LIBRE','OCUPADA'))
);

-- TABLA PEDIDOS
CREATE TABLE pedidos (
    id_pedido SERIAL PRIMARY KEY,
    id_mesa INT,
    id_usuario INT,
    estado VARCHAR(20) CHECK (estado IN ('EN_ATENCION','PAGADO','ANULADO')),
    fecha_apertura TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_mesa) REFERENCES mesas(id_mesa),
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
);

-- TABLA DETALLE PEDIDOS
CREATE TABLE detalle_pedidos (
    id_detalle SERIAL PRIMARY KEY,
    id_pedido INT,
    tipo_item VARCHAR(20) CHECK (tipo_item IN ('CARTA','MENU')),
    id_producto INT,
    id_plato_menu INT,
    cantidad INT,
    precio_unitario DECIMAL(10,2),
    notas VARCHAR(255),
    estado_impresion VARCHAR(20) CHECK (estado_impresion IN ('PENDIENTE','IMPRESO')),
    FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido),
    FOREIGN KEY (id_producto) REFERENCES productos(id_producto),
    FOREIGN KEY (id_plato_menu) REFERENCES menu_diario_platos(id_plato_menu)
);

-- TABLA VENTAS
CREATE TABLE ventas (
    id_venta SERIAL PRIMARY KEY,
    id_pedido INT UNIQUE,
    cajero_id INT,
    fecha_emision TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    subtotal DECIMAL(10,2),
    igv DECIMAL(10,2),
    total DECIMAL(10,2),
    metodo_pago VARCHAR(20),
    comprobante_sunat VARCHAR(50),
    FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido),
    FOREIGN KEY (cajero_id) REFERENCES usuarios(id_usuario)
);

-- TABLA GASTOS
CREATE TABLE gastos (
    id_gasto SERIAL PRIMARY KEY,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    descripcion VARCHAR(255),
    monto DECIMAL(10,2),
    id_usuario INT,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
);