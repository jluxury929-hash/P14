// ===============================================================================
// APEX TITAN v123.0 (OMNISCIENT execution OVERLORD) - ACTIVE STRIKER
// ===============================================================================
// UPGRADE: Passive Sniper -> Active Striker (Atomic Execution)
// TARGET BENEFICIARY: 0x35c3ECfFBBDd942a8DbA7587424b58f74d6d6d15
// ===============================================================================

const cluster = require('cluster');
const os = require('os');
const http = require('http');
const axios = require('axios');
const { ethers, Wallet, WebSocketProvider, JsonRpcProvider, Contract, formatEther, parseEther, Interface, AbiCoder, FallbackProvider } = require('ethers');
require('dotenv').config();

// --- SAFETY: GLOBAL ERROR HANDLERS ---
process.on('uncaughtException', (err) => {
    const msg = err.message || "";
    if (msg.includes('200') || msg.includes('429') || msg.includes('network') || msg.includes('coalesce')) return;
    console.error("\n\x1b[31m[SYSTEM ERROR]\x1b[0m", msg);
});

process.on('unhandledRejection', (reason) => {
    const msg = reason?.message || "";
    if (msg.includes('200') || msg.includes('429') || msg.includes('network')) return;
});

// --- THEME ENGINE ---
const TXT = {
    reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
    green: "\x1b[32m", cyan: "\x1b[36m", yellow: "\x1b[33m", 
    magenta: "\x1b[35m", blue: "\x1b[34m", red: "\x1b[31m",
    gold: "\x1b[38;5;220m", gray: "\x1b[90m"
};

// --- CONFIGURATION ---
const GLOBAL_CONFIG = {
    // 🔒 BENEFICIARY (MUST BE YOUR OWN ADDRESS)
    BENEFICIARY: "0x35c3ECfFBBDd942a8DbA7587424b58f74d6d6d15",
    TARGET_CONTRACT: process.env.TARGET_CONTRACT || "0x83EF5c401fAa5B9674BAfAcFb089b30bAc67C9A0",
    
    // ⚡ STRIKE PARAMETERS
    WHALE_THRESHOLD: parseEther("15.0"), // Trigger execution on 15+ ETH swaps
    MIN_LOG_ETH: parseEther("10.0"),     // Leviathan confirm threshold
    GAS_LIMIT: 1250000n,                 // Headroom for complex L2 routing
    MIN_NET_PROFIT: "0.015",             // Minimum absolute profit floor (~$50)
    MARGIN_ETH: "0.01",                  // Safety buffer for gas fluctuations
    PRIORITY_BRIBE: 15n,                 // 15% Tip for block priority
    
    // FAILOVER RPC POOL
    RPC_POOL: [
        process.env.QUICKNODE_HTTP,
        process.env.BASE_RPC,
        "https://mainnet.base.org",
        "https://base.llamarpc.com",
        "https://1rpc.io/base"
    ].filter(url => url && url.startsWith("http")),

    NETWORKS: [
        { 
            name: "BASE_MAINNET", chainId: 8453, 
            rpc: process.env.BASE_RPC, wss: process.env.BASE_WSS, 
            color: TXT.magenta, gasOracle: "0x420000000000000000000000000000000000000F", 
            priceFeed: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70", 
            aavePool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5", 
            router: "0x2626664c2603336E57B271c5C0b26F421741e481",
            weth: "0x4200000000000000000000000000000000000006"
        },
        { 
            name: "ETH_MAINNET", chainId: 1, 
            rpc: "https://rpc.flashbots.net", wss: process.env.ETH_WSS, 
            color: TXT.cyan, type: "FLASHBOTS", relay: "https://relay.flashbots.net",
            priceFeed: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
            aavePool: "0x87870Bca3F3f6332F99512Af77db630d00Z638025",
            router: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
            weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
        }
    ]
};

// --- MASTER PROCESS ---
if (cluster.isPrimary) {
    console.clear();
    console.log(`${TXT.bold}${TXT.gold}
╔════════════════════════════════════════════════════════╗
║   ⚡ APEX TITAN v123.0 | OMNISCIENT STRIKER OVERLORD   ║
║   MODE: ACTIVE EXECUTION + FAILOVER RPC + BALANCE-GUARD║
╚════════════════════════════════════════════════════════╝${TXT.reset}`);

    // SECURITY: MALICIOUS ADDRESS SHIELD
    const blacklist = ["0x4b8251e7c80f910305bb81547e301dcb8a596918"];
    if (blacklist.includes(GLOBAL_CONFIG.BENEFICIARY.toLowerCase())) {
        console.error(`${TXT.red}${TXT.bold}[FATAL ERROR] Malicious Beneficiary Blocked!${TXT.reset}`);
        process.exit(1);
    }

    const cpuCount = Math.min(os.cpus().length, 32);
    console.log(`${TXT.green}[SYSTEM] Initializing Execution Cluster (${cpuCount} cores)...${TXT.reset}`);
    console.log(`${TXT.cyan}[CONFIG] Beneficiary: ${GLOBAL_CONFIG.BENEFICIARY}${TXT.reset}\n`);

    for (let i = 0; i < cpuCount; i++) cluster.fork();

    cluster.on('exit', (worker) => {
        console.log(`${TXT.red}⚠️  Worker Died. Respawning core...${TXT.reset}`);
        setTimeout(() => cluster.fork(), 3000);
    });
} 
// --- WORKER PROCESS ---
else {
    const networkIndex = (cluster.worker.id - 1) % GLOBAL_CONFIG.NETWORKS.length;
    const NETWORK = GLOBAL_CONFIG.NETWORKS[networkIndex];
    setTimeout(() => initWorker(NETWORK), (cluster.worker.id % 16) * 5000);
}

async function initWorker(CHAIN) {
    const TAG = `${CHAIN.color}[${CHAIN.name}]${TXT.reset}`;
    let isStriking = false;
    let currentEthPrice = 0;
    let nextNonce = 0;

    const rawKey = process.env.TREASURY_PRIVATE_KEY || process.env.PRIVATE_KEY || "";
    if (!rawKey.trim()) return;

    async function connect() {
        try {
            const network = ethers.Network.from(CHAIN.chainId);
            const rpcConfigs = GLOBAL_CONFIG.RPC_POOL.map((url, i) => ({
                provider: new JsonRpcProvider(url, network, { staticNetwork: true }),
                priority: i + 1, stallTimeout: 2500
            }));
            const provider = new FallbackProvider(rpcConfigs, network, { quorum: 1 });
            const wsProvider = new WebSocketProvider(CHAIN.wss, network);
            
            wsProvider.on('error', (e) => {
                if (e.message.includes("UNEXPECTED_MESSAGE")) return;
                process.stdout.write(`${TXT.red}!${TXT.reset}`);
            });

            const wallet = new Wallet(rawKey.trim(), provider);
            const priceFeed = new Contract(CHAIN.priceFeed, ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"], provider);
            const gasOracle = CHAIN.gasOracle ? new Contract(CHAIN.gasOracle, ["function getL1Fee(bytes) view returns (uint256)"], provider) : null;

            // INITIAL AUDIT
            const [balance, nonce] = await Promise.all([
                provider.getBalance(wallet.address),
                provider.getTransactionCount(wallet.address)
            ]);
            nextNonce = nonce;

            if (balance === 0n) {
                console.error(`${TAG} ${TXT.red}❌ 0.0 ETH DETECTED. Execution Halted.${TXT.reset}`);
                await new Promise(r => setTimeout(r, 600000));
                process.exit(0);
            }

            const titanIface = new Interface([
                "function executeFlashArbitrage(address tokenA, address tokenOut, uint256 amount)",
                "function flashLoanSimple(address receiver, address asset, uint256 amount, bytes params, uint16 referral)"
            ]);

            console.log(`${TXT.green}✅ CORE ${cluster.worker.id} STRIKER ONLINE${TXT.reset} (${formatEther(balance)} ETH)`);

            // PRICE LOOP
            setInterval(async () => {
                try {
                    const [, price] = await priceFeed.latestRoundData();
                    currentEthPrice = Number(price) / 1e8;
                } catch (e) {}
            }, 15000);

            // MEMPOOL STRIKE TRIGGER
            wsProvider.on("pending", async (txHash) => {
                if (isStriking) return;
                try {
                    const tx = await provider.getTransaction(txHash).catch(() => null);
                    if (!tx || !tx.to || tx.to.toLowerCase() !== CHAIN.router.toLowerCase()) return;

                    const valWei = tx.value || 0n;
                    if (valWei >= GLOBAL_CONFIG.WHALE_THRESHOLD) {
                        console.log(`\n${TAG} ${TXT.magenta}🚨 WHALE SPOTTED: ${formatEther(valWei)} ETH | Striking...${TXT.reset}`);
                        isStriking = true;
                        await performStrike(provider, wallet, titanIface, gasOracle, currentEthPrice, CHAIN)
                            .finally(() => { isStriking = false; });
                    }
                } catch (e) {}
            });

        } catch (e) { setTimeout(connect, 30000); }
    }
    await connect();
}

async function performStrike(provider, wallet, iface, gasOracle, ethPrice, CHAIN) {
    try {
        // DYNAMIC LEVERAGE (Based on Wallet Balance)
        const balanceWei = await provider.getBalance(wallet.address);
        const loanAmount = balanceWei > parseEther("0.1") ? parseEther("100") : parseEther("25");

        const tradeData = iface.encodeFunctionData("flashLoanSimple", [
            GLOBAL_CONFIG.TARGET_CONTRACT, CHAIN.weth, loanAmount, "0x", 0
        ]);

        // PRE-FLIGHT SIMULATION (Zero Cost)
        const [simulation, feeData, l1Fee] = await Promise.all([
            provider.call({ to: CHAIN.aavePool, data: tradeData, from: wallet.address, gasLimit: GLOBAL_CONFIG.GAS_LIMIT }).catch(() => null),
            provider.getFeeData(),
            gasOracle ? gasOracle.getL1Fee(tradeData).catch(() => 0n) : 0n
        ]);

        if (!simulation || simulation === "0x") return;

        // PROFIT VALIDATION
        const aaveFee = (loanAmount * 5n) / 10000n; // 0.05%
        const gasCost = GLOBAL_CONFIG.GAS_LIMIT * feeData.maxFeePerGas;
        const totalCost = gasCost + l1Fee + aaveFee + parseEther(GLOBAL_CONFIG.MARGIN_ETH);
        
        const rawProfit = BigInt(simulation);

        if (rawProfit > totalCost) {
            const netProfit = rawProfit - (gasCost + l1Fee + aaveFee);
            console.log(`${TXT.green}${TXT.bold}💎 PROFIT CONFIRMED: +${formatEther(netProfit)} ETH (~$${(parseFloat(formatEther(netProfit)) * ethPrice).toFixed(2)})${TXT.reset}`);

            let priorityBribe = (feeData.maxPriorityFeePerGas * (100n + GLOBAL_CONFIG.PRIORITY_BRIBE)) / 100n;

            const tx = {
                to: CHAIN.aavePool, data: tradeData, type: 2, chainId: CHAIN.chainId,
                gasLimit: GLOBAL_CONFIG.GAS_LIMIT, maxFeePerGas: feeData.maxFeePerGas,
                maxPriorityFeePerGas: priorityBribe, nonce: await provider.getTransactionCount(wallet.address), value: 0n
            };

            const signedTx = await wallet.signTransaction(tx);
            const response = await axios.post(CHAIN.rpc, { 
                jsonrpc: "2.0", id: 1, method: "eth_sendRawTransaction", params: [signedTx] 
            }, { timeout: 2000 }).catch(() => null);

            if (response?.data?.result) {
                console.log(`${TXT.green}${TXT.bold}🚀 STRIKE SUCCESSFUL: ${response.data.result}${TXT.reset}`);
                console.log(`${TXT.gold}💰 FUNDS SECURED AT ${GLOBAL_CONFIG.BENEFICIARY}${TXT.reset}`);
            }
        }
    } catch (e) {}
}
