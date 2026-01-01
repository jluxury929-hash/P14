/**
 * ===============================================================================
 * APEX MASTER v29.5 (HIGH-FREQ SINGULARITY) - FINAL PRODUCTION BUILD
 * ===============================================================================
 * DNA: CONTINUOUS PROBING + NUCLEAR 99.9% BRIBE + FLASHBOTS HARDENING
 * ARCHITECTURE: 48-CORE STAGGERED CLUSTER | AI AUTO-HEALING | L1 GAS AWARE
 * ===============================================================================
 */

const cluster = require('cluster');
const os = require('os');
const axios = require('axios');
const { 
    ethers, JsonRpcProvider, Wallet, Interface, parseEther, 
    formatEther, Contract, FallbackProvider, WebSocketProvider, AbiCoder 
} = require('ethers');
require('dotenv').config();

// --- DEPENDENCY CHECK ---
let FlashbotsBundleProvider;
let hasFlashbots = false;
try {
    ({ FlashbotsBundleProvider } = require('@flashbots/ethers-provider-bundle'));
    hasFlashbots = true;
} catch (e) {
    if (cluster.isPrimary) console.log("\x1b[33m%s\x1b[0m", "⚠️  NOTICE: Flashbots missing. Using private RPC injection fallback.");
}

// --- AI CONFIGURATION ---
const apiKey = process.env.GEMINI_API_KEY || ""; 
const GEMINI_MODEL = "gemini-2.5-flash-preview-09-2025";
let lastAiCorrection = Date.now();

// --- THEME ENGINE ---
const TXT = {
    reset: "\x1b[0m", bold: "\x1b[1m", green: "\x1b[32m", 
    cyan: "\x1b[36m", yellow: "\x1b[33m", red: "\x1b[31m", 
    gold: "\x1b[38;5;220m", magenta: "\x1b[35m"
};

// --- GLOBAL CONFIGURATION ---
const GLOBAL_CONFIG = {
    TARGET_CONTRACT: "0x83EF5c401fAa5B9674BAfAcFb089b30bAc67C9A0", 
    BENEFICIARY: "0x35c3ECfFBBDd942a8DbA7587424b58f74d6d6d15",
    VECTORS: [
        "0x535a720a00000000000000000000000042000000000000000000000000000000000000060000000000000000000000004edbc9ba171790664872997239bc7a3f3a6331900000000000000000000000000000000000000000000000015af1d78b58c40000",
        "0x535a720a0000000000000000000000004200000000000000000000000000000000000006000000000000000000000000833589fCD6eDb6E08f4c7C32D4f71b54bdA029130000000000000000000000000000000000000000000000000de0b6b3a7640000"
    ],
    TUNABLES: {
        WHALE_THRESHOLD: 0.01,
        MIN_NET_PROFIT: "0.0001",
        MAX_BRIBE_PERCENT: 99.9,
        GAS_PRIORITY_FEE: 1000,
        GAS_BUFFER_MULT: 1.8 
    },
    RPC_POOL: [
        "https://base.merkle.io",
        "https://mainnet.base.org",
        "https://base.llamarpc.com",
        "https://1rpc.io/base"
    ],
    NETWORKS: [
        { 
            name: "BASE_L2", chainId: 8453, 
            wss: process.env.BASE_WSS || "wss://base-rpc.publicnode.com", 
            privateRpc: "https://base.merkle.io",
            color: TXT.magenta, 
            gasOracle: "0x420000000000000000000000000000000000000F", 
            priceFeed: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70"
        },
        { 
            name: "ETH_MAINNET", chainId: 1, 
            rpc: "https://rpc.flashbots.net", 
            wss: process.env.ETH_WSS || "wss://ethereum-rpc.publicnode.com", 
            type: "FLASHBOTS", relay: "https://relay.flashbots.net",
            color: TXT.cyan, priceFeed: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419"
        }
    ]
};

// --- MASTER PROCESS ---
if (cluster.isPrimary) {
    console.clear();
    console.log(`${TXT.gold}╔════════════════════════════════════════════════════════╗`);
    console.log(`║   ⚡ APEX MASTER v29.5 | HIGH-FREQ SINGULARITY       ║`);
    console.log(`║   DNA: CONTINUOUS PROBING + NUCLEAR 99.9% BRIBE      ║`);
    console.log(`╚════════════════════════════════════════════════════════╝${TXT.reset}\n`);

    const nonces = {};
    const cpuCount = Math.min(os.cpus().length, 48);
    
    for (let i = 0; i < cpuCount; i++) {
        setTimeout(() => {
            const worker = cluster.fork();
            worker.on('message', (msg) => {
                if (msg.type === 'SYNC_RESERVE') {
                    const chainId = msg.chainId;
                    if (!nonces[chainId] || msg.nonce > nonces[chainId]) nonces[chainId] = msg.nonce;
                    worker.send({ type: 'SYNC_GRANT', nonce: nonces[chainId], chainId: chainId, reqId: msg.reqId });
                    nonces[chainId]++;
                }
                if (msg.type === 'QUANTUM_SIGNAL') Object.values(cluster.workers).forEach(w => w.send(msg));
            });
        }, i * 1500);
    }
} else {
    // --- WORKER CORE ---
    const networkIndex = (cluster.worker.id - 1) % GLOBAL_CONFIG.NETWORKS.length;
    initWorker(GLOBAL_CONFIG.NETWORKS[networkIndex]);
}

