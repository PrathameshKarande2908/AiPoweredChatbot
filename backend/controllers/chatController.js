import Chat from "../models/Chat.js";
import UserProfile from "../models/UserProfile.js";
import Appointment from "../models/Appointment.js";
import { analyzeSeverity } from "../features/triage/severityAnalyzer.js";
import { buildPreventiveAdvice } from "../features/prevention/preventiveTipsEngine.js";
import {
  generateAIResponse,
  generatePreventiveAIAdvice,
} from "../services/openaiService.js";

/* ================= BASIC HELPERS ================= */

const createSessionId = () =>
  `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const normalizeText = (value = "") =>
  String(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const clampNumber = (value, min, max) => {
  if (!Number.isFinite(value)) return null;
  return Math.min(Math.max(value, min), max);
};

const toRadians = (value) => (value * Math.PI) / 180;

const haversineDistanceKm = (lat1, lon1, lat2, lon2) => {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const toBulletList = (items = []) =>
  items
    .filter(Boolean)
    .map((item) => `- ${item}`)
    .join("\n");

const sanitizeAiGuidance = (value = "") => {
  const blockedSectionWords =
    /^(diet support|lifestyle support|disease prevention|preventive tips|what you can do now|suggested next steps|do this now)$/i;

  return String(value || "")
    .replace(/[#*_`]/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.length >= 12)
    .filter((line) => !blockedSectionWords.test(line))
    .filter((line) => !line.startsWith("-"))
    .filter((line) => !/^⚠️/.test(line))
    .slice(0, 4)
    .join("\n")
    .trim();
};

/* ================= CASUAL / PROFILE MESSAGES ================= */

const isCasualMessage = (text = "") => {
  const normalized = normalizeText(text);

  const exactMatches = [
    "hi",
    "hii",
    "hiii",
    "hello",
    "hey",
    "hey there",
    "good morning",
    "good afternoon",
    "good evening",
    "how are you",
    "who are you",
    "what can you do",
    "test",
    "testing",
    "ok",
    "okay",
    "thanks",
    "thank you",
    "नमस्ते",
    "हाय",
    "हेलो",
    "कैसे हो",
    "धन्यवाद",
    "नमस्कार",
    "कसा आहेस",
    "कशी आहेस",
  ];

  if (exactMatches.includes(normalized)) return true;

  const casualPatterns = [
    /^(hi+|hey+|hello+)\b/,
    /^how are you\b/,
    /^who are you\b/,
    /^what can you do\b/,
    /^test(ing)?\b/,
    /thank(s| you)\b/,
    /^(नमस्ते|हाय|हेलो|नमस्कार)\b/,
    /^(कैसे हो|कसा आहेस|कशी आहेस)\b/,
  ];

  return casualPatterns.some((pattern) => pattern.test(normalized));
};

const casualReplyMap = {
  en: {
    default: `Hi! I'm here to help.

You can describe your symptoms in simple words, for example:
- "I have fever"
- "I am having cough"
- "My stomach hurts"

I'll guide you with the next steps.`,
    who: `Hi! I'm your AI Health Assistant.

I can help you:
- understand symptoms in a simple way
- suggest basic next steps
- tell you when symptoms may need urgent care`,
    what: `I can help with symptom guidance, triage level, preventive tips, nearby care suggestions, and appointment booking support.`,
    thanks: `You're welcome. I'm here whenever you need help.`,
    test: `Yes, I'm working properly.

Try:
- "I have fever"
- "I have vomiting and diarrhea"
- "I have chest pain and breathing difficulty"`,
    how: `I'm doing well — ready to help with your health concerns.`,
  },
  hi: {
    default: `नमस्ते! मैं आपकी मदद के लिए यहाँ हूँ।

आप अपने लक्षण सरल शब्दों में लिख सकते हैं, जैसे:
- "मुझे बुखार है"
- "मुझे खांसी हो रही है"
- "मेरे पेट में दर्द है"`,
    who: `नमस्ते! मैं आपका AI Health Assistant हूँ।`,
    what: `मैं लक्षणों, ट्रायेज स्तर, बचाव सुझाव और डॉक्टर/हॉस्पिटल सुझावों में मदद कर सकता हूँ।`,
    thanks: `आपका स्वागत है।`,
    test: `हाँ, मैं सही से काम कर रहा हूँ।`,
    how: `मैं ठीक हूँ — आपकी मदद के लिए तैयार हूँ।`,
  },
  mr: {
    default: `नमस्कार! मी तुमच्या मदतीसाठी येथे आहे.

तुमची लक्षणे साध्या शब्दांत लिहा, उदाहरणार्थ:
- "मला ताप आहे"
- "मला खोकला आहे"
- "माझ्या पोटात दुखत आहे"`,
    who: `नमस्कार! मी तुमचा AI Health Assistant आहे.`,
    what: `मी लक्षणे, ट्रायेज स्तर, प्रतिबंधक सूचना आणि डॉक्टर/हॉस्पिटल सूचना देऊ शकतो.`,
    thanks: `स्वागत आहे.`,
    test: `हो, मी व्यवस्थित काम करत आहे.`,
    how: `मी ठीक आहे — मदतीसाठी तयार आहे.`,
  },
};

