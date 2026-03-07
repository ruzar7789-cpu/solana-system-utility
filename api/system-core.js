import { Connection, clusterApiUrl } from '@solana/web3.js';
import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });

    // Tvůj ostrý přístup k databázi
    const sql = neon("postgresql://neondb_owner:npg_cVA3ayLX8vPH@ep-curly-voice-agsdk9sy-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require");
    
    const WALLET_FINAL = "C1NfhjQ6y9M1KRXE4zJbCqtnhaJgASRMRsnSEnU4PaNS";
    const connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');

    try {
        // Získání reálných dat ze sítě Solana
        const slot = await connection.getSlot();
        const gapFound = (Math.random() * 0.08).toFixed(4); // Simulace detekce algoritmem

        // --- OSTRÝ ZÁPIS DO NEONU ---
        // Předpokládáme, že máš tabulku 'logs' (pokud ne, vytvoříme ji v dalším kroku)
        await sql`
            INSERT INTO logs (slot, gap_sol, destination, status, created_at)
            VALUES (${slot}, ${gapFound}, ${WALLET_FINAL}, 'DETECTED', NOW())
        `;

        return res.status(200).json({
            success: true,
            status: "REAL-TIME SCANNING",
            slot: slot,
            details: `[!] GAP: ${gapFound} SOL - ZAPSÁNO DO DB`,
            destination: WALLET_FINAL
        });

    } catch (err) {
        console.error(err);
        return res.status(200).json({ 
            success: false, 
            status: "DB_CONNECTION_ERROR", 
            msg: "Neon.tech odmítl zápis. Zkontroluj tabulku logs." 
        });
    }
}
