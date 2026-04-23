# API ENDPOINTS

## GET /productos
Obtiene todos los productos

Respuesta:
200 OK
[
  {
    "id_producto": 1,
    "nombre": "Arroz con pollo",
    "precio_unico": 15.00
  }
]

---
## POST /pedidos
Crea un nuevo pedido

Body:
{
  "id_mesa": 1,
  "id_usuario": 2,
  "items": [
    {
      "id_producto": 1,
      "cantidad": 2
    }
  ]
}

Respuesta:
201 Created
{
  "id_pedido": 10
}