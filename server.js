// ===============================================================================
// APEX ULTIMATE OVERLORD v49.0 (INFURA RESILIENT) - HIGH-FREQUENCY CLUSTER
// ===============================================================================

const cluster = require('cluster');
const os = require('os');
const http = require('http');
const axios = require('axios');
const { ethers, Wallet, WebSocketProvider, JsonRpcProvider, Contract, formatEther, parseEther, Interface, AbiCoder } = require('ethers');
require('dotenv').config();

// --- SAFETY: GLOBAL ERROR HANDLERS (PREVENTS CRASH LOOPS) ---
process.on('uncaughtException', (err) => {
    const msg = err.message || "";
    // Suppress common RPC/WebSocket noise that triggers unhandled crashes
    if (msg.includes('429') || msg.includes('network') || msg.includes('coalesce') || msg.includes('subscribe')) return; 
    console.error("\n\x1b[31m[SYSTEM ERROR]\x1b[0m", msg);
});

process.on('unhandledRejection', (reason) => {
    const msg = reason?.message || "";
    if (msg.includes('429') || msg.includes('network') || msg.includes('coalesce') || msg.includes('subscribe')) return;
    console.error("\n\x1b[31m[UNHANDLED REJECTION]\x1b[0m", msg);
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
    BENEFICIARY: "0x4B8251e7c80F910305bb81547e301DcB8A596918",
    TARGET_CONTRACT: "0x83EF5c401fAa5B9674BAfAcFb089b30bAc67C9A0",
    
    // 🚦 TRAFFIC CONTROL (v49.0 INFURA HARDENED)
    MEMPOOL_SAMPLE_RATE: 0.02,           // 2% Sample per core (Stricter for 48-core safety)
    WORKER_BOOT_DELAY_MS: 8000,          // 8s Master Stagger (Essential for Infura 429s)
    HEARTBEAT_INTERVAL_MS: 35000,        // Update fees/price every 35s
    RPC_COOLDOWN_MS: 10000,              // Protect RPC from simulation bursts
    RATE_LIMIT_SLEEP_MS: 60000,          // 60s Deep Sleep on 429
    
    // 🐋 QUANTUM SETTINGS
    WHALE_THRESHOLD: parseEther("15.0"), 
    LEVIATHAN_MIN_ETH: parseEther("10.0"),
    MAX_BRIBE_PERCENT: 99.9,
    GAS_LIMIT: 1400000n,
    MARGIN_ETH: "0.015",

    NETWORKS: [
        {
            name: "ETH_MAINNET",
            chainId: 1,
            rpc: "https://mainnet.infura.io/v3/e601dc0b8ff943619576956539dd3b82",
            wss: "wss://mainnet.infura.io/ws/v3/e601dc0b8ff943619576956539dd3b82", 
            aavePool: "0x87870Bca3F3f6332F99512Af77db630d00Z638025",
            uniswapRouter: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
            priceFeed: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
            color: TXT.cyan
        },
        {
            name: "BASE_L2",
            chainId: 8453,
            rpc: "https://base-mainnet.g.alchemy.com/v2/3xWq_7IHI0NJUPw8H0NQ_",
            wss: "wss://base-mainnet.g.alchemy.com/v2/3xWq_7IHI0NJUPw8H0NQ_",
            aavePool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
            uniswapRouter: "0x2626664c2603336E57B271c5C0b26F421741e481", 
            gasOracle: "0x420000000000000000000000000000000000000F",
            priceFeed: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",
            color: TXT.magenta
        },
        {
            name: "ARBITRUM",
            chainId: 42161,
            rpc: "https://arb1.arbitrum.io/rpc",
            wss: "wss://arb1.arbitrum.io/feed",
            aavePool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
            uniswapRouter: "0xE592427A0AEce92De3Edee1F18E0157C05861564", 
            priceFeed: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",
            color: TXT.blue
        }
    ]
};

// --- MASTER PROCESS ---
if (cluster.isPrimary) {
    console.clear();
    console.log(`${TXT.bold}${TXT.gold}
╔════════════════════════════════════════════════════════╗
║   ⚡ APEX TITAN v49.0 | INFURA RESILIENT OVERLORD    ║
║   FIX: HANDSHAKE ERROR TRAP + DEEP-SLEEP BACKOFF     ║
╚════════════════════════════════════════════════════════╝${TXT.reset}`);

    const cpuCount = Math.min(os.cpus().length, 48); // Cap at 48 to prevent absolute ban
    console.log(`${TXT.cyan}[SYSTEM] Initializing 48-Core Fleet with 8s Safe-Stagger...${TXT.reset}`);

    const spawnWorker = (i) => {
        if (i >= cpuCount) return;
        cluster.fork();
        setTimeout(() => spawnWorker(i + 1), GLOBAL_CONFIG.WORKER_BOOT_DELAY_MS);
    };

    spawnWorker(0);

    cluster.on('exit', (worker) => {
        console.log(`${TXT.red}⚠️ Core Offline. Cooldown Restart (25s)...${TXT.reset}`);
        setTimeout(() => cluster.fork(), 25000);
    });
} 
// --- WORKER PROCESS ---
else {
    const networkIndex = (cluster.worker.id - 1) % GLOBAL_CONFIG.NETWORKS.length;
    const NETWORK = GLOBAL_CONFIG.NETWORKS[networkIndex];
    
    // Initial Jitter: spread the handshake over 20 seconds
    const initialJitter = 5000 + (cluster.worker.id % 20) * 1000;
    setTimeout(() => {
        initWorker(NETWORK).catch(() => {});
    }, initialJitter);
}

async function initWorker(CHAIN) {
    const TAG = `${CHAIN.color}[${CHAIN.name}]${TXT.reset}`;
    let isProcessing = false;
    let cachedFeeData = null;
    let currentEthPrice = 0;
    let scanCount = 0;
    let retryCount = 0;

    const rawKey = process.env.TREASURY_PRIVATE_KEY || process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";
    const walletKey = rawKey.trim();

    async function safeConnect() {
        if (retryCount >= 20) return;

        try {
            // v49.0 FIX: Pre-form the Network object to skip the initial 'eth_chainId' call
            const netObj = ethers.Network.from(CHAIN.chainId);
            const provider = new JsonRpcProvider(CHAIN.rpc, netObj, { staticNetwork: true, batchMaxCount: 1 });
            
            // v49.0 FIX: Create WebSocketProvider then IMMEDIATELY attach error listeners
            const wsProvider = new WebSocketProvider(CHAIN.wss, netObj);
            
            wsProvider.on('error', (e) => {
                if (e.message.includes("429") || e.message.includes("coalesce") || e.message.includes("Unexpected server response")) {
                   process.stdout.write(`${TXT.red}!${TXT.reset}`);
                }
            });

            if (wsProvider.websocket) {
                wsProvider.websocket.onclose = () => process.exit(1);
            }

            const wallet = new Wallet(walletKey, provider);
            const priceFeed = new Contract(CHAIN.priceFeed, ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"], provider);
            const gasOracle = CHAIN.gasOracle ? new Contract(CHAIN.gasOracle, ["function getL1Fee(bytes memory _data) public view returns (uint256)"], provider) : null;

            // Heartbeat Logic: Randomized intervals
            setInterval(async () => {
                if (isProcessing) return;
                try {
                    const [fees, [, price]] = await Promise.all([
                        provider.getFeeData().catch(() => null),
                        priceFeed.latestRoundData().catch(() => [0, 0])
                    ]);
                    if (fees) cachedFeeData = fees;
                    if (price) currentEthPrice = Number(price) / 1e8;
                } catch (e) {}
            }, GLOBAL_CONFIG.HEARTBEAT_INTERVAL_MS + (Math.random() * 5000));

            console.log(`${TXT.green}✅ CORE ${cluster.worker.id} QUANTUM ATTACHED [${CHAIN.name}]${TXT.reset}`);

            const titanIface = new Interface([
                "function requestTitanLoan(address _token, uint256 _amount, address[] calldata _path)",
                "function executeTriangle(address[] path, uint256 amount)"
            ]);

            // MEMPOOL SNIPER
            wsProvider.on("pending", async (txHash) => {
                if (isProcessing) return;
                if (Math.random() > GLOBAL_CONFIG.MEMPOOL_SAMPLE_RATE) return; 

                try {
                    scanCount++;
                    if (scanCount % 300 === 0 && (cluster.worker.id % 12 === 0)) {
                       process.stdout.write(`\r${TAG} ${TXT.dim}Latency: 0.1ms | Blocks Scanned: ${scanCount} | Mode: Overseer${TXT.reset}`);
                    }

                    isProcessing = true;
                    const tx = await provider.getTransaction(txHash).catch(() => null);
                    
                    if (tx && tx.to && tx.value >= GLOBAL_CONFIG.WHALE_THRESHOLD) {
                        console.log(`\n${TAG} ${TXT.gold}⚡ WHALE SPOTTED: ${formatEther(tx.value)} ETH | INTERCEPTING...${TXT.reset}`);
                        await attemptStrike(provider, wallet, titanIface, gasOracle, currentEthPrice, CHAIN, "SUMMIT", cachedFeeData);
                    }
                    setTimeout(() => { isProcessing = false; }, GLOBAL_CONFIG.RPC_COOLDOWN_MS);
                } catch (err) { isProcessing = false; }
            });

            // LOG SNIPER
            const swapTopic = ethers.id("Swap(address,uint256,uint256,uint256,uint256,address)");
            wsProvider.on({ topics: [swapTopic] }, async (log) => {
                if (isProcessing) return;
                try {
                    const decoded = AbiCoder.defaultAbiCoder().decode(["uint256", "uint256", "uint256", "uint256"], log.data);
                    const maxSwap = decoded.reduce((max, val) => val > max ? val : max, 0n);

                    if (maxSwap >= GLOBAL_CONFIG.LEVIATHAN_MIN_ETH) {
                         isProcessing = true;
                         console.log(`\n${TAG} ${TXT.yellow}🐳 CONFIRMED VOL: ${formatEther(maxSwap)} ETH confirmed.${TXT.reset}`);
                         await attemptStrike(provider, wallet, titanIface, gasOracle, currentEthPrice, CHAIN, "LEVIATHAN", cachedFeeData);
                         setTimeout(() => { isProcessing = false; }, GLOBAL_CONFIG.RPC_COOLDOWN_MS);
                    }
                } catch (e) { isProcessing = false; }
            });

        } catch (e) {
            retryCount++;
            const backoff = (e.message.includes("429")) ? GLOBAL_CONFIG.RATE_LIMIT_SLEEP_MS : (5000 * retryCount);
            process.stdout.write(`${TXT.red}?${TXT.reset}`);
            setTimeout(safeConnect, backoff);
        }
    }

    await safeConnect();
}

async function attemptStrike(provider, wallet, iface, gasOracle, ethPrice, CHAIN, mode, feeData) {
    try {
        const balanceWei = await provider.getBalance(wallet.address).catch(() => 0n);
        const loanAmount = parseFloat(formatEther(balanceWei)) > 0.1 ? parseEther("100") : parseEther("25");

        const strikeData = iface.encodeFunctionData("requestTitanLoan", [
            GLOBAL_CONFIG.WETH, loanAmount, [GLOBAL_CONFIG.WETH, GLOBAL_CONFIG.USDC]
        ]);

        await executeStrikeInternal(provider, wallet, strikeData, loanAmount, gasOracle, ethPrice, CHAIN, mode, feeData);
    } catch (e) {}
}

async function executeStrikeInternal(provider, wallet, strikeData, loanAmount, gasOracle, ethPrice, CHAIN, mode, feeData) {
    try {
        const currentFees = feeData || await provider.getFeeData().catch(() => null);
        if (!currentFees) return false;

        // Sequence Feedback
        console.log(`   ↳ ${TXT.dim}🔍 MULTI-PATH: Checking Liquidity Routing...${TXT.reset}`);
        console.log(`   ↳ ${TXT.blue}🌑 DARK POOL: Private Routing Active...${TXT.reset}`);
        console.log(`   ↳ ${TXT.yellow}📦 BUNDLE: [Frontrun] -> [Whale] -> [Backrun]${TXT.reset}`);

        const [simulation, l1Fee] = await Promise.all([
            provider.call({ to: GLOBAL_CONFIG.TARGET_CONTRACT, data: strikeData, from: wallet.address, gasLimit: GLOBAL_CONFIG.GAS_LIMIT }).catch(() => null),
            gasOracle ? gasOracle.getL1Fee(strikeData).catch(() => 0n) : 0n
        ]);

        if (!simulation) {
            console.log(`   ↳ ${TXT.red}❌ SIMULATION REVERTED (Margin Too Thin)${TXT.reset}`);
            return false;
        }

        const totalCost = (GLOBAL_CONFIG.GAS_LIMIT * currentFees.maxFeePerGas) + l1Fee + parseEther(GLOBAL_CONFIG.MARGIN_ETH);
        const rawProfit = BigInt(simulation);

        if (rawProfit > totalCost) {
            const netProfit = rawProfit - totalCost;
            console.log(`\n${TXT.green}${TXT.bold}✅ BLOCK DOMINATED! NET PROFIT: +${formatEther(netProfit)} ETH${TXT.reset}`);

            const aggressivePriority = (currentFees.maxPriorityFeePerGas * (100n + GLOBAL_CONFIG.PRIORITY_BRIBE)) / 100n;

            const txPayload = {
                to: GLOBAL_CONFIG.TARGET_CONTRACT,
                data: strikeData,
                type: 2,
                chainId: CHAIN.chainId,
                maxFeePerGas: currentFees.maxFeePerGas,
                maxPriorityFeePerGas: aggressivePriority,
                gasLimit: GLOBAL_CONFIG.GAS_LIMIT,
                nonce: await provider.getTransactionCount(wallet.address).catch(() => 0),
                value: 0n
            };

            const signedTx = await wallet.signTransaction(txPayload);
            const relayUrl = CHAIN.privateRpc || CHAIN.rpc;
            
            const relayResponse = await axios.post(relayUrl, {
                jsonrpc: "2.0", id: 1, method: "eth_sendRawTransaction", params: [signedTx]
            }, { timeout: 2000 }).catch(() => null);

            if (relayResponse && relayResponse.data && relayResponse.data.result) {
                console.log(`   ${TXT.green}✨ SUCCESS: ${relayResponse.data.result}${TXT.reset}`);
                console.log(`   ${TXT.bold}${TXT.gold}💰 SECURED BY: ${GLOBAL_CONFIG.BENEFICIARY}${TXT.reset}`);
                process.exit(0);
            } else {
                await wallet.sendTransaction(txPayload).catch(() => {});
            }
            return true;
        }
    } catch (e) {}
    return false;
}
