// Supabase Edge Function: analyze-civic-image
// Powered by Google Gemini 1.5/2.0 Vision API
// Securely processes civic issue images without exposing Gemini API key to client

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CIVIC_CATEGORIES = [
  'Road Damage / Pothole',
  'Garbage / Waste',
  'Overflowing Dustbin',
  'Water Leakage',
  'Drainage / Sewage Overflow',
  'Broken Streetlight',
  'Traffic Signal Damage',
  'Damaged Public Infrastructure',
  'Open Manhole',
  'Fallen Tree / Obstruction',
  'Roadside Encroachment',
  'Other Civic Issue'
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    const GEMINI_VISION_MODEL = Deno.env.get('GEMINI_VISION_MODEL') || 'gemini-1.5-flash';

    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({
          error: 'GEMINI_API_KEY is not configured in Supabase Edge Function secrets.',
          status: 'fallback_required'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const { image_base64, image_url, mime_type = 'image/jpeg' } = await req.json();

    let base64Data = image_base64;
    let mimeType = mime_type;

    // If image_url is provided, fetch image and convert to base64
    if (!base64Data && image_url) {
      const imgRes = await fetch(image_url);
      if (!imgRes.ok) {
        throw new Error(`Failed to fetch image from URL: ${image_url}`);
      }
      const arrayBuf = await imgRes.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      base64Data = btoa(binary);
      mimeType = imgRes.headers.get('content-type') || 'image/jpeg';
    }

    if (!base64Data) {
      return new Response(
        JSON.stringify({ error: 'Missing image_base64 or image_url' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Clean up base64 prefix if present
    if (base64Data.includes('base64,')) {
      base64Data = base64Data.split('base64,')[1];
    }

    // System prompt with strict JSON output formatting
    const prompt = `You are NAGARSETU AI, an expert municipal computer vision classifier for civic defects.
Analyze this civic issue photo and respond ONLY with a valid JSON object with the following structure:
{
  "is_civic_issue": true or false,
  "category": "One of: ${CIVIC_CATEGORIES.join(', ')}",
  "issue_type": "Specific concise title of the civic defect (e.g. Large Road Pothole)",
  "confidence": 0.0 to 1.0 (realistic confidence based on clarity),
  "severity": "Low" or "Medium" or "High" or "Critical",
  "title": "Short practical complaint title (e.g. Severe Asphalt Pothole on Roadway)",
  "description": "Factual description based strictly on visible evidence without making up unobservable facts.",
  "recommended_department": "Corresponding municipal department name",
  "visual_evidence": ["list", "of", "detected", "visual", "objects"],
  "quality_check": {
    "isUsable": true or false,
    "warning": "Optional quality warning if blurry/dark/overexposed, otherwise null"
  }
}
If the photo does not depict any municipal or civic issue, set "is_civic_issue": false and provide appropriate explanation.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VISION_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const geminiPayload = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Data
              }
            }
          ]
        }
      ],
      generationConfig: {
        response_mime_type: 'application/json',
        temperature: 0.1
      }
    };

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${errText}`);
    }

    const geminiData = await response.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      throw new Error('Empty response received from Gemini model');
    }

    const parsedResult = JSON.parse(rawText);

    return new Response(
      JSON.stringify({
        success: true,
        data: parsedResult,
        model: GEMINI_VISION_MODEL
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error.message || 'Unknown Gemini Vision processing error',
        status: 'error'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
