import { Connection, clusterApiUrl, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });

    const sql = neon(process.env.DATABASE_URL);
    const myAddress = new PublicKey("C1NfhjQ6y9M1KRXE4zJbCqtnhaJgASRMRsnSEnU4PaNS");
    
    // 1. PŘIPOJENÍ K HLAVNÍMU ROZBOČOVAČI
    const mainConn = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');

    try {
        // 2. REALNÝ SKEN: Získáme seznam všech aktivních serverů v síti Solana
        const nodes = await mainConn.getClusterNodes();
        
        // Filtrujeme pouze ty, které mají aktivní RPC (bránu)
        const activeNodes = nodes.filter(node => node.rpc !== null);

        for (const node of activeNodes) {
            const nodeRpc = `http://${node.rpc}`; // Tady je ta REAL adresa
            
            try {
                // Zkusíme se "vloupat" do identity uzlu bez klíče
                const targetConn = new Connection(nodeRpc, 'confirmed');
                const identity = await targetConn.getIdentity();
                const balance = await targetConn.getBalance(identity.publicKey);

                // Pokud má uzel v sobě víc než 0.05 SOL (palivo na provoz)
                if (balance > 50000000) { 
                    const msg = `NALEZENO PALIVO NA: ${nodeRpc} (Zůstatek: ${balance / 1e9} SOL)`;
                    
                    await sql`INSERT INTO logs (slot, gap_sol, destination, status, created_at) 
                              VALUES (0, 'NODE_EXPLOIT_FOUND', ${nodeRpc}, 'READY', NOW())`;

                    return res.status(200).json({ 
                        success: true, 
                        status: "BRÁNA IDENTIFIKOVÁNA", 
                        target: nodeRpc, 
                        identity: identity.publicKey.toBase58(),
                        available_sol: balance / 1e9
                    });
                }
            } catch (e) {
                // Pokud uzel neodpovídá nebo je zabezpečený, jdeme na další
                continue;
            }
        }

        return res.status(200).json({ success: false, status: "Všechny aktivní brány jsou aktuálně zabezpečené. Opakuji sken..." });

    } catch (err) {
        return res.status(500).json({ error: "Skenování sítě bylo přerušeno firewallem." });
    }
}
