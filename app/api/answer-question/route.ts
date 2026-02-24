import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { questions, profile } = await req.json();

    if (!questions?.length) {
      return NextResponse.json({ answers: [] });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ answers: questions.map(() => "") });
    }

    // Build a concise profile context for Claude
    const ctx = [
      profile.firstName && profile.lastName ? `Name: ${profile.firstName} ${profile.lastName}` : "",
      profile.currentTitle    ? `Title: ${profile.currentTitle}` : "",
      profile.currentCompany  ? `Company: ${profile.currentCompany}` : "",
      profile.yearsExperience ? `Experience: ${profile.yearsExperience} years` : "",
      profile.technicalSkills ? `Skills: ${profile.technicalSkills}` : "",
      profile.programmingLanguages ? `Languages: ${profile.programmingLanguages}` : "",
      profile.frameworks      ? `Frameworks: ${profile.frameworks}` : "",
      profile.tools           ? `Tools: ${profile.tools}` : "",
      profile.university      ? `Education: ${profile.degree || ""} at ${profile.university}` : "",
      profile.elevatorPitch   ? `About: ${profile.elevatorPitch}` : "",
      profile.greatestStrength? `Strength: ${profile.greatestStrength}` : "",
      profile.workAuthorized !== undefined ? `Work authorized: ${profile.workAuthorized}` : "",
      profile.city            ? `Location: ${profile.city}, ${profile.state || ""}` : "",
    ].filter(Boolean).join("\n");

    const questionsText = questions
      .map((q: string, i: number) => `Q${i + 1}: ${q}`)
      .join("\n\n");

    const prompt = `You are filling out a job application form on behalf of a candidate. Based on their profile, answer each question professionally and concisely.

CANDIDATE PROFILE:
${ctx}

QUESTIONS TO ANSWER:
${questionsText}

RULES:
- Answer each question directly and professionally
- Keep answers concise (2-5 sentences for open-ended questions)
- For yes/no questions, answer based on the profile (e.g. work authorization)
- For location questions, use the candidate's location from profile
- For questions about experience with specific topics, relate it to their skills/background
- If the question asks about a specific technical topic they know, give a strong relevant answer
- If completely unknown, give a honest professional response
- Do NOT make up specific numbers, dates, or facts not in the profile

Return ONLY a JSON array of answer strings, one per question, in the same order:
["answer1", "answer2", ...]`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const data = await response.json();
    let raw = data.content[0].text.trim();
    raw = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

    const answers = JSON.parse(raw);
    return NextResponse.json({ answers });
  } catch (e: any) {
    console.error("answer-question error:", e);
    return NextResponse.json({ answers: [] }, { status: 500 });
  }
}
