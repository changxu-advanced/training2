# API 参考（自动生成）

由 packages/api-contracts 经 tools/codegen 生成，禁止手改。更新：pnpm codegen；验证：pnpm codegen:check。业务实现及生成方式见 [API 指南](./api.md)。下列结构直接来自 OpenAPI，不作为运行结果证明。

## public API

### searchProducts

`GET /products`

Search products and current stock

#### 认证

```json
[]
```

#### 参数

```json
[
  {
    "schema": {
      "type": "integer",
      "minimum": 1,
      "default": 1
    },
    "required": false,
    "name": "page",
    "in": "query"
  },
  {
    "schema": {
      "type": "integer",
      "minimum": 1,
      "maximum": 100,
      "default": 20
    },
    "required": false,
    "name": "pageSize",
    "in": "query"
  },
  {
    "schema": {
      "type": "string",
      "enum": [
        "true",
        "false"
      ],
      "description": "true: stock greater than zero; false or omitted: all products"
    },
    "required": false,
    "description": "true: stock greater than zero; false or omitted: all products",
    "name": "inStock",
    "in": "query"
  },
  {
    "schema": {
      "type": "string",
      "description": "Trim and uppercase; blank means absent; exact match"
    },
    "required": false,
    "description": "Trim and uppercase; blank means absent; exact match",
    "name": "code",
    "in": "query"
  },
  {
    "schema": {
      "type": "string",
      "description": "Trim; blank means absent; literal case-insensitive substring; combined with code using AND"
    },
    "required": false,
    "description": "Trim; blank means absent; literal case-insensitive substring; combined with code using AND",
    "name": "name",
    "in": "query"
  }
]
```

#### 响应

```json
{
  "200": {
    "description": "Products sorted by code",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ProductsPage"
        }
      }
    }
  },
  "400": {
    "description": "Invalid input",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "500": {
    "description": "Internal response or service error",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "501": {
    "description": "Operation not implemented",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  }
}
```

### getStock

`GET /products/{id}/stock`

Get current stock snapshot

#### 认证

```json
[]
```

#### 参数

```json
[
  {
    "schema": {
      "type": "string",
      "format": "uuid"
    },
    "required": true,
    "name": "id",
    "in": "path"
  }
]
```

#### 响应

```json
{
  "200": {
    "description": "Current stock, not reserved",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/Stock"
        }
      }
    }
  },
  "400": {
    "description": "Invalid input",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "404": {
    "description": "Not found or not owner",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "500": {
    "description": "Internal response or service error",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "501": {
    "description": "Operation not implemented",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  }
}
```

### createOrder

`POST /orders`

Create draft without reserving stock

#### 认证

```json
[
  {
    "bearerAuth": []
  }
]
```

#### 参数

```json
[
  {
    "schema": {
      "type": "string",
      "format": "uuid"
    },
    "required": true,
    "name": "idempotency-key",
    "in": "header"
  }
]
```

#### 请求体

```json
{
  "required": true,
  "content": {
    "application/json": {
      "schema": {
        "$ref": "#/components/schemas/OrderInput"
      }
    }
  }
}
```

#### 响应

```json
{
  "200": {
    "description": "Existing order for same owner/key/input",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/Order"
        }
      }
    }
  },
  "201": {
    "description": "New draft",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/Order"
        }
      }
    }
  },
  "400": {
    "description": "Invalid input",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "401": {
    "description": "Authentication required",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "404": {
    "description": "Not found or not owner",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "409": {
    "description": "Business or idempotency conflict",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "415": {
    "description": "Unsupported content type",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "500": {
    "description": "Internal response or service error",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "501": {
    "description": "Operation not implemented",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "503": {
    "description": "Retry exhausted",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  }
}
```

### listOrders

`GET /orders`

List own orders newest first with current confirmation availability

#### 认证

```json
[
  {
    "bearerAuth": []
  }
]
```

#### 参数

```json
[
  {
    "schema": {
      "type": "integer",
      "minimum": 1,
      "default": 1
    },
    "required": false,
    "name": "page",
    "in": "query"
  },
  {
    "schema": {
      "type": "integer",
      "minimum": 1,
      "maximum": 100,
      "default": 20
    },
    "required": false,
    "name": "pageSize",
    "in": "query"
  },
  {
    "schema": {
      "type": "string",
      "enum": [
        "draft",
        "confirmed",
        "cancelled"
      ]
    },
    "required": false,
    "name": "status",
    "in": "query"
  }
]
```

