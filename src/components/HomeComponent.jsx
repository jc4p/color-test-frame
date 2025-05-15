'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import styles from './HomeComponent.module.css';
import { shareCastIntent, initiateMintProcess } from '@/lib/frame';

// Helper function to get color styles (updated for True Colors)
const getColorStyle = (colorName) => {
  switch (colorName?.toLowerCase()) {
    case 'orange': return styles.orange;
    case 'blue': return styles.blue;
    case 'green': return styles.green;
    case 'gold': return styles.gold;
    default: return '';
  }
};

export function HomeComponent() {
  const [userData, setUserData] = useState(null);
  const [trueColorsData, setTrueColorsData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fid, setFid] = useState(null);
  const [shareStatus, setShareStatus] = useState('');
  const [mintStatus, setMintStatus] = useState('');

  // Effect to check for window.userFid
  useEffect(() => {
    if (typeof window !== 'undefined' && window.userFid) {
      // console.log('HomeComponent found window.userFid immediately:', window.userFid);
      setFid(window.userFid);
      setIsLoading(false); 
      return; 
    }
    let attempts = 0;
    const maxAttempts = 30; 
    const intervalMs = 200;
    // console.log('HomeComponent starting poll for window.userFid');
    const intervalId = setInterval(() => {
      attempts++;
      if (typeof window !== 'undefined' && window.userFid) {
        // console.log(`HomeComponent found window.userFid after ${attempts} attempts:`, window.userFid);
        setFid(window.userFid);
        clearInterval(intervalId);
      } else if (attempts >= maxAttempts) {
        // console.warn('HomeComponent polling timeout reached without finding window.userFid.');
        setError("Could not detect Farcaster frame context. Ensure you're viewing this in a frame.");
        setIsLoading(false);
        clearInterval(intervalId);
      }
    }, intervalMs);
    return () => {
      // console.log("HomeComponent cleaning up polling interval.");
      clearInterval(intervalId);
    };
  }, []);

  // Fetch data effect (triggered by fid change)
  useEffect(() => {
    if (!fid) {
        return;
    }
    // console.log(`HomeComponent FID set to: ${fid}, fetching analysis data...`);
    setIsLoading(true);
    setError(null);
    setUserData(null);
    setTrueColorsData(null);
    setShareStatus('');
    setMintStatus('');
    fetch(`/api/user?fid=${fid}`)
      .then(async res => {
        if (!res.ok) {
          let errorMsg = `API request failed with status ${res.status}`;
          try { const errorData = await res.json(); errorMsg = errorData.error || errorMsg; } catch (e) { /* Ignore */ }
          throw new Error(errorMsg);
        }
        return res.json();
      })
      .then(data => {
        // console.log("HomeComponent received analysis data:", data);
        if (!data.trueColors) throw new Error("Missing True Colors analysis.");
        setUserData({ username: data.username, pfp_url: data.pfp_url, display_name: data.display_name });
        setTrueColorsData(data.trueColors);
        setIsLoading(false); 
      })
      .catch(err => {
        console.error("Error fetching analysis data:", err); // Keep error
        setError(err.message || "Failed to fetch analysis data.");
        setIsLoading(false); 
      });
  }, [fid]);

  const handleShareClick = useCallback(async () => {
    if (!trueColorsData || !fid || !userData) {
      // console.error('Missing data for sharing:', { trueColorsData, fid, userData });
      setShareStatus('Error: Missing data');
      setTimeout(() => setShareStatus(''), 3000);
      return;
    }

    setShareStatus('Sharing...');

    try {
      const apiResponse = await fetch('/api/create-share-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          color: trueColorsData.primaryColor,
          displayName: userData.display_name || userData.username || `FID ${fid}`,
          pfpUrl: userData.pfp_url || '',
          fid: fid,
        }),
      });

      if (!apiResponse.ok) {
        const errorData = await apiResponse.json();
        throw new Error(errorData.error || `Failed to create share link (status: ${apiResponse.status})`);
      }

      // Destructure generatedImageR2Url as well
      const { shareablePageUrl, generatedImageR2Url } = await apiResponse.json();

      // Log the R2 URL to the front-end console as requested
      if (generatedImageR2Url) {
        console.log('Final R2 Image URL:', generatedImageR2Url);
      }

      if (!shareablePageUrl) {
        throw new Error('Shareable Page URL not received from API.');
      }

      const castText = `My True Color is ${trueColorsData.primaryColor}! What's yours?`;
      
      await shareCastIntent(castText, shareablePageUrl);
      
      setShareStatus('Shared!');

    } catch (err) {
      console.error('Error in handleShareClick:', err); // Keep error
      setShareStatus(`Share failed: ${err.message.substring(0, 50)}...`);
    } finally {
      setTimeout(() => setShareStatus(''), 5000); 
    }
  }, [trueColorsData, userData, fid]);

  // New handler for minting
  const handleMintClick = useCallback(async () => {
    if (!trueColorsData || !fid || !userData) {
      setMintStatus('Error: Missing data');
      setTimeout(() => setMintStatus(''), 3000);
      return;
    }

    setMintStatus('Generating NFT...');

    try {
      const apiResponse = await fetch('/api/mint-nft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          color: trueColorsData.primaryColor,
          displayName: userData.display_name || userData.username || `FID ${fid}`,
          pfpUrl: userData.pfp_url || '',
          fid: fid,
        }),
      });

      if (!apiResponse.ok) {
        const errorData = await apiResponse.json();
        throw new Error(errorData.error || `Failed to mint NFT image (status: ${apiResponse.status})`);
      }

      const { mintedImageR2Url } = await apiResponse.json();

      if (mintedImageR2Url) {
        console.log('Minted NFT Image R2 URL:', mintedImageR2Url);
        setMintStatus('Image ready, preparing transaction...');

        // Call the new initiateMintProcess function from frame.js
        const mintResult = await initiateMintProcess({
            fid: fid,
            username: userData?.username,
            primaryColor: trueColorsData.primaryColor,
            mintedImageR2Url: mintedImageR2Url
        });

        // console.log('Mint process result:', mintResult);

        if (mintResult.success) {
          setMintStatus('Thanks, check your wallet in a few minutes!');
        } else {
          // Error message will be from the error thrown by initiateMintProcess
          throw new Error(mintResult.message || 'Minting process failed.');
        }

      } else {
        throw new Error('Minted Image URL not received from API.');
      }

    } catch (err) {
      console.error('Error in handleMintClick:', err); 
      setMintStatus(`Mint failed: ${err.message.substring(0, 100)}`);
    } finally {
      // Consider when to clear status or if a retry should be allowed
      // setTimeout(() => setMintStatus(''), 10000); // Longer timeout for final messages
    }
  }, [trueColorsData, userData, fid]);

  const primaryColor = trueColorsData?.primaryColor;
  const colorStyle = getColorStyle(primaryColor);
  const primaryColorName = primaryColor?.toLowerCase();

  // Loading State UI (Show if fid is not set yet OR if isLoading is true during fetch)
  if (!fid || isLoading) {
        return (
            <div className={`${styles.container} ${styles.loadingContainer}`}>
                <div className={styles.spinner}></div>
                {/* Adjust text based on whether we are waiting for FID or fetching data */} 
                <p className={styles.loadingText}>{!fid ? "Waiting for frame context..." : "Discovering your True Color..."}</p>
            </div>
        );
  }

  // Error State UI
  if (error) {
        return (
            <div className={styles.container}>
                 <h2 className={styles.errorTitle}>Color Analysis Failed!</h2>
                <p className={styles.errorMessage}>{error}</p>
            </div>
        );
  }

  // Main Content UI (Only render if fid is set, not loading, and no error)
  return (
    <div className={`${styles.container} ${primaryColorName ? styles[primaryColorName] : ''}`}>
      {/* Header Container */}
      <div className={styles.headerContainer}>
        {userData && userData.pfp_url && (
            <div className={styles.pfpContainerSmall}>
              <Image
                src={userData.pfp_url}
                alt={`${userData.display_name || userData.username || 'User'}'s profile picture`}
                width={50}
                height={50}
                className={`${styles.pfpImageSmall} ${colorStyle}`}
                priority
                unoptimized={true}
              />
            </div>
        )}
         <h1 className={styles.titleSmall}>
            Color analysis complete for <span className={`${styles.userNameHighlight}`}>{userData?.display_name || userData?.username || `FID ${fid}` }</span>!
        </h1>
      </div>

      {/* Share Button */}
      {trueColorsData && (
        <button
            className={styles.shareButton}
            onClick={handleShareClick}
            disabled={!!shareStatus && shareStatus !== 'Share Result'}
            aria-label="Share Result"
        >
            <span role="img" aria-label="share icon">🔗</span> 
            {shareStatus || 'Share Result'}
        </button>
       )}

      {/* Mint NFT Image Button - New Button */}
      {trueColorsData && (
        <button
            className={`${styles.shareButton} ${styles.mintButton}`}
            onClick={handleMintClick}
            disabled={!!mintStatus && mintStatus !== 'Mint Result'}
            aria-label="Mint Result"
        >
            <span role="img" aria-label="sparkles icon">✨</span>
            {mintStatus || 'Mint Result'}
        </button>
      )}

      {/* Results Container */}
      {trueColorsData && (
          <div className={styles.resultsContainer}>
            <h2 className={styles.resultTitle}>Your True Color is... <span className={`${styles.highlight} ${colorStyle}`}>{primaryColor}!</span></h2>
            {trueColorsData.summary && <p className={styles.summary}>{trueColorsData.summary}</p>}
            
            <div className={styles.detailsGrid}>
                {/* Positive Stereotypes */}
                {trueColorsData.positiveStereotypes && trueColorsData.positiveStereotypes.length > 0 && (
                  <div className={styles.stereotypesContainer}>
                    <h3>Positive Traits</h3>
                    <ul>
                      {trueColorsData.positiveStereotypes.map((item, index) => (
                        <li key={index}>
                          <strong>{item.trait}:</strong> {item.evidence}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {/* Negative Stereotypes */}
                {trueColorsData.negativeStereotypes && trueColorsData.negativeStereotypes.length > 0 && (
                  <div className={styles.stereotypesContainer}>
                    <h3>Potential Challenges</h3>
                    <ul>
                      {trueColorsData.negativeStereotypes.map((item, index) => (
                        <li key={index}>
                          <strong>{item.trait}:</strong> {item.evidence}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                 {/* Color Affinities */}
                {trueColorsData.colorAffinities && (
                  <div className={styles.affinitiesContainer}>
                    <h3>Color Affinities</h3>
                    <ul>
                      {Object.entries(trueColorsData.colorAffinities)
                        .sort(([, a], [, b]) => b - a) 
                        .map(([color, percentage]) => (
                          <li key={color} className={getColorStyle(color)}>
                             {color}: {Math.round(percentage)}%
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
            </div>
          </div>
      )}
    </div>
  );
} 