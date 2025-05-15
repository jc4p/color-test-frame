import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const runtime = 'edge';


const ALCHEMY_RPC_URL = process.env.CELO_RPC_URL;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS?.toLowerCase();

// Keccak256 hash of "Transfer(address,address,uint256)"
const TRANSFER_EVENT_SIGNATURE = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

const MAX_RETRIES = 30; // Approx 3 seconds (30 * 1s)
const RETRY_DELAY_MS = 1000; // 1 second

async function getTokenIdFromTransaction(txHash) {
  if (!ALCHEMY_RPC_URL) {
    throw new Error('CELO_RPC_URL is not configured.');
  }
  if (!CONTRACT_ADDRESS) {
    throw new Error('CONTRACT_ADDRESS is not configured.');
  }

  let lastError = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // console.log(`Attempt ${attempt + 1} to fetch receipt for tx: ${txHash}`);
      const response = await fetch(ALCHEMY_RPC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getTransactionReceipt',
          params: [txHash],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch transaction receipt: ${response.status} ${errorText}`);
      }

      const { result, error } = await response.json();

      if (error) {
        lastError = new Error(`RPC Error: ${error.message}`);
        // Some RPC errors might be non-retryable, but we'll retry for simplicity here
        // unless it's a clear configuration issue from the start (handled outside loop).
        console.error(`RPC error on attempt ${attempt + 1}:`, error.message);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        continue;
      }
      
      if (result) {
        // Receipt found, proceed to find logs
        if (!result.logs || result.logs.length === 0) {
          // This case (receipt found but no logs) usually means it won't appear later for this specific tx.
          // However, if the contract logic is complex, logs might appear with more confirmations. For NFT mints, usually direct.
          // We'll treat it as potentially retryable for a few attempts if logs are expected.
          lastError = new Error('Transaction receipt found, but no logs present. This might indicate an issue with the transaction itself or contract interaction.');
          console.warn(`Receipt for ${txHash} found on attempt ${attempt + 1}, but no logs. Retrying a few times for logs to appear...`);
          // If after several attempts logs are still not there, it is unlikely they will appear for this tx.
          if (attempt < MAX_RETRIES / 2) { // Retry for logs for half the attempts
             await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
             continue;
          }
          throw lastError; 
        }

        for (const log of result.logs) {
          if (
            log.address?.toLowerCase() === CONTRACT_ADDRESS &&
            log.topics && log.topics[0]?.toLowerCase() === TRANSFER_EVENT_SIGNATURE &&
            log.topics.length === 4
          ) {
            const tokenIdHex = log.topics[3];
            // console.log(`Token ID found on attempt ${attempt + 1}`);
            return parseInt(tokenIdHex, 16);
          }
        }
        // If logs are present but not the one we are looking for
        lastError = new Error('Transfer event for the specified contract not found in transaction logs, though other logs exist.');
        // This is likely a definitive failure for this tx, so throw immediately.
        throw lastError;
      }

      // If result is null, transaction is not yet mined/indexed
      // console.log(`Transaction ${txHash} not found or still processing on attempt ${attempt + 1}. Retrying...`);
      lastError = new Error('Transaction receipt not found after multiple attempts (likely still processing or invalid hash).');
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));

    } catch (e) {
      lastError = e; // Store the error from this attempt
      console.error(`Error on attempt ${attempt + 1} for tx ${txHash}:`, e.message);
      // If the error is specific (e.g., network, parsing), we might break or handle differently
      // For now, we retry on most errors from fetch/processing within the loop.
      if (attempt < MAX_RETRIES - 1) { // Don't wait if it's the last attempt
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }
  // If loop finishes without returning, all retries failed
  console.error(`Failed to get tokenId for tx ${txHash} after ${MAX_RETRIES} attempts. Last error:`, lastError?.message);
  throw lastError || new Error('Failed to get token ID after all retries.');
}

export async function POST(request) {
  if (!process.env.POSTGRES_URL) {
    return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
  }
  try {
    const body = await request.json();
    const { txHash, walletAddress, fid, username, color, imageUrl } = body;

    if (!txHash || !walletAddress || !color || !imageUrl) {
      return NextResponse.json({ error: 'Missing required parameters: txHash, walletAddress, color, imageUrl' }, { status: 400 });
    }

    let tokenId;
    try {
      tokenId = await getTokenIdFromTransaction(txHash);
    } catch (e) {
      console.error(`Failed to get tokenId for tx ${txHash}:`, e.message);
      // If tokenId retrieval fails, we might still want to record the attempt depending on policy
      // For now, we'll return an error indicating the failure.
      return NextResponse.json({ error: `Failed to retrieve token ID: ${e.message}`, details: e.stack }, { status: 500 });
    }

    if (typeof tokenId !== 'number') {
        return NextResponse.json({ error: 'Could not determine Token ID from transaction logs.' }, { status: 400 });
    }

    // Insert into the database
    await sql`
      INSERT INTO true_color_nfts (token_id, tx_hash, wallet_address, fid, username, color, image_url)
      VALUES (${tokenId}, ${txHash}, ${walletAddress}, ${fid || null}, ${username || null}, ${color}, ${imageUrl});
    `;

    return NextResponse.json({ success: true, message: 'Mint transaction recorded.', tokenId: tokenId });

  } catch (error) {
    console.error('Error in record-mint-transaction:', error);
    // Check for specific Vercel Postgres error structure if needed
    const errorMessage = error.message || 'Internal Server Error';
    return NextResponse.json({ error: errorMessage, details: error.stack }, { status: 500 });
  }
} 