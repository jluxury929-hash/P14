// ===============================================================================
// APEX TITAN v129.0 (ULTIMATE HIGH-FREQUENCY STRIKER) - EXECUTION FIX
// ===============================================================================
// MERGE SYNC: v128.0 (HARDENED) + v6.0 (NUCLEAR) + CONTINUOUS BLOCK PROBING
// TARGET BENEFICIARY: 0x35c3ECfFBBDd942a8DbA7587424b58f74d6d6d15
// ===============================================================================

const cluster = require('cluster');
const os = require('os');
const http = require('http');
const axios = require('axios');
const { ethers, Wallet, WebSocketProvider, JsonRpcProvider, Contract, formatEther, parseEther, Interface, AbiCoder, FallbackProvider } = require('ethers');
require('dotenv').config();

// --- SAFETY: GLOBAL ERROR HANDLERS (CRASH PROOF) ---
process.on('uncaughtException', (err) => {
    const msg = err.message || "";
    if (msg.includes('200') || msg.includes('429') || msg.includes('network') || msg.includes('coalesce')) return;
    console.error("\n\x1b[31m[SYSTEM ERROR]\x1b[0m", msg);
});

process.on('unhandledRejection', (reason) => {
    const msg = reason?.message || "";
    if (msg.includes('200') || msg.includes('429') || msg.includes('network')) return;
});

// --- DEPENDENCY CHECK ---
let FlashbotsBundleProvider;
let hasFlashbots = false;
try {
    ({ FlashbotsBundleProvider } = require('@flashbots/ethers-provider-bundle'));
    hasFlashbots = true;
} catch (e) {
    if (cluster.isPrimary) console.error("\x1b[33m%s\x1b[0m", "⚠️ WARNING: Flashbots dependency missing. Mainnet bundling disabled.");
}

// --- THEME ENGINE ---
const TXT = {
    reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
    green: "\x1b[32m", cyan: "\x1b[36m", yellow: "\x1b[33m", 
    magenta: "\x1b[35m", blue: "\x1b[34m", red: "\x1b[31m",
    gold: "\x1b[38;5;220m", gray: "\x1b[90m"
};

// --- CONFIGURATION ---
const GLOBAL_CONFIG = {
    BENEFICIARY: "0x35c3ECfFBBDd942a8DbA7587424b58f74d6d6d15",
    TARGET_CONTRACT: process.env.TARGET_CONTRACT || "0x83EF5c401fAa5B9674BAfAcFb089b30bAc67C9A0",
    
    // ⚡ QUANTUM STRIKE VECTORS (Arbitrage Payloads)
    VECTORS: [
        "0x535a720a00000000000000000000000042000000000000000000000000000000000000060000000000000000000000004edbc9ba171790664872997239bc7a3f3a6331900000000000000000000000000000000000000000000000015af1d78b58c40000",
        "0x535a720a0000000000000000000000004200000000000000000000000000000000000006000000000000000000000000833589fCD6eDb6E08f4c7C32D4f71b54bdA029130000000000000000000000000000000000000000000000000de0b6b3a7640000"
    ],

    // ☢️ HIGH-FREQUENCY PARAMETERS (FIXED FOR EXECUTION)
    WHALE_THRESHOLD: parseEther("0.01"), // HYPER-SENSITIVE: Trigger on any liquidity move
    MIN_NET_PROFIT: "0.0001",            // ATOMIC FLOOR: Strike on all profitable windows
    GAS_LIMIT: 1500000n,                 
    GAS_PRIORITY_FEE: 1000n,             // 1000 GWEI: Nuclear priority
    MAX_BRIBE_PERCENT: 99.9,             // 99.9% Profit Bribe for dominance
    
    PORT: process.env.PORT || 8080,
    RPC_POOL: [
        process.env.QUICKNODE_HTTP,
        process.env.BASE_RPC,
        "https://mainnet.base.org",
        "https://base.llamarpc.com",
        "https://1rpc.io/base"
    ].filter(url => url && url.startsWith("http")),

    MAX_CORES: Math.min(os.cpus().length, 48), 

    NETWORKS: [
        { 
            name: "BASE_L2", chainId: 8453, 
            rpc: process.env.BASE_RPC || "https://mainnet.base.org", 
            wss: process.env.BASE_WSS || "wss://base-rpc.publicnode.com", 
            privateRpc: "https://base.merkle.io",
            color: TXT.magenta, gasOracle: "0x420000000000000000000000000000000000000F", 
            priceFeed: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70", 
            router: "0x2626664c2603336E57B271c5C0b26F421741e481",
            weth: "0x4200000000000000000000000000000000000006",
            aavePool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5"
        },
        { 
            name: "ETH_MAINNET", chainId: 1, 
            rpc: "https://rpc.flashbots.net", 
            wss: process.env.ETH_WSS || "wss://ethereum-rpc.publicnode.com", 
            type: "FLASHBOTS", relay: "https://relay.flashbots.net",
            color: TXT.cyan, priceFeed: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
            router: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
            aavePool: "0x87870Bca3F3f6332F99512Af77db630d00Z638025",
            weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
        }
    ]
};

