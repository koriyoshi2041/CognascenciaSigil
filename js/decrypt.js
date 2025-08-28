(function () {
  const $ = (id) => document.getElementById(id);
  const status = (msg) => { $("out").textContent = msg; };

  $("load").onclick = async () => {
    try {
      const url = $("url").value.trim();
      let p2 = $("p2").value || "";
      // Normalize P2 similar to C1 normalize
      p2 = p2.trim().replace(/[\u200B-\u200D\uFEFF]/g, "");
      if (p2.normalize) p2 = p2.normalize('NFC');
      if (!url) { status("Enter URL"); return; }
      if (!p2) { status("Enter P2"); return; }
      const resp = await fetch(url + (url.includes('?') ? '&' : '?') + 'ts=' + Date.now());
      const cipherObj = await resp.json();
      const plaintext = await window.CS_Crypto.decrypt(cipherObj, p2);
      $("out").textContent = plaintext;
    } catch (e) {
      console.error(e);
      status(e.message || String(e));
    }
  };

  $("loadFromTokenURI").onclick = async () => {
    try {
      let p2 = $("p2").value || "";
      p2 = p2.trim().replace(/[\u200B-\u200D\uFEFF]/g, "");
      if (p2.normalize) p2 = p2.normalize('NFC');
      if (!p2) { status("Enter P2"); return; }
      const cfg = await (await fetch('config.json?ts='+Date.now())).json();
      const abi = await (await fetch('abi.json?ts='+Date.now())).json();
      const provider = new ethers.JsonRpcProvider('https://mainnet.optimism.io');
      const c = new ethers.Contract(cfg.contractAddress, abi, provider);
      const uri = await c.tokenURI(cfg.tokenId || 1);
      let json;
      if (uri.startsWith('data:application/json;base64,')) {
        const b64 = uri.split(',')[1];
        json = JSON.parse(atob(b64));
      } else {
        const resp = await fetch(uri + (uri.includes('?') ? '&' : '?') + 'ts='+Date.now());
        json = await resp.json();
      }
      if (!json || !json.encrypted) { status('No encrypted payload in tokenURI'); return; }
      const plaintext = await window.CS_Crypto.decrypt(json.encrypted, p2);
      $("out").textContent = plaintext;
    } catch (e) {
      console.error(e);
      status(e.message || String(e));
    }
  };
})();

 