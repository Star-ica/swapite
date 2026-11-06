(function () {
  "use strict";
  var ethers = window.ethers, C = window.APP_CONFIG, A = window.ARTIFACTS;
  // BOT Chain mainnet
  var CHAIN = { id: 677, hex: "0x2a5", name: "BOT Chain Mainnet", rpc: "https://rpc.botchain.ai", explorer: "https://scan.botchain.ai", currency: { name: "BOT", symbol: "BOT", decimals: 18 } };
  var $ = function (s) { return document.querySelector(s); };
  // Address comes only from config.js (no localStorage override that could point at an old testnet deploy)
  var account = null, mainAddr = C.address || "", txBusy = false, isOwner = false;
  // The pool's ERC-20 (read from the contract): { addr, sym, dec }
  var tok = null, ERC20 = ["function symbol() view returns (string)", "function decimals() view returns (uint8)", "function balanceOf(address) view returns (uint256)", "function allowance(address,address) view returns (uint256)", "function approve(address,uint256) returns (bool)"];
  var readProvider = new ethers.JsonRpcProvider(CHAIN.rpc, CHAIN.id, { staticNetwork: ethers.Network.from(CHAIN.id) });

  function h(tag, attrs) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "class") n.className = attrs[k];
      else if (k === "text") n.textContent = attrs[k];
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    for (var i = 2; i < arguments.length; i++) { var c = arguments[i]; if (c == null) continue; n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); }
    return n;
  }
  // "TOKEN" in config labels becomes the pool token's symbol once it is loaded
  var L = function (s) { return s == null ? s : String(s).replace(/\bTOKEN\b/g, tok ? tok.sym : "token"); };
  var short = function (a) { return a.slice(0, 6) + "…" + a.slice(-4); };
  var addrLink = function (a) { return h("a", { href: CHAIN.explorer + "/address/" + a, target: "_blank", rel: "noopener", class: "mono", text: short(a) }); };
  function units(v, dec) {
    var s = ethers.formatUnits(v, dec == null ? 18 : dec).split("."), d = (s[1] || "").slice(0, 4).replace(/0+$/, "");
    return BigInt(s[0]).toLocaleString("en-US") + (d ? "." + d : "");
  }
  function fmt(kind, v) {
    if (v === undefined || v === null) return "—";
    switch (kind) {
      case "token": return units(v);
      case "bps": return (Number(v) / 100) + "%";
      case "ratio": return v >= (2n ** 200n) ? "∞" : Number(ethers.formatUnits(v, 18)).toFixed(3);
      case "time": return v === 0n ? "—" : new Date(Number(v) * 1000).toLocaleString();
      case "bool": return v ? "Yes" : "No";
      case "tkn": return tok ? units(v, tok.dec) + " " + tok.sym : String(v);
      case "list": return v.length ? Array.prototype.map.call(v, String).join(", ") : "none";
      default: return String(v);
    }
  }
  function fmtNamed(name, v) {
    if (typeof v === "bigint") {
      if (C.enums && C.enums[name]) return C.enums[name][Number(v)] || String(v);
      if ((C.amountFields || []).indexOf(name) > -1) return units(v);
      if ((C.timeFields || []).indexOf(name) > -1) return fmt("time", v);
      if ((C.bpsFields || []).indexOf(name) > -1) return fmt("bps", v);
      return String(v);
    }
    if (typeof v === "boolean") return fmt("bool", v);
    if (typeof v === "string" && ethers.isAddress(v)) return addrLink(v);
    if (v && typeof v === "object" && v.length !== undefined) return Array.prototype.map.call(v, String).join(", ") || "none";
    return String(v);
  }

  // ---------- status toasts ----------
  function toast(msg, opts) {
    opts = opts || {};
    var box = $("#status"), d = h("div", { class: opts.err ? "err" : "" }, msg);
    if (opts.hash) { d.appendChild(document.createTextNode(" ")); d.appendChild(h("a", { href: CHAIN.explorer + "/tx/" + opts.hash, target: "_blank", rel: "noopener", text: "view tx" })); }
    box.appendChild(d);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    if (!opts.sticky) setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, opts.err ? 9000 : 5000);
    return d;
  }
  var errText = function (e) { return (e && (e.shortMessage || e.reason || (e.info && e.info.error && e.info.error.message) || e.message)) || String(e); };
  function cleanRevert(e) {
    var m = errText(e), r = m.match(/reverted(?: with reason string)?:?\s*"?([^"\n]+)"?/i);
    return r ? r[1].trim() : m;
  }
  function withTimeout(p, ms, msg) {
    return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error(msg)); }, ms); })]);
  }

 // ---------- wallet ----------