const getCasualReply = (message, language = "en") => {
  const normalized = message.trim().toLowerCase();
  const replies = casualReplyMap[language] || casualReplyMap.en;

  if (/^who are you\b/.test(normalized)) return replies.who;
  if (/^what can you do\b/.test(normalized)) return replies.what;
  if (/thank(s| you)\b/.test(normalized) || /(धन्यवाद)/.test(normalized)) {
    return replies.thanks;
  }
  if (/^test(ing)?\b/.test(normalized)) return replies.test;
  if (
    /^how are you\b/.test(normalized) ||
    /(कैसे हो|कसा आहेस|कशी आहेस)/.test(normalized)
  ) {
    return replies.how;
  }

  return replies.default;
};

const profileOnlyPatterns = [
  { label: "asthma", pattern: /^asthma$|^i have asthma$|^दमा$|^अस्थमा$/i },
  {
    label: "diabetes",
    pattern:
      /^diabetes$|^diabetic$|^i have diabetes$|^sugar$|^मधुमेह$|^डायबिटीज$/i,
  },
  {
    label: "hypertension",
    pattern:
      /^bp$|^high bp$|^high blood pressure$|^hypertension$|^उच्च रक्तदाब$/i,
  },
  {
    label: "allergy",
    pattern: /^allergy$|^allergies$|^i have allergy$|^एलर्जी$|^अॅलर्जी$/i,
  },
];

const detectProfileOnlyHealthContext = (message = "") => {
  const normalized = String(message || "").trim().toLowerCase();
  if (!normalized || normalized.length > 40) return null;
  return (
    profileOnlyPatterns.find((item) => item.pattern.test(normalized))?.label ||
    null
  );
};

const upsertProfileCondition = async (userId, condition) => {
  if (!userId || !condition) return;

  let profile = await UserProfile.findOne({ userId });

  if (!profile) {
    await UserProfile.create({ userId, conditions: condition }).catch(() => null);
    return;
  }

  const existing = normalizeText(profile.conditions || "");
  if (!existing.includes(normalizeText(condition))) {
    profile.conditions = [profile.conditions, condition]
      .filter(Boolean)
      .join(profile.conditions ? ", " : "");
    await profile.save().catch(() => null);
  }
};

/* ================= COPY / RESPONSE FORMAT ================= */

