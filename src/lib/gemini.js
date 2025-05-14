import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn("GEMINI_API_KEY environment variable is not set. Gemini API calls will fail.");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || '');

// Define the schema for the True Colors analysis
const trueColorsSchema = {
  type: SchemaType.OBJECT,
  properties: {
    primaryColor: {
      type: SchemaType.STRING,
      description: "The True Color that best represents the user based on their personality traits.",
      enum: ["Orange", "Blue", "Green", "Gold"],
    },
    colorAffinities: {
      type: SchemaType.OBJECT,
      description: "An estimated percentage affinity for each True Color (0-100). These represent affinity and do not need to sum to 100.",
      properties: {
        Orange: { type: SchemaType.NUMBER, description: "Percentage affinity for Orange (action-oriented, spontaneous)." },
        Blue: { type: SchemaType.NUMBER, description: "Percentage affinity for Blue (relationship-oriented, empathetic)." },
        Green: { type: SchemaType.NUMBER, description: "Percentage affinity for Green (intellectual, analytical)." },
        Gold: { type: SchemaType.NUMBER, description: "Percentage affinity for Gold (organized, responsible)." },
      },
      required: ["Orange", "Blue", "Green", "Gold"],
    },
    summary: {
        type: SchemaType.STRING,
        description: "A brief (2-3 sentence) summary explaining the primary color choice and key traits observed, written directly to the user ('Your True Color appears to be... because you demonstrate...').",
        maxLength: 350,
    },
    positiveStereotypes: {
      type: SchemaType.ARRAY,
      description: "3-5 common positive traits or stereotypes associated with the user's primary color, each with specific evidence from their casts/bio.",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          trait: {
            type: SchemaType.STRING,
            description: "The positive trait or stereotype observed.",
            maxLength: 100,
          },
          evidence: {
            type: SchemaType.STRING,
            description: "A brief explanation or a direct quote (max 20 words) from the user's casts/bio illustrating this trait. Example: 'Your cast about X shows this.' or 'Quote: \'USER_CAST_SNIPPET\'.",
            maxLength: 250,
          }
        },
        required: ["trait", "evidence"]
      },
      minItems: 3,
      maxItems: 5,
    },
    negativeStereotypes: {
      type: SchemaType.ARRAY,
      description: "3-5 common negative traits, potential challenges, or areas for growth associated with the user's primary color, each with specific evidence from their casts/bio.",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          trait: {
            type: SchemaType.STRING,
            description: "The negative trait, potential challenge, or area for growth observed.",
            maxLength: 100,
          },
          evidence: {
            type: SchemaType.STRING,
            description: "A brief explanation or a direct quote (max 20 words) from the user's casts/bio illustrating this trait/challenge. Example: 'Your cast about Y suggests this.' or 'Quote: \'USER_CAST_SNIPPET\'.",
            maxLength: 250,
          }
        },
        required: ["trait", "evidence"]
      },
      minItems: 3,
      maxItems: 5,
    },
  },
  required: ["primaryColor", "colorAffinities", "summary", "positiveStereotypes", "negativeStereotypes"],
};

/**
 * Analyzes a user's bio and casts to determine their True Colors personality affinity.
 * @param {string | null} bio - The user's Farcaster bio.
 * @param {string[]} casts - An array of the user's recent cast texts.
 * @returns {Promise<object | null>} The analysis result matching trueColorsSchema or null if an error occurs.
 */