#### 响应

```json
{
  "200": {
    "description": "Own orders, never another buyer's orders",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/OrdersPage"
        }
      }
    }
  },
  "400": {
    "description": "Invalid input",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "401": {
    "description": "Authentication required",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "500": {
    "description": "Internal response or service error",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "501": {
    "description": "Operation not implemented",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  }
}
```

### getOrder

`GET /orders/{id}`

Read own order

#### 认证

```json
[
  {
    "bearerAuth": []
  }
]
```

#### 参数

```json
[
  {
    "schema": {
      "type": "string",
      "format": "uuid"
    },
    "required": true,
    "name": "id",
    "in": "path"
  }
]
```

#### 响应

```json
{
  "200": {
    "description": "Own order",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/Order"
        }
      }
    }
  },
  "400": {
    "description": "Invalid input",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "401": {
    "description": "Authentication required",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "404": {
    "description": "Not found or not owner",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "500": {
    "description": "Internal response or service error",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "501": {
    "description": "Operation not implemented",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  }
}
```

### confirmOrder

`POST /orders/{id}/confirm`

Confirm once with atomic stock allocation

#### 认证

```json
[
  {
    "bearerAuth": []
  }
]
```

#### 参数

```json
[
  {
    "schema": {
      "type": "string",
      "format": "uuid"
    },
    "required": true,
    "name": "id",
    "in": "path"
  }
]
```

#### 响应

```json
{
  "200": {
    "description": "Confirmed or already confirmed",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/Order"
        }
      }
    }
  },
  "400": {
    "description": "Invalid input",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "401": {
    "description": "Authentication required",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "404": {
    "description": "Not found or not owner",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "409": {
    "description": "Business or idempotency conflict",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "500": {
    "description": "Internal response or service error",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "501": {
    "description": "Operation not implemented",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "503": {
    "description": "Retry exhausted",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  }
}
```

### cancelOrder

`POST /orders/{id}/cancel`

Cancel once; restore stock only when previously confirmed

#### 认证

```json
[
  {
    "bearerAuth": []
  }
]
```

#### 参数

```json
[
  {
    "schema": {
      "type": "string",
      "format": "uuid"
    },
    "required": true,
    "name": "id",
    "in": "path"
  }
]
```

#### 响应

```json
{
  "200": {
    "description": "Cancelled or already cancelled",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/Order"
        }
      }
    }
  },
  "400": {
    "description": "Invalid input",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "401": {
    "description": "Authentication required",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "404": {
    "description": "Not found or not owner",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "500": {
    "description": "Internal response or service error",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "501": {
    "description": "Operation not implemented",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "503": {
    "description": "Retry exhausted",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  }
}
```

### deleteCancelledOrders

`DELETE /orders/cancelled`

Remove all own cancelled orders from history; preserve durable idempotency records

#### 认证

```json
[
  {
    "bearerAuth": []
  }
]
```

#### 响应

```json
{
  "200": {
    "description": "Number of newly deleted cancelled orders",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/OrderCleanupResult"
        }
      }
    }
  },
  "401": {
    "description": "Authentication required",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "500": {
    "description": "Internal response or service error",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "501": {
    "description": "Operation not implemented",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "503": {
    "description": "Retry exhausted",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  }
}
```

### catalogEvents

`GET /catalog/events`

Committed catalog invalidation hints over SSE; reconnect and refetch snapshots

#### 认证

```json
[]
```

#### 响应

```json
{
  "200": {
    "description": "Events catalog: changed and heartbeat: ok; no buyer or order information",
    "content": {
      "text/event-stream": {
        "schema": {
          "type": "string"
        }
      }
    }
  },
  "500": {
    "description": "Internal response or service error",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "503": {
    "description": "Retry exhausted",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  }
}
```

### 共享模型与认证定义