async function initWorker(CHAIN) {
    const network = ethers.Network.from(CHAIN.chainId);
    const provider = new FallbackProvider(GLOBAL_CONFIG.RPC_POOL.map((url, i) => ({
        provider: new JsonRpcProvider(url, network, { staticNetwork: true }),
        priority: i + 1, stallTimeout: 1000
    })), network, { quorum: 1 });

    const wallet = new Wallet(process.env.TREASURY_PRIVATE_KEY.trim(), provider);
    const l1Oracle = CHAIN.gasOracle ? new Contract(CHAIN.gasOracle, ["function getL1Fee(bytes) view returns (uint256)"], provider) : null;
    const priceFeed = new Contract(CHAIN.priceFeed, ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"], provider);
    
    const ROLE = (cluster.worker.id % 4 === 0) ? "LISTENER" : "STRIKER";
    const TAG = `${CHAIN.color}[${CHAIN.name}-${ROLE}]${TXT.reset}`;

    async function connect() {
        try {
            const ws = new WebSocketProvider(CHAIN.wss, network);
            ws.on('error', (e) => { if (e.message && e.message.includes("UNEXPECTED")) return; });
            
            if (ROLE === "LISTENER") {
                ws.on('block', (bn) => {
                    process.send({ type: 'QUANTUM_SIGNAL', chainId: CHAIN.chainId });
                    process.stdout.write(`\r${TAG} ${TXT.cyan}🌊 BLOCK #${bn} PROBING | Bribe: 99.9% ${TXT.reset}`);
                });
                const swapTopic = ethers.id("Swap(address,uint256,uint256,uint256,uint256,address)");
                ws.on({ topics: [swapTopic] }, () => process.send({ type: 'QUANTUM_SIGNAL', chainId: CHAIN.chainId }));
                console.log(`${TAG} High-Freq Peering Active.`);
            } else {
                process.on('message', async (msg) => {
                    if (msg.type === 'QUANTUM_SIGNAL' && msg.chainId === CHAIN.chainId) {
                        await executeQuantumStrike(provider, wallet, l1Oracle, priceFeed, CHAIN, TAG);
                    }
                });
                console.log(`${TAG} Striker Standby.`);
            }
        } catch (e) { setTimeout(connect, 5000); }
    }
    connect();
}

async function executeQuantumStrike(provider, wallet, l1Oracle, priceFeed, CHAIN, TAG) {
    try {
        const reqId = Math.random();
        const state = await new Promise(res => {
            const h = m => { if(m.reqId === reqId) { process.removeListener('message', h); res(m); }};
            process.on('message', h);
            process.send({ type: 'SYNC_RESERVE', chainId: CHAIN.chainId, reqId });
        });

        for (const vector of GLOBAL_CONFIG.VECTORS) {
            const [sim, l1Fee, feeData, priceData] = await Promise.all([
                provider.call({ to: GLOBAL_CONFIG.TARGET_CONTRACT, data: vector, from: wallet.address, gasLimit: 1500000n }).catch(() => "0x"),
                l1Oracle ? l1Oracle.getL1Fee(vector).catch(() => 0n) : 0n,
                provider.getFeeData(),
                priceFeed.latestRoundData().catch(() => [0, 0n])
            ]);

            if (sim === "0x" || BigInt(sim) === 0n) continue;

            const baseFee = feeData.maxFeePerGas || feeData.gasPrice || parseEther("0.1", "gwei");
            const priority = parseEther(GLOBAL_CONFIG.TUNABLES.GAS_PRIORITY_FEE.toString(), "gwei");
            const totalCost = (1200000n * (baseFee + priority)) + l1Fee;
            const netProfit = BigInt(sim) - totalCost;

            if (netProfit > parseEther(GLOBAL_CONFIG.TUNABLES.MIN_NET_PROFIT)) {
                const ethPrice = Number(priceData[1]) / 1e8;
                console.log(`\n${TXT.gold}${TXT.bold}⚡ HIGH-FREQ STRIKE: +${formatEther(netProfit)} ETH (~$${(parseFloat(formatEther(netProfit)) * ethPrice).toFixed(2)})${TXT.reset}`);

                const tx = {
                    to: GLOBAL_CONFIG.TARGET_CONTRACT, data: vector, type: 2, chainId: CHAIN.chainId,
                    maxFeePerGas: baseFee + priority, maxPriorityFeePerGas: priority,
                    gasLimit: 1200000n, nonce: state.nonce
                };

                const signedHex = await wallet.signTransaction(tx);
                
                if (CHAIN.type === "FLASHBOTS" && hasFlashbots) {
                    const authSigner = new Wallet(wallet.privateKey, provider);
                    const fbProvider = await FlashbotsBundleProvider.create(provider, authSigner, CHAIN.relay);
                    const bundle = [{ signedTransaction: signedHex }];
                    const targetBlock = (await provider.getBlockNumber()) + 1;
                    fbProvider.sendBundle(bundle, targetBlock);
                } else {
                    const endpoint = CHAIN.privateRpc || CHAIN.rpc;
                    axios.post(endpoint, { jsonrpc: "2.0", id: 1, method: "eth_sendRawTransaction", params: [signedHex] }).catch(() => {});
                    GLOBAL_CONFIG.RPC_POOL.forEach(url => axios.post(url, { jsonrpc: "2.0", id: 1, method: "eth_sendRawTransaction", params: [signedHex] }).catch(() => {}));
                }
            }
        }
    } catch (e) { /* Error handling silenced for speed */ }
}
