// Edit address to point this front end at an existing deployment.
window.APP_CONFIG = {
  "address": "",
  "slug": "swaplite",
  "name": "SwapLite",
  "accent": "#2f5bd3",
  "tagline": "A tiny automated market maker for two tokens.",
  "about": "Constant-product pool (x·y=k) with a 0.3% fee. Add liquidity in the pool ratio, swap either way, and remove your share at any time.",
  "tokens": [
    "tokenA",
    "tokenB"
  ],
  "deploy": {
    "tokens": [
      {
        "name": "Token A",
        "symbol": "TKA"
      },
      {
        "name": "Token B",
        "symbol": "TKB"
      }
    ],
    "args": [
      "$t0",
      "$t1"
    ]
  },
  "stats": [
    {
      "label": "Reserve A",
      "fn": "reserveA",
      "fmt": "token"
    },
    {
      "label": "Reserve B",
      "fn": "reserveB",
      "fmt": "token"
    },
    {
      "label": "Total LP shares",
      "fn": "totalShares",
      "fmt": "token"
    },
    {
      "label": "Your LP shares",
      "fn": "shares",
      "fmt": "token",
      "args": [
        "me"
      ]
    }
  ],
  "actions": [
    {
      "title": "Add liquidity",
      "fn": "addLiquidity",
      "desc": "After the first deposit, amounts are matched to the pool ratio.",
      "inputs": [
        {
          "id": "a",
          "label": "Amount A",
          "type": "amount",
          "default": "100"
        },
        {
          "id": "b",
          "label": "Amount B",
          "type": "amount",
          "default": "100"
        }
      ]
    },
    {
      "title": "Remove liquidity",
      "fn": "removeLiquidity",
      "inputs": [
        {
          "id": "s",
          "label": "LP shares",
          "type": "amount",
          "default": "10"
        }
      ]
    },
    {
      "title": "Swap",
      "fn": "swap",
      "inputs": [
        {
          "id": "dir",
          "label": "Direction",
          "type": "bool",
          "options": [
            [
              "true",
              "A → B"
            ],
            [
              "false",
              "B → A"
            ]
          ]
        },
        {
          "id": "amountIn",
          "label": "Amount in",
          "type": "amount",
          "default": "10"
        },
        {
          "id": "minOut",
          "label": "Minimum out",
          "type": "amount",
          "default": "0"
        }
      ]
    }
  ],
  "views": [
    {
      "title": "Quote a swap",
      "fn": "getAmountOut",
      "button": "Get quote",
      "inputs": [
        {
          "id": "dir",
          "label": "Direction",
          "type": "bool",
          "options": [
            [
              "true",
              "A → B"
            ],
            [
              "false",
              "B → A"
            ]
          ]
        },
        {
          "id": "amountIn",
          "label": "Amount in",
          "type": "amount",
          "default": "10"
        }
      ]
    }
  ]
};
