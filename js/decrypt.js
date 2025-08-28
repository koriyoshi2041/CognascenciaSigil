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
})();

 