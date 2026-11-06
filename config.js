// BOT Chain mainnet deployment. "TOKEN" in labels is replaced with the pool token's symbol.
window.APP_CONFIG = {
  "address": "0xD29de39fAF2656690ac64bC0e632b230b6FFF277",
  "slug": "swaplite",
  "name": "SwapLite",
  "accent": "#2f5bd3",
  "tagline": "Swap BOT and a token in one tiny pool.",
  "about": "Constant-product pool (x·y=k) between native BOT and one ERC-20 token, with a 0.3% fee. Add liquidity in the pool ratio, swap either way, and remove your share at any time.",
  "tokens": ["token"],
  "stats": [
    { "label": "BOT in pool", "fn": "reserveBot", "fmt": "token" },
    { "label": "TOKEN in pool", "fn": "reserveToken", "fmt": "tkn" },
    { "label": "Total LP shares", "fn": "totalShares", "fmt": "token" },
    { "label": "Your LP shares", "fn": "shares", "fmt": "token", "args": ["me"] }
  ],
  "actions": [
    {
      "title": "Swap BOT → TOKEN",
      "fn": "swapBotForToken",
      "valueInput": "amountIn",
      "quote": { "dir": true, "from": "amountIn", "slip": "slip" },
      "inputs": [
        { "id": "amountIn", "label": "BOT to sell", "type": "amount", "default": "1" },
        { "id": "slip", "label": "Max slippage %", "type": "percent", "default": "1" }
      ]
    },
    {
      "title": "Swap TOKEN → BOT",
      "fn": "swapTokenForBot",
      "approve": "amountIn",
      "quote": { "dir": false, "from": "amountIn", "slip": "slip" },
      "inputs": [
        { "id": "amountIn", "label": "TOKEN to sell", "type": "tokenAmount", "default": "10" },
        { "id": "slip", "label": "Max slippage %", "type": "percent", "default": "1" }
      ]
    },
    {
      "title": "Add liquidity",
      "fn": "addLiquidity",
      "desc": "After the first deposit, amounts are matched to the pool ratio and any extra BOT is refunded.",
      "valueInput": "bot",
      "approve": "tkn",
      "inputs": [
        { "id": "bot", "label": "BOT", "type": "amount", "default": "10" },
        { "id": "tkn", "label": "TOKEN", "type": "tokenAmount", "default": "100" }
      ]
    },
    {
      "title": "Remove liquidity",
      "fn": "removeLiquidity",
      "desc": "Same units as \"Your LP shares\" above.",
      "inputs": [ { "id": "s", "label": "LP shares", "type": "amount", "default": "1" } ]
    }
  ],
  "views": [
    {
      "title": "Quote BOT → TOKEN",
      "fn": "getAmountOut",
      "fmt": "tkn",
      "button": "Get quote",
      "inputs": [
        { "id": "dir", "type": "const", "value": true },
        { "id": "amountIn", "label": "BOT in", "type": "amount", "default": "1" }
      ]
    },
    {
      "title": "Quote TOKEN → BOT",
      "fn": "getAmountOut",
      "fmt": "token",
      "button": "Get quote",
      "inputs": [
        { "id": "dir", "type": "const", "value": false },
        { "id": "amountIn", "label": "TOKEN in", "type": "tokenAmount", "default": "10" }
      ]
    },
    {
      "title": "LP shares of an address",
      "fn": "shares",
      "fmt": "token",
      "inputs": [ { "id": "a", "label": "Address", "type": "address", "meDefault": true } ]
    }
  ]
};