/**
 * ⚡ REAL MEMPOOL SCANNER (EDUCATIONAL)
 * * --------------------------------------------------------------------------------
 * This script connects to a REAL RPC provider and listens for pending transactions.
 * It filters for "Whale" movements AND specific interactions with a target address.
 * * NOTE: This is the "Driver" node. To actually EXECUTE a flash loan or sandwich,
 * you would need to deploy a Solidity Smart Contract and call it from here.
 * * --------------------------------------------------------------------------------
 */

import { WebSocketProvider, ethers, formatEther } from 'ethers';

// --- CONFIGURATION ---
const CONFIG = {
    // 🌍 NETWORK SELECTION
    // Switch the WSS_URL below to the network you want to scan.
    
    // OPTION 1: ETHEREUM MAINNET (Infura)
    WSS_URL: "wss://mainnet.infura.io/ws/v3/e601dc0b8ff943619576956539dd3b82",

    // 🎯 TARGET ADDRESS TO ANALYZE
    TARGET_ADDRESS: "0x35c3ECfFBBDd942a8DbA7587424b58f74d6d6d15",

    // 🐋 WHALE SETTINGS
    MIN_WHALE_VALUE: 10.0, // Only show transactions moving > 10 ETH
};

// --- LOGGING UTILS ---
const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    cyan: "\x1b[36m",
    gold: "\x1b[38;5;220m",
    magenta: "\x1b[35m",
    dim: "\x1b[2m"
};

const log = (msg, color = colors.reset) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`${colors.dim}[${timestamp}]${colors.reset} ${color}${msg}${colors.reset}`);
};

async function startRealScanner() {
    console.clear();
    console.log(`${colors.gold}
╔════════════════════════════════════════════════════════╗
║   ⚡ ETHEREUM/BASE REAL-TIME SCANNER                   ║
║   WATCHING: ${CONFIG.TARGET_ADDRESS.substring(0, 12)}... ║
╚════════════════════════════════════════════════════════╝${colors.reset}`);

    if (CONFIG.WSS_URL.includes("YOUR_INFURA_KEY")) {
        log("❌ ERROR: You must provide a valid WSS URL in the CONFIG object.", colors.red);
        process.exit(1);
    }

    try {
        const provider = new WebSocketProvider(CONFIG.WSS_URL);
        
        log(`[SYSTEM] Connecting to Network...`, colors.cyan);
        log(`[SYSTEM] Endpoint: ${CONFIG.WSS_URL}`, colors.dim);
        
        const network = await provider.getNetwork();
        log(`[SYSTEM] Connected to Chain ID: ${network.chainId}! Listening...`, colors.green);

        // --- REAL LISTENER ---
        provider.on("pending", async (txHash) => {
            try {
                const tx = await provider.getTransaction(txHash);

                if (!tx) return;

                const valueEth = parseFloat(formatEther(tx.value));
                
                // --- TARGET ANALYSIS LOGIC ---
                const isToTarget = tx.to && tx.to.toLowerCase() === CONFIG.TARGET_ADDRESS.toLowerCase();
                const isFromTarget = tx.from && tx.from.toLowerCase() === CONFIG.TARGET_ADDRESS.toLowerCase();

                // TRIGGER: If it's a whale OR it's our target address
                if (valueEth >= CONFIG.MIN_WHALE_VALUE || isToTarget || isFromTarget) {
                    
                    if (isToTarget || isFromTarget) {
                        console.log(`\n${colors.magenta}${colors.bold}🎯 TARGET ACTIVITY DETECTED${colors.reset}`);
                        console.log(`   Hash: ${txHash}`);
                        console.log(`   Direction: ${isFromTarget ? 'Outgoing ➔' : 'Incoming ➔'}`);
                    } else {
                        console.log(`\n${colors.gold}⚡ WHALE DETECTED: ${txHash.substring(0, 10)}...${colors.reset}`);
                    }

                    console.log(`   💰 Value: ${colors.green}${valueEth.toFixed(4)} ETH${colors.reset}`);
                    console.log(`   📍 From:  ${tx.from}`);
                    console.log(`   🎯 To:    ${tx.to ? tx.to : 'Contract Creation'}`);
                    console.log(`   ⛽ Gas:   ${formatEther(tx.gasPrice || 0)} ETH`);
                    
                    // Specific Strategy Analysis
                    if (tx.to) {
                        analyzeArbitrageOpportunity(tx, valueEth);
                    }
                }
            } catch (err) {
                // Network noise
            }
        });

    } catch (error) {
        log(`[ERROR] Connection failed: ${error.message}`, colors.red);
    }
}

function analyzeArbitrageOpportunity(tx, value) {
    const isUniswapRouter = (tx.to.toLowerCase() === "0xE592427A0AEce92De3Edee1F18E0157C05861564".toLowerCase()) || 
                            (tx.to.toLowerCase() === "0x2626664c2603336E57B271c5C0b26F421741e481".toLowerCase());
    
    if (isUniswapRouter) {
        log(`   🚨 INTERACTION WITH UNISWAP V3 ROUTER!`, colors.red);
        log(`   ℹ️ Potential Price Impact: ${value > 50 ? 'HIGH' : 'MEDIUM'}`, colors.yellow);
        log(`   ⚠️ EXECUTION SKIPPED: Educational Mode.`, colors.dim);
    } else if (tx.to.toLowerCase() === CONFIG.TARGET_ADDRESS.toLowerCase()) {
        log(`   🔍 TARGET ANALYSIS: Direct interaction with monitored address.`, colors.magenta);
        log(`   📊 Data Payload: ${tx.data.substring(0, 32)}...`, colors.dim);
    }
}

startRealScanner();
