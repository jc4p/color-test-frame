import * as frame from '@farcaster/frame-sdk'

export async function initializeFrame() {
  // Await the context promise
  const context = await frame.sdk.context;

  if (!context || !context.user) {
    // console.log('Not in frame context');
    return;
  }

  // Handle potential nested user object (known issue)
  let user = context.user;
  if (user && typeof user === 'object' && 'fid' in user && 'user' in user && user.user) {
    // console.warn('Detected nested user object, accessing user.user');
    user = user.user;
  }

  // Ensure user object has fid
  if (!user || typeof user.fid !== 'number') {
    console.error('User object or fid is missing or invalid in frame context:', user);
    return;
  }

  // console.log('Frame context initialized for user FID:', user.fid);

  // Make FID globally accessible
  // console.log('Setting window.userFid =', user.fid);
  window.userFid = user.fid;

  // Call the ready function to remove splash screen
  try {
    await frame.sdk.actions.ready();
    // console.log('Frame ready signal sent.');
  } catch (error) {
    console.error('Error signaling frame ready:', error);
  }
}

export async function shareCastIntent(castText, embedUrl) {
  if (!castText || !embedUrl) {
    // console.error('shareCastIntent: castText and embedUrl are required.');
    throw new Error('Cast text and embed URL are required for sharing.');
  }

  try {
    const finalComposeUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(castText)}&embeds[]=${encodeURIComponent(embedUrl)}`;
    
    // Ensure the SDK is available and has the necessary methods
    if (!frame || !frame.sdk || !frame.sdk.actions || !frame.sdk.actions.openUrl) {
        throw new Error('Farcaster SDK or actions.openUrl not available.');
    }

    await frame.sdk.actions.openUrl({ url: finalComposeUrl });
    // console.log('Successfully opened Warpcast compose intent:', finalComposeUrl);
  } catch (error) {
    console.error('Error in shareCastIntent opening URL:', error);
    // Re-throw the error so the calling component can handle it if needed
    throw error; 
  }
} 

const CELO_CHAIN_ID_DECIMAL = 42220;
const CELO_CHAIN_ID_HEX = '0xa4ec';
const NEXT_PUBLIC_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const MINT_FUNCTION_SIGNATURE = '0x1249c58b'; // keccak256('mint()').substring(0, 10)

async function ensureCorrectNetwork() {
  if (!frame.sdk || !frame.sdk.wallet || !frame.sdk.wallet.ethProvider) {
    throw new Error('Farcaster wallet provider is not available.');
  }
  try {
    const chainId = await frame.sdk.wallet.ethProvider.request({
      method: 'eth_chainId'
    });
    const chainIdDecimal = typeof chainId === 'number' ? chainId : parseInt(chainId, 16);

    if (chainIdDecimal !== CELO_CHAIN_ID_DECIMAL) {
      // console.log(`Requesting network switch to Celo (Chain ID: ${CELO_CHAIN_ID_HEX}). Current: ${chainId}`);
      await frame.sdk.wallet.ethProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: CELO_CHAIN_ID_HEX }]
      });
      // After requesting switch, re-check to ensure it was successful
      const newChainId = await frame.sdk.wallet.ethProvider.request({ method: 'eth_chainId' });
      const newChainIdDecimal = typeof newChainId === 'number' ? newChainId : parseInt(newChainId, 16);
      if (newChainIdDecimal !== CELO_CHAIN_ID_DECIMAL) {
        throw new Error(`Failed to switch to Celo network. Please switch manually. Current network: ${newChainIdDecimal}`);
      }
      // console.log('Successfully switched to Celo network.');
    } else {
      // console.log('Already on Celo network.');
    }
  } catch (error) {
    console.error('Error ensuring correct network:', error);
    // Prepend a more user-friendly message if it's a common rejection
    if (error.code === 4001) { // User rejected the request
        throw new Error('Network switch request rejected by user. Please connect to Celo (42220).');
    }
    throw new Error(`Network check/switch failed: ${error.message}. Please ensure your wallet is connected to Celo (42220).`);
  }
}

async function mintTokenAndRecordTransaction(mintData) {
  const {
    walletAddress,
    fid,
    username,
    color,
    imageUrl,
  } = mintData;

  if (!NEXT_PUBLIC_CONTRACT_ADDRESS) {
    throw new Error('Contract address (NEXT_PUBLIC_CONTRACT_ADDRESS) is not configured.');
  }
  if (!walletAddress) {
    throw new Error('Wallet address not provided for minting.');
  }

  // console.log(`Attempting to mint NFT. Contract: ${NEXT_PUBLIC_CONTRACT_ADDRESS}, Wallet: ${walletAddress}`);

  try {
    const txHash = await frame.sdk.wallet.ethProvider.request({
      method: 'eth_sendTransaction',
      params: [{
        from: walletAddress,
        to: NEXT_PUBLIC_CONTRACT_ADDRESS,
        data: MINT_FUNCTION_SIGNATURE, // For a simple mint() function with no arguments
        value: '0x0' // If your mint function is not payable
      }]
    });

    console.log('Transaction sent, txHash:', txHash);

    if (!txHash || typeof txHash !== 'string' || !txHash.startsWith('0x')) {
      throw new Error('Failed to send transaction or invalid transaction hash received.');
    }

    // Now call the backend to record this transaction and poll for token ID
    const recordTxResponse = await fetch('/api/record-mint-transaction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        txHash: txHash,
        walletAddress: walletAddress,
        fid: fid,
        username: username,
        color: color,
        imageUrl: imageUrl,
      }),
    });

    const recordTxData = await recordTxResponse.json();

    if (!recordTxResponse.ok) {
      throw new Error(recordTxData.error || `Failed to record transaction (status: ${recordTxResponse.status})`);
    }
    
    if (recordTxData.success) {
      // console.log('Transaction recorded successfully on backend, tokenId:', recordTxData.tokenId);
      return { success: true, message: 'Mint initiated and transaction sent. Waiting for confirmation.', txHash: txHash, tokenId: recordTxData.tokenId };
    } else {
      throw new Error(recordTxData.error || 'Failed to record transaction on backend after successful send.');
    }

  } catch (error) {
    console.error('Error in mintTokenAndRecordTransaction:', error);
    if (error.code === 4001) { // User rejected the transaction
        throw new Error('Transaction rejected by user.');
    }
    throw error; // Re-throw to be caught by the caller
  }
}

export async function initiateMintProcess(dataForMinting) {
  const { fid, username, primaryColor, mintedImageR2Url } = dataForMinting;

  if (!frame.sdk || !frame.sdk.wallet || !frame.sdk.wallet.ethProvider) {
    throw new Error('Farcaster wallet provider is not available for minting.');
  }

  try {
    // console.log('Step 1: Ensuring correct network (Celo).');
    await ensureCorrectNetwork();

    // console.log('Step 2: Requesting wallet accounts.');
    const accounts = await frame.sdk.wallet.ethProvider.request({
      method: 'eth_requestAccounts'
    });

    if (!accounts || accounts.length === 0 || !accounts[0]) {
      throw new Error('No wallet accounts found or permission denied.');
    }
    const walletAddress = accounts[0];
    // console.log('Wallet address obtained:', walletAddress);

    const mintData = {
        walletAddress,
        fid,
        username,
        color: primaryColor,
        imageUrl: mintedImageR2Url,
    };

    // console.log('Step 3: Calling mintTokenAndRecordTransaction with data:', mintData);
    return await mintTokenAndRecordTransaction(mintData);

  } catch (error) {
    console.error('Error in initiateMintProcess:', error);
    // The error might already be user-friendly from ensureCorrectNetwork or mintTokenAndRecordTransaction
    throw error; // Re-throw to be handled by UI
  }
} 