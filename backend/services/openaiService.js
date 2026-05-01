import "dotenv/config";
import axios from "axios";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || "openrouter/auto";

const languageInstructions = {
  en: "Reply in English.",
  hi: "Reply in Hindi using simple natural Devanagari script.",
  mr: "Reply in Marathi using simple natural Devanagari script.",
};

const fallbackByLanguage = {
  en: `I'm here to help.

### Symptom guidance
Please rest, stay hydrated, and monitor your symptoms closely.

### When to get help
Contact a doctor if symptoms worsen, last longer than expected, or new warning signs appear.

⚠️ This is general guidance, not a medical diagnosis.`,
  hi: `मैं आपकी मदद के लिए यहाँ हूँ।

### लक्षण मार्गदर्शन
आराम करें, पर्याप्त पानी पिएँ और लक्षणों पर नज़र रखें।

### कब डॉक्टर से मिलें
यदि लक्षण बढ़ें, लंबे समय तक रहें, या नए गंभीर संकेत दिखें, तो डॉक्टर से संपर्क करें।

⚠️ यह सामान्य मार्गदर्शन है, चिकित्सीय निदान नहीं।`,
  mr: `मी तुमच्या मदतीसाठी येथे आहे.

### लक्षण मार्गदर्शन
विश्रांती घ्या, पुरेसे पाणी प्या आणि लक्षणांवर लक्ष ठेवा.

### डॉक्टरांचा सल्ला कधी घ्यावा
लक्षणे वाढली, जास्त काळ टिकली किंवा नवीन गंभीर चिन्हे दिसली तर डॉक्टरांचा सल्ला घ्या.

⚠️ हे सामान्य मार्गदर्शन आहे, वैद्यकीय निदान नाही.`,
};

const buildProfileContext = (profile) => {
  if (!profile) return "";

  const details = [];

  if (profile.fullName) details.push(`Name: ${profile.fullName}`);
  if (profile.age) details.push(`Age: ${profile.age}`);
  if (profile.gender) details.push(`Gender: ${profile.gender}`);
  if (profile.allergies) details.push(`Allergies: ${profile.allergies}`);
  if (profile.conditions) details.push(`Known conditions: ${profile.conditions}`);
  if (profile.medications) details.push(`Current medications: ${profile.medications}`);

  if (!details.length) return "";

  return `Patient profile context:
${details.join("\n")}

Use this only as supporting context. Do not invent profile facts.`;
};

const buildSeverityContext = (severityContext, language = "en") => {
  if (!severityContext) return "";

  const triggerText = severityContext.matchedTriggers?.length
    ? `Detected warning signs: ${severityContext.matchedTriggers.join(", ")}.`
    : "";

  const memoryText = severityContext.conditionMemory?.knownSymptoms?.length
    ? `Conversation symptom memory: ${severityContext.conditionMemory.knownSymptoms.join(", ")}. Highest severity so far: ${severityContext.conditionMemory.highestSeverity || severityContext.level}.`
    : "";

  if (severityContext.isEmergency) {
    return `Severity classification: SEVERE / EMERGENCY.
${triggerText}
${memoryText}

Rules:
- Keep response very short.
- Say urgent medical help is needed now.
- Do not diagnose.
- Do not repeat backend emergency bullet list.
- Stay calm and direct.
- ${languageInstructions[language] || languageInstructions.en}`;
  }

  if (severityContext.level === "MODERATE") {
    return `Severity classification: MODERATE.
${triggerText}
${memoryText}

Rules:
- Advise doctor consultation soon.
- Mention warning signs briefly.
- Do not diagnose.
- Do not create diet/lifestyle/prevention sections.
- ${languageInstructions[language] || languageInstructions.en}`;
  }

  return `Severity classification: MILD.
${triggerText}
${memoryText}

Rules:
- Give calm symptom guidance.
- Mention simple self-care.
- Do not diagnose.
- Do not create diet/lifestyle/prevention sections.
- ${languageInstructions[language] || languageInstructions.en}`;
};

const sanitizeMessages = (messages = []) =>
  messages
    .filter((msg) => msg?.role && msg?.content)
    .slice(-10)
    .map((msg) => ({
      role: msg.role === "assistant" ? "assistant" : "user",
      content: String(msg.content).slice(0, 3000),
    }));

