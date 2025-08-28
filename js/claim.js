(async function () {
  const $ = (id) => document.getElementById(id);
  const status = (msg) => { $("status").textContent = msg; };

  const resp = await fetch("config.json");
  const config = await resp.json();

  let provider, signer, account, network;

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
      const abi = await (await fetch("abi.json")).json();
      const c = new ethers.Contract(config.contractAddress, abi, signer);
      const ow = await c.owner();
      if (ow && ow.toLowerCase() === account.toLowerCase()) {
        $("ownerSponsorNow").style.display = "inline-block";
      } else {
        $("ownerSponsorNow").style.display = "none";
      }
    } catch (_) { /* older ABI may not have owner(); ignore */ }
  };

  $("claim").onclick = async () => {
    try {
      if (!signer) { status("Connect first"); return; }
      const code = $("c1").value;
      if (!code) { status("Enter C1"); return; }
      const abi = await (await fetch("abi.json")).json();
      const contract = new ethers.Contract(config.contractAddress, abi, signer);
      const tx = await contract.claim(code);
      status("Submitting tx...");
      await tx.wait();
      status("Claimed successfully. C1 is now invalid.");
    } catch (e) {
      console.error(e);
      status(e.shortMessage || e.message || String(e));
    }
  };

  $("sponsoredClaim").onclick = async () => {
    try {
      const code = $("c1").value || "";
      const recipient = $("recipient").value || "";
      if (!code) { status("Enter C1"); return; }
      if (!/^0x[a-fA-F0-9]{40}$/.test(recipient)) { status("Invalid recipient address"); return; }

      // Optional: try to locally validate the hash against onchain claimHash
      const abi = await (await fetch("abi.json")).json();
      const readProvider = provider || new ethers.JsonRpcProvider("https://mainnet.optimism.io");
      const c = new ethers.Contract(config.contractAddress, abi, readProvider);
      let ok = true;
      try {
        const onchainHash = await c.claimHash();
        const localHash = ethers.keccak256(ethers.toUtf8Bytes(code));
        ok = (onchainHash.toLowerCase() === localHash.toLowerCase());
      } catch (_) { /* older ABI without claimHash: skip local check */ }
      if (!ok) { status("C1 does not match onchain claimHash"); return; }

      const payload = { contract: config.contractAddress, chainId: config.chainId, recipient, c1: code };
      const text = JSON.stringify(payload);
      await navigator.clipboard.writeText(text);
      status("Request copied. Send it to the sponsor to complete the mint.");
      console.log("Sponsored claim request:", text);
    } catch (e) {
      console.error(e);
      status(e.shortMessage || e.message || String(e));
    }
  };

  $("ownerSponsorNow").onclick = async () => {
    try {
      if (!signer) { status("Connect first"); return; }
      const code = $("c1").value || "";
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
    } catch (e) {
      console.error(e);
      status(e.shortMessage || e.message || String(e));
    }
  };
})(); 