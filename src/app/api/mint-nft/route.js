import { NextResponse } from 'next/server';
import { uploadToR2 } from '@/lib/r2';

export const runtime = 'edge';

// Re-define color traits here or import from a shared constants file if preferred
const colorTraits = {
  orange: "Action-oriented, energetic, spontaneous",
  blue: "Relationship-oriented, empathetic, communicative",
  green: "Intellectual, analytical, independent",
  gold: "Organized, responsible, traditional",
  unknown: "Unique and multifaceted"
};

export async function POST(request) {
  try {
    const body = await request.json();
    // Added 'color' to destructuring, it should be primaryColor from trueColorsData
    const { color, displayName, pfpUrl, fid } = body;

    if (!color || !displayName || !fid) {
      return NextResponse.json({ error: 'Missing required parameters: color, displayName, fid' }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL is not configured.' }, { status: 500 });
    }

    // Get the traits for the color
    const selectedColorTraits = colorTraits[color.toLowerCase()] || colorTraits['unknown'];

    // Construct the URL for the NFT image generator
    const nftImageUrl = new URL(`${appUrl}/api/generate-nft-image`);
    nftImageUrl.searchParams.set('color', color);
    nftImageUrl.searchParams.set('displayName', displayName);
    if (pfpUrl) {
      nftImageUrl.searchParams.set('pfpUrl', pfpUrl);
    }
    // The generate-nft-image route does not use fid or traits in querystring directly
    // but they are used to select the traits string above which is embedded in the image
    // For future: if generate-nft-image needed traits directly, they would be passed here.

    // Fetch the image from the NFT image generation route
    const imageResponse = await fetch(nftImageUrl.toString());
    if (!imageResponse.ok) {
      const errorText = await imageResponse.text();
      return NextResponse.json({ error: `Failed to generate NFT image: ${errorText}` }, { status: imageResponse.status });
    }
    const imageBuffer = await imageResponse.arrayBuffer();

    // Upload to R2
    const timestamp = Date.now();
    const imageName = `nft-image-${fid}-${timestamp}.png`;
    // New R2 path prefix
    const r2FileName = `true-colors-nfts/${imageName}`;
    
    const publicR2Url = await uploadToR2(Buffer.from(imageBuffer), r2FileName, 'image/png');

    return NextResponse.json({
      mintedImageR2Url: publicR2Url,
      imageFileName: imageName
    });

  } catch (error) {
    console.error('Error in mint-nft route:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
} 