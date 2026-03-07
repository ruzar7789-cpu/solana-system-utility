import { Connection, clusterApiUrl, Keypair, VersionedTransaction } from '@solana/web3.js';
import { neon } from '@neondatabase/serverless';
import bs58 from 'bs58';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });

    // Připojení k DB (Neon) a Solaně (DEVNET pro testování zdarma)
    const sql = neon("postgresql://neondb_owner:npg_cVA3ayLX8vPH@ep-curly-voice-agsdk9sy-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require");
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

    try {
        // 1. Načtení tvého klíče z Vercel Environment Variables
        const secretKeyString = process.env.SOLANA_PRIVATE_KEY;
        if (!secretKeyString) throw new Error("Klíč nenalezen ve Vercelu!");
        const payer = Keypair.fromSecretKey(bs58.decode(secretKeyString));

        // 2. ZEPTÁME SE JUPITERA NA OBCHOD (Výměna 0.1 SOL za USDC na Devnetu)
        // Používáme testovací tokeny pro Devnet
        const quoteResponse = await (
            await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=100000000&slippageBps=50`)
        ).json();

        if (!quoteResponse || quoteResponse.error) {
            throw new Error("Jupiter nenašel cestu pro obchod: " + (quoteResponse.error || "Neznámá chyba"));
        }

        // 3. VYTVOŘENÍ SWAP TRANSAKCE
        const { swapTransaction } = await (
            await fetch('https://quote-api.jup.ag/v6/swap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    quoteResponse,
                    userPublicKey: payer.publicKey.toString(),
                    wrapAndUnwrapSol: true,
                })
            })
        ).json();

        // 4. PODPIS TVÝM KLÍČEM
        const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
        var transaction = VersionedTransaction.deserialize(swapTransactionBuf);
        transaction.sign([payer]);

        // 5. ODESLÁNÍ DO BLOCKCHAINU
        const signature = await connection.sendRawTransaction(transaction.serialize(), {
            skipPreflight: true,
            maxRetries: 2
        });

        // 6. ZÁPIS DO NEONU (Teď už jako EXECUTED obchod)
        const slot = await connection.getSlot();
        await sql`
            INSERT INTO logs (slot, gap_sol, destination, status, created_at)
            VALUES (${slot}, 'JUPITER_SWAP', ${signature}, 'EXECUTED', NOW())
        `;

        return res.status(200).json({
            success: true,
            status: "OBCHOD PROVEDEN",
            signature: signature,
            outAmount: quoteResponse.outAmount
        });

    } catch (err) {
        console.error(err);
        return res.status(200).json({ 
            success: false, 
            status: "CHYBA OBCHODU", 
            error: err.message 
        });
    }
}
