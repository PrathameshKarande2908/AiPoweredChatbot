const normalizeText = (value = "") =>
  String(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const SUPPORTED_TOPICS = new Set([
  "cardiac",
  "respiratory",
  "digestive",
  "neurological",
  "skin",
  "urinary",
  "muscle_joint",
  "general",
]);

const detectProfileFlags = (profile = null) => {
  const source = normalizeText(
    [profile?.conditions, profile?.medications, profile?.allergies]
      .filter(Boolean)
      .join(" ")
  );

  return {
    hasDiabetes: /\b(diabetes|diabetic|sugar)\b|मधुमेह|डायबिटीज/.test(source),
    hasHypertension:
      /\b(hypertension|high blood pressure|bp)\b|हाई बीपी|उच्च रक्तदाब/.test(source),
    hasAsthma: /\basthma\b|अस्थमा|दमा/.test(source),
    hasAllergy: /\ballerg(y|ies)\b|एलर्जी|अॅलर्जी/.test(source),
  };
};

const topicRules = [
  { topic: "cardiac", pattern: /chest pain|heart|palpitation|left arm pain|सीने में दर्द|छाती में दर्द|छातीत दुख|हृदय|धडधड/ },
  { topic: "respiratory", pattern: /cough|cold|throat|breath|breathing|fever|flu|viral|infection|asthma|खांसी|खोकला|घसा|सर्दी|सांस|श्वास|ताप|बुखार/ },
  { topic: "digestive", pattern: /stomach|abdomen|vomit|vomiting|diarrhea|loose motion|acidity|gas|food poisoning|पेट|पोट|उल्टी|उलट्या|जुलाब|दस्त|अम्लपित्त/ },
  { topic: "neurological", pattern: /headache|migraine|dizziness|stroke|seizure|weakness|सिर दर्द|डोकेदुखी|चक्कर|फिट्स|स्ट्रोक|अशक्तपणा/ },
  { topic: "skin", pattern: /allergy|rash|itch|skin|swelling|hives|एलर्जी|अॅलर्जी|पुरळ|त्वचा|खुजली|सूज/ },
  { topic: "urinary", pattern: /urine|urinary|burning urination|uti|kidney|पेशाब|लघवी|मूत्र|जलन/ },
  { topic: "muscle_joint", pattern: /joint pain|back pain|body ache|muscle|sprain|knee pain|शरीर दर्द|अंगदुखी|पाठदुखी|सांधेदुखी|मांसपेशी/ },
];

const detectTopic = ({ symptoms = "", severityResult = null }) => {
  if (SUPPORTED_TOPICS.has(severityResult?.primaryConcern)) {
    return severityResult.primaryConcern;
  }

  const source = normalizeText(`${symptoms} ${(severityResult?.matchedTriggers || []).join(" ")}`);
  return topicRules.find((rule) => rule.pattern.test(source))?.topic || "general";
};

const ruleAdvice = {
  general: {
    diet: ["Eat simple home-cooked food and drink enough water through the day.", "Prefer fruits, soups, dal, khichdi, curd rice, or other easy-to-digest meals while recovering."],
    lifestyle: ["Rest well and avoid heavy physical activity until symptoms improve.", "Track temperature, pain, weakness, and any new symptom changes."],
    prevention: ["Wash hands regularly and avoid sharing bottles, towels, or utensils while unwell.", "Seek medical care if symptoms persist, worsen, or new warning signs appear."],
  },
  respiratory: {
    diet: ["Take warm fluids such as water, soup, or herbal drinks to support hydration.", "Choose light meals and avoid very oily or cold foods if they worsen throat irritation."],
    lifestyle: ["Rest, avoid smoke and dust, and keep the room well ventilated.", "Use steam inhalation or warm salt-water gargles only if they suit you."],
    prevention: ["Wear a mask around others while coughing and wash hands after coughing or sneezing.", "Get checked quickly if fever stays high, breathing becomes difficult, or cough worsens."],
  },
  digestive: {
    diet: ["Take small frequent meals and focus on fluids such as water, ORS, rice water, soup, or coconut water if tolerated.", "Prefer bland food like banana, toast, curd rice, khichdi, or plain dal for now."],
    lifestyle: ["Rest and watch for dehydration signs like dizziness, reduced urination, dry mouth, or weakness.", "Avoid outside food, spicy food, and very oily meals until symptoms settle."],
    prevention: ["Use safe drinking water and eat freshly cooked food.", "Seek care quickly if pain increases, vomiting continues, or you cannot keep fluids down."],
  },
  neurological: {
    diet: ["Drink enough water and avoid skipping meals because dehydration and hunger can worsen headaches or dizziness.", "Limit excess caffeine and very sugary drinks if they trigger symptoms."],
    lifestyle: ["Rest in a quiet room, reduce screen strain, and keep sleep timing regular.", "Note triggers such as stress, poor sleep, loud noise, missed meals, or long screen use."],
    prevention: ["Get checked if headache is unusually severe, frequent, or linked with vomiting, weakness, fainting, or vision changes.", "Maintain regular sleep, hydration, posture, and meal timings."],
  },
  skin: {
    diet: ["Stay hydrated and avoid foods that previously triggered allergy or irritation.", "Keep meals simple and balanced instead of trying new foods during a flare."],
    lifestyle: ["Keep the affected skin clean and dry, avoid scratching, and use mild soap.", "Avoid sharing towels, razors, or skin products while a rash or infection is possible."],
    prevention: ["Track possible triggers like soaps, creams, medicines, dust, plants, or foods.", "Seek care urgently if rash spreads fast, becomes painful, or comes with swelling or breathing trouble."],
  },
  cardiac: {
    diet: ["Choose light food and avoid heavy, oily meals until you are medically checked.", "Avoid excess caffeine or energy drinks if you notice palpitations."],
    lifestyle: ["Avoid exertion and sit or lie down safely while arranging medical help.", "Do not ignore chest discomfort, breathlessness, sweating, faintness, or pain spreading to arm, jaw, or back."],
    prevention: ["Keep blood pressure, sugar, and cholesterol checks updated if advised by a doctor.", "Seek urgent medical care for chest pain or breathing difficulty rather than waiting at home."],
  },
  urinary: {
    diet: ["Drink water regularly unless a doctor has restricted your fluids.", "Avoid excess caffeine, fizzy drinks, and very spicy foods if they worsen burning."],
    lifestyle: ["Do not hold urine for long periods and maintain personal hygiene.", "Watch for fever, back pain, blood in urine, or worsening burning."],
    prevention: ["Use safe hygiene practices and stay hydrated through the day.", "Consult a doctor if urinary burning, fever, or lower abdominal pain persists."],
  },
  muscle_joint: {
    diet: ["Eat balanced meals with enough protein, fruits, and fluids to support recovery.", "Avoid skipping meals if weakness or body ache is present."],
    lifestyle: ["Rest the painful area and avoid heavy lifting or sudden movement.", "Use gentle movement only if it does not increase pain."],
    prevention: ["Maintain posture, warm up before exercise, and avoid overexertion.", "Seek care if pain follows injury, swelling increases, or movement becomes difficult."],
  },
};

const uniqueLimit = (items = [], limit = 3) => {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const clean = String(item || "").trim();
    const key = normalizeText(clean);
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
    if (result.length >= limit) break;
  }

  return result;
};