const cleanPlainReply = (reply = "") =>
  String(reply || "")
    .replace(/[#*`]/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 10)
    .slice(0, 4)
    .join("\n")
    .trim();

const getRequestHeaders = (apiKey) => ({
  Authorization: `Bearer ${apiKey}`,
  "Content-Type": "application/json",
  "HTTP-Referer": process.env.APP_URL || "http://localhost:5173",
  "X-Title": "AI Health Assistant",
});

const callOpenRouter = async ({ messages, temperature = 0.4, maxTokens = 350 }) => {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY missing");
  }

  const response = await axios.post(
    OPENROUTER_URL,
    {
      model: DEFAULT_MODEL,
      messages,
      temperature,
      max_tokens: maxTokens,
    },
    {
      timeout: 20000,
      headers: getRequestHeaders(apiKey),
    }
  );

  return response.data?.choices?.[0]?.message?.content?.trim() || "";
};

export const generateAIResponse = async (
  messages,
  language = "en",
  patientProfile = null,
  severityContext = null
) => {
  if (!process.env.OPENROUTER_API_KEY) {
    console.log("⚠️ OPENROUTER_API_KEY missing. Using fallback.");
    return fallbackByLanguage[language] || fallbackByLanguage.en;
  }

  try {
    const systemMessages = [
      {
        role: "system",
        content: `You are a safe, friendly AI health assistant.

Global rules:
- Never claim to diagnose.
- Do not prescribe medicines.
- Give practical next-step guidance only.
- Keep response concise.
- Avoid repeating UI headings like Triage Level or Emergency Alert.
- Do not generate diet, lifestyle, or prevention lists because backend adds them separately.
- Do NOT give strict diet restrictions like "avoid dairy" or "avoid sugar" unless clearly necessary from the user's profile or symptom context.
- Prefer neutral guidance like "eat light and easily digestible food".
- ${languageInstructions[language] || languageInstructions.en}`,
      },
    ];

    const profileContext = buildProfileContext(patientProfile);
    if (profileContext) {
      systemMessages.push({ role: "system", content: profileContext });
    }

    const severityPrompt = buildSeverityContext(severityContext, language);
    if (severityPrompt) {
      systemMessages.push({ role: "system", content: severityPrompt });
    }

    const rawReply = await callOpenRouter({
      messages: [...systemMessages, ...sanitizeMessages(messages)],
      temperature: 0.35,
      maxTokens: 300,
    });

    return cleanPlainReply(rawReply) || fallbackByLanguage[language] || fallbackByLanguage.en;
  } catch (error) {
    console.error("AI ERROR:", error.response?.data || error.message);
    return fallbackByLanguage[language] || fallbackByLanguage.en;
  }
};

export const generatePreventiveAIAdvice = async ({
  symptoms = "",
  language = "en",
  patientProfile = null,
  severityContext = null,
  topic = "general",
} = {}) => {
  if (!process.env.OPENROUTER_API_KEY || severityContext?.isEmergency) {
    return null;
  }

  try {
    const profileContext = buildProfileContext(patientProfile);

    const prompt = `Generate preventive care suggestions for a health assistant.

Return ONLY valid JSON. No markdown. No explanation.

JSON shape:
{
  "diet": ["tip 1", "tip 2"],
  "lifestyle": ["tip 1", "tip 2"],
  "prevention": ["tip 1", "tip 2"]
}

Rules:
- Keep each tip short, practical, and safe.
- No diagnosis.
- No medicines or dosage.
- No strict restrictions like "avoid dairy" or "avoid sugar" unless clearly necessary from profile context.
- Prefer neutral guidance such as light, easy-to-digest food, hydration, rest, hygiene, monitoring, and trigger avoidance.
- Asthma-specific advice is allowed ONLY when the topic is respiratory.
- Give at most 2 tips per section.
- ${languageInstructions[language] || languageInstructions.en}

Topic: ${topic}
Severity: ${severityContext?.level || "MILD"}
Symptoms: ${symptoms}
${profileContext}`;

    const content = await callOpenRouter({
      messages: [
        {
          role: "system",
          content:
            "You generate safe structured preventive health JSON only. Do not include markdown or prose outside JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.25,
      maxTokens: 450,
    });

    const jsonText = content.match(/\{[\s\S]*\}/)?.[0] || "";
    if (!jsonText) return null;

    const parsed = JSON.parse(jsonText);

    return {
      diet: Array.isArray(parsed.diet) ? parsed.diet : [],
      lifestyle: Array.isArray(parsed.lifestyle) ? parsed.lifestyle : [],
      prevention: Array.isArray(parsed.prevention) ? parsed.prevention : [],
    };
  } catch (error) {
    console.error("PREVENTIVE AI ERROR:", error.response?.data || error.message);
    return null;
  }
};
