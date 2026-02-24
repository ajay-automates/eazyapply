import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Read file content
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let textContent = "";

    // Extract text from PDF
    if (file.name.toLowerCase().endsWith(".pdf")) {
      try {
        const pdfParse = (await import("pdf-parse")).default;
        const pdfData = await pdfParse(buffer);
        textContent = pdfData.text;
      } catch (e) {
        // Fallback: try to read as text
        textContent = buffer.toString("utf-8").replace(/[^\x20-\x7E\n\r\t]/g, " ");
      }
    } else {
      // For DOCX, extract raw text (simplified)
      textContent = buffer.toString("utf-8").replace(/[^\x20-\x7E\n\r\t]/g, " ");
    }

    if (!textContent || textContent.trim().length < 20) {
      return NextResponse.json({ error: "Could not extract text from file" }, { status: 400 });
    }

    // Use Claude to extract structured profile data
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (anthropicKey) {
      const extracted = await extractWithClaude(textContent, anthropicKey);
      return NextResponse.json(extracted);
    }

    // Fallback: basic regex extraction
    const extracted = extractBasic(textContent);
    return NextResponse.json(extracted);
  } catch (error: any) {
    console.error("Resume parse error:", error);
    return NextResponse.json({ error: error.message || "Parse failed" }, { status: 500 });
  }
}

async function extractWithClaude(text: string, apiKey: string) {
  const prompt = `Extract structured profile data from this resume text. Return ONLY valid JSON with these fields (use empty string "" for anything you can't find):

{
  "firstName": "",
  "lastName": "",
  "email": "",
  "phone": "",
  "address": "",
  "city": "",
  "state": "",
  "zipCode": "",
  "country": "",
  "linkedinUrl": "",
  "githubUrl": "",
  "portfolioUrl": "",
  "websiteUrl": "",
  "currentTitle": "",
  "currentCompany": "",
  "yearsExperience": "",
  "university": "",
  "degree": "",
  "major": "",
  "gpa": "",
  "gradYear": "",
  "university2": "",
  "degree2": "",
  "major2": "",
  "gradYear2": "",
  "technicalSkills": "",
  "programmingLanguages": "",
  "frameworks": "",
  "tools": "",
  "certifications": "",
  "languages": "",
  "elevatorPitch": "",
  "volunteerExperience": "",
  "publications": "",
  "awards": "",
  "professionalMemberships": ""
}

RESUME TEXT:
${text.substring(0, 8000)}

Return ONLY the JSON object, no markdown, no explanation.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    let raw = data.content[0].text.trim();

    // Strip markdown code fences
    if (raw.startsWith("```")) {
      raw = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    return JSON.parse(raw);
  } catch (e) {
    console.error("Claude extraction failed:", e);
    return extractBasic(text);
  }
}

function extractBasic(text: string): Record<string, string> {
  const result: Record<string, string> = {};

  // Email
  const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  if (emailMatch) result.email = emailMatch[0];

  // Phone
  const phoneMatch = text.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  if (phoneMatch) result.phone = phoneMatch[0];

  // LinkedIn
  const linkedinMatch = text.match(/linkedin\.com\/in\/[\w-]+/i);
  if (linkedinMatch) result.linkedinUrl = "https://" + linkedinMatch[0];

  // GitHub
  const githubMatch = text.match(/github\.com\/[\w-]+/i);
  if (githubMatch) result.githubUrl = "https://" + githubMatch[0];

  // Name (first line that looks like a name)
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines[0] && lines[0].split(" ").length <= 4 && !lines[0].includes("@")) {
    const parts = lines[0].split(" ");
    result.firstName = parts[0] || "";
    result.lastName = parts.slice(1).join(" ") || "";
  }

  return result;
}