const guidanceCopy = {
  en: {
    triageLabel: "Triage Level",
    disclaimer:
      "⚠️ This is preliminary guidance only and does not replace professional medical advice.",
    mildNextStepsTitle: "### What you can do now",
    moderateNextStepsTitle: "### Suggested next steps",
    severeTitle: "🚨 EMERGENCY ALERT 🚨",
    severeLead:
      "Your symptoms may need urgent medical attention. Please seek immediate help now.",
    severeStepsTitle: "### Do this now",
    warningSignsTitle: "### Possible warning signs noticed",
    preventiveTipsTitle: "### Preventive Tips",
    dietTitle: "#### Diet support",
    lifestyleTitle: "#### Lifestyle support",
    preventionTitle: "#### Disease prevention",
    mildSteps: [
      "Rest and stay hydrated.",
      "Monitor symptoms for any worsening.",
      "Seek medical advice if symptoms persist or get worse.",
    ],
    moderateSteps: [
      "Arrange a doctor consultation soon.",
      "Watch for worsening symptoms such as breathing trouble, persistent vomiting, or fainting.",
      "If symptoms suddenly become severe, seek urgent medical help.",
    ],
    severeSteps: [
      "Go to the nearest hospital, emergency room, or call local emergency help now.",
      "Do not wait if symptoms worsen or you feel unsafe.",
      "If possible, have someone stay with you and avoid being alone.",
    ],
  },
  hi: {
    triageLabel: "ट्रायेज स्तर",
    disclaimer:
      "⚠️ यह केवल प्रारंभिक मार्गदर्शन है। यह पेशेवर चिकित्सीय सलाह का विकल्प नहीं है।",
    mildNextStepsTitle: "### अभी आप क्या कर सकते हैं",
    moderateNextStepsTitle: "### अगले उचित कदम",
    severeTitle: "🚨 इमरजेंसी अलर्ट 🚨",
    severeLead:
      "आपके लक्षण गंभीर हो सकते हैं। कृपया तुरंत चिकित्सा सहायता लें।",
    severeStepsTitle: "### अभी यह करें",
    warningSignsTitle: "### संभावित गंभीर संकेत",
    preventiveTipsTitle: "### बचाव और देखभाल सुझाव",
    dietTitle: "#### आहार सहायता",
    lifestyleTitle: "#### जीवनशैली सहायता",
    preventionTitle: "#### रोग-रोकथाम",
    mildSteps: [
      "आराम करें और पर्याप्त पानी पिएँ।",
      "लक्षण बढ़ रहे हैं या नहीं, इस पर नज़र रखें।",
      "यदि लक्षण बने रहें या बढ़ें, तो डॉक्टर से सलाह लें।",
    ],
    moderateSteps: [
      "जल्द डॉक्टर से परामर्श लें।",
      "सांस लेने में दिक्कत, बार-बार उल्टी, चक्कर या बेहोशी जैसे लक्षणों पर नज़र रखें।",
      "यदि स्थिति अचानक गंभीर हो जाए, तो तुरंत चिकित्सा सहायता लें।",
    ],
    severeSteps: [
      "तुरंत नज़दीकी अस्पताल जाएँ या आपातकालीन सहायता लें।",
      "यदि स्थिति बिगड़ रही हो या आप असुरक्षित महसूस कर रहे हों, तो बिल्कुल इंतज़ार न करें।",
      "यदि संभव हो तो किसी को अपने साथ रखें और अकेले न रहें।",
    ],
  },
  mr: {
    triageLabel: "ट्रायेज स्तर",
    disclaimer:
      "⚠️ हे फक्त प्राथमिक मार्गदर्शन आहे. हे व्यावसायिक वैद्यकीय सल्ल्याची जागा घेत नाही.",
    mildNextStepsTitle: "### आत्ता तुम्ही काय करू शकता",
    moderateNextStepsTitle: "### पुढील योग्य पावले",
    severeTitle: "🚨 आपत्कालीन इशारा 🚨",
    severeLead:
      "तुमची लक्षणे गंभीर असू शकतात. कृपया तात्काळ वैद्यकीय मदत घ्या.",
    severeStepsTitle: "### आत्ता हे करा",
    warningSignsTitle: "### आढळलेले गंभीर संकेत",
    preventiveTipsTitle: "### प्रतिबंधक आणि काळजीच्या सूचना",
    dietTitle: "#### आहार मदत",
    lifestyleTitle: "#### जीवनशैली मदत",
    preventionTitle: "#### रोग प्रतिबंध",
    mildSteps: [
      "विश्रांती घ्या आणि पुरेसे पाणी प्या.",
      "लक्षणे वाढतात का हे पाहत राहा.",
      "लक्षणे कायम राहिली किंवा वाढली तर डॉक्टरांचा सल्ला घ्या.",
    ],
    moderateSteps: [
      "लवकरच डॉक्टरांचा सल्ला घ्या.",
      "श्वास घेण्यास त्रास, वारंवार उलट्या, चक्कर, बेशुद्ध पडणे यांसारखी लक्षणे वाढतात का हे पाहा.",
      "स्थिती अचानक गंभीर झाली तर त्वरित वैद्यकीय मदत घ्या.",
    ],
    severeSteps: [
      "तात्काळ जवळच्या रुग्णालयात जा किंवा आपत्कालीन मदत घ्या.",
      "स्थिती बिघडत असेल किंवा तुम्हाला असुरक्षित वाटत असेल तर अजिबात थांबू नका.",
      "शक्य असल्यास कोणीतरी तुमच्यासोबत असू द्या आणि एकटे राहू नका.",
    ],
  },
};