```json
{
  "securitySchemes": {
    "bearerAuth": {
      "type": "http",
      "scheme": "bearer",
      "bearerFormat": "JWT"
    }
  },
  "schemas": {
    "ProductsPage": {
      "type": "object",
      "properties": {
        "items": {
          "type": "array",
          "items": {
            "$ref": "#/components/schemas/Product"
          }
        },
        "page": {
          "type": "integer",
          "minimum": 1
        },
        "pageSize": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100
        },
        "total": {
          "type": "integer",
          "minimum": 0
        }
      },
      "required": [
        "items",
        "page",
        "pageSize",
        "total"
      ],
      "additionalProperties": false
    },
    "Product": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid"
        },
        "code": {
          "type": "string",
          "pattern": "^[A-Z0-9_-]{1,32}$"
        },
        "name": {
          "type": "string",
          "pattern": "^[\\s\\S]{1,100}$/u"
        },
        "description": {
          "type": "string",
          "pattern": "^[\\s\\S]{0,2000}$/u"
        },
        "priceJpy": {
          "type": "integer",
          "minimum": 0,
          "maximum": 100000000
        },
        "stock": {
          "type": "integer",
          "minimum": 0,
          "maximum": 1000000
        }
      },
      "required": [
        "id",
        "code",
        "name",
        "description",
        "priceJpy",
        "stock"
      ],
      "additionalProperties": false
    },
    "ApiError": {
      "type": "object",
      "properties": {
        "error": {
          "type": "object",
          "properties": {
            "code": {
              "type": "string",
              "enum": [
                "INVALID_INPUT",
                "UNAUTHENTICATED",
                "FORBIDDEN",
                "NOT_FOUND",
                "DUPLICATE_PRODUCT",
                "IDEMPOTENCY_CONFLICT",
                "INSUFFICIENT_STOCK",
                "INVALID_ORDER_STATE",
                "TEMPORARILY_UNAVAILABLE",
                "INTERNAL_ERROR",
                "NOT_IMPLEMENTED",
                "UNSUPPORTED_MEDIA_TYPE"
              ]
            },
            "message": {
              "type": "string"
            },
            "requestId": {
              "type": "string"
            },
            "fields": {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          },
          "required": [
            "code",
            "message",
            "requestId"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "error"
      ],
      "additionalProperties": false
    },
    "Stock": {
      "type": "object",
      "properties": {
        "productId": {
          "type": "string",
          "format": "uuid"
        },
        "stock": {
          "type": "integer",
          "minimum": 0,
          "maximum": 1000000
        }
      },
      "required": [
        "productId",
        "stock"
      ],
      "additionalProperties": false
    },
    "Order": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid"
        },
        "status": {
          "type": "string",
          "enum": [
            "draft",
            "confirmed",
            "cancelled"
          ]
        },
        "items": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "productId": {
                "type": "string",
                "format": "uuid"
              },
              "productCode": {
                "type": "string"
              },
              "productName": {
                "type": "string"
              },
              "unitPriceJpy": {
                "type": "integer",
                "minimum": 0,
                "maximum": 100000000
              },
              "quantity": {
                "type": "integer",
                "minimum": 1,
                "maximum": 1000
              }
            },
            "required": [
              "productId",
              "productCode",
              "productName",
              "unitPriceJpy",
              "quantity"
            ],
            "additionalProperties": false
          },
          "minItems": 1,
          "maxItems": 50
        },
        "totalJpy": {
          "type": "integer",
          "minimum": 0,
          "maximum": 5000000000000
        },
        "createdAt": {
          "type": "string",
          "format": "date-time"
        },
        "confirmedAt": {
          "type": [
            "string",
            "null"
          ],
          "format": "date-time"
        },
        "cancelledAt": {
          "type": [
            "string",
            "null"
          ],
          "format": "date-time"
        }
      },
      "required": [
        "id",
        "status",
        "items",
        "totalJpy",
        "createdAt",
        "confirmedAt",
        "cancelledAt"
      ],
      "additionalProperties": false
    },
    "OrderInput": {
      "type": "object",
      "properties": {
        "items": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "productId": {
                "type": "string",
                "format": "uuid"
              },
              "quantity": {
                "type": "integer",
                "minimum": 1,
                "maximum": 1000
              }
            },
            "required": [
              "productId",
              "quantity"
            ],
            "additionalProperties": false
          },
          "minItems": 1,
          "maxItems": 50
        }
      },
      "required": [
        "items"
      ],
      "additionalProperties": false
    },
    "OrdersPage": {
      "type": "object",
      "properties": {
        "items": {
          "type": "array",
          "items": {
            "allOf": [
              {
                "$ref": "#/components/schemas/Order"
              },
              {
                "type": "object",
                "properties": {
                  "canConfirm": {
                    "type": "boolean"
                  }
                },
                "required": [
                  "canConfirm"
                ],
                "additionalProperties": false
              }
            ]
          }
        },
        "page": {
          "type": "integer",
          "minimum": 1
        },
        "pageSize": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100
        },
        "total": {
          "type": "integer",
          "minimum": 0
        }
      },
      "required": [
        "items",
        "page",
        "pageSize",
        "total"
      ],
      "additionalProperties": false
    },
    "OrderCleanupResult": {
      "type": "object",
      "properties": {
        "deletedCount": {
          "type": "integer",
          "minimum": 0
        }
      },
      "required": [
        "deletedCount"
      ],
      "additionalProperties": false
    }
  },
  "parameters": {}
}
```

