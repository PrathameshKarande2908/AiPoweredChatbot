import "dotenv/config";
import axios from "axios";

const languageInstructions = {
  en: "Reply in English.",
  hi: "Reply in Hindi using simple natural Devanagari script.",
  mr: "Reply in Marathi using simple natural Devanagari script.",
};

const fallbackByLanguage = {
  en: `I'm here to help.

### Symptom guidance
You may need a little rest, fluids, and close monitoring for now.

### When to get help
Please contact a doctor if symptoms worsen, last longer than expected, or new warning signs appear.

⚠️ This is general guidance, not a medical diagnosis.`,
  hi: `मैं आपकी मदद के लिए यहाँ हूँ।

### लक्षण मार्गदर्शन
फिलहाल आराम, तरल पदार्थ और लक्षणों पर नज़र रखना उपयोगी हो सकता है।

### कब डॉक्टर से मिलें
यदि लक्षण बढ़ें, लंबे समय तक रहें, या नए गंभीर संकेत दिखें, तो डॉक्टर से संपर्क करें।

⚠️ यह सामान्य मार्गदर्शन है, चिकित्सीय निदान नहीं।`,
  mr: `मी तुमच्या मदतीसाठी येथे आहे.

### लक्षण मार्गदर्शन
सध्या विश्रांती, द्रवपदार्थ आणि लक्षणांवर लक्ष ठेवणे उपयुक्त ठरू शकते.

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
  if (profile.emergencyContact) details.push(`Emergency contact: ${profile.emergencyContact}`);

  if (details.length === 0) return "";

  return `Patient profile context:
${details.join("\n")}

Use this only as supporting context. Do not invent facts that are not listed.`;
};

const buildSeverityContext = (severityContext, language = "en") => {
  if (!severityContext) return "";

  const triggerText =
    severityContext.matchedTriggers?.length > 0
      ? `Possible warning signs detected: ${severityContext.matchedTriggers.join(", ")}.`
      : "";

  if (severityContext.isEmergency) {
    return `Severity classification: SEVERE / EMERGENCY.
${triggerText}

The response must:
- stay very short
- clearly say urgent medical help is needed now
- avoid diagnosis
- avoid detailed disease discussion
- avoid repeating the emergency bullet list already added by backend
- keep the wording calm, direct, and brief
- ${languageInstructions[language] || languageInstructions.en}`;
  }

  if (severityContext.level === "MODERATE") {
    return `Severity classification: MODERATE.
${triggerText}

The response must:
- be concise
- advise doctor consultation soon
- mention only a small number of warning signs to watch for
- focus on symptom guidance, not diagnosis
- do not generate preventive diet/lifestyle lists because backend adds structured preventive tips separately
- ${languageInstructions[language] || languageInstructions.en}`;
  }

  return `Severity classification: MILD.
${triggerText}

The response must:
- stay calm and supportive
- focus on symptom guidance and immediate self-care
- avoid diagnosis
- stay concise
- do not generate preventive diet/lifestyle lists because backend adds structured preventive tips separately
- remind the user to seek care if symptoms worsen
- ${languageInstructions[language] || languageInstructions.en}`;
};

export const generateAIResponse = async (
  messages,
  language = "en",
  patientProfile = null,
  severityContext = null
) => {
  const API_KEY = process.env.OPENROUTER_API_KEY;

  if (!API_KEY) {
    console.log("⚠️ No API key found. Using fallback.");
    return fallbackByLanguage[language] || fallbackByLanguage.en;
  }

  try {
    const systemMessages = [
      {
        role: "system",
        content: `You are a friendly AI health assistant.

Your tone should feel supportive, calm, and human.
Do not sound robotic.
Keep answers clear, warm, and easy to read.

Global rules:
- Never claim to diagnose.
- Give practical next-step guidance.
- Focus on symptom understanding, immediate self-care, and when to seek help.
- Use short headings only when useful.
- Avoid long explanations.
- Avoid repeating exact UI labels like "Triage Level" or "Emergency Alert" because the backend may add them separately.
- Avoid generating separate diet, lifestyle, and prevention lists because the backend formats preventive tips.
- Keep answers concise by default.
- ${languageInstructions[language] || languageInstructions.en}`,
      },
    ];

    const profileContext = buildProfileContext(patientProfile);
    if (profileContext) {
      systemMessages.push({
        role: "system",
        content: profileContext,
      });
    }

    const triageContext = buildSeverityContext(severityContext, language);
    if (triageContext) {
      systemMessages.push({
        role: "system",
        content: triageContext,
      });
    }

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openrouter/free",
        messages: [...systemMessages, ...messages],
      },
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return (
      response.data?.choices?.[0]?.message?.content?.trim() ||
      fallbackByLanguage[language] ||
      fallbackByLanguage.en
    );
  } catch (error) {
    console.error("AI ERROR:", error.response?.data || error.message);
    return fallbackByLanguage[language] || fallbackByLanguage.en;
  }
};