async function switchChain() {
  var id = parseInt(await window.ethereum.request({ method: "eth_chainId" }), 16);
  if (id === CHAIN.id) return;
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN.hex }] });
  } catch (e) {
    if (e && (e.code === 4902 || e.code === -32603 || /unrecognized|not been added/i.test(e.message || ""))) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{ chainId: CHAIN.hex, chainName: CHAIN.name, nativeCurrency: CHAIN.currency, rpcUrls: [CHAIN.rpc], blockExplorerUrls: [CHAIN.explorer] }]
      });
    } else throw e;
  }
}

async function connect(quiet) {
  if (!window.ethereum) {
    if (!quiet) throw new Error("No wallet found. Install MetaMask or another EVM wallet, then reload.");
    return;
  }
  // eth_accounts = silent (no popup), eth_requestAccounts = popup; time out instead of hanging forever
  var accounts = await withTimeout(
    window.ethereum.request({ method: quiet ? "eth_accounts" : "eth_requestAccounts" }),
    quiet ? 5000 : 60000,
    "Wallet did not respond. Open MetaMask from the toolbar and clear pending requests."
  );
  if (!accounts || !accounts.length) return;
  account = ethers.getAddress(accounts[0]);
  try { isOwner = (await mainC().owner()).toLowerCase() === account.toLowerCase(); } catch (e) { isOwner = false; }
  renderActions();
  await refreshBadge();
  await refreshAll();
  if (!quiet) {
    // Switch network in the background so a hidden prompt can't freeze connect
    withTimeout(switchChain(), 60000, "switch").then(refreshBadge)
      .catch(function () { toast("Switch your wallet to BOT Chain (677) before sending transactions", { err: true }); });
  }
}

  async function refreshBadge() {
    var b = $("#netBadge"), btn = $("#connectBtn");
    if (!account) { b.textContent = "Not connected"; b.className = "badge"; btn.textContent = "Connect wallet"; return; }
    var id = parseInt(await window.ethereum.request({ method: "eth_chainId" }), 16);
    btn.textContent = short(account);
    if (id === CHAIN.id) { b.textContent = CHAIN.name + " (677)"; b.className = "badge ok"; }
    else { b.textContent = "Wrong network (" + id + ")"; b.className = "badge bad"; }
  }
  function mainC() { return new ethers.Contract(mainAddr, A.main.abi, readProvider); }

  // Estimate on our own RPC (reverts show the contract's message), then hand the wallet a complete tx
  async function send(label, fn, args, value, target) {
    if (!account) await connect(false);
    if (!account) throw new Error("Connect your wallet first");
    if (txBusy) throw new Error("Another transaction is still pending");
    txBusy = true;
    var t = null, p = null;
    try {
      await withTimeout(switchChain(), 60000, "Approve the switch to BOT Chain in your wallet");
      value = value || 0n;
      var to = target || mainAddr, data = (target ? new ethers.Interface(ERC20) : mainC().interface).encodeFunctionData(fn, args || []);
      var gas;
      try { gas = await readProvider.estimateGas({ from: account, to: to, data: data, value: value }); }
      catch (e) { throw new Error(cleanRevert(e)); }
      t = toast(label + ": confirm in your wallet…", { sticky: true });
      var hash = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [{ from: account, to: to, data: data, value: ethers.toQuantity(value), gas: ethers.toQuantity(gas * 12n / 10n) }]
      });
      t.remove(); t = null;
      p = toast(label + ": pending…", { sticky: true, hash: hash });
      var r = await readProvider.waitForTransaction(hash, 1, 180000);
      p.remove(); p = null;
      if (!r) throw new Error("not confirmed within 3 minutes, check the explorer");
      if (r.status !== 1) throw new Error("transaction reverted");
      toast(label + " confirmed ✓", { hash: hash });
      await refreshAll();
      return true;
    } catch (e) {
      if (t) t.remove(); if (p) p.remove();
      toast(label + " failed: " + errText(e), { err: true });
      return false;
    } finally { txBusy = false; }
  }

  // ---------- inputs ----------
  function field(inp) {
    if (inp.type === "const") return null;
    var id = "f_" + inp.id, ctl;
    if (inp.type === "bool") {
      ctl = h("select", { id: id });
      (inp.options || [["true", "Yes"], ["false", "No"]]).forEach(function (o) { ctl.appendChild(h("option", { value: o[0], text: o[1] })); });
    } else {
      ctl = h("input", { id: id, autocomplete: "off", inputmode: (inp.type === "amount" || inp.type === "uint" || inp.type === "days" || inp.type === "daysFromNow") ? "decimal" : "text", placeholder: inp.placeholder || (inp.type === "address" ? (inp.meDefault ? "0x… (blank = you)" : "0x…") : ""), value: inp.default != null ? inp.default : "" });
    }
    return h("label", {}, L(inp.label), ctl);
  }
  function parse(inp, form) {
    if (inp.type === "const") return inp.value;
    var el = form.querySelector("#f_" + inp.id), v = (el.value || "").trim();
    if (inp.type === "bool") return v === "true";
    if (v === "" && !(inp.type === "address" && inp.meDefault)) throw new Error(inp.label + " is required");
    switch (inp.type) {
      case "tokenAmount":
        if (!tok) throw new Error("Token not loaded yet");
        var ta = ethers.parseUnits(v, tok.dec);
        if (ta <= 0n) throw new Error(inp.label + " must be greater than 0");
        return ta;
      case "percent":
        var pc = Number(v);
        if (!(pc >= 0 && pc < 100)) throw new Error(inp.label + " must be between 0 and 100");
        return BigInt(Math.round(pc * 100));
      case "amount":
        var amt = ethers.parseUnits(v, 18);
        if (amt <= 0n) throw new Error(inp.label + " must be greater than 0");
        return amt;
      case "uint":
        if (!/^\d+$/.test(v)) throw new Error(inp.label + " must be a whole number");
        return BigInt(v);
      case "days": return BigInt(v) * 86400n;
      case "daysFromNow": return BigInt(Math.floor(Date.now() / 1000)) + BigInt(v) * 86400n;
      case "address":
        if (v === "" || v.toLowerCase() === "me") { if (!account) throw new Error("Connect your wallet first"); return account; }
        if (!ethers.isAddress(v)) throw new Error(inp.label + " is not a valid address");
        return v;
      default: return v;
    }
  }

  // ---------- sections ----------
  function renderResult(fnName, res) {
    var outs = mainC().interface.getFunction(fnName).outputs, dl = h("dl", { class: "kv" });
    if (outs.length === 1) {
      var d = h("dd"); d.append(fmtNamed(outs[0].name, res));
      dl.appendChild(h("dt", { text: outs[0].name || "result" })); dl.appendChild(d);
    } else {
      outs.forEach(function (o, i) {
        var d2 = h("dd"); d2.append(fmtNamed(o.name, res[i]));
        dl.appendChild(h("dt", { text: o.name || "#" + i })); dl.appendChild(d2);
      });
    }
    return dl;
  }
  function renderActions() {
    var box = $("#actions"); box.innerHTML = "";
    (C.actions || []).filter(function (a) { return !a.owner || isOwner; }).forEach(function (a) {
      var form = h("form", {}, h("h3", { text: L(a.title) }), a.desc ? h("p", { class: "desc", text: L(a.desc) }) : null);
      var row = h("div", { class: "row" });
      (a.inputs || []).forEach(function (i) { var f = field(i); if (f) row.appendChild(f); });
      form.appendChild(row);
      var btn = h("button", { class: "btn primary", type: "submit", text: L(a.button || a.title) });
      form.appendChild(btn);
      form.addEventListener("submit", async function (ev) {
        ev.preventDefault(); btn.disabled = true;
        try {
          var args = (a.inputs || []).map(function (i) { return parse(i, form); });
          var ids = (a.inputs || []).map(function (i) { return i.id; }); // kept in step with args
          if (!mainAddr) throw new Error("Set the contract address in config.js");
          var value = 0n;
          if (a.valueInput) {
            // That input is sent as BOT (msg.value) rather than as a function argument
            var k = ids.indexOf(a.valueInput);
            value = args[k]; args.splice(k, 1); ids.splice(k, 1);
          }
          if (a.valueCopy) {
            // That input is both a function argument and the BOT sent (e.g. createGroup's deposit)
            value = args[ids.indexOf(a.valueCopy)];
          }
          if (a.quote) {
            // Turn the slippage % input into minOut from a live quote
            var qi = ids.indexOf(a.quote.slip);
            var amtIn = a.quote.from === a.valueInput ? value : args[ids.indexOf(a.quote.from)];
            var out = await mainC().getAmountOut(a.quote.dir, amtIn);
            var minOut = out * (10000n - args[qi]) / 10000n;
            var outTxt = a.quote.dir ? fmt("tkn", out) : units(out) + " BOT";
            if (!confirm(L(a.title) + ": you get about " + outTxt + " (at least " + (a.quote.dir ? fmt("tkn", minOut) : units(minOut) + " BOT") + "). Continue?")) { btn.disabled = false; return; }
            args[qi] = minOut;
          }
          if (a.approve) {
            // Approve the pool to pull exactly this much token first, if needed
            if (!account) await connect(false);
            if (!account) throw new Error("Connect your wallet first");
            var need = args[ids.indexOf(a.approve)];
            var allowed = await new ethers.Contract(tok.addr, ERC20, readProvider).allowance(account, mainAddr);
            if (allowed < need && !(await send("Approve " + tok.sym, "approve", [mainAddr, need], 0n, tok.addr))) { btn.disabled = false; return; }
          }
          if (a.value) {
            // BOT to attach, read live from the contract (e.g. fundingPrice(id) or invoices(id).faceValue)
            var res = await mainC()[a.value.fn].apply(null, args.slice(0, a.value.argc || 1));
            value = a.value.pick ? res[a.value.pick] : res;
            if (!confirm(L(a.title) + ": send " + units(value) + " BOT?")) { btn.disabled = false; return; }
          }
          await send(L(a.title), a.fn, args, value);
        } catch (e) { toast(errText(e), { err: true }); }
        btn.disabled = false;
      });
      box.appendChild(h("div", { class: "card act" }, form));
    });
  }
  function renderViews() {
    var box = $("#views"); box.innerHTML = "";
    (C.views || []).forEach(function (v) {
      var out = h("div"), form = h("form", {}, h("h3", { text: L(v.title) }), v.desc ? h("p", { class: "desc", text: L(v.desc) }) : null);
      var row = h("div", { class: "row" });
      (v.inputs || []).forEach(function (i) { var f = field(i); if (f) row.appendChild(f); });
      form.appendChild(row);
      var btn = h("button", { class: "btn", type: "submit", text: v.button || "Look up" });
      form.appendChild(btn); form.appendChild(out);
      form.addEventListener("submit", async function (ev) {
        ev.preventDefault(); out.innerHTML = "";
        try {
          if (!mainAddr) throw new Error("Set the contract address in config.js");
          var args = (v.inputs || []).map(function (i) { return parse(i, form); });
          var res = await mainC()[v.fn].apply(null, args);
          if (v.fmt) out.appendChild(h("dl", { class: "kv" }, h("dt", { text: "result" }), h("dd", { text: fmt(v.fmt, res) })));
          else out.appendChild(renderResult(v.fn, res));
        } catch (e) { out.appendChild(h("p", { class: "desc", text: errText(e) })); }
      });
      box.appendChild(h("div", { class: "card qry" }, form));
    });
  }
  async function renderStats() {
    var box = $("#stats"); box.innerHTML = "";
    if (!mainAddr) return;
    var c = mainC();
    await Promise.all((C.stats || []).map(async function (s) {
      var cell = h("div", { class: "stat" }, h("span", { text: L(s.label) }), h("b", { text: "…" }));
      box.appendChild(cell);
      try {
        if ((s.args || []).indexOf("me") > -1 && !account) { cell.lastChild.textContent = "Connect wallet"; return; }
        var res = await c[s.fn].apply(null, (s.args || []).map(function (x) { return x === "me" ? account : x; }));
        if (s.pick) res = res[s.pick];
        cell.lastChild.textContent = fmt(s.fmt, res);
      } catch (e) { cell.lastChild.textContent = "n/a"; }
    }));
  }
  async function loadToken() {
    if (tok || !mainAddr || !(C.tokens || []).length) return;
    var addr = await mainC()[C.tokens[0]](), t = new ethers.Contract(addr, ERC20, readProvider);
    var r = await Promise.all([t.symbol(), t.decimals()]);
    tok = { addr: addr, sym: r[0], dec: Number(r[1]) };
    renderActions(); renderViews();
  }
  async function renderToken() {
    var box = $("#tokens"); if (!box) return;
    if (!tok) { box.innerHTML = ""; if (mainAddr) box.appendChild(h("p", { class: "desc", text: "Could not read the pool token from BOT Chain." })); return; }
    var bal = "connect wallet to see your balance";
    if (account) {
      var t = new ethers.Contract(tok.addr, ERC20, readProvider);
      var r = await Promise.all([t.balanceOf(account), readProvider.getBalance(account)]);
      bal = "  your balance " + units(r[0], tok.dec) + " " + tok.sym + " · " + units(r[1]) + " BOT";
    }
    box.innerHTML = "";
    box.appendChild(h("h2", { text: "Pool token" }));
    box.appendChild(h("div", { class: "tok" }, h("span", { class: "n", text: tok.sym }), h("span", { class: "m" }, addrLink(tok.addr), bal)));
    box.appendChild(h("p", { class: "desc", text: "Adding liquidity or selling " + tok.sym + " asks you to approve the exact amount first." }));
  }
  async function refreshAll() {
    if (mainAddr) {
      try { if ((await readProvider.getCode(mainAddr)) === "0x") toast("No contract found at that address on BOT Chain mainnet.", { err: true }); }
      catch (e) { toast("Could not reach BOT Chain: " + errText(e), { err: true }); }
    }
    try { await loadToken(); } catch (e) {}
    await Promise.all([renderStats(), renderToken()]);
  }

 // ---------- boot ----------
document.title = C.name + " · BOT Chain";
document.documentElement.style.setProperty("--accent", C.accent);
$("#appName").textContent = C.name; $("#tagline").textContent = C.tagline;

// Manual connect button
$("#connectBtn").addEventListener("click", function () {
  connect(false).catch(function (e) { toast(errText(e), { err: true }); });
});

if (window.ethereum) {
  if (window.ethereum.on) {
    window.ethereum.on("accountsChanged", function () { window.location.reload(); });
    window.ethereum.on("chainChanged", function () { refreshBadge(); });
  }
  // Silent auto-connect on load — no popup, no error toast
  connect(true).catch(function () {});
}

renderActions(); renderViews(); refreshAll();
})();