## private API

### registerProduct

`POST /products`

Admin registers product

#### 认证

```json
[
  {
    "bearerAuth": []
  }
]
```

#### 请求体

```json
{
  "required": true,
  "content": {
    "application/json": {
      "schema": {
        "$ref": "#/components/schemas/ProductInput"
      }
    }
  }
}
```

#### 响应

```json
{
  "201": {
    "description": "Registered product",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/Product"
        }
      }
    }
  },
  "400": {
    "description": "Invalid input",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "401": {
    "description": "Authentication required",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "403": {
    "description": "Admin role required",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "409": {
    "description": "Business or idempotency conflict",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "415": {
    "description": "Unsupported content type",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "500": {
    "description": "Internal response or service error",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "501": {
    "description": "Operation not implemented",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  }
}
```

### listProducts

`GET /products`

Admin lists products

#### 认证

```json
[
  {
    "bearerAuth": []
  }
]
```

#### 参数

```json
[
  {
    "schema": {
      "type": "integer",
      "minimum": 1,
      "default": 1
    },
    "required": false,
    "name": "page",
    "in": "query"
  },
  {
    "schema": {
      "type": "integer",
      "minimum": 1,
      "maximum": 100,
      "default": 20
    },
    "required": false,
    "name": "pageSize",
    "in": "query"
  }
]
```

#### 响应

```json
{
  "200": {
    "description": "Products sorted by code",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ProductsPage"
        }
      }
    }
  },
  "400": {
    "description": "Invalid input",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "401": {
    "description": "Authentication required",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "403": {
    "description": "Admin role required",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "500": {
    "description": "Internal response or service error",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "501": {
    "description": "Operation not implemented",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  }
}
```

### getProduct

`GET /products/{id}`

Admin reads product for restocking

#### 认证

```json
[
  {
    "bearerAuth": []
  }
]
```

#### 参数

```json
[
  {
    "schema": {
      "type": "string",
      "format": "uuid"
    },
    "required": true,
    "name": "id",
    "in": "path"
  }
]
```

#### 响应

```json
{
  "200": {
    "description": "Current product",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/Product"
        }
      }
    }
  },
  "400": {
    "description": "Invalid input",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "401": {
    "description": "Authentication required",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "403": {
    "description": "Admin role required",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "404": {
    "description": "Not found or not owner",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "500": {
    "description": "Internal response or service error",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "501": {
    "description": "Operation not implemented",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  }
}
```

### restockProduct

`POST /products/{id}/restock`

Admin adds stock atomically; same owner/key never adds twice

#### 认证

```json
[
  {
    "bearerAuth": []
  }
]
```

#### 参数

```json
[
  {
    "schema": {
      "type": "string",
      "format": "uuid"
    },
    "required": true,
    "name": "id",
    "in": "path"
  },
  {
    "schema": {
      "type": "string",
      "format": "uuid"
    },
    "required": true,
    "name": "idempotency-key",
    "in": "header"
  }
]
```

#### 请求体

```json
{
  "required": true,
  "content": {
    "application/json": {
      "schema": {
        "$ref": "#/components/schemas/RestockInput"
      }
    }
  }
}
```

#### 响应

