(async function () {
  const $ = (id) => document.getElementById(id);
  const status = (msg) => { $("status").textContent = msg; };

  const resp = await fetch("config.json?ts=" + Date.now());
  const config = await resp.json();

  let provider, signer, account, network;

  function normalizeC1(input) {
    let s = (input || "").trim();
    s = s.replace(/[\u200B-\u200D\uFEFF]/g, "");
    if (s.normalize) s = s.normalize('NFC');
    return s;
  }

  // Recipient side P2 generation (client-only, no upload)
  const genP2 = () => {
    try {
      const array = new Uint32Array(4);
      (self.crypto || window.crypto).getRandomValues(array);
      const raw = Array.from(array).map(x => x.toString(16).padStart(8, '0')).join('');
      const p2 = `P2-${raw}`;
      $("p2local").value = p2;
      return p2;
    } catch (_) {
      const p2 = `P2-${Date.now().toString(16)}`;
      $("p2local").value = p2;
      return p2;
    }
  };
  const getP2ForOwner = () => (($("p2local") && $("p2local").value) || "").trim();
  const normalizeP2 = (s) => (s || "").trim().replace(/[\u200B-\u200D\uFEFF]/g, "").normalize ? s.normalize('NFC') : s;

  if ($("generateP2")) {
    $("generateP2").onclick = () => { genP2(); };
  }

  $("switchOP").onclick = async () => {
    try {
      if (!window.ethereum) { status("No wallet found"); return; }
      // Try switch first
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xA' }] });
      status("Switched to Optimism (10)");
    } catch (err) {
      // If the chain has not been added to MetaMask
      if (err && err.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0xA',
              chainName: 'Optimism',
              rpcUrls: ['https://mainnet.optimism.io'],
              nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
              blockExplorerUrls: ['https://optimistic.etherscan.io']
            }]
          });
          status("Optimism added and switched");
        } catch (e2) {
          status(e2.message || String(e2));
        }
      } else {
        status(err.message || String(err));
      }
    }
  };

  $("connect").onclick = async () => {
    if (!window.ethereum) { status("No wallet found"); return; }
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    account = await signer.getAddress();
    network = await provider.getNetwork();
    $("account").textContent = account;
    $("network").textContent = `${network.chainId}`;
    if (`${network.chainId}` !== config.chainId) {
      status(`Please switch to chain ${config.chainId}`);
    } else {
      status("Connected");
    }

    try {
      // show owner sponsor if current account is contract owner
      const abi = await (await fetch("abi.json?ts="+Date.now())).json();
      const c = new ethers.Contract(config.contractAddress, abi, signer);
      const ow = await c.owner();
      const isOwner = !!ow && (ow.toLowerCase() === account.toLowerCase());
      const ownerOnlyIds = ["ownerSponsorNow","ownerSponsorSet","p2owner","ownerPlain"];
      ownerOnlyIds.forEach(id => { const el = $(id); if (el) el.style.display = isOwner ? (id==="ownerPlain"?"": "inline-block") : "none"; });
    } catch (_) { /* older ABI may not have owner(); ignore */ }
  };

  // legacy self-claim removed

  // legacy request JSON removed

  $("ownerSponsorNow").onclick = async () => {
    try {
      if (!signer) { status("Connect first"); return; }
      const code = normalizeC1($("c1").value || "");
      const recipient = $("recipient").value || "";
      if (!code) { status("Enter C1"); return; }
      if (!/^0x[a-fA-F0-9]{40}$/.test(recipient)) { status("Invalid recipient address"); return; }
      const abi = await (await fetch("abi.json")).json();
      const c = new ethers.Contract(config.contractAddress, abi, signer);
      // Optional: verify current account is owner
      const ow = await c.owner();
      if (ow.toLowerCase() !== account.toLowerCase()) { status("Only owner can sponsor"); return; }
      const tx = await c.claimTo(recipient, code);
      status("Sponsoring (owner claimTo)...");
      await tx.wait();
      status("Sponsored claim completed.");
      const btn2 = document.getElementById('gotoDecrypt');
      if (btn2) { btn2.style.display = 'inline-block'; btn2.onclick = () => { window.location.href = 'decrypt.html'; }; }

      // If owner tools are visible, allow encrypting content with recipient P2 and push to tokenURI as data: URI
      try {
        const abi = await (await fetch("abi.json?ts="+Date.now())).json();
        const c2 = new ethers.Contract(config.contractAddress, abi, signer);
        const ow = await c2.owner();
        if (ow.toLowerCase() === account.toLowerCase()) {
          const btnSet = document.getElementById('ownerSponsorSet');
          if (btnSet) {
            btnSet.style.display = 'inline-block';
            btnSet.onclick = async () => {
              try {
                let p2 = normalizeP2($("p2owner").value || getP2ForOwner());
                if (!p2) { status("Enter or generate P2 first"); return; }
                const plain = $("ownerPlain").value || "";
                if (!plain) { status("Enter plaintext content"); return; }
                const cipher = await window.CS_Crypto.encrypt(plain, p2, 250000);
                const metadata = { name: "Encrypted Content", description: "Use decrypt.html with your P2 to view.", image: "data:image/svg+xml;base64,", encrypted: cipher };
                const tokenUri = "data:application/json;base64," + btoa(JSON.stringify(metadata));
                const tx2 = await c2.setTokenURI(tokenUri);
                status("Setting encrypted tokenURI...");
                await tx2.wait();
                status("Encrypted content set. Share P2 with recipient to decrypt.");
              } catch (e3) { console.error(e3); status(e3.message || String(e3)); }
            };
          }
        }
      } catch (_) {}
    } catch (e) {
      console.error(e);
      status(e.shortMessage || e.message || String(e));
    }
  };
})(); 