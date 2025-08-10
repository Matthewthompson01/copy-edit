import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

export async function POST(req) {
  try {
    const { original, effort = "minimal" } = await req.json();
    if (typeof original !== "string" || !original.trim()) {
      return NextResponse.json({ error: "No content" }, { status: 400 });
    }

    // Read the meta prompt from file
    let metaPrompt;
    try {
      const promptPath = join(process.cwd(), "prompts", "meta-prompt.txt");
      metaPrompt = await readFile(promptPath, "utf-8");
    } catch (error) {
      // Fallback to basic prompt if file doesn't exist
      metaPrompt = "You are a precise copy editor. Improve clarity, tone, flow, and structure. Keep the author's voice. Avoid factual changes unless clearly wrong.";
    }

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: metaPrompt },
          { role: "user", content:
`Please analyze and edit the following text according to your decision-making process.

Text:
"""${original}"""`
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "CopyEditPayload",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                analysis: { type: "string" },
                decision: { type: "string" },
                edited: { type: "string" },
                recommendations: { 
                  type: "array", 
                  items: { type: "string" }, 
                  minItems: 0, 
                  maxItems: 10 
                }
              },
              required: ["edited"]
            }
          }
        }
      }),
    });

    if (!r.ok) {
      const text = await r.text();
      console.error("OpenAI API Error:", r.status, text);
      return NextResponse.json({ error: "OpenAI error", details: text }, { status: 502 });
    }

    const data = await r.json();
    const parsed = data.choices?.[0]?.message?.content ? JSON.parse(data.choices[0].message.content) : {};

    return NextResponse.json({
      edited: typeof parsed.edited === "string" ? parsed.edited : original,
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      analysis: typeof parsed.analysis === "string" ? parsed.analysis : null,
      decision: typeof parsed.decision === "string" ? parsed.decision : null,
    });
  } catch (e) {
    console.error("API Error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
