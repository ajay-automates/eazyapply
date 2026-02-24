"use client";

import { useState, useRef, useCallback } from "react";

// ============================================================
// COMPLETE PROFILE SCHEMA — every possible job application field
// ============================================================

interface Profile {
  // Personal
  firstName: string; lastName: string; email: string; phone: string;
  address: string; city: string; state: string; zipCode: string; country: string;
  dateOfBirth: string;
  // Links
  linkedinUrl: string; githubUrl: string; portfolioUrl: string;
  websiteUrl: string; twitterUrl: string; dribbbleUrl: string; behanceUrl: string;
  stackOverflowUrl: string; mediumUrl: string; kaggleUrl: string;
  // Current Work
  currentTitle: string; currentCompany: string; yearsExperience: string;
  noticePeriod: string; reasonForLeaving: string;
  // Education
  university: string; degree: string; major: string; gpa: string; gradYear: string;
  university2: string; degree2: string; major2: string; gpa2: string; gradYear2: string;
  // Skills
  technicalSkills: string; programmingLanguages: string; frameworks: string;
  tools: string; certifications: string; languages: string;
  // Work Authorization
  workAuthorized: boolean; requiresSponsorship: boolean;
  visaType: string; citizenship: string;
  // Demographics (EEO - all decline by default)
  gender: string; race: string; veteranStatus: string; disabilityStatus: string;
  lgbtq: string;
  // Job Preferences
  desiredSalary: string; desiredSalaryMin: string; desiredSalaryMax: string;
  salaryCurrency: string; salaryPeriod: string;
  workType: string; willingToRelocate: boolean;
  availableStartDate: string; preferredLocations: string;
  // Common Questions
  howDidYouHear: string; whyThisRole: string; whyThisCompany: string;
  coverLetterTemplate: string; elevatorPitch: string;
  greatestStrength: string; greatestWeakness: string;
  managementStyle: string; teamSize: string;
  criminalRecord: string; drugTest: boolean;
  // Additional
  referralSource: string; personalStatement: string;
  volunteerExperience: string; publications: string;
  patents: string; awards: string;
  militaryService: string; securityClearance: string;
  professionalMemberships: string;
}

const DEFAULT_PROFILE: Profile = {
  firstName: "", lastName: "", email: "", phone: "",
  address: "", city: "", state: "", zipCode: "", country: "United States",
  dateOfBirth: "",
  linkedinUrl: "", githubUrl: "", portfolioUrl: "",
  websiteUrl: "", twitterUrl: "", dribbbleUrl: "", behanceUrl: "",
  stackOverflowUrl: "", mediumUrl: "", kaggleUrl: "",
  currentTitle: "", currentCompany: "", yearsExperience: "",
  noticePeriod: "", reasonForLeaving: "",
  university: "", degree: "", major: "", gpa: "", gradYear: "",
  university2: "", degree2: "", major2: "", gpa2: "", gradYear2: "",
  technicalSkills: "", programmingLanguages: "", frameworks: "",
  tools: "", certifications: "", languages: "",
  workAuthorized: true, requiresSponsorship: false,
  visaType: "", citizenship: "",
  gender: "Decline to self-identify", race: "Decline to self-identify",
  veteranStatus: "Decline to self-identify", disabilityStatus: "Decline to self-identify",
  lgbtq: "Decline to self-identify",
  desiredSalary: "", desiredSalaryMin: "", desiredSalaryMax: "",
  salaryCurrency: "USD", salaryPeriod: "annually",
  workType: "Remote", willingToRelocate: false,
  availableStartDate: "", preferredLocations: "",
  howDidYouHear: "LinkedIn", whyThisRole: "", whyThisCompany: "",
  coverLetterTemplate: "", elevatorPitch: "",
  greatestStrength: "", greatestWeakness: "",
  managementStyle: "", teamSize: "",
  criminalRecord: "No", drugTest: true,
  referralSource: "", personalStatement: "",
  volunteerExperience: "", publications: "",
  patents: "", awards: "",
  militaryService: "", securityClearance: "",
  professionalMemberships: "",
};

// ============================================================
// SECTIONS DEFINITION
// ============================================================

type FieldDef = {
  key: keyof Profile;
  label: string;
  type?: "text" | "email" | "tel" | "url" | "textarea" | "select" | "checkbox" | "number" | "date";
  placeholder?: string;
  options?: string[];
  half?: boolean;
  hint?: string;
};

type SectionDef = {
  id: string;
  title: string;
  icon: string;
  desc: string;
  fields: FieldDef[];
};

const SECTIONS: SectionDef[] = [
  {
    id: "personal", title: "Personal Information", icon: "👤", desc: "Basic contact info used on every application",
    fields: [
      { key: "firstName", label: "First Name", placeholder: "John", half: true },
      { key: "lastName", label: "Last Name", placeholder: "Doe", half: true },
      { key: "email", label: "Email", type: "email", placeholder: "john@example.com" },
      { key: "phone", label: "Phone", type: "tel", placeholder: "+1 (555) 123-4567" },
      { key: "address", label: "Street Address", placeholder: "123 Main St, Apt 4" },
      { key: "city", label: "City", placeholder: "San Francisco", half: true },
      { key: "state", label: "State / Province", placeholder: "CA", half: true },
      { key: "zipCode", label: "Zip / Postal Code", placeholder: "94102", half: true },
      { key: "country", label: "Country", placeholder: "United States", half: true },
      { key: "dateOfBirth", label: "Date of Birth", type: "date", hint: "Only required by some international applications" },
    ],
  },
  {
    id: "links", title: "Online Profiles & Links", icon: "🔗", desc: "Social and professional profiles",
    fields: [
      { key: "linkedinUrl", label: "LinkedIn", type: "url", placeholder: "https://linkedin.com/in/johndoe" },
      { key: "githubUrl", label: "GitHub", type: "url", placeholder: "https://github.com/johndoe" },
      { key: "portfolioUrl", label: "Portfolio", type: "url", placeholder: "https://johndoe.dev" },
      { key: "websiteUrl", label: "Personal Website", type: "url", placeholder: "https://johndoe.com" },
      { key: "twitterUrl", label: "Twitter / X", type: "url", placeholder: "https://x.com/johndoe", half: true },
      { key: "dribbbleUrl", label: "Dribbble", type: "url", placeholder: "https://dribbble.com/johndoe", half: true },
      { key: "behanceUrl", label: "Behance", type: "url", placeholder: "https://behance.net/johndoe", half: true },
      { key: "stackOverflowUrl", label: "Stack Overflow", type: "url", placeholder: "https://stackoverflow.com/users/...", half: true },
      { key: "mediumUrl", label: "Medium / Blog", type: "url", placeholder: "https://medium.com/@johndoe", half: true },
      { key: "kaggleUrl", label: "Kaggle", type: "url", placeholder: "https://kaggle.com/johndoe", half: true },
    ],
  },
  {
    id: "experience", title: "Work Experience", icon: "💼", desc: "Current role and experience details",
    fields: [
      { key: "currentTitle", label: "Current Job Title", placeholder: "Senior Software Engineer" },
      { key: "currentCompany", label: "Current Company", placeholder: "Google" },
      { key: "yearsExperience", label: "Total Years of Experience", type: "number", placeholder: "5" },
      { key: "noticePeriod", label: "Notice Period", placeholder: "2 weeks", half: true },
      { key: "reasonForLeaving", label: "Reason for Leaving", placeholder: "Seeking new challenges", half: true },
    ],
  },
  {
    id: "education", title: "Education", icon: "🎓", desc: "Degrees and academic background",
    fields: [
      { key: "university", label: "University / School", placeholder: "MIT" },
      { key: "degree", label: "Degree", placeholder: "Master of Science", half: true },
      { key: "major", label: "Major / Field of Study", placeholder: "Computer Science", half: true },
      { key: "gpa", label: "GPA", placeholder: "3.8/4.0", half: true },
      { key: "gradYear", label: "Graduation Year", placeholder: "2024", half: true },
      { key: "university2", label: "Second University (optional)", placeholder: "Stanford", hint: "Leave blank if only one degree" },
      { key: "degree2", label: "Second Degree", placeholder: "Bachelor of Science", half: true },
      { key: "major2", label: "Second Major", placeholder: "Mathematics", half: true },
      { key: "gpa2", label: "Second GPA", placeholder: "3.9/4.0", half: true },
      { key: "gradYear2", label: "Second Grad Year", placeholder: "2022", half: true },
    ],
  },
  {
    id: "skills", title: "Skills & Certifications", icon: "🛠️", desc: "Technical skills, languages, and certifications",
    fields: [
      { key: "technicalSkills", label: "Technical Skills", type: "textarea", placeholder: "Machine Learning, Data Engineering, Cloud Architecture, System Design..." },
      { key: "programmingLanguages", label: "Programming Languages", placeholder: "Python, TypeScript, Java, Go, Rust" },
      { key: "frameworks", label: "Frameworks & Libraries", placeholder: "React, Next.js, FastAPI, PyTorch, TensorFlow" },
      { key: "tools", label: "Tools & Platforms", placeholder: "AWS, Docker, Kubernetes, Git, PostgreSQL" },
      { key: "certifications", label: "Certifications", type: "textarea", placeholder: "AWS Solutions Architect, Google Cloud Professional ML Engineer..." },
      { key: "languages", label: "Languages Spoken", placeholder: "English (Native), Spanish (Conversational), Hindi (Fluent)" },
    ],
  },
  {
    id: "authorization", title: "Work Authorization", icon: "📋", desc: "Legal work status — asked on nearly every US application",
    fields: [
      { key: "workAuthorized", label: "Authorized to work in the US?", type: "checkbox" },
      { key: "requiresSponsorship", label: "Require visa sponsorship now or in the future?", type: "checkbox" },
      { key: "visaType", label: "Current Visa Type (if applicable)", placeholder: "H-1B, OPT, Green Card, etc.", half: true },
      { key: "citizenship", label: "Citizenship", placeholder: "US Citizen, Permanent Resident, etc.", half: true },
    ],
  },
  {
    id: "demographics", title: "Demographics (EEO)", icon: "📊", desc: "Voluntary self-identification — we default to 'Decline' for all",
    fields: [
      { key: "gender", label: "Gender", type: "select", options: ["Decline to self-identify", "Male", "Female", "Non-binary", "Other"] },
      { key: "race", label: "Race / Ethnicity", type: "select", options: ["Decline to self-identify", "American Indian or Alaska Native", "Asian", "Black or African American", "Hispanic or Latino", "Native Hawaiian or Other Pacific Islander", "White", "Two or More Races"] },
      { key: "veteranStatus", label: "Veteran Status", type: "select", options: ["Decline to self-identify", "I am not a protected veteran", "I identify as one or more of the classifications of a protected veteran"] },
      { key: "disabilityStatus", label: "Disability Status", type: "select", options: ["Decline to self-identify", "Yes, I have a disability", "No, I don't have a disability"] },
      { key: "lgbtq", label: "LGBTQ+ Identification", type: "select", options: ["Decline to self-identify", "Yes", "No"] },
    ],
  },
  {
    id: "preferences", title: "Job Preferences", icon: "🎯", desc: "Salary, work type, and availability",
    fields: [
      { key: "desiredSalary", label: "Desired Salary", placeholder: "$150,000" },
      { key: "desiredSalaryMin", label: "Salary Range Min", placeholder: "$130,000", half: true },
      { key: "desiredSalaryMax", label: "Salary Range Max", placeholder: "$180,000", half: true },
      { key: "salaryCurrency", label: "Currency", type: "select", options: ["USD", "EUR", "GBP", "CAD", "AUD", "INR", "Other"], half: true },
      { key: "salaryPeriod", label: "Pay Period", type: "select", options: ["annually", "monthly", "hourly"], half: true },
      { key: "workType", label: "Preferred Work Type", type: "select", options: ["Remote", "Hybrid", "On-site", "Flexible", "No Preference"] },
      { key: "willingToRelocate", label: "Willing to relocate?", type: "checkbox" },
      { key: "availableStartDate", label: "Available Start Date", placeholder: "Immediately / 2 weeks / specific date" },
      { key: "preferredLocations", label: "Preferred Locations", placeholder: "San Francisco, New York, Remote" },
    ],
  },
  {
    id: "questions", title: "Common Application Questions", icon: "💬", desc: "Pre-written answers for frequently asked questions",
    fields: [
      { key: "howDidYouHear", label: "How did you hear about us?", type: "select", options: ["LinkedIn", "Job Board", "Company Website", "Referral", "Recruiter", "Indeed", "Glassdoor", "Google Search", "Career Fair", "Other"] },
      { key: "elevatorPitch", label: "Tell me about yourself (30-sec pitch)", type: "textarea", placeholder: "I'm a senior software engineer with 5 years of experience building scalable distributed systems..." },
      { key: "whyThisRole", label: "Why are you interested in this role? (template)", type: "textarea", placeholder: "I'm excited about this opportunity because..." },
      { key: "whyThisCompany", label: "Why this company? (template)", type: "textarea", placeholder: "I admire [company]'s mission to..." },
      { key: "greatestStrength", label: "Greatest Strength", type: "textarea", placeholder: "My ability to break down complex technical problems..." },
      { key: "greatestWeakness", label: "Greatest Weakness", type: "textarea", placeholder: "I sometimes spend too much time perfecting code..." },
      { key: "coverLetterTemplate", label: "Cover Letter Template", type: "textarea", placeholder: "Dear Hiring Manager,\n\nI'm writing to express my interest in..." },
    ],
  },
  {
    id: "additional", title: "Additional Information", icon: "📝", desc: "Extra details some applications require",
    fields: [
      { key: "criminalRecord", label: "Criminal Record?", type: "select", options: ["No", "Yes"] },
      { key: "drugTest", label: "Willing to take drug test?", type: "checkbox" },
      { key: "securityClearance", label: "Security Clearance", placeholder: "None / Secret / Top Secret" },
      { key: "militaryService", label: "Military Service", placeholder: "None / Branch and dates" },
      { key: "volunteerExperience", label: "Volunteer Experience", type: "textarea", placeholder: "Mentor at Code.org, Open source contributor..." },
      { key: "publications", label: "Publications", type: "textarea", placeholder: "Papers, blog posts, articles..." },
      { key: "patents", label: "Patents", placeholder: "US Patent #..." },
      { key: "awards", label: "Awards & Honors", type: "textarea", placeholder: "Dean's List, Hackathon winner..." },
      { key: "professionalMemberships", label: "Professional Memberships", placeholder: "IEEE, ACM, etc." },
      { key: "personalStatement", label: "Personal Statement / Objective", type: "textarea", placeholder: "Passionate engineer seeking to..." },
      { key: "managementStyle", label: "Management Style (if applicable)", placeholder: "Collaborative, data-driven..." },
      { key: "teamSize", label: "Largest Team Managed", placeholder: "12 engineers" },
      { key: "referralSource", label: "Referral / Employee Name", placeholder: "Jane Smith (Engineering)" },
    ],
  },
];