```json
{
  "200": {
    "description": "Current product after this restock or an idempotent replay",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/Product"
        }
      }
    }
  },
  "400": {
    "description": "Invalid input",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "401": {
    "description": "Authentication required",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "403": {
    "description": "Admin role required",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "404": {
    "description": "Not found or not owner",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "409": {
    "description": "Business or idempotency conflict",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "415": {
    "description": "Unsupported content type",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "500": {
    "description": "Internal response or service error",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "501": {
    "description": "Operation not implemented",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "503": {
    "description": "Retry exhausted",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  }
}
```

### catalogEvents

`GET /catalog/events`

Committed catalog invalidation hints over SSE; reconnect and refetch snapshots

#### 认证

```json
[]
```

#### 响应

```json
{
  "200": {
    "description": "Events catalog: changed and heartbeat: ok; no buyer or order information",
    "content": {
      "text/event-stream": {
        "schema": {
          "type": "string"
        }
      }
    }
  },
  "500": {
    "description": "Internal response or service error",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  },
  "503": {
    "description": "Retry exhausted",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/ApiError"
        }
      }
    }
  }
}
```

### 共享模型与认证定义

```json
{
  "securitySchemes": {
    "bearerAuth": {
      "type": "http",
      "scheme": "bearer",
      "bearerFormat": "JWT"
    }
  },
  "schemas": {
    "Product": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid"
        },
        "code": {
          "type": "string",
          "pattern": "^[A-Z0-9_-]{1,32}$"
        },
        "name": {
          "type": "string",
          "pattern": "^[\\s\\S]{1,100}$/u"
        },
        "description": {
          "type": "string",
          "pattern": "^[\\s\\S]{0,2000}$/u"
        },
        "priceJpy": {
          "type": "integer",
          "minimum": 0,
          "maximum": 100000000
        },
        "stock": {
          "type": "integer",
          "minimum": 0,
          "maximum": 1000000
        }
      },
      "required": [
        "id",
        "code",
        "name",
        "description",
        "priceJpy",
        "stock"
      ],
      "additionalProperties": false
    },
    "ApiError": {
      "type": "object",
      "properties": {
        "error": {
          "type": "object",
          "properties": {
            "code": {
              "type": "string",
              "enum": [
                "INVALID_INPUT",
                "UNAUTHENTICATED",
                "FORBIDDEN",
                "NOT_FOUND",
                "DUPLICATE_PRODUCT",
                "IDEMPOTENCY_CONFLICT",
                "INSUFFICIENT_STOCK",
                "INVALID_ORDER_STATE",
                "TEMPORARILY_UNAVAILABLE",
                "INTERNAL_ERROR",
                "NOT_IMPLEMENTED",
                "UNSUPPORTED_MEDIA_TYPE"
              ]
            },
            "message": {
              "type": "string"
            },
            "requestId": {
              "type": "string"
            },
            "fields": {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          },
          "required": [
            "code",
            "message",
            "requestId"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "error"
      ],
      "additionalProperties": false
    },
    "ProductInput": {
      "type": "object",
      "properties": {
        "code": {
          "type": "string",
          "pattern": "^[A-Z0-9_-]{1,32}$"
        },
        "name": {
          "type": "string",
          "pattern": "^[\\s\\S]{1,100}$/u"
        },
        "description": {
          "type": "string",
          "pattern": "^[\\s\\S]{0,2000}$/u",
          "default": ""
        },
        "priceJpy": {
          "type": "integer",
          "minimum": 0,
          "maximum": 100000000
        },
        "stock": {
          "type": "integer",
          "minimum": 0,
          "maximum": 1000000
        }
      },
      "required": [
        "code",
        "name",
        "priceJpy",
        "stock"
      ],
      "additionalProperties": false
    },
    "ProductsPage": {
      "type": "object",
      "properties": {
        "items": {
          "type": "array",
          "items": {
            "$ref": "#/components/schemas/Product"
          }
        },
        "page": {
          "type": "integer",
          "minimum": 1
        },
        "pageSize": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100
        },
        "total": {
          "type": "integer",
          "minimum": 0
        }
      },
      "required": [
        "items",
        "page",
        "pageSize",
        "total"
      ],
      "additionalProperties": false
    },
    "RestockInput": {
      "type": "object",
      "properties": {
        "quantity": {
          "type": "integer",
          "minimum": 1,
          "maximum": 2000
        }
      },
      "required": [
        "quantity"
      ],
      "additionalProperties": false
    }
  },
  "parameters": {}
}
```
