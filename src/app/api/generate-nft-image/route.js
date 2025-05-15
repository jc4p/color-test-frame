import { ImageResponse } from '@vercel/og';

export const runtime = 'edge';

// Store color descriptions
const colorTraits = {
  orange: "Action-oriented, energetic, spontaneous",
  blue: "Relationship-oriented, empathetic, communicative",
  green: "Intellectual, analytical, independent",
  gold: "Organized, responsible, traditional",
  unknown: "Unique and multifaceted"
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const colorName = searchParams.get('color')?.toLowerCase() || 'unknown';
    const displayName = searchParams.get('displayName') || 'Anonymous User';
    const pfpUrl = searchParams.get('pfpUrl');
    // fid is not used in this image directly

    let validPfpUrl = null;
    if (pfpUrl) {
      try {
        const pfpUrlObj = new URL(pfpUrl);
        if (pfpUrlObj.protocol === 'http:' || pfpUrlObj.protocol === 'https:') {
          validPfpUrl = pfpUrl;
        }
      } catch (e) {
        // console.warn('Invalid pfpUrl provided for NFT image:', pfpUrl);
      }
    }

    const colorMap = {
      orange: '#FF7043',
      blue: '#42A5F5',
      green: '#66BB6A',
      gold: '#FFCA28',
      unknown: '#808080',
    };

    const selectedColorHex = colorMap[colorName] || colorMap['unknown'];
    const capitalizedColorName = colorName.charAt(0).toUpperCase() + colorName.slice(1);
    const traits = colorTraits[colorName] || colorTraits['unknown'];

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center', // Center content vertically for square
            backgroundColor: '#2C3A47', // Darker background for NFT feel
            fontFamily: '"Arial", sans-serif',
            padding: '40px', // Adjust padding for square
            boxSizing: 'border-box',
            color: '#FFFFFF', // Default text color to white
          }}
        >
          {/* User Info Area - Smaller and at the top */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '25px' }}>
            {validPfpUrl ? (
              <img
                src={validPfpUrl}
                alt=""
                width={90} // Slightly larger PFP
                height={90}
                style={{
                  borderRadius: '50%',
                  border: `4px solid ${selectedColorHex}`, // Border with color
                  marginBottom: '10px'
                }}
              />
            ) : (
              <div 
                style={{ 
                  width: 90, 
                  height: 90, 
                  borderRadius: '50%', 
                  backgroundColor: '#555', 
                  border: `4px solid ${selectedColorHex}`,
                  marginBottom: '10px'
                }}
              />
            )}
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#EAEAEA' }}>
              {displayName}
            </div>
          </div>

          {/* Color Circle and Name */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: '15px' }}>
            <div
              style={{
                width: '200px', // Larger circle for square
                height: '200px',
                backgroundColor: selectedColorHex,
                borderRadius: '50%',
                marginBottom: '20px',
                border: '6px solid rgba(255,255,255,0.8)',
                boxShadow: `0 0 25px ${selectedColorHex}`, // Glow effect
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            />
            <div style={{
              fontSize: '48px',
              fontWeight: 'bold',
              color: selectedColorHex,
              textShadow: '1px 1px 3px rgba(0,0,0,0.5)'
            }}>
              {capitalizedColorName}
            </div>
          </div>
          
          {/* Color Traits Text */}
          <div style={{
            fontSize: '26px',
            color: '#BDC3C7', // Lighter gray for traits
            textAlign: 'center',
            marginTop: '5px', // Closer to color name
            maxWidth: '80%',
            lineHeight: '1.3'
          }}>
            {traits}
          </div>

        </div>
      ),
      {
        width: 600, // Square image
        height: 600,
      },
    );
  } catch (e) {
    console.error('Error generating NFT image:', e.message);
    if (e.cause) {
      console.error('Cause:', e.cause);
    }
    return new Response(`Failed to generate NFT image: ${e.message}`, { status: 500 });
  }
} 