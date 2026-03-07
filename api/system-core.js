import { Connection, clusterApiUrl } from '@solana/web3.js';
import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
    const sql = neon(process.env.DATABASE_URL);
    // Přepínáme na extrémně rychlé timeouty, aby nás Vercel nestopnul
    const connection = new Connection(clusterApiUrl('mainnet-beta'), {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 1500 
    });

    try {
        const nodes = await connection.getClusterNodes();
        // Vybereme náhodný vzorek 20 uzlů pro každý nálet
        const targetSample = nodes.filter(n => n.rpc).sort(() => 0.5 - Math.random()).slice(0, 20);

        const exploits = [];

        for (const node of targetSample) {
            try {
                const nodeUrl = `http://${node.rpc}`;
                const nodeConn = new Connection(nodeUrl, 'confirmed');
                const identity = await nodeConn.getIdentity();
                const balance = await nodeConn.getBalance(identity.publicKey);

                // Pokud najdeme uzel s jakýmkoliv zůstatkem, zapíšeme ho jako kořist
                if (balance > 0) {
                    await sql`INSERT INTO logs (slot, gap_sol, destination, status, created_at) 
                              VALUES (0, 'NODE_EXPLOIT_READY', ${nodeUrl}, 'CRITICAL', NOW())`;
                    exploits.push(nodeUrl);
                }
            } catch (e) { continue; }
        }

        return res.status(200).json({ 
            success: true, 
            status: exploits.length > 0 ? "KOŘIST NALEZENA" : "SKEN DOKONČEN", 
            found_nodes: exploits 
        });

    } catch (err) {
        return res.status(200).json({ success: false, status: "REKONEKCE SYSTÉMU" });
    }
}
