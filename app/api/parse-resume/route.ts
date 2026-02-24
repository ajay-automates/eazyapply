import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let textContent = "";

    if (file.name.toLowerCase().endsWith(".pdf")) {
      try {
        const pdfParse = (await import("pdf-parse")).default;
        const pdfData = await pdfParse(buffer);
        textContent = pdfData.text;
      } catch (e) {
        textContent = buffer.toString("utf-8").replace(/[^\x20-\x7E\n\r\t]/g, " ");
      }
    } else {
      textContent = buffer.toString("utf-8").replace(/[^\x20-\x7E\n\r\t]/g, " ");
    }

    if (!textContent || textContent.trim().length < 20) {
      return NextResponse.json({ error: "Could not extract text from file" }, { status: 400 });
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      const extracted = await extractWithClaude(textContent, anthropicKey);
      return NextResponse.json(extracted);
    }

    return NextResponse.json(extractBasic(textContent));
  } catch (error: any) {
    console.error("Resume parse error:", error);
    return NextResponse.json({ error: error.message || "Parse failed" }, { status: 500 });
  }
}

async function extractWithClaude(text: string, apiKey: string) {
  const prompt = `You are an expert resume parser and job application assistant. Given the resume text below, do two things:

1. EXTRACT every possible piece of information from the resume
2. GENERATE smart, professional default answers for common job application questions based on the candidate's background

Return ONLY a valid JSON object with ALL of these fields. Use empty string "" only if you truly cannot infer the value. For generated fields (elevator pitch, strengths, cover letter, etc.), write real, high-quality answers based on the resume.

EXTRACTION RULES:
- firstName, lastName: from the name at the top
- email, phone: contact info
- address, city, state, zipCode, country: location info (country default "United States" if US-based)
- linkedinUrl, githubUrl, portfolioUrl, websiteUrl, twitterUrl: extract full URLs
- currentTitle: most recent job title
- currentCompany: most recent employer
- yearsExperience: calculate total years from work history (as a number string like "5")
- noticePeriod: default "2 weeks" unless stated otherwise
- university, degree, major, gpa, gradYear: primary education
- university2, degree2, major2, gpa2, gradYear2: second degree if present
- technicalSkills: comma-separated list of all technical skills
- programmingLanguages: comma-separated programming languages only
- frameworks: comma-separated frameworks and libraries
- tools: comma-separated tools, platforms, cloud services
- certifications: any certifications or licenses
- languages: spoken languages (default "English" if not stated)
- workAuthorized: true (default true unless resume mentions visa/sponsorship needed)
- requiresSponsorship: false (default false unless resume says otherwise)
- visaType: visa type if mentioned, else ""
- citizenship: citizenship/residency status if mentioned, else ""
- desiredSalary: "" (leave blank)
- desiredSalaryMin: "" (leave blank)
- desiredSalaryMax: "" (leave blank)
- salaryCurrency: "USD"
- salaryPeriod: "annually"
- workType: "Remote" (safe default)
- willingToRelocate: false
- availableStartDate: "2 weeks notice"
- preferredLocations: city from resume or ""
- gender: "Decline to self-identify"
- race: "Decline to self-identify"
- veteranStatus: "Decline to self-identify"
- disabilityStatus: "Decline to self-identify"
- lgbtq: "Decline to self-identify"
- criminalRecord: "No"
- drugTest: true
- securityClearance: security clearance level if mentioned, else ""
- militaryService: military service if mentioned, else ""
- volunteerExperience: volunteer work if mentioned
- publications: publications/papers if mentioned
- patents: patents if mentioned
- awards: awards and honors
- professionalMemberships: professional organizations
- referralSource: ""
- howDidYouHear: "LinkedIn"

GENERATION RULES (write real answers, 2-5 sentences each):
- elevatorPitch: Write a compelling 30-second professional summary in first person based on their experience, skills, and background. Make it specific to their actual experience.
- whyThisRole: Write a template answer "I'm excited about this opportunity because [role]-specific reasons based on their skills and background. Keep [company] as a placeholder.
- whyThisCompany: Write a template "I'm drawn to [company] because..." with placeholder. Keep it genuine and based on their apparent values from resume.
- greatestStrength: Write a specific strength answer based on their actual skills and experience from the resume. Include a brief example pattern.
- greatestWeakness: Write a self-aware weakness with growth mindset. Make it honest but not disqualifying. Something like perfectionism or delegation that they're actively working on.
- coverLetterTemplate: Write a full professional cover letter template using their actual background. Use [Company Name], [Position], [Hiring Manager] as placeholders. 3-4 paragraphs.
- managementStyle: If they have management experience, describe a collaborative/data-driven style. If no management experience, use ""
- teamSize: largest team size if mentioned, else ""
- personalStatement: A 2-3 sentence professional objective based on their background and career trajectory.

RESUME TEXT:
${text.substring(0, 12000)}

Return ONLY the JSON object. No markdown fences, no explanation, just raw JSON.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Claude API error: ${response.status} — ${errText}`);
    }

    const data = await response.json();
    let raw = data.content[0].text.trim();

    // Strip markdown code fences if present
    raw = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

    const parsed = JSON.parse(raw);

    // Ensure boolean fields are proper booleans
    if (typeof parsed.workAuthorized === "string") {
      parsed.workAuthorized = parsed.workAuthorized === "true" || parsed.workAuthorized === true;
    }
    if (typeof parsed.requiresSponsorship === "string") {
      parsed.requiresSponsorship = parsed.requiresSponsorship === "true";
    }
    if (typeof parsed.willingToRelocate === "string") {
      parsed.willingToRelocate = parsed.willingToRelocate === "true";
    }
    if (typeof parsed.drugTest === "string") {
      parsed.drugTest = parsed.drugTest !== "false";
    }

    return parsed;
  } catch (e) {
    console.error("Claude extraction failed:", e);
    return extractBasic(text);
  }
}

function extractBasic(text: string): Record<string, any> {
  const result: Record<string, any> = {};

  const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  if (emailMatch) result.email = emailMatch[0];

  const phoneMatch = text.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  if (phoneMatch) result.phone = phoneMatch[0];

  const linkedinMatch = text.match(/linkedin\.com\/in\/[\w-]+/i);
  if (linkedinMatch) result.linkedinUrl = "https://" + linkedinMatch[0];

  const githubMatch = text.match(/github\.com\/[\w-]+/i);
  if (githubMatch) result.githubUrl = "https://" + githubMatch[0];

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines[0] && lines[0].split(" ").length <= 4 && !lines[0].includes("@")) {
    const parts = lines[0].split(" ");
    result.firstName = parts[0] || "";
    result.lastName = parts.slice(1).join(" ") || "";
  }

  // Smart defaults
  result.workAuthorized = true;
  result.requiresSponsorship = false;
  result.willingToRelocate = false;
  result.drugTest = true;
  result.criminalRecord = "No";
  result.country = "United States";
  result.salaryCurrency = "USD";
  result.salaryPeriod = "annually";
  result.workType = "Remote";
  result.howDidYouHear = "LinkedIn";
  result.availableStartDate = "2 weeks notice";
  result.gender = "Decline to self-identify";
  result.race = "Decline to self-identify";
  result.veteranStatus = "Decline to self-identify";
  result.disabilityStatus = "Decline to self-identify";
  result.lgbtq = "Decline to self-identify";
  result.languages = "English";

  return result;
}
