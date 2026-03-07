import { Connection, clusterApiUrl, PublicKey } from '@solana/web3.js';
import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
    const sql = neon(process.env.DATABASE_URL);
    const mainConn = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');

    try {
        // Získáme reálný seznam stovek uzlů v síti
        const nodes = await mainConn.getClusterNodes();
        const activeTargets = nodes.filter(n => n.rpc).slice(0, 100); // Bereme prvních 100

        // Agresivní paralelní útok na RPC brány
        const scanResults = await Promise.allSettled(activeTargets.map(async (node) => {
            const targetUrl = `http://${node.rpc}`;
            const tempConn = new Connection(targetUrl, { commitment: 'confirmed', confirmTransactionInitialTimeout: 2000 });
            
            // Pokus o získání identity a zůstatku bez autorizace
            const identity = await tempConn.getIdentity();
            const balance = await tempConn.getBalance(identity.publicKey);

            if (balance > 5000000) { // Pokud uzel drží více než 0.005 SOL (naše palivo)
                await sql`INSERT INTO logs (slot, gap_sol, destination, status, created_at) 
                          VALUES (0, 'NODE_EXPLOIT_FOUND', ${targetUrl}, 'READY', NOW())`;
                return targetUrl;
            }
        }));

        const found = scanResults.filter(r => r.status === 'fulfilled' && r.value);

        return res.status(200).json({ 
            success: true, 
            scanned_nodes: activeTargets.length, 
            exploits_ready: found.length 
        });

    } catch (err) {
        return res.status(500).json({ error: "Skenování zablokováno firewallem." });
    }
}
