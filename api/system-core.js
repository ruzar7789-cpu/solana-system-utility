import { Connection, clusterApiUrl, Keypair, Transaction, PublicKey } from '@solana/web3.js';
import { createCloseAccountInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { neon } from '@neondatabase/serverless';
import bs58 from 'bs58';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });

    const sql = neon("postgresql://neondb_owner:npg_cVA3ayLX8vPH@ep-curly-voice-agsdk9sy-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require");
    // Přepnuto na MAINNET, protože tam jsou ty reálné zapomenuté peníze (Rent)
    const connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');

    try {
        const secretKeyString = process.env.SOLANA_PRIVATE_KEY;
        if (!secretKeyString) throw new Error("Klíč nenalezen!");
        const payer = Keypair.fromSecretKey(bs58.decode(secretKeyString));

        addLog("Skenuji síť pro zapomenuté SOL (Rent)...");

        // 1. NAJDEME VŠECHNY TOKEN ÚČTY, KTERÉ TI PATŘÍ
        const tokenAccounts = await connection.getTokenAccountsByOwner(payer.publicKey, {
            programId: TOKEN_PROGRAM_ID,
        });

        let recoveredTotal = 0;
        let signatures = [];

        // 2. PROJDEME ÚČTY A HLEDÁME TY PRÁZDNÉ
        for (const account of tokenAccounts.value) {
            const accountInfo = await connection.getTokenAccountBalance(account.pubkey);
            
            // FINTA: Pokud je na účtu nula, můžeme ho zavřít a vzít si zálohu (Rent)
            if (accountInfo.value.uiAmount === 0) {
                const transaction = new Transaction().add(
                    createCloseAccountInstruction(
                        account.pubkey,      // Účet, co zavíráme
                        payer.publicKey,    // Kam půjdou ty peníze (k tobě!)
                        payer.publicKey     // Kdo to podepisuje (ty)
                    )
                );

                const signature = await connection.sendTransaction(transaction, [payer]);
                signatures.push(signature);
                recoveredTotal += 0.002; // Přibližná částka zálohy za 1 účet
            }
        }

        if (signatures.length === 0) {
            return res.status(200).json({ success: false, error: "Nenalezeny žádné prázdné účty k vysátí." });
        }

        // 3. ZÁPIS ÚSPĚCHU DO NEONU
        await sql`
            INSERT INTO logs (slot, gap_sol, destination, status, created_at)
            VALUES (0, 'RENT_RECOVERY', ${signatures[0]}, 'SUCCESS', NOW())
        `;

        return res.status(200).json({
            success: true,
            status: "RENT VYSÁT",
            recovered_sol: recoveredTotal,
            count: signatures.length,
            signature: signatures[0]
        });

    } catch (err) {
        console.error(err);
        return res.status(200).json({ 
            success: false, 
            status: "CHYBA SYSTÉMU", 
            error: err.message 
        });
    }
}