export async function analyzeTrueColors(bio, casts) {
  if (!GEMINI_API_KEY) {
    console.error("Cannot analyze: GEMINI_API_KEY is not set.");
    return null;
  }
  if (!casts || casts.length === 0) {
    console.warn("No casts provided for analysis.");
    if (!bio) {
        console.error("No bio or casts provided for analysis.");
        return null;
    }
  }

  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-lite", // Consider gemini-1.5-flash-latest or gemini-1.5-pro-latest if more power is needed
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.9,
      maxOutputTokens: 2048, // Ensure this is enough for the schema
      responseMimeType: "application/json",
      responseSchema: trueColorsSchema,
    },
  });

  const prompt = `Analyze this Farcaster user's bio and recent casts to determine their "True Colors" personality type. Assign a primary color and percentage affinities (0-100) for all four colors. Also, list common positive and negative stereotypes/traits for their primary color, providing specific evidence from their texts for each.

**True Colors Personality Types Overview:**
*   **Orange:** Action-oriented, energetic, spontaneous, risk-taker, competitive, enjoys freedom, hands-on, lives in the present. Values skill and results.
    *   *Positive traits often include:* Dynamic, skillful, adventurous, charming, fun-loving, witty, quick-thinking, bold.
    *   *Potential challenges include:* Impatient, impulsive, may overlook rules/details, can be seen as irresponsible or flaky, may not finish tasks.
*   **Blue:** Relationship-oriented, empathetic, communicative, seeks harmony and connection, authentic, artistic, compassionate. Values personal growth and meaning.
    *   *Positive traits often include:* Caring, insightful, inspiring, cooperative, sincere, peacemaker, good listener, expressive.
    *   *Potential challenges include:* Overly emotional, conflict-avoidant, can be taken advantage of, may struggle with difficult decisions, people-pleasing tendency.
*   **Green:** Intellectual, analytical, independent, innovative, curious, seeks knowledge and competence, logical, visionary. Values logic and data.
    *   *Positive traits often include:* Competent, original, rational, inventive, calm, self-controlled, objective, principled.
    *   *Potential challenges include:* Can seem arrogant or aloof, socially reserved, overly critical (of self and others), unemotional, may procrastinate due to perfectionism.
*   **Gold:** Organized, responsible, traditional, dependable, values rules and order, punctual, enjoys structure, dutiful. Values stability and community.
    *   *Positive traits often include:* Stable, reliable, thorough, efficient, law-abiding, detail-oriented, loyal, hard-working.
    *   *Potential challenges include:* Rigid, controlling, judgmental, resistant to change, can be bureaucratic, may lack spontaneity or creativity.

**Input Data:**
Bio: ${bio || 'No bio provided.'}
Recent Casts (max 500):
${casts.slice(0, 500).join('\\n---\\n')} ${casts.length > 500 ? '\\n[... additional casts truncated]' : ''}

**Analysis Instructions:**
1.  **Primary Color:** Determine the single BEST fit from Orange, Blue, Green, or Gold.
2.  **Color Affinities:** Estimate affinity for EACH of the four colors (0-100%). These represent affinity and do NOT need to sum to 100.
3.  **Summary:** Write a 2-3 sentence summary explaining the primary color choice, written directly TO THE USER. Show your evidence.").
4.  **Positive Stereotypes (Personalized):** List 3-5 common positive traits associated with the determined primary color. For each trait, provide specific supporting evidence by either: 
    a) Briefly explaining how the user's casts/bio demonstrate this trait.
    b) Citing a short, relevant quote (max 20 words) from their casts/bio.
5.  **Negative Stereotypes (Personalized & Constructive):** List 3-5 common negative traits or potential challenges associated with the determined primary color. For each, provide specific supporting evidence similarly by explaining or quoting from their casts/bio. Frame these constructively as areas for awareness or growth.

**IMPORTANT FORMATTING & STYLE:**
*   Adhere STRICTLY to the JSON schema, especially for the structure of positive and negative stereotypes (array of objects, each with 'trait' and 'evidence' strings).
*   Write the summary directly TO THE USER (use "You"/"Your").
*   Base analysis only on provided text. Do not invent information.
*   Ensure evidence for stereotypes is concise and directly linked to the user's provided text.
*   If you discuss "on-chain" concepts always use "onchain" one word without the dash.

Please provide the analysis in the specified JSON format.`;

  // console.log("Sending True Colors request to Gemini...");

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const responseText = response.text();

    // console.log("Received Gemini True Colors response text.");

    try {
        const parsedResponse = JSON.parse(responseText);
        // console.log("Successfully parsed Gemini True Colors response.");

        // Basic validation
        if (!parsedResponse.primaryColor || !parsedResponse.colorAffinities || !parsedResponse.summary || !parsedResponse.positiveStereotypes || !parsedResponse.negativeStereotypes) {
            console.error("Parsed Gemini True Colors response is missing required fields.", parsedResponse);
            throw new Error("Invalid structure in Gemini True Colors response.");
        }
        if (parsedResponse.positiveStereotypes.length < 3 || parsedResponse.positiveStereotypes.length > 5 || !parsedResponse.positiveStereotypes.every(item => item.trait && item.evidence)) {
            console.warn("Parsed Gemini True Colors response has an unexpected number or structure of positive stereotypes.", parsedResponse.positiveStereotypes);
            // Potentially throw an error if strict adherence is critical
        }
        if (parsedResponse.negativeStereotypes.length < 3 || parsedResponse.negativeStereotypes.length > 5 || !parsedResponse.negativeStereotypes.every(item => item.trait && item.evidence)) {
            console.warn("Parsed Gemini True Colors response has an unexpected number or structure of negative stereotypes.", parsedResponse.negativeStereotypes);
            // Potentially throw an error if strict adherence is critical
        }

        return parsedResponse;
    } catch (parseError) {
        console.error('JSON parse error (True Colors):', parseError);
        console.error('Raw Gemini True Colors response text:', responseText);
        const match = responseText.match(/```json\\n(.*\n?)```/s);
        if (match && match[1]) {
            console.log("Attempting to parse extracted JSON (True Colors) from markdown.");
            try {
                const parsedFallback = JSON.parse(match[1]);
                 console.log("Successfully parsed extracted Gemini True Colors JSON.");
                 // Re-validate
                 if (!parsedFallback.primaryColor || !parsedFallback.colorAffinities || !parsedFallback.summary || !parsedFallback.positiveStereotypes || !parsedFallback.negativeStereotypes) {
                    console.error("Parsed fallback Gemini True Colors response is missing required fields.", parsedFallback);
                    throw new Error("Invalid structure in fallback Gemini True Colors response.");
                 }
                 if (parsedFallback.positiveStereotypes.length < 3 || parsedFallback.positiveStereotypes.length > 5 || !parsedFallback.positiveStereotypes.every(item => item.trait && item.evidence)) {
                    console.warn("Parsed fallback Gemini True Colors response has an unexpected number or structure of positive stereotypes.", parsedFallback.positiveStereotypes);
                 }
                 if (parsedFallback.negativeStereotypes.length < 3 || parsedFallback.negativeStereotypes.length > 5 || !parsedFallback.negativeStereotypes.every(item => item.trait && item.evidence)) {
                    console.warn("Parsed fallback Gemini True Colors response has an unexpected number or structure of negative stereotypes.", parsedFallback.negativeStereotypes);
                 }
                return parsedFallback;
            } catch (fallbackParseError) {
                console.error('Fallback JSON parse error (True Colors):', fallbackParseError);
                throw new Error("Failed to parse Gemini True Colors response as JSON, even after extraction.");
            }
        } else {
             throw new Error("Failed to parse Gemini True Colors response as JSON.");
        }
    }
  } catch (error) {
    console.error('Error calling Gemini API for True Colors analysis:', error);
    return null;
  }
} 