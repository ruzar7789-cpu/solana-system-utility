import { Connection, clusterApiUrl, Keypair, Transaction, SystemProgram, PublicKey } from '@solana/web3.js';
import { neon } from '@neondatabase/serverless';
import bs58 from 'bs58';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });

    // Připojení k DB a Solaně
    const sql = neon("postgresql://neondb_owner:npg_cVA3ayLX8vPH@ep-curly-voice-agsdk9sy-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require");
    const connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');
    const WALLET_DESTINATION = new PublicKey("C1NfhjQ6y9M1KRXE4zJbCqtnhaJgASRMRsnSEnU4PaNS");

    try {
        // Načtení tvého klíče z Vercel Environment Variables
        const secretKeyString = process.env.SOLANA_PRIVATE_KEY;
        if (!secretKeyString) throw new Error("Klíč nenalezen ve Vercelu!");
        
        const payer = Keypair.fromSecretKey(bs58.decode(secretKeyString));

        // Získání dat ze sítě
        const slot = await connection.getSlot();
        const recentBlockhash = await connection.getLatestBlockhash();

        // --- REÁLNÁ OPERACE (Testovací mikro-transakce) ---
        // Tohle pošle 0.000001 SOL (skoro nic), aby se ověřilo, že tvůj klíč funguje.
        const transaction = new Transaction({
            recentBlockhash: recentBlockhash.blockhash,
            feePayer: payer.publicKey
        }).add(
            SystemProgram.transfer({
                fromPubkey: payer.publicKey,
                toPubkey: WALLET_DESTINATION,
                lamports: 1000, 
            })
        );

        // PODPIS A ODESLÁNÍ (To je ta REALITA)
        const signature = await connection.sendTransaction(transaction, [payer]);
        
        // Zápis do Neonu s reálným ID transakce
        await sql`
            INSERT INTO logs (slot, gap_sol, destination, status, created_at)
            VALUES (${slot}, '0.000001', ${signature}, 'EXECUTED', NOW())
        `;

        return res.status(200).json({
            success: true,
            status: "TRANSAKCE ODESLÁNA",
            signature: signature,
            slot: slot
        });

    } catch (err) {
        console.error(err);
        return res.status(200).json({ 
            success: false, 
            status: "CHYBA PODPISU", 
            error: err.message 
        });
    }
}
