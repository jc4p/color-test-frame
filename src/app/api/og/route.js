import { ImageResponse } from '@vercel/og';

export const runtime = 'edge';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    // Params from query string
    const colorName = searchParams.get('color')?.toLowerCase() || 'unknown';
    const displayName = searchParams.get('displayName') || 'Anonymous User';
    const pfpUrl = searchParams.get('pfpUrl');
    // const fid = searchParams.get('fid'); // Not directly used in image text but good for context

    // Basic validation for pfpUrl
    let validPfpUrl = null;
    if (pfpUrl) {
      try {
        const pfpUrlObj = new URL(pfpUrl);
        if (pfpUrlObj.protocol === 'http:' || pfpUrlObj.protocol === 'https:') {
          validPfpUrl = pfpUrl;
        }
      } catch (e) {
        // console.warn('Invalid pfpUrl provided:', pfpUrl); // Reduce logging
      }
    }

    const colorMap = {
      orange: '#FF7043',
      blue: '#42A5F5',
      green: '#66BB6A',
      gold: '#FFCA28',
      unknown: '#808080', // Default gray for unknown color
    };

    const selectedColorHex = colorMap[colorName] || colorMap['unknown'];
    const capitalizedColorName = colorName.charAt(0).toUpperCase() + colorName.slice(1);


    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            backgroundColor: '#f0f0f0',
            fontFamily: '"Arial", sans-serif',
            padding: '20px 30px',
            boxSizing: 'border-box',
          }}
        >
          {/* User Info Area */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '25px' }}>
            {validPfpUrl ? (
              <img
                src={validPfpUrl}
                alt=""
                width={80}
                height={80}
                style={{
                  borderRadius: '50%',
                  marginRight: '20px',
                  border: '4px solid #ccc'
                }}
              />
            ) : (
              <div 
                style={{ 
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  width: 80, 
                  height: 80, 
                  borderRadius: '50%', 
                  backgroundColor: '#ccc',
                  marginRight: '20px',
                  border: '4px solid #ccc'
                }}
              />
            )}
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', fontSize: '28px', fontWeight: 'bold', color: '#333' }}>
              {displayName}
            </div>
          </div>
          
          {/* Color Circle and Name */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '150px',
                height: '150px',
                backgroundColor: selectedColorHex,
                borderRadius: '50%',
                marginBottom: '5px',
                border: '5px solid rgba(0,0,0,0.1)',
                boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
              }}
            />
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              fontSize: '40px',
              fontWeight: 'bold',
              color: selectedColorHex,
              textShadow: '1px 1px 2px rgba(0,0,0,0.2)'
            }}>
              I'm {capitalizedColorName}!
            </div>
          </div>
          
          {/* Find out yours! text */}
          <div style={{
            display: 'flex',
            fontSize: '28px',
            color: '#555',
            width: '100%',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            Discover your color!
          </div>
        </div>
      ),
      {
        width: 600,
        height: 400,
      },
    );
  } catch (e) {
    console.error('Error generating image:', e.message);
    if (e.cause) {
      console.error('Cause:', e.cause);
    }
    return new Response(`Failed to generate image: ${e.message}`, { status: 500 });
  }
} 