const sanitizeAdviceList = (items = []) => {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => String(item || "").replace(/^[-•\d.)\s]+/, "").trim())
    .map((item) => item.replace(/\s+/g, " "))
    .filter((item) => item.length >= 18 && item.length <= 220)
    .filter((item) => /[.!?।]$/.test(item))
    .filter((item) => item.split(/\s+/).length >= 4)
    .filter((item) => !/^practice good$/i.test(item))
    .filter((item) => !/\b(take|use|start|stop)\s+\d+\s*(mg|ml|tablet|capsule)/i.test(item));
};

const normalizeAiAdvice = (aiAdvice = null) => {
  if (!aiAdvice || typeof aiAdvice !== "object") return null;

  const diet = sanitizeAdviceList(aiAdvice.diet);
  const lifestyle = sanitizeAdviceList(aiAdvice.lifestyle);
  const prevention = sanitizeAdviceList(aiAdvice.prevention);

  if (!diet.length && !lifestyle.length && !prevention.length) return null;

  return { diet, lifestyle, prevention };
};

const addProfileSpecificRules = ({ topic, flags, diet, lifestyle, prevention }) => {
  if (flags.hasDiabetes) {
    diet.push("Because diabetes is mentioned in the profile, avoid sugary drinks and keep blood sugar monitoring regular.");
  }

  if (flags.hasHypertension) {
    diet.push("Because high blood pressure is mentioned in the profile, keep salt low and reduce heavily processed foods.");
  }

  if (flags.hasAsthma && topic === "respiratory") {
    lifestyle.push("Because asthma is mentioned in the profile, keep prescribed inhaler or medicine accessible and avoid smoke or dust triggers.");
  }

  if (flags.hasAllergy && topic === "skin") {
    prevention.push("Because allergy history is mentioned in the profile, avoid known allergens and do not start new medicines without medical advice.");
  }
};

export const buildPreventiveAdvice = async ({
  symptoms = "",
  severityResult = null,
  language = "en",
  patientProfile = null,
  aiEnhancer = null,
} = {}) => {
  if (severityResult?.isEmergency) return null;

  const topic = detectTopic({ symptoms, severityResult });
  const selected = ruleAdvice[topic] || ruleAdvice.general;
  const flags = detectProfileFlags(patientProfile);

  const diet = [...selected.diet];
  const lifestyle = [...selected.lifestyle];
  const prevention = [...selected.prevention];

  addProfileSpecificRules({ topic, flags, diet, lifestyle, prevention });

  let source = "rules";

  if (typeof aiEnhancer === "function") {
    try {
      const aiAdvice = await aiEnhancer({
        symptoms,
        severityResult,
        language,
        patientProfile,
        topic,
        profileFlags: flags,
        ruleAdvice: {
          diet: uniqueLimit(diet, 3),
          lifestyle: uniqueLimit(lifestyle, 3),
          prevention: uniqueLimit(prevention, 3),
        },
      });

      const normalizedAiAdvice = normalizeAiAdvice(aiAdvice);

      if (normalizedAiAdvice) {
        diet.unshift(...normalizedAiAdvice.diet);
        lifestyle.unshift(...normalizedAiAdvice.lifestyle);
        prevention.unshift(...normalizedAiAdvice.prevention);
        source = "hybrid";
      }
    } catch (error) {
      console.error("PREVENTIVE AI ENHANCER ERROR:", error.message);
    }
  }

  return {
    topic,
    source,
    diet: uniqueLimit(diet, 3),
    lifestyle: uniqueLimit(lifestyle, 3),
    prevention: uniqueLimit(prevention, 3),
  };
};
