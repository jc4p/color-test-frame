import { NextResponse } from 'next/server';
import { getUserDataFromNeynar, getRecentCastTexts } from '@/lib/neynar';
import { analyzeTrueColors } from '@/lib/gemini';

// Set runtime to edge
export const runtime = 'edge';
export const dynamic = 'force-dynamic'; // Ensure fresh data on each request

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const fidParam = searchParams.get('fid');

  if (!fidParam) {
    return NextResponse.json({ error: 'FID query parameter is required' }, { status: 400 });
  }

  const fid = parseInt(fidParam, 10);

  if (isNaN(fid)) {
    return NextResponse.json({ error: 'Invalid FID format' }, { status: 400 });
  }

  console.log(`API route started for FID: ${fid}`);

  try {
    // Fetch user data and casts in parallel
    const [userData, castTexts] = await Promise.all([
      getUserDataFromNeynar(fid),
      getRecentCastTexts(fid)
    ]);

    if (!userData) {
      console.error(`Failed to fetch user data for FID: ${fid}`);
      return NextResponse.json({ error: 'User not found or failed to fetch base data' }, { status: 404 });
    }

    console.log(`Fetched user data for FID: ${fid}. Username: ${userData.username}`);
    console.log(`Fetched ${castTexts.length} cast texts for FID: ${fid}.`);

    // Extract bio for Gemini
    const bio = userData.profile?.bio?.text || null;

    // Analyze using Gemini
    const trueColorsAnalysis = await analyzeTrueColors(bio, castTexts);

    if (!trueColorsAnalysis) {
      console.error(`Failed to get True Colors analysis from Gemini for FID: ${fid}`);
      return NextResponse.json({ error: 'Failed to analyze user profile' }, { status: 500 });
    }

    console.log(`Successfully received True Colors analysis for FID: ${fid}. Primary Color: ${trueColorsAnalysis.primaryColor}`);

    // Combine results
    const responseData = {
      // Basic user info
      username: userData.username,
      pfp_url: userData.pfp_url,
      display_name: userData.display_name,
      // True Colors analysis
      trueColors: trueColorsAnalysis,
    };

    return NextResponse.json(responseData);

  } catch (error) {
    console.error(`API route error for FID ${fid}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 