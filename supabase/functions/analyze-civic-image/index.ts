// Supabase Edge Function: analyze-civic-image
// Powered by Google Gemini 3.6 Flash Vision API

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VALID_TAXONOMY: Record<string, string> = {
  'Road Damage / Pothole': 'Public Works Department (PWD)',
  'Water Leakage / Pipeline': 'Water Supply & Sewerage',
  'Garbage / Waste': 'Sanitation & Waste Management',
  'Drainage / Sewage': 'Drainage & Sewage Department',
  'Streetlight / Electrical': 'Electrical & Street Lighting',
  'Traffic Infrastructure': 'Traffic Management Department',
  'Public Infrastructure Damage': 'Public Works Department (PWD)',
  'Other Civic Issue': 'Public Works Department (PWD)'
};

const SYSTEM_PROMPT = `You are the civic issue vision analyzer for NAGARSETU 3.0.
Analyze ONLY the actual uploaded image.
Do not infer the issue from the filename.
Do not reuse previous analysis.
Do not assume the issue is a pothole.
Determine the physical civic problem visible in the image.

If visible water is flowing from a broken pipe, damaged pipeline, leaking municipal water line, water ponding due to pipe break, or water infrastructure failure, classify it as:
Water Leakage / Pipeline
and recommend:
Water Supply & Sewerage.

If the image shows a pothole, crater, depression, pavement failure, or road surface damage without a water infrastructure failure, classify it as:
Road Damage / Pothole
and recommend:
Public Works Department (PWD).

If the image shows garbage, trash, solid waste, uncollected refuse, or overflowing litter bin, classify it as:
Garbage / Waste
and recommend:
Sanitation & Waste Management.

If the image shows overflowing drain, choked sewer, clogged gutter, open manhole shaft, or stagnant wastewater, classify it as:
Drainage / Sewage
and recommend:
Drainage & Sewage Department.

If the image shows non-functional, broken or damaged streetlight, lamp post, or electrical fixture, classify it as:
Streetlight / Electrical
and recommend:
Electrical & Street Lighting.

If the image shows damaged traffic light, broken signal pole, junction light malfunction, classify it as:
Traffic Infrastructure
and recommend:
Traffic Management Department.

If the image shows damaged public footpath pavers, broken curb, or public railing damage, classify it as:
Public Infrastructure Damage
and recommend:
Public Works Department (PWD).

If evidence is insufficient or unreadable, return:
Other Civic Issue
with low confidence score.

Never invent visual details that are not visible.

Respond ONLY with a valid JSON object matching this structure:
{
  "is_civic_issue": true,
  "category": "One of: Road Damage / Pothole, Water Leakage / Pipeline, Garbage / Waste, Drainage / Sewage, Streetlight / Electrical, Traffic Infrastructure, Public Infrastructure Damage, Other Civic Issue",
  "title": "Short practical complaint title (e.g. Municipal Water Pipeline Leakage)",
  "description": "Factual description based strictly on visible evidence.",
  "severity": "LOW or MEDIUM or HIGH or CRITICAL",
  "priority": "Low or Medium or High or Critical",
  "recommended_department": "Corresponding department from taxonomy",
  "confidence": 0.0 to 1.0,
  "detected_features": ["list", "of", "detected", "visual", "elements"],
  "needs_manual_verification": false
}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    const GEMINI_VISION_MODEL = Deno.env.get('GEMINI_VISION_MODEL') || 'gemini-3.6-flash';

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

    if (base64Data.includes('base64,')) {
      base64Data = base64Data.split('base64,')[1];
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VISION_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const geminiPayload = {
      contents: [
        {
          parts: [
            { text: SYSTEM_PROMPT },
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
    const category = parsedResult.category in VALID_TAXONOMY ? parsedResult.category : 'Other Civic Issue';
    parsedResult.category = category;
    parsedResult.recommended_department = VALID_TAXONOMY[category];

    return new Response(
      JSON.stringify({
        success: true,
        data: parsedResult,
        model: GEMINI_VISION_MODEL
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: error.message || 'Unknown Gemini Vision processing error',
        status: 'error'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
