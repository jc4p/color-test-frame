import { NextResponse } from 'next/server';
import { uploadToR2 } from '@/lib/r2';

export const runtime = 'edge';

export async function POST(request) {
  try {
    const body = await request.json();
    const { color, displayName, pfpUrl, fid } = body;

    if (!color || !displayName || !fid) {
      return NextResponse.json({ error: 'Missing required parameters: color, displayName, fid' }, { status: 400 });
    }

    // Construct the URL for the OG image generator
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL is not configured.' }, { status: 500 });
    }

    const ogImageUrl = new URL(`${appUrl}/api/og`);
    ogImageUrl.searchParams.set('color', color);
    ogImageUrl.searchParams.set('displayName', displayName);
    if (pfpUrl) {
      ogImageUrl.searchParams.set('pfpUrl', pfpUrl);
    }
    ogImageUrl.searchParams.set('fid', fid.toString());

    // Fetch the image from the OG route
    const imageResponse = await fetch(ogImageUrl.toString());
    if (!imageResponse.ok) {
      const errorText = await imageResponse.text();
      // console.error('Failed to generate OG image:', errorText); // Reduce logging
      return NextResponse.json({ error: `Failed to generate OG image: ${errorText}` }, { status: imageResponse.status });
    }
    const imageBuffer = await imageResponse.arrayBuffer();

    // Upload to R2
    const timestamp = Date.now();
    const imageName = `share-image-${fid}-${timestamp}.png`;
    const r2FileName = `true-colors-test/${imageName}`;
    
    const publicR2Url = await uploadToR2(Buffer.from(imageBuffer), r2FileName, 'image/png');

    // Construct the URL that, when shared, will show this image in the frame
    const sharePageUrl = new URL(appUrl);
    sharePageUrl.searchParams.set('image', imageName);

    return NextResponse.json({
      generatedImageR2Url: publicR2Url,
      shareablePageUrl: sharePageUrl.toString(),
      imageFileName: imageName
    });

  } catch (error) {
    console.error('Error in create-share-link:', error); // Keep error
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
} 