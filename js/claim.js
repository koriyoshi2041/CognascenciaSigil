(async function () {
  const $ = (id) => document.getElementById(id);
  const status = (msg) => { $("status").textContent = msg; };

  const resp = await fetch("config.json");
  const config = await resp.json();

  let provider, signer, account, network;

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
})(); 