const getLanguageCopy = (language = "en") =>
  guidanceCopy[language] || guidanceCopy.en;

const formatPreventiveTipsSection = (copy, preventiveAdvice) => {
  if (!preventiveAdvice) return "";

  const sections = [copy.preventiveTipsTitle];

  if (preventiveAdvice.diet?.length) {
    sections.push("", copy.dietTitle, toBulletList(preventiveAdvice.diet));
  }

  if (preventiveAdvice.lifestyle?.length) {
    sections.push(
      "",
      copy.lifestyleTitle,
      toBulletList(preventiveAdvice.lifestyle)
    );
  }

  if (preventiveAdvice.prevention?.length) {
    sections.push(
      "",
      copy.preventionTitle,
      toBulletList(preventiveAdvice.prevention)
    );
  }

  return sections.join("\n");
};

const buildEmergencyReply = ({ copy, reasons = [] }) => {
  const sections = [
    copy.severeTitle,
    "",
    copy.severeLead,
    "",
    copy.severeStepsTitle,
    toBulletList(copy.severeSteps),
  ];

  if (reasons.length > 0) {
    sections.push(
      "",
      copy.warningSignsTitle,
      `- ${reasons.slice(0, 2).join("\n- ")}`
    );
  }

  sections.push("", copy.disclaimer);
  return sections.join("\n");
};