// --- MASTER PROCESS ---
if (cluster.isPrimary) {
    console.clear();
    console.log(`${TXT.bold}${TXT.gold}
╔════════════════════════════════════════════════════════╗
║   ⚡ APEX TITAN v129.0 | ULTIMATE EXECUTION ENGINE    ║
║   MODE: NUCLEAR 99.9% BRIBE + HIGH-FREQ PROBING       ║
╚════════════════════════════════════════════════════════╝${TXT.reset}`);

    const cpuCount = GLOBAL_CONFIG.MAX_CORES;
    for (let i = 0; i < cpuCount; i++) cluster.fork();

    cluster.on('message', (worker, msg) => {
        if (msg.type === 'STRIKE_SIGNAL') {
            for (const id in cluster.workers) cluster.workers[id].send(msg);
        }
    });

    cluster.on('exit', (worker) => {
        console.log(`${TXT.red}⚠️ Core Died. Respawning in 3s...${TXT.reset}`);
        setTimeout(() => cluster.fork(), 3000);
    });
} 
// --- WORKER PROCESS ---
else {
    const networkIndex = (cluster.worker.id - 1) % GLOBAL_CONFIG.NETWORKS.length;
    const NETWORK = GLOBAL_CONFIG.NETWORKS[networkIndex];
    initWorker(NETWORK);
}

async function initWorker(CHAIN) {
    const TAG = `${CHAIN.color}[${CHAIN.name}]${TXT.reset}`;
    const ROLE = (cluster.worker.id % 4 === 0) ? "LISTENER" : "STRIKER";
    
    let isStriking = false;
    let currentEthPrice = 0;

    const rawKey = process.env.TREASURY_PRIVATE_KEY || process.env.PRIVATE_KEY || "";
    if (!rawKey.trim()) return;

    async function safeConnect() {
        try {
            const network = ethers.Network.from(CHAIN.chainId);
            const rpcConfigs = GLOBAL_CONFIG.RPC_POOL.map((url, i) => ({
                provider: new JsonRpcProvider(url, network, { staticNetwork: true }),
                priority: i + 1, stallTimeout: 1500
            }));
            const provider = new FallbackProvider(rpcConfigs, network, { quorum: 1 });
            
            // HARDENED WS
            const wsProvider = new WebSocketProvider(CHAIN.wss, network);
            wsProvider.on('error', (error) => {
                if (error && error.message && (error.message.includes("UNEXPECTED_MESSAGE"))) return;
                console.error(`${TXT.yellow}⚠️ [WS ERROR] ${TAG}: ${error.message}${TXT.reset}`);
            });

            const wallet = new Wallet(rawKey.trim(), provider);
            const priceFeed = new Contract(CHAIN.priceFeed, ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"], provider);
            const gasOracle = CHAIN.gasOracle ? new Contract(CHAIN.gasOracle, ["function getL1Fee(bytes) view returns (uint256)"], provider) : null;

            console.log(`${TXT.green}✅ CORE ${cluster.worker.id} [${ROLE}] READY${TXT.reset}`);

            // STRIKER: Execution Loop
            process.on('message', async (msg) => {
                if (msg.type === 'STRIKE_SIGNAL' && msg.chainId === CHAIN.chainId && !isStriking && ROLE === "STRIKER") {
                    isStriking = true;
                    // Jitter for nonce protection
                    await new Promise(r => setTimeout(r, Math.random() * 30));
                    await executeQuantumStrike(provider, wallet, gasOracle, currentEthPrice, CHAIN)
                        .finally(() => { isStriking = false; });
                }
            });

            // LISTENER: Dual-Path Detection (Pending + Logs)
            if (ROLE === "LISTENER") {
                const swapTopic = ethers.id("Swap(address,uint256,uint256,uint256,uint256,address)");
                
                // 1. Monitor Logs (Finalized blocks)
                wsProvider.on({ topics: [swapTopic] }, () => {
                    process.send({ type: 'STRIKE_SIGNAL', chainId: CHAIN.chainId });
                });
                
                // 2. Monitor Pending (Mempool)
                wsProvider.on("pending", async (txHash) => {
                    const tx = await provider.getTransaction(txHash).catch(() => null);
                    if (tx && tx.to && (tx.value || 0n) >= GLOBAL_CONFIG.WHALE_THRESHOLD) {
                        process.send({ type: 'STRIKE_SIGNAL', chainId: CHAIN.chainId });
                    }
                });

                // 3. Heartbeat Probing (Trigger strike on every block)
                wsProvider.on("block", (blockNumber) => {
                    process.send({ type: 'STRIKE_SIGNAL', chainId: CHAIN.chainId });
                    process.stdout.write(`\r${TAG} ${TXT.cyan}🌊 BLOCK #${blockNumber} PEERED | Bribe: 99.9% ${TXT.reset}`);
                });

                setInterval(async () => {
                    try {
                        const [, price] = await priceFeed.latestRoundData();
                        currentEthPrice = Number(price) / 1e8;
                    } catch (e) {}
                }, 15000);
            }

        } catch (e) { setTimeout(safeConnect, 10000); }
    }
    await safeConnect();
}

async function executeQuantumStrike(provider, wallet, oracle, ethPrice, CHAIN) {
    try {
        if (GLOBAL_CONFIG.TARGET_CONTRACT.includes("YOUR_DEPLOYED")) return;

        for (const strikeData of GLOBAL_CONFIG.VECTORS) {
            // 1. ATOMIC SIMULATION
            const [simulation, l1Fee, feeData] = await Promise.all([
                provider.call({ to: GLOBAL_CONFIG.TARGET_CONTRACT, data: strikeData, from: wallet.address, gasLimit: GLOBAL_CONFIG.GAS_LIMIT }).catch(() => null),
                oracle ? oracle.getL1Fee(strikeData).catch(() => 0n) : 0n,
                provider.getFeeData()
            ]);

            if (!simulation || simulation === "0x") continue;

            // 2. NUCLEAR COST CALCULATION
            const gasPrice = feeData.maxFeePerGas || feeData.gasPrice;
            const l2Cost = GLOBAL_CONFIG.GAS_LIMIT * gasPrice;
            const totalThreshold = l2Cost + l1Fee + parseEther(GLOBAL_CONFIG.MIN_NET_PROFIT);
            
            const rawProfit = BigInt(simulation);

            if (rawProfit > totalThreshold) {
                const netProfit = rawProfit - (l2Cost + l1Fee);
                
                console.log(`\n${TXT.gold}${TXT.bold}⚡ STRIKE AUTHORIZED [${CHAIN.name}]${TXT.reset}`);
                console.log(`   ↳ 📐 PROFIT: +${formatEther(netProfit)} ETH (~$${(parseFloat(formatEther(netProfit)) * ethPrice).toFixed(2)})${TXT.reset}`);

                const priorityBribe = parseEther(GLOBAL_CONFIG.GAS_PRIORITY_FEE.toString(), "gwei");

                const tx = {
                    to: GLOBAL_CONFIG.TARGET_CONTRACT, 
                    data: strikeData, 
                    type: 2, 
                    chainId: CHAIN.chainId,
                    gasLimit: GLOBAL_CONFIG.GAS_LIMIT, 
                    maxFeePerGas: gasPrice + priorityBribe,
                    maxPriorityFeePerGas: priorityBribe,
                    nonce: await provider.getTransactionCount(wallet.address),
                    value: 0n
                };

                const signedTx = await wallet.signTransaction(tx);

                // FLASHBOTS HARDENING
                if (CHAIN.type === "FLASHBOTS" && hasFlashbots) {
                    const authSigner = new Wallet(wallet.privateKey, provider);
                    const fbProvider = await FlashbotsBundleProvider.create(provider, authSigner, CHAIN.relay);
                    const bundle = [{ signedTransaction: signedTx }];
                    const targetBlock = (await provider.getBlockNumber()) + 1;
                    const sim = await fbProvider.simulate(bundle, targetBlock).catch(() => ({ error: true }));
                    if (!sim.error) await fbProvider.sendBundle(bundle, targetBlock);
                } else {
                    const endpoint = CHAIN.privateRpc || CHAIN.rpc;
                    const res = await axios.post(endpoint, { jsonrpc: "2.0", id: 1, method: "eth_sendRawTransaction", params: [signedTx] }, { timeout: 2000 }).catch(() => null);
                    if (res?.data?.result) {
                        console.log(`${TXT.green}${TXT.bold}✅ BROADCAST SUCCESSFUL: ${res.data.result.substring(0,16)}...${TXT.reset}`);
                        console.log(`${TXT.yellow}✨ Funds secured at Beneficiary.${TXT.reset}`);
                    }
                }
            }
        }
    } catch (e) {}
}
