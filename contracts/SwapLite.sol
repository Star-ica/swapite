// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "./Token.sol";

/// @title SwapLite - constant-product (x*y=k) pool for two tokens with a 0.3% fee.
contract SwapLite {
    IERC20 public immutable tokenA;
    IERC20 public immutable tokenB;
    uint256 public reserveA;
    uint256 public reserveB;
    uint256 public totalShares;
    mapping(address => uint256) public shares;

    event LiquidityAdded(address indexed user, uint256 a, uint256 b, uint256 shares);
    event LiquidityRemoved(address indexed user, uint256 a, uint256 b, uint256 shares);
    event Swapped(address indexed user, bool aToB, uint256 amountIn, uint256 amountOut);

    constructor(address a, address b) {
        require(a != b, "same token");
        tokenA = IERC20(a);
        tokenB = IERC20(b);
    }

    /// Pulls amounts in the pool's current ratio; any excess on the larger side is not taken.
    function addLiquidity(uint256 a, uint256 b) external returns (uint256 s) {
        require(a > 0 && b > 0, "zero");
        uint256 useA = a;
        uint256 useB = b;
        if (totalShares == 0) {
            s = _sqrt(a * b);
        } else {
            uint256 sa = (a * totalShares) / reserveA;
            uint256 sb = (b * totalShares) / reserveB;
            s = sa < sb ? sa : sb;
            useA = (s * reserveA) / totalShares;
            useB = (s * reserveB) / totalShares;
        }
        require(s > 0, "no shares");
        require(tokenA.transferFrom(msg.sender, address(this), useA), "A");
        require(tokenB.transferFrom(msg.sender, address(this), useB), "B");
        reserveA += useA; reserveB += useB;
        totalShares += s; shares[msg.sender] += s;
        emit LiquidityAdded(msg.sender, useA, useB, s);
    }

    function removeLiquidity(uint256 s) external {
        require(s > 0 && shares[msg.sender] >= s, "shares");
        uint256 a = (s * reserveA) / totalShares;
        uint256 b = (s * reserveB) / totalShares;
        shares[msg.sender] -= s; totalShares -= s;
        reserveA -= a; reserveB -= b;
        require(tokenA.transfer(msg.sender, a) && tokenB.transfer(msg.sender, b), "transfer");
        emit LiquidityRemoved(msg.sender, a, b, s);
    }

    function getAmountOut(bool aToB, uint256 amountIn) public view returns (uint256) {
        require(reserveA > 0 && reserveB > 0, "no liquidity");
        (uint256 rIn, uint256 rOut) = aToB ? (reserveA, reserveB) : (reserveB, reserveA);
        uint256 inFee = amountIn * 997;
        return (inFee * rOut) / (rIn * 1000 + inFee);
    }

    function swap(bool aToB, uint256 amountIn, uint256 minOut) external returns (uint256 out) {
        require(amountIn > 0, "zero");
        out = getAmountOut(aToB, amountIn);
        require(out > 0 && out >= minOut, "slippage");
        if (aToB) {
            require(tokenA.transferFrom(msg.sender, address(this), amountIn), "in");
            reserveA += amountIn; reserveB -= out;
            require(tokenB.transfer(msg.sender, out), "out");
        } else {
            require(tokenB.transferFrom(msg.sender, address(this), amountIn), "in");
            reserveB += amountIn; reserveA -= out;
            require(tokenA.transfer(msg.sender, out), "out");
        }
        emit Swapped(msg.sender, aToB, amountIn, out);
    }

    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) { z = y; uint256 x = y / 2 + 1; while (x < z) { z = x; x = (y / x + x) / 2; } }
        else if (y != 0) { z = 1; }
    }
}