// ============================================================
// RESUME PARSER (Client-side API call)
// ============================================================

async function parseResume(file: File): Promise<Partial<Profile>> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/parse-resume", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error("Failed to parse resume");
  return res.json();
}

// ============================================================
// DASHBOARD COMPONENT
// ============================================================

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [activeSection, setActiveSection] = useState("personal");
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [saved, setSaved] = useState(false);
  const [resumeFile, setResumeFile] = useState<string>("");
  const [filledFromResume, setFilledFromResume] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const updateField = useCallback((key: keyof Profile, value: any) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadStatus("Parsing resume with AI...");
    setResumeFile(file.name);

    try {
      const extracted = await parseResume(file);
      const filledKeys: string[] = [];

      // Merge extracted data into profile (only non-empty fields)
      setProfile((prev) => {
        const updated = { ...prev };
        for (const [key, value] of Object.entries(extracted)) {
          if (value && key in updated) {
            (updated as any)[key] = value;
            filledKeys.push(key);
          }
        }
        return updated;
      });

      setFilledFromResume(filledKeys);
      setUploadStatus(`Extracted ${filledKeys.length} fields from your resume!`);
    } catch (err) {
      setUploadStatus("Failed to parse resume. Please try again or fill manually.");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    // Save to localStorage (extension will read from here or sync via API)
    localStorage.setItem("eazyapply_profile", JSON.stringify(profile));

    // Also save to chrome.storage if extension is installed
    if (typeof window !== "undefined" && (window as any).chrome?.runtime?.sendMessage) {
      try {
        (window as any).chrome.runtime.sendMessage(
          "EAZYAPPLY_EXTENSION_ID",
          { action: "SYNC_PROFILE", profile },
        );
      } catch (e) {
        // Extension not installed, that's fine
      }
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  // Load from localStorage on mount
  useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("eazyapply_profile");
      if (saved) {
        try {
          setProfile({ ...DEFAULT_PROFILE, ...JSON.parse(saved) });
        } catch (e) {}
      }
    }
  });

  const completionCount = Object.entries(profile).filter(
    ([_, v]) => v !== "" && v !== false && v !== "Decline to self-identify"
  ).length;
  const totalFields = Object.keys(profile).length;
  const completionPct = Math.round((completionCount / totalFields) * 100);

  return (
    <div className="min-h-screen bg-surface-0">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 h-14 border-b border-zinc-800/50 bg-surface-0/80 backdrop-blur-xl flex items-center px-6">
        <a href="/" className="flex items-center gap-2 mr-8">
          <span className="text-lg">⚡</span>
          <span className="font-bold tracking-tight">EazyApply</span>
        </a>
        <span className="text-sm text-zinc-500 hidden md:block">Dashboard</span>
        <div className="ml-auto flex items-center gap-4">
          <div className="text-xs text-zinc-500">
            <span className="text-brand-400 font-bold">{completionPct}%</span> profile complete
          </div>
          <button
            onClick={handleSave}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              saved
                ? "bg-brand-500 text-black"
                : "bg-brand-500/10 text-brand-400 border border-brand-500/30 hover:bg-brand-500/20"
            }`}
          >
            {saved ? "✓ Saved!" : "Save Profile"}
          </button>
        </div>
      </header>

      <div className="flex max-w-7xl mx-auto">
        {/* Sidebar */}
        <aside className="hidden lg:block w-64 border-r border-zinc-800/50 min-h-[calc(100vh-3.5rem)] p-4 sticky top-14 self-start">
          {/* Resume Upload */}
          <div className="mb-6">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full py-4 rounded-xl border-2 border-dashed border-zinc-700 hover:border-brand-500/50 bg-surface-2 transition-all text-center group"
            >
              {uploading ? (
                <div className="text-sm text-yellow-400 animate-pulse">⏳ Parsing...</div>
              ) : resumeFile ? (
                <div>
                  <div className="text-sm text-brand-400 font-semibold">📄 {resumeFile}</div>
                  <div className="text-xs text-zinc-500 mt-1">Click to re-upload</div>
                </div>
              ) : (
                <div>
                  <div className="text-2xl mb-1">📄</div>
                  <div className="text-sm text-zinc-400 group-hover:text-white transition-colors">Upload Resume</div>
                  <div className="text-xs text-zinc-600">PDF or DOCX</div>
                </div>
              )}
            </button>
            <input ref={fileRef} type="file" accept=".pdf,.docx,.doc" onChange={handleResumeUpload} className="hidden" />
            {uploadStatus && (
              <p className={`text-xs mt-2 ${uploadStatus.includes("Failed") ? "text-red-400" : "text-brand-400"}`}>
                {uploadStatus}
              </p>
            )}
          </div>

          {/* Section Nav */}
          <nav className="space-y-1">
            {SECTIONS.map((s) => {
              const sectionFields = s.fields.map((f) => f.key);
              const filled = sectionFields.filter(
                (k) => profile[k] !== "" && profile[k] !== false && profile[k] !== "Decline to self-identify"
              ).length;
              const isActive = activeSection === s.id;

              return (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-all ${
                    isActive
                      ? "bg-brand-500/10 text-brand-400 border border-brand-500/20"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-surface-3"
                  }`}
                >
                  <span className="text-base">{s.icon}</span>
                  <span className="flex-1 truncate">{s.title}</span>
                  <span className={`text-[10px] font-mono ${filled === sectionFields.length ? "text-brand-400" : "text-zinc-600"}`}>
                    {filled}/{sectionFields.length}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Extension Install */}
          <div className="mt-6 p-4 rounded-xl bg-surface-2 border border-zinc-800">
            <p className="text-xs font-semibold text-zinc-300 mb-2">🧩 Chrome Extension</p>
            <p className="text-xs text-zinc-500 mb-3">Install to auto-fill forms with your profile data.</p>
            <a href="#" className="block text-center text-xs font-semibold py-2 rounded-lg bg-brand-500/10 text-brand-400 border border-brand-500/20 hover:bg-brand-500/20 transition-all">
              Download Extension
            </a>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-10 max-w-3xl">
          {SECTIONS.filter((s) => s.id === activeSection).map((section) => (
            <div key={section.id}>
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{section.icon}</span>
                  <h2 className="text-2xl font-bold">{section.title}</h2>
                </div>
                <p className="text-sm text-zinc-500">{section.desc}</p>
              </div>

              <div className="space-y-5">
                {/* Render fields in rows for half-width fields */}
                {(() => {
                  const rows: (FieldDef | [FieldDef, FieldDef])[] = [];
                  let i = 0;
                  while (i < section.fields.length) {
                    const f = section.fields[i];
                    if (f.half && i + 1 < section.fields.length && section.fields[i + 1].half) {
                      rows.push([f, section.fields[i + 1]]);
                      i += 2;
                    } else {
                      rows.push(f);
                      i++;
                    }
                  }

                  return rows.map((row, idx) => {
                    if (Array.isArray(row)) {
                      return (
                        <div key={idx} className="grid grid-cols-2 gap-4">
                          {row.map((f) => (
                            <FieldInput key={f.key} field={f} value={profile[f.key]} onChange={updateField} fromResume={filledFromResume.includes(f.key)} />
                          ))}
                        </div>
                      );
                    }
                    return <FieldInput key={row.key} field={row} value={profile[row.key]} onChange={updateField} fromResume={filledFromResume.includes(row.key)} />;
                  });
                })()}
              </div>

              {/* Navigation */}
              <div className="flex justify-between mt-10 pt-6 border-t border-zinc-800/50">
                {(() => {
                  const idx = SECTIONS.findIndex((s) => s.id === section.id);
                  return (
                    <>
                      {idx > 0 ? (
                        <button onClick={() => setActiveSection(SECTIONS[idx - 1].id)} className="text-sm text-zinc-400 hover:text-white transition-colors">
                          ← {SECTIONS[idx - 1].title}
                        </button>
                      ) : <div />}
                      {idx < SECTIONS.length - 1 ? (
                        <button onClick={() => setActiveSection(SECTIONS[idx + 1].id)} className="text-sm text-brand-400 hover:text-brand-300 font-semibold transition-colors">
                          {SECTIONS[idx + 1].title} →
                        </button>
                      ) : (
                        <button onClick={handleSave} className="px-6 py-2 rounded-lg bg-brand-500 text-black font-semibold text-sm hover:bg-brand-400 transition-all">
                          Save & Finish
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          ))}
        </main>
      </div>
    </div>
  );
}

// ============================================================
// FIELD INPUT COMPONENT
// ============================================================

function FieldInput({
  field,
  value,
  onChange,
  fromResume,
}: {
  field: FieldDef;
  value: any;
  onChange: (key: keyof Profile, value: any) => void;
  fromResume: boolean;
}) {
  const baseClasses =
    "w-full px-3.5 py-2.5 rounded-lg bg-surface-3 border text-sm text-zinc-200 outline-none transition-all placeholder:text-zinc-600 focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20";
  const borderClass = fromResume ? "border-brand-500/30" : "border-zinc-800";

  if (field.type === "checkbox") {
    return (
      <label className="flex items-center gap-3 cursor-pointer group">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(field.key, e.target.checked)}
          className="w-4.5 h-4.5 rounded accent-green-500"
        />
        <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">{field.label}</span>
        {fromResume && <span className="text-[10px] text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-full">from resume</span>}
      </label>
    );
  }

  if (field.type === "select") {
    return (
      <div>
        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
          {field.label}
          {fromResume && <span className="ml-2 text-brand-400 normal-case tracking-normal font-normal">(from resume)</span>}
        </label>
        <select
          value={value as string}
          onChange={(e) => onChange(field.key, e.target.value)}
          className={`${baseClasses} ${borderClass}`}
        >
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div>
        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
          {field.label}
          {fromResume && <span className="ml-2 text-brand-400 normal-case tracking-normal font-normal">(from resume)</span>}
        </label>
        <textarea
          value={value as string}
          onChange={(e) => onChange(field.key, e.target.value)}
          placeholder={field.placeholder}
          rows={4}
          className={`${baseClasses} ${borderClass} resize-y min-h-[80px]`}
        />
        {field.hint && <p className="text-xs text-zinc-600 mt-1">{field.hint}</p>}
      </div>
    );
  }

  return (
    <div>
      <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
        {field.label}
        {fromResume && <span className="ml-2 text-brand-400 normal-case tracking-normal font-normal">(from resume)</span>}
      </label>
      <input
        type={field.type || "text"}
        value={value as string}
        onChange={(e) => onChange(field.key, e.target.value)}
        placeholder={field.placeholder}
        className={`${baseClasses} ${borderClass}`}
      />
      {field.hint && <p className="text-xs text-zinc-600 mt-1">{field.hint}</p>}
    </div>
  );
}
