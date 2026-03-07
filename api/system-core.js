import { Connection, clusterApiUrl, PublicKey } from '@solana/web3.js';
import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
    const sql = neon(process.env.DATABASE_URL);
    const mainConn = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');

    try {
        const nodes = await mainConn.getClusterNodes();
        // Zaměříme se na uzly s aktivním RPC portem
        const targets = nodes.filter(n => n.rpc).slice(0, 50); // Zkusíme prvních 50 najednou

        // Paralelní skenování pro maximální rychlost
        const results = await Promise.allSettled(targets.map(async (node) => {
            const targetConn = new Connection(`http://${node.rpc}`, { commitment: 'confirmed', confirmTransactionInitialTimeout: 3000 });
            const identity = await targetConn.getIdentity();
            const balance = await targetConn.getBalance(identity.publicKey);

            if (balance > 1000000) { // Pokud uzel obsahuje více než 0.001 SOL
                await sql`INSERT INTO logs (slot, gap_sol, destination, status, created_at) 
                          VALUES (0, 'NODE_EXPLOIT_FOUND', ${node.rpc}, 'READY', NOW())`;
                return node.rpc;
            }
        }));

        const found = results.filter(r => r.status === 'fulfilled' && r.value);

        return res.status(200).json({ 
            success: true, 
            scanned: targets.length, 
            found: found.length 
        });

    } catch (err) {
        return res.status(500).json({ error: "Skenování přerušeno firewallem." });
    }
}
