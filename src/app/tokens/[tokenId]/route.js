import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const runtime = 'edge';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://your-app-url.com'; // Fallback needed

// Descriptions for each color, similar to generate-nft-image route
const colorTraitDescriptions = {
  orange: "Action-oriented, energetic, spontaneous, risk-taker, competitive, enjoys freedom, hands-on.",
  blue: "Relationship-oriented, empathetic, communicative, seeks harmony and connection, authentic.",
  green: "Intellectual, analytical, independent, innovative, curious, seeks knowledge and competence.",
  gold: "Organized, responsible, traditional, dependable, values rules and order, enjoys structure.",
  unknown: "A unique and multifaceted personality."
};

export async function GET(request, { params }) {
  const { tokenId } = await params;

  if (!tokenId || isNaN(parseInt(tokenId))) {
    return NextResponse.json({ error: 'Invalid or missing Token ID' }, { status: 400 });
  }

  const numericTokenId = parseInt(tokenId);

  if (!process.env.POSTGRES_URL) {
    return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
  }

  try {
    const { rows } = await sql`
      SELECT token_id, fid, username, color, image_url 
      FROM true_color_nfts 
      WHERE token_id = ${numericTokenId};
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }

    const tokenData = rows[0];
    const colorName = tokenData.color?.toLowerCase() || 'unknown';
    const capitalizedColorName = colorName.charAt(0).toUpperCase() + colorName.slice(1);
    const descriptionForColor = colorTraitDescriptions[colorName] || colorTraitDescriptions.unknown;

    const metadata = {
      name: `True Color #${tokenData.token_id} - ${capitalizedColorName}`,
      description: `${tokenData.username || 'User FID: ' + tokenData.fid}'s True Color is ${capitalizedColorName}. This color represents traits like: ${descriptionForColor}`,
      image: tokenData.image_url,
      external_url: APP_URL, 
      attributes: [
        {
          trait_type: "Color",
          value: capitalizedColorName
        },
        {
          trait_type: "Color Meaning",
          value: descriptionForColor
        }
      ]
    };

    if (tokenData.username) {
      metadata.attributes.push({
        trait_type: "Username",
        value: tokenData.username
      });
    }

    if (tokenData.fid) {
      metadata.attributes.push({
        trait_type: "Farcaster FID",
        value: tokenData.fid,
        display_type: "number"
      });
    }

    return NextResponse.json(metadata);

  } catch (error) {
    console.error('Error fetching token metadata:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
} 