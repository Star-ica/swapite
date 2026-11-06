// ABI of the deployed SwapLite contract (native BOT <-> ERC-20) on BOT Chain mainnet.
// The empty add() and remove() functions are left out on purpose.
window.ARTIFACTS = {
  main: {
    abi: [
      "function token() view returns (address)",
      "function reserveBot() view returns (uint256)",
      "function reserveToken() view returns (uint256)",
      "function totalShares() view returns (uint256)",
      "function shares(address) view returns (uint256)",
      "function getAmountOut(bool botToToken, uint256 amountIn) view returns (uint256)",
      "function addLiquidity(uint256 tokenAmount) payable returns (uint256 s)",
      "function removeLiquidity(uint256 s)",
      "function swapBotForToken(uint256 minOut) payable returns (uint256 out)",
      "function swapTokenForBot(uint256 amountIn, uint256 minOut) returns (uint256 out)",
      "event LiquidityAdded(address indexed user, uint256 bot, uint256 tkn, uint256 shares)",
      "event LiquidityRemoved(address indexed user, uint256 bot, uint256 tkn, uint256 shares)",
      "event Swapped(address indexed user, bool botToToken, uint256 amountIn, uint256 amountOut)"
    ]
  }
};