const buildAssistantReply = ({
  language = "en",
  severityResult,
  aiReply,
  preventiveAdvice = null,
}) => {
  const copy = getLanguageCopy(language);
  const level = severityResult?.level || "MILD";
  const reasons = severityResult?.matchedTriggers || [];
  const preventiveSection = formatPreventiveTipsSection(copy, preventiveAdvice);
  const cleanedAiReply = sanitizeAiGuidance(aiReply);

  if (severityResult?.isEmergency) {
    return buildEmergencyReply({ copy, reasons });
  }

  if (level === "MODERATE") {
    return [
      `🩺 ${copy.triageLabel}: MODERATE`,
      "",
      copy.moderateNextStepsTitle,
      toBulletList(copy.moderateSteps),
      "",
      cleanedAiReply,
      preventiveSection || "",
      "",
      copy.disclaimer,
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    `🩺 ${copy.triageLabel}: MILD`,
    "",
    copy.mildNextStepsTitle,
    toBulletList(copy.mildSteps),
    "",
    cleanedAiReply,
    preventiveSection || "",
    "",
    copy.disclaimer,
  ]
    .filter(Boolean)
    .join("\n");
};

const buildFallbackReply = (language = "en", severityResult) => {
  return buildAssistantReply({
    language,
    severityResult,
    aiReply: "",
    preventiveAdvice: null,
  });
};

/* ================= SPECIALTY / RECOMMENDATION ================= */

const detectSpecialtyFromSymptoms = (symptoms = "") => {
  const text = normalizeText(symptoms);

  if (
    /chest pain|breathing|breath|cough|asthma|lung|pneumonia|shortness|श्वास|खोकला|छाती|सांस|श्वसन|दम/.test(
      text
    )
  ) {
    return "Pulmonologist";
  }

  if (
    /stomach|abdomen|vomit|vomiting|diarrhea|acidity|gas|loose motion|पेट|उल्टी|दस्त|जुलाब|पोट|उलट्या/.test(
      text
    )
  ) {
    return "Gastroenterologist";
  }

  if (
    /headache|migraine|seizure|stroke|dizziness|neuro|डोके|सिर|मायग्रेन|चक्कर|फिट्स|स्ट्रोक/.test(
      text
    )
  ) {
    return "Neurologist";
  }

  if (/skin|rash|itch|allergy|खुजली|त्वचा|पुरळ|अॅलर्जी|एलर्जी/.test(text)) {
    return "Dermatologist";
  }

  return "General Physician";
};

const buildSmartCareRecommendation = ({ severity, symptomText }) => {
  const specialty = detectSpecialtyFromSymptoms(symptomText);

  if (severity === "SEVERE") {
    return {
      type: "HOSPITAL",
      message: "Immediate hospital care recommended",
      specialty,
    };
  }

  if (severity === "MODERATE") {
    return {
      type: "DOCTOR",
      message: `Consult a ${specialty}`,
      specialty,
    };
  }

  return null;
};

/* ================= MEMORY ================= */

const extractKnownSymptomsFromMessages = (messages = []) =>
  messages
    .filter((message) => message?.role === "user" && message?.content)
    .slice(-8)
    .map((message) => message.content);

const updateSymptomMemory = (chat, cleanMessage, severityResult) => {
  const existing = chat.symptomMemory || {};
  const knownSymptoms = Array.isArray(existing.knownSymptoms)
    ? existing.knownSymptoms
    : [];

  const nextSymptoms = [...knownSymptoms, cleanMessage]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(-12);

  chat.symptomMemory = {
    knownSymptoms: nextSymptoms,
    lastSeverity: severityResult?.level || existing.lastSeverity || "MILD",
    lastPrimaryConcern:
      severityResult?.primaryConcern || existing.lastPrimaryConcern || "general",
    updatedAt: new Date(),
  };
};

/* ================= NEARBY CARE MOCK ================= */

const generateNearbyMockData = ({
  latitude,
  longitude,
  severity = "MILD",
  symptomText = "",
}) => {
  const inferredSpecialty = detectSpecialtyFromSymptoms(symptomText);

  const doctorTemplates = [
    {
      name: "City Care Clinic",
      specialty: "General Physician",
      phone: "+91 98765 10101",
      rating: 4.4,
      isOpenNow: true,
      offsetLat: 0.008,
      offsetLng: 0.006,
    },
    {
      name: "LifePlus Chest & Lung Care",
      specialty: "Pulmonologist",
      phone: "+91 98765 20202",
      rating: 4.6,
      isOpenNow: true,
      offsetLat: -0.012,
      offsetLng: 0.004,
    },
    {
      name: "Neuro Relief Center",
      specialty: "Neurologist",
      phone: "+91 98765 30303",
      rating: 4.3,
      isOpenNow: false,
      offsetLat: 0.016,
      offsetLng: -0.005,
    },
    {
      name: "Digestive Wellness Clinic",
      specialty: "Gastroenterologist",
      phone: "+91 98765 40404",
      rating: 4.2,
      isOpenNow: true,
      offsetLat: -0.007,
      offsetLng: -0.01,
    },
    {
      name: "Skin & Allergy Care",
      specialty: "Dermatologist",
      phone: "+91 98765 50505",
      rating: 4.1,
      isOpenNow: true,
      offsetLat: 0.011,
      offsetLng: 0.013,
    },
  ];

  const hospitalTemplates = [
    {
      name: "Sunrise Hospital",
      type: "Multispeciality Hospital",
      phone: "+91 98765 60606",
      rating: 4.5,
      emergencyReady: true,
      isOpenNow: true,
      offsetLat: 0.01,
      offsetLng: -0.008,
    },
    {
      name: "Metro Emergency Center",
      type: "Emergency Hospital",
      phone: "+91 98765 70707",
      rating: 4.7,
      emergencyReady: true,
      isOpenNow: true,
      offsetLat: -0.014,
      offsetLng: 0.009,
    },
    {
      name: "Care Multispeciality Hospital",
      type: "Hospital",
      phone: "+91 98765 80808",
      rating: 4.4,
      emergencyReady: severity === "SEVERE",
      isOpenNow: true,
      offsetLat: 0.018,
      offsetLng: 0.004,
    },
    {
      name: "Lifeline Trauma Center",
      type: "Trauma Center",
      phone: "+91 98765 90909",
      rating: 4.8,
      emergencyReady: true,
      isOpenNow: true,
      offsetLat: -0.02,
      offsetLng: -0.006,
    },
  ];

  const doctors = doctorTemplates
    .map((item) => {
      const itemLat = latitude + item.offsetLat;
      const itemLng = longitude + item.offsetLng;
      const distanceKm = haversineDistanceKm(
        latitude,
        longitude,
        itemLat,
        itemLng
      );

      const specialtyBoost = item.specialty === inferredSpecialty ? -0.7 : 0;
      const openBoost = item.isOpenNow ? -0.2 : 0.3;
      const score = distanceKm + specialtyBoost + openBoost;

      return {
        name: item.name,
        specialty: item.specialty,
        phone: item.phone,
        rating: item.rating,
        isOpenNow: item.isOpenNow,
        distanceKm: Number(distanceKm.toFixed(1)),
        latitude: Number(itemLat.toFixed(6)),
        longitude: Number(itemLng.toFixed(6)),
        score,
      };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, 4)
    .map(({ score, ...rest }) => rest);

  const hospitals = hospitalTemplates
    .map((item) => {
      const itemLat = latitude + item.offsetLat;
      const itemLng = longitude + item.offsetLng;
      const distanceKm = haversineDistanceKm(
        latitude,
        longitude,
        itemLat,
        itemLng
      );

      const emergencyBoost =
        severity === "SEVERE" && item.emergencyReady ? -1.2 : 0;
      const openBoost = item.isOpenNow ? -0.2 : 0.4;
      const score = distanceKm + emergencyBoost + openBoost;

      return {
        name: item.name,
        type: item.type,
        phone: item.phone,
        rating: item.rating,
        isOpenNow: item.isOpenNow,
        emergencyReady: item.emergencyReady,
        distanceKm: Number(distanceKm.toFixed(1)),
        latitude: Number(itemLat.toFixed(6)),
        longitude: Number(itemLng.toFixed(6)),
        score,
      };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, 4)
    .map(({ score, ...rest }) => rest);

  return {
    doctors,
    hospitals,
    inferredSpecialty,
  };
};

/* ================= CHAT CONTROLLER ================= */

export const handleChat = async (req, res) => {
  try {
    const { userId, message, sessionId, language = "en" } = req.body || {};

    if (!userId || !message?.trim()) {
      return res.status(400).json({
        error: "userId and message are required",
      });
    }

    const cleanMessage = message.trim();
    const activeSessionId = sessionId || createSessionId();

    let chat = await Chat.findOne({
      userId,
      sessionId: activeSessionId,
    });

    if (!chat) {
      chat = new Chat({
        userId,
        sessionId: activeSessionId,
        title: cleanMessage.slice(0, 40) || "New Chat",
        messages: [],
      });
    }

    chat.messages.push({
      role: "user",
      content: cleanMessage,
    });

    let finalReply = "";
    let severity = null;
    let emergency = false;
    let recommendation = null;

    if (isCasualMessage(cleanMessage)) {
      finalReply = getCasualReply(cleanMessage, language);
    } else {
      const profileOnlyCondition = detectProfileOnlyHealthContext(cleanMessage);

      if (profileOnlyCondition) {
        await upsertProfileCondition(userId, profileOnlyCondition);

        finalReply =
          "Got it. I have noted this as profile context. Now describe your current symptoms, for example: ‘I have cough and sore throat.’";
      } else {
        const memoryForAnalyzer =
          chat.symptomMemory ||
          {
            knownSymptoms: extractKnownSymptomsFromMessages(chat.messages),
          };

        const severityResult = analyzeSeverity(cleanMessage, memoryForAnalyzer);

        severity = severityResult.level;
        emergency = severityResult.isEmergency;

        const profile = await UserProfile.findOne({ userId });

        let aiReply = "";

        try {
          aiReply = await generateAIResponse(
            chat.messages,
            language,
            profile,
            severityResult
          );
        } catch (err) {
          console.error("AI ERROR:", err.message);
          aiReply = buildFallbackReply(language, severityResult);
        }

        let preventiveAdvice = null;

        if (!severityResult.isEmergency) {
          preventiveAdvice = await buildPreventiveAdvice({
            symptoms: cleanMessage,
            severityResult,
            language,
            patientProfile: profile,
            aiEnhancer: generatePreventiveAIAdvice,
          });
        }

        finalReply = buildAssistantReply({
          language,
          severityResult,
          aiReply,
          preventiveAdvice,
        });

        recommendation = buildSmartCareRecommendation({
          severity: severityResult.level,
          symptomText: cleanMessage,
        });

        updateSymptomMemory(chat, cleanMessage, severityResult);
      }
    }

    chat.messages.push({
      role: "assistant",
      content: finalReply,
    });

    if (!chat.title || chat.title === "New Chat") {
      const firstUserMessage = chat.messages.find((msg) => msg.role === "user");
      if (firstUserMessage?.content) {
        chat.title = firstUserMessage.content.slice(0, 40);
      }
    }

    await chat.save();

    return res.json({
      reply: finalReply,
      severity,
      emergency,
      recommendation,
      sessionId: activeSessionId,
      title: chat.title || "New Chat",
      messages: chat.messages || [],
    });
  } catch (error) {
    console.error("SERVER ERROR:", error);
    return res.status(500).json({
      error: "Server error",
      details: error.message,
    });
  }
};

/* ================= CHAT HISTORY ================= */

export const getHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { sessionId } = req.query;

    if (!userId || !sessionId) {
      return res.status(400).json({
        error: "userId and sessionId are required",
      });
    }

    const chat = await Chat.findOne({
      userId,
      sessionId,
    });

    if (!chat) {
      return res.json({
        messages: [],
        sessionId,
        title: "New Chat",
      });
    }

    return res.json({
      messages: chat.messages || [],
      sessionId: chat.sessionId,
      title: chat.title || "New Chat",
      symptomMemory: chat.symptomMemory || null,
    });
  } catch (error) {
    console.error("HISTORY ERROR:", error);
    return res.status(500).json({
      error: "Server error",
      details: error.message,
    });
  }
};

/* ================= SESSION MANAGEMENT ================= */

export const listChats = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        error: "userId is required",
      });
    }

    const chats = await Chat.find({ userId })
      .sort({ updatedAt: -1 })
      .select("sessionId title updatedAt messages");

    const sessions = chats.map((chat) => {
      const lastUserMessage = [...(chat.messages || [])]
        .reverse()
        .find((msg) => msg.role === "user");

      return {
        sessionId: chat.sessionId,
        title: chat.title || "New Chat",
        updatedAt: chat.updatedAt,
        messageCount: chat.messages?.length || 0,
        preview: lastUserMessage?.content?.slice(0, 80) || "",
      };
    });

    return res.json({ sessions });
  } catch (error) {
    console.error("LIST CHATS ERROR:", error);
    return res.status(500).json({
      error: "Server error",
      details: error.message,
    });
  }
};

export const createChatSession = async (req, res) => {
  try {
    const { userId } = req.body || {};

    if (!userId) {
      return res.status(400).json({
        error: "userId is required",
      });
    }

    const sessionId = createSessionId();

    const chat = await Chat.create({
      userId,
      sessionId,
      title: "New Chat",
      messages: [],
      symptomMemory: {
        knownSymptoms: [],
        lastSeverity: "MILD",
        lastPrimaryConcern: "general",
        updatedAt: new Date(),
      },
    });

    return res.status(201).json({
      sessionId,
      title: chat.title,
      messages: [],
    });
  } catch (error) {
    console.error("CREATE CHAT ERROR:", error);
    return res.status(500).json({
      error: "Server error",
      details: error.message,
    });
  }
};

export const renameChatSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { userId, title } = req.body || {};

    if (!userId || !sessionId || !title?.trim()) {
      return res.status(400).json({
        error: "userId, sessionId and title are required",
      });
    }

    const chat = await Chat.findOneAndUpdate(
      { userId, sessionId },
      { title: title.trim().slice(0, 60) },
      { new: true }
    );

    if (!chat) {
      return res.status(404).json({
        error: "Chat session not found",
      });
    }

    return res.json({
      sessionId: chat.sessionId,
      title: chat.title,
    });
  } catch (error) {
    console.error("RENAME CHAT ERROR:", error);
    return res.status(500).json({
      error: "Server error",
      details: error.message,
    });
  }
};

export const deleteChatSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { userId } = req.query;

    if (!userId || !sessionId) {
      return res.status(400).json({
        error: "userId and sessionId are required",
      });
    }

    const deleted = await Chat.findOneAndDelete({ userId, sessionId });

    if (!deleted) {
      return res.status(404).json({
        error: "Chat session not found",
      });
    }

    return res.json({
      success: true,
      sessionId,
    });
  } catch (error) {
    console.error("DELETE CHAT ERROR:", error);
    return res.status(500).json({
      error: "Server error",
      details: error.message,
    });
  }
};

/* ================= PROFILE ================= */

export const getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    let profile = await UserProfile.findOne({ userId });

    if (!profile) {
      profile = new UserProfile({ userId });
      await profile.save();
    }

    return res.json(profile);
  } catch (error) {
    console.error("GET PROFILE ERROR:", error);
    return res.status(500).json({
      error: "Server error",
      details: error.message,
    });
  }
};

export const updateUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      fullName = "",
      age = null,
      gender = "",
      allergies = "",
      conditions = "",
      medications = "",
      emergencyContact = "",
      preferredLanguage = "en",
    } = req.body || {};

    const profile = await UserProfile.findOneAndUpdate(
      { userId },
      {
        userId,
        fullName,
        age: age === "" ? null : age,
        gender,
        allergies,
        conditions,
        medications,
        emergencyContact,
        preferredLanguage,
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    );

    return res.json(profile);
  } catch (error) {
    console.error("UPDATE PROFILE ERROR:", error);
    return res.status(500).json({
      error: "Server error",
      details: error.message,
    });
  }
};

/* ================= NEARBY CARE ================= */

export const getNearbyCare = async (req, res) => {
  try {
    const {
      latitude,
      longitude,
      severity = "MILD",
      symptomText = "",
      language = "en",
    } = req.body || {};

    const safeLatitude = clampNumber(Number(latitude), -90, 90);
    const safeLongitude = clampNumber(Number(longitude), -180, 180);

    if (safeLatitude === null || safeLongitude === null) {
      return res.status(400).json({
        error: "Valid latitude and longitude are required",
      });
    }

    const normalizedSeverity =
      ["MILD", "MODERATE", "SEVERE"].includes(String(severity).toUpperCase())
        ? String(severity).toUpperCase()
        : "MILD";

    const nearbyData = generateNearbyMockData({
      latitude: safeLatitude,
      longitude: safeLongitude,
      severity: normalizedSeverity,
      symptomText,
    });

    return res.json({
      severity: normalizedSeverity,
      language,
      location: {
        latitude: safeLatitude,
        longitude: safeLongitude,
      },
      inferredSpecialty: nearbyData.inferredSpecialty,
      doctors: nearbyData.doctors,
      hospitals: nearbyData.hospitals,
    });
  } catch (error) {
    console.error("NEARBY CARE ERROR:", error);
    return res.status(500).json({
      error: "Server error",
      details: error.message,
    });
  }
};
