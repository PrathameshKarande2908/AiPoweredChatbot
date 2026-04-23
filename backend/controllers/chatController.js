import Chat from "../models/Chat.js";
import UserProfile from "../models/UserProfile.js";
import Appointment from "../models/Appointment.js";
import { analyzeSeverity } from "../features/triage/severityAnalyzer.js";
import { generateAIResponse } from "../services/openaiService.js";

const createSessionId = () =>
  `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const isCasualMessage = (text) => {
  if (!text) return false;

  const normalized = text.trim().toLowerCase();

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

I'll try to guide you with the next steps.`,
    who: `Hi! I'm your AI Health Assistant.

I can help you:
- understand symptoms in a simple way
- suggest basic next steps
- tell you when a symptom may need urgent care

You can type something like:
- "I have fever and cough"
- "I have headache since morning"
- "My throat hurts"`,
    what: `I can help with basic health-related questions and symptom guidance.

For example, you can ask:
- "I have cough and fever"
- "Why do I have stomach pain?"
- "Is sore throat serious?"

Tell me what you're feeling and I'll help step by step.`,
    thanks: `You're welcome. I'm here whenever you need help.

You can tell me your symptoms anytime, and I'll guide you calmly step by step.`,
    test: `Yes, I'm working properly.

You can try messages like:
- "I have fever"
- "I am coughing"
- "I have chest pain"`,
    how: `I'm doing well — thanks for asking.

I'm here and ready to help with any health concerns or symptoms you want to discuss.`,
  },
  hi: {
    default: `नमस्ते! मैं आपकी मदद के लिए यहाँ हूँ।

आप अपने लक्षण सरल शब्दों में लिख सकते हैं, जैसे:
- "मुझे बुखार है"
- "मुझे खांसी हो रही है"
- "मेरे पेट में दर्द है"

मैं आपको अगले कदम समझाने की कोशिश करूँगा।`,
    who: `नमस्ते! मैं आपका AI Health Assistant हूँ।

मैं आपकी मदद कर सकता हूँ:
- लक्षणों को सरल तरीके से समझने में
- बुनियादी अगले कदम बताने में
- कब तुरंत डॉक्टर से मिलना चाहिए यह बताने में`,
    what: `मैं बुनियादी स्वास्थ्य प्रश्नों और लक्षणों पर मार्गदर्शन दे सकता हूँ।

उदाहरण:
- "मुझे बुखार और खांसी है"
- "मेरे पेट में दर्द क्यों है?"
- "क्या गले का दर्द गंभीर है?"`,
    thanks: `आपका स्वागत है। जब भी ज़रूरत हो, मैं यहाँ हूँ।

आप अपने लक्षण लिखिए, मैं शांत तरीके से आपकी मदद करूँगा।`,
    test: `हाँ, मैं सही से काम कर रहा हूँ।

आप यह लिखकर देख सकते हैं:
- "मुझे बुखार है"
- "मुझे खांसी है"
- "मेरे सीने में दर्द है"`,
    how: `मैं ठीक हूँ — पूछने के लिए धन्यवाद।

मैं आपके स्वास्थ्य संबंधी सवालों और लक्षणों में मदद करने के लिए तैयार हूँ।`,
  },
  mr: {
    default: `नमस्कार! मी तुमच्या मदतीसाठी येथे आहे.

तुमची लक्षणे साध्या शब्दांत लिहा, उदाहरणार्थ:
- "मला ताप आहे"
- "मला खोकला आहे"
- "माझ्या पोटात दुखत आहे"

मी पुढचे योग्य मार्गदर्शन देण्याचा प्रयत्न करेन.`,
    who: `नमस्कार! मी तुमचा AI Health Assistant आहे.

मी मदत करू शकतो:
- लक्षणे सोप्या भाषेत समजावून सांगणे
- पुढची साधी पावले सुचवणे
- कधी तातडीने डॉक्टरांकडे जायचे ते सांगणे`,
    what: `मी मूलभूत आरोग्यविषयक प्रश्नांमध्ये आणि लक्षणांबाबत मार्गदर्शन करू शकतो.

उदाहरण:
- "मला ताप आणि खोकला आहे"
- "माझ्या पोटात का दुखत आहे?"
- "घसा दुखणे गंभीर आहे का?"`,
    thanks: `स्वागत आहे. तुम्हाला जेव्हा गरज असेल तेव्हा मी येथेच आहे.

तुमची लक्षणे सांगा, मी शांतपणे मदत करेन.`,
    test: `हो, मी व्यवस्थित काम करत आहे.

हे लिहून पाहा:
- "मला ताप आहे"
- "मला खोकला आहे"
- "माझ्या छातीत दुखत आहे"`,
    how: `मी ठीक आहे — विचारल्याबद्दल धन्यवाद.

तुमच्या आरोग्याशी संबंधित प्रश्नांमध्ये मदत करण्यासाठी मी तयार आहे.`,
  },
};

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

const defaultSlotTimes = [
  "09:00",
  "10:00",
  "11:30",
  "01:00",
  "03:00",
  "04:30",
  "06:00",
];

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

const detectSpecialtyFromSymptoms = (symptoms = "") => {
  const text = String(symptoms).toLowerCase();

  if (
    /chest pain|breathing|cough|asthma|lung|pneumonia|shortness of breath|श्वास|खोकला|छाती|सांस|श्वसन|दम|छातीत|श्वास घे/.test(
      text
    )
  ) {
    return "Pulmonologist";
  }

  if (
    /stomach|abdomen|vomit|vomiting|diarrhea|acidity|gas|पेट|उल्टी|दस्त|जुलाब|पोट|उलट्या/.test(
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

const parseAppointmentDateTime = (appointmentDate, appointmentTime) => {
  if (!appointmentDate || !appointmentTime) return null;

  const dateTime = new Date(`${appointmentDate}T${appointmentTime}:00`);

  if (Number.isNaN(dateTime.getTime())) return null;
  return dateTime;
};

const getLanguageCopy = (language = "en") =>
  guidanceCopy[language] || guidanceCopy.en;

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

const toBulletList = (items = []) =>
  items.map((item) => `- ${item}`).join("\n");

const determinePreventiveTopic = (symptoms = "", severityResult = null) => {
  const text = String(symptoms).toLowerCase();
  const triggers = severityResult?.matchedTriggers || [];

  if (
    /cough|cold|throat|breathing|fever|flu|viral|खांसी|खोकला|घसा|सर्दी|ताप|बुखार|श्वास/.test(
      text
    ) ||
    triggers.some((item) =>
      /fever|cough|breathing|infection|throat/.test(String(item).toLowerCase())
    )
  ) {
    return "respiratory";
  }

  if (
    /stomach|abdomen|vomit|vomiting|diarrhea|acidity|gas|pet|पेट|पोट|उल्टी|उलट्या|जुलाब|दस्त/.test(
      text
    ) ||
    triggers.some((item) =>
      /vomiting|diarrhea|abdominal|dehydration/.test(String(item).toLowerCase())
    )
  ) {
    return "digestive";
  }

  if (/headache|migraine|dizziness|head pain|सिर दर्द|डोकेदुखी|चक्कर/.test(text)) {
    return "headache";
  }

  if (/skin|rash|itch|allergy|पुरळ|त्वचा|खुजली|अॅलर्जी|एलर्जी/.test(text)) {
    return "skin";
  }

  return "general";
};

const getProfileFlags = (profile = null) => {
  const source = [
    profile?.conditions || "",
    profile?.medications || "",
    profile?.allergies || "",
  ]
    .join(" ")
    .toLowerCase();

  return {
    hasDiabetes: /diabetes|diabetic|sugar/.test(source),
    hasHypertension: /hypertension|high blood pressure|bp/.test(source),
    hasAsthma: /asthma/.test(source),
  };
};

const preventiveAdviceLibrary = {
  en: {
    general: {
      diet: [
        "Choose simple home-cooked food and drink enough water through the day.",
        "Prefer fruits, soups, khichdi, dal, curd rice, or other easy-to-digest meals while recovering.",
      ],
      lifestyle: [
        "Sleep well, avoid overexertion, and keep track of temperature, pain, or other symptom changes.",
        "Maintain hand hygiene and do not share towels, bottles, or utensils when unwell.",
      ],
      prevention: [
        "Seek medical care early if symptoms last longer than expected or begin to worsen.",
        "Keep routine health checks, medicines, and emergency contacts updated.",
      ],
    },
    respiratory: {
      diet: [
        "Warm fluids such as water, soup, and herbal drinks may help keep the throat comfortable and support hydration.",
        "Choose light meals and avoid very oily food if you feel weak or feverish.",
      ],
      lifestyle: [
        "Rest well, use steam or warm salt-water gargles if suitable, and avoid smoke, dust, and cold irritants.",
        "Wear a mask around others if coughing, and wash hands after sneezing or coughing.",
      ],
      prevention: [
        "Monitor fever, cough, and breathing. Get checked promptly if breathing gets harder or fever stays high.",
        "Keep distance from vulnerable family members and ventilate the room well.",
      ],
    },
    digestive: {
      diet: [
        "Take small frequent meals and focus on fluids such as water, ORS, rice water, soup, or coconut water if tolerated.",
        "Prefer bland foods like banana, toast, curd rice, khichdi, or plain dal, and avoid spicy or very oily meals for now.",
      ],
      lifestyle: [
        "Rest and keep watching for dehydration, dizziness, reduced urination, or repeated vomiting.",
        "Wash hands before eating and after using the toilet to reduce further infection risk.",
      ],
      prevention: [
        "Use safe drinking water and fresh food, and avoid outside food if stomach symptoms are active.",
        "Seek care quickly if pain increases, vomiting continues, or you cannot keep fluids down.",
      ],
    },
    headache: {
      diet: [
        "Drink enough water and avoid skipping meals, since dehydration and hunger can worsen headaches.",
        "Limit excess caffeine, very sugary drinks, and alcohol-like triggers if relevant.",
      ],
      lifestyle: [
        "Rest in a quiet room, reduce screen strain, and sleep on time.",
        "Track whether headache is linked to stress, poor sleep, loud noise, or missed meals.",
      ],
      prevention: [
        "Get checked if headaches are frequent, unusually severe, or come with vomiting, weakness, or vision changes.",
        "Maintain regular sleep, hydration, and posture habits to reduce recurrence.",
      ],
    },
    skin: {
      diet: [
        "Stay hydrated and avoid foods that you already know trigger your allergy or skin irritation.",
        "Prefer simple balanced meals rather than experimenting with new foods during a flare.",
      ],
      lifestyle: [
        "Keep the skin clean and dry, avoid scratching, and use mild soap or skin products.",
        "Do not share towels or personal skin products if there is a rash or possible infection.",
      ],
      prevention: [
        "Track soaps, creams, foods, dust, or medicines that may trigger the problem.",
        "Seek care if rash spreads fast, becomes painful, or is associated with swelling or breathing trouble.",
      ],
    },
  },
  hi: {
    general: {
      diet: [
        "सादा घर का खाना लें और दिन भर पर्याप्त पानी पीते रहें।",
        "ठीक होने तक फल, सूप, खिचड़ी, दाल या हल्का पचने वाला भोजन बेहतर रहता है।",
      ],
      lifestyle: [
        "पर्याप्त नींद लें, ज़्यादा मेहनत से बचें, और तापमान या लक्षणों में बदलाव पर नज़र रखें।",
        "हाथ साफ रखें और बीमारी के दौरान तौलिया, बोतल या बर्तन साझा न करें।",
      ],
      prevention: [
        "यदि लक्षण लंबे समय तक रहें या बढ़ने लगें तो जल्दी डॉक्टर से संपर्क करें।",
        "रूटीन दवाइयाँ, चेकअप और इमरजेंसी संपर्क जानकारी अपडेट रखें।",
      ],
    },
    respiratory: {
      diet: [
        "गुनगुना पानी, सूप या हल्के गर्म पेय गले को आराम दे सकते हैं और शरीर को हाइड्रेट रखते हैं।",
        "कमज़ोरी या बुखार में हल्का भोजन लें और बहुत तैलीय चीज़ों से बचें।",
      ],
      lifestyle: [
        "आराम करें, ज़रूरत हो तो भाप या गरारे करें, और धुआँ, धूल तथा ठंडी उत्तेजना से बचें।",
        "खांसी हो तो दूसरों के आसपास मास्क पहनें और खांसने/छींकने के बाद हाथ धोएँ।",
      ],
      prevention: [
        "बुखार, खांसी और सांस पर नज़र रखें। सांस बढ़ती दिक्कत या लगातार तेज बुखार में जल्दी जाँच कराएँ।",
        "कमरे में हवा आने दें और घर के बुज़ुर्ग या कमजोर लोगों से थोड़ी दूरी रखें।",
      ],
    },
    digestive: {
      diet: [
        "थोड़ी-थोड़ी मात्रा में बार-बार लें और पानी, ओआरएस, चावल का पानी, सूप या नारियल पानी जैसे तरल लें यदि सहन हो।",
        "केला, टोस्ट, दही-चावल, खिचड़ी या सादा दाल जैसे हल्के भोजन लें और फिलहाल बहुत मसालेदार या तैलीय भोजन से बचें।",
      ],
      lifestyle: [
        "आराम करें और पानी की कमी, चक्कर, कम पेशाब या बार-बार उल्टी पर नज़र रखें।",
        "खाने से पहले और शौचालय के बाद हाथ धोएँ ताकि संक्रमण का खतरा कम हो।",
      ],
      prevention: [
        "साफ पानी और ताज़ा भोजन लें, और पेट खराब होने पर बाहर का खाना कम करें।",
        "दर्द बढ़े, उल्टी जारी रहे या पानी भी न रुक रहा हो तो जल्दी डॉक्टर से मिलें।",
      ],
    },
    headache: {
      diet: [
        "पर्याप्त पानी पिएँ और खाना न छोड़ें, क्योंकि डिहाइड्रेशन और भूख सिरदर्द बढ़ा सकते हैं।",
        "बहुत ज़्यादा कैफीन या बहुत मीठे पेय कम करें यदि वे ट्रिगर बनते हों।",
      ],
      lifestyle: [
        "शांत जगह पर आराम करें, स्क्रीन का इस्तेमाल कम करें और समय पर नींद लें।",
        "देखें कि सिरदर्द तनाव, कम नींद, तेज आवाज़ या खाना छोड़ने से तो नहीं बढ़ता।",
      ],
      prevention: [
        "यदि सिरदर्द बार-बार हो, बहुत तेज हो, या उल्टी, कमजोरी या दृष्टि बदलाव के साथ हो तो जाँच कराएँ।",
        "नियमित नींद, पानी और सही बैठने की आदतें सिरदर्द दोबारा होने का जोखिम घटाती हैं।",
      ],
    },
    skin: {
      diet: [
        "पर्याप्त पानी पिएँ और जिन खाद्य पदार्थों से पहले एलर्जी या जलन हुई हो उनसे बचें।",
        "फ्लेयर के दौरान नया खाना आज़माने के बजाय सादा संतुलित भोजन लें।",
      ],
      lifestyle: [
        "त्वचा साफ और सूखी रखें, खुजलाने से बचें, और हल्के साबुन या त्वचा उत्पादों का उपयोग करें।",
        "यदि दाने या संक्रमण की आशंका हो तो तौलिया या त्वचा उत्पाद साझा न करें।",
      ],
      prevention: [
        "साबुन, क्रीम, दवा, धूल या भोजन जैसे संभावित ट्रिगर नोट करें।",
        "यदि दाने तेजी से फैलें, दर्द करें, या सूजन/सांस की दिक्कत के साथ हों तो तुरंत जाँच कराएँ।",
      ],
    },
  },
  mr: {
    general: {
      diet: [
        "साधे घरचे अन्न घ्या आणि दिवसभर पुरेसे पाणी प्या.",
        "बरे होईपर्यंत फळे, सूप, खिचडी, डाळ किंवा हलके पचणारे अन्न अधिक योग्य ठरते.",
      ],
      lifestyle: [
        "पुरेशी झोप घ्या, जास्त श्रम टाळा आणि ताप किंवा इतर लक्षणांतील बदल लक्षात ठेवा.",
        "हात स्वच्छ ठेवा आणि आजारी असताना टॉवेल, बाटली किंवा भांडी शेअर करू नका.",
      ],
      prevention: [
        "लक्षणे जास्त काळ टिकली किंवा वाढू लागली तर लवकर डॉक्टरांचा सल्ला घ्या.",
        "नियमित औषधे, तपासण्या आणि आपत्कालीन संपर्क अद्ययावत ठेवा.",
      ],
    },
    respiratory: {
      diet: [
        "कोमट पाणी, सूप किंवा हलकी गरम पेये घसा आरामदायक ठेवण्यास आणि शरीर हायड्रेट ठेवण्यास मदत करू शकतात.",
        "ताप किंवा अशक्तपणा असल्यास हलके अन्न घ्या आणि खूप तेलकट पदार्थ टाळा.",
      ],
      lifestyle: [
        "विश्रांती घ्या, गरज असल्यास वाफ किंवा कोमट पाण्याच्या गुळण्या करा, आणि धूर, धूळ व थंड चिडवणारे घटक टाळा.",
        "खोकला असल्यास इतरांच्या जवळ मास्क वापरा आणि खोकल्यावर/शिंकताना हात धुवा.",
      ],
      prevention: [
        "ताप, खोकला आणि श्वासावर लक्ष ठेवा. श्वासोच्छवास अधिक कठीण होत असेल किंवा ताप टिकत असेल तर लवकर तपासणी करा.",
        "घरात हवा खेळती ठेवा आणि वयोवृद्ध किंवा अशक्त व्यक्तींना शक्यतो संरक्षण द्या.",
      ],
    },
    digestive: {
      diet: [
        "थोड्या-थोड्या वेळाने कमी प्रमाणात खा आणि सहन होत असल्यास पाणी, ओआरएस, भाताचे पाणी, सूप किंवा नारळपाणी घ्या.",
        "केळी, टोस्ट, दहीभात, खिचडी किंवा साधी डाळ यांसारखे हलके अन्न घ्या आणि सध्या खूप मसालेदार किंवा तेलकट पदार्थ टाळा.",
      ],
      lifestyle: [
        "विश्रांती घ्या आणि निर्जलीकरण, चक्कर, लघवी कमी होणे किंवा वारंवार उलट्या याकडे लक्ष ठेवा.",
        "जेवण्यापूर्वी आणि शौचालयानंतर हात धुवा जेणेकरून संसर्गाचा धोका कमी होईल.",
      ],
      prevention: [
        "सुरक्षित पिण्याचे पाणी आणि ताजे अन्न वापरा, आणि पोटाचे त्रास सुरू असताना बाहेरचे अन्न टाळा.",
        "दुखणे वाढत असेल, उलट्या सुरूच असतील किंवा द्रवही राहात नसेल तर लवकर डॉक्टरांना भेटा.",
      ],
    },
    headache: {
      diet: [
        "पुरेसे पाणी प्या आणि जेवण चुकवू नका, कारण निर्जलीकरण आणि भूक डोकेदुखी वाढवू शकतात.",
        "खूप जास्त कॅफिन किंवा फार गोड पेये कमी करा जर ती ट्रिगर ठरत असतील.",
      ],
      lifestyle: [
        "शांत ठिकाणी विश्रांती घ्या, स्क्रीनचा ताण कमी करा आणि वेळेवर झोप घ्या.",
        "डोकेदुखी ताण, कमी झोप, मोठा आवाज किंवा जेवण चुकणे यामुळे वाढते का ते नोंदवा.",
      ],
      prevention: [
        "डोकेदुखी वारंवार होत असेल, खूप तीव्र असेल किंवा उलटी, अशक्तपणा किंवा दृष्टीतील बदलांसह असेल तर तपासणी करा.",
        "नियमित झोप, पाणी आणि योग्य बसण्याच्या सवयी डोकेदुखी पुन्हा होण्याचा धोका कमी करतात.",
      ],
    },
    skin: {
      diet: [
        "पुरेसे पाणी प्या आणि ज्यामुळे आधी अॅलर्जी किंवा त्वचेची जळजळ झाली असेल ते पदार्थ टाळा.",
        "फ्लेअरच्या काळात नवीन पदार्थ वापरण्यापेक्षा साधे संतुलित अन्न घ्या.",
      ],
      lifestyle: [
        "त्वचा स्वच्छ आणि कोरडी ठेवा, खाजवणे टाळा आणि सौम्य साबण किंवा त्वचा उत्पादने वापरा.",
        "पुरळ किंवा संसर्गाची शक्यता असल्यास टॉवेल किंवा त्वचेची उत्पादने शेअर करू नका.",
      ],
      prevention: [
        "साबण, क्रीम, औषधे, धूळ किंवा अन्न यांसारखे ट्रिगर नोंदवा.",
        "पुरळ पटकन पसरत असेल, वेदनादायक होत असेल किंवा सूज/श्वासाचा त्रास असेल तर त्वरित तपासणी करा.",
      ],
    },
  },
};

const buildPreventiveAdvice = ({
  symptoms = "",
  severityResult = null,
  language = "en",
  patientProfile = null,
}) => {
  if (severityResult?.isEmergency) {
    return null;
  }

  const profileFlags = getProfileFlags(patientProfile);
  const localizedLibrary =
    preventiveAdviceLibrary[language] || preventiveAdviceLibrary.en;
  const topic = determinePreventiveTopic(symptoms, severityResult);
  const baseAdvice = localizedLibrary[topic] || localizedLibrary.general;

  const diet = [...baseAdvice.diet];
  const lifestyle = [...baseAdvice.lifestyle];
  const prevention = [...baseAdvice.prevention];

  if (profileFlags.hasDiabetes) {
    if (language === "hi") {
      diet.push(
        "यदि आपको डायबिटीज है तो मीठे पेय कम लें और भोजन/शुगर मॉनिटरिंग नियमित रखें।"
      );
    } else if (language === "mr") {
      diet.push(
        "जर तुम्हाला मधुमेह असेल तर गोड पेये कमी घ्या आणि आहार व शुगर तपासणी नियमित ठेवा."
      );
    } else {
      diet.push(
        "If you have diabetes, prefer controlled portions, avoid sugary drinks, and keep blood sugar monitoring regular."
      );
    }
  }

  if (profileFlags.hasHypertension) {
    if (language === "hi") {
      diet.push(
        "यदि हाई बीपी है तो नमक कम रखें और अत्यधिक प्रोसेस्ड खाद्य पदार्थों से बचें।"
      );
    } else if (language === "mr") {
      diet.push(
        "हाय बीपी असल्यास मीठाचे प्रमाण कमी ठेवा आणि जास्त प्रक्रिया केलेले पदार्थ टाळा."
      );
    } else {
      diet.push(
        "If you have high blood pressure, keep salt low and reduce heavily processed foods."
      );
    }
  }

  if (profileFlags.hasAsthma && topic === "respiratory") {
    if (language === "hi") {
      lifestyle.push(
        "यदि अस्थमा है तो इनहेलर/दवा उपलब्ध रखें और धूल-धुएँ से विशेष बचाव करें।"
      );
    } else if (language === "mr") {
      lifestyle.push(
        "अस्थमा असल्यास इनहेलर/औषध जवळ ठेवा आणि धूळ-धूर यापासून विशेष बचाव करा."
      );
    } else {
      lifestyle.push(
        "If you have asthma, keep your inhaler or prescribed medicines accessible and avoid smoke or dust triggers."
      );
    }
  }

  return {
    topic,
    diet: diet.slice(0, 3),
    lifestyle: lifestyle.slice(0, 3),
    prevention: prevention.slice(0, 3),
  };
};

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

const buildEmergencyReply = ({ copy, aiReply, reasons = [] }) => {
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

  if (aiReply?.trim()) {
    sections.push("", "---", "", aiReply.trim());
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

  if (severityResult?.isEmergency) {
    return buildEmergencyReply({
      copy,
      aiReply,
      reasons,
    });
  }

  if (level === "MODERATE") {
    return [
      `🩺 ${copy.triageLabel}: MODERATE`,
      "",
      copy.moderateNextStepsTitle,
      toBulletList(copy.moderateSteps),
      "",
      aiReply,
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
    aiReply,
    preventiveSection || "",
    "",
    copy.disclaimer,
  ]
    .filter(Boolean)
    .join("\n");
};

const buildFallbackReply = (language = "en", severityResult) => {
  const copy = getLanguageCopy(language);

  if (severityResult?.isEmergency) {
    return [
      copy.severeTitle,
      "",
      copy.severeLead,
      "",
      copy.severeStepsTitle,
      toBulletList(copy.severeSteps),
      "",
      copy.disclaimer,
    ].join("\n");
  }

  if (severityResult?.level === "MODERATE") {
    return [
      `🩺 ${copy.triageLabel}: MODERATE`,
      "",
      copy.moderateNextStepsTitle,
      toBulletList(copy.moderateSteps),
      "",
      copy.disclaimer,
    ].join("\n");
  }

  return [
    `🩺 ${copy.triageLabel}: MILD`,
    "",
    copy.mildNextStepsTitle,
    toBulletList(copy.mildSteps),
    "",
    copy.disclaimer,
  ].join("\n");
};

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

export const getAvailableAppointments = async (req, res) => {
  try {
    const { doctorName, appointmentDate } = req.body || {};

    if (!doctorName || !appointmentDate) {
      return res.status(400).json({
        error: "doctorName and appointmentDate are required",
      });
    }

    const bookedAppointments = await Appointment.find({
      doctorName,
      appointmentDate,
      status: "booked",
    }).select("appointmentTime");

    const bookedTimes = new Set(
      bookedAppointments.map((item) => item.appointmentTime)
    );

    const availableSlots = defaultSlotTimes
      .filter((time) => !bookedTimes.has(time))
      .map((time) => ({
        time,
        label: time,
      }));

    return res.json({
      doctorName,
      appointmentDate,
      slots: availableSlots,
    });
  } catch (error) {
    console.error("GET APPOINTMENT SLOTS ERROR:", error);
    return res.status(500).json({
      error: "Server error",
      details: error.message,
    });
  }
};

export const createAppointment = async (req, res) => {
  try {
    const {
      userId,
      doctorName,
      specialty = "",
      phone = "",
      hospitalName = "",
      appointmentDate,
      appointmentTime,
      notes = "",
      latitude = null,
      longitude = null,
    } = req.body || {};

    if (!userId || !doctorName || !appointmentDate || !appointmentTime) {
      return res.status(400).json({
        error:
          "userId, doctorName, appointmentDate and appointmentTime are required",
      });
    }

    const appointmentDateTime = parseAppointmentDateTime(
      appointmentDate,
      appointmentTime
    );

    if (!appointmentDateTime) {
      return res.status(400).json({
        error: "Invalid appointment date or time",
      });
    }

    if (appointmentDateTime.getTime() < Date.now()) {
      return res.status(400).json({
        error: "Appointment must be scheduled for a future time",
      });
    }

    const existingAppointment = await Appointment.findOne({
      userId,
      doctorName,
      appointmentDate,
      appointmentTime,
      status: "booked",
    });

    if (existingAppointment) {
      return res.status(409).json({
        error: "This appointment is already booked",
      });
    }

    const doctorBusy = await Appointment.findOne({
      doctorName,
      appointmentDate,
      appointmentTime,
      status: "booked",
    });

    if (doctorBusy) {
      return res.status(409).json({
        error: "This slot is no longer available",
      });
    }

    const appointment = await Appointment.create({
      userId,
      doctorName,
      specialty,
      phone,
      hospitalName,
      appointmentDate,
      appointmentTime,
      appointmentDateTime,
      notes,
      latitude: Number.isFinite(Number(latitude)) ? Number(latitude) : null,
      longitude: Number.isFinite(Number(longitude)) ? Number(longitude) : null,
    });

    return res.status(201).json({
      success: true,
      appointment,
    });
  } catch (error) {
    console.error("CREATE APPOINTMENT ERROR:", error);

    if (error?.code === 11000) {
      return res.status(409).json({
        error: "This appointment already exists",
      });
    }

    return res.status(500).json({
      error: "Server error",
      details: error.message,
    });
  }
};

export const listAppointments = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        error: "userId is required",
      });
    }

    const appointments = await Appointment.find({ userId }).sort({
      appointmentDateTime: 1,
    });

    return res.json({
      appointments,
    });
  } catch (error) {
    console.error("LIST APPOINTMENTS ERROR:", error);
    return res.status(500).json({
      error: "Server error",
      details: error.message,
    });
  }
};

export const handleChat = async (req, res) => {
  try {
    const { userId, message, sessionId, language = "en" } = req.body;

    if (!userId || !message?.trim()) {
      return res.status(400).json({ error: "userId and message are required" });
    }

    const activeSessionId = sessionId || createSessionId();
    const cleanMessage = message.trim();

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

    if (isCasualMessage(cleanMessage)) {
      finalReply = getCasualReply(cleanMessage, language);
    } else {
      const severityResult = analyzeSeverity(cleanMessage, language);
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

      const preventiveAdvice = buildPreventiveAdvice({
        symptoms: cleanMessage,
        severityResult,
        language,
        patientProfile: profile,
      });

      finalReply = buildAssistantReply({
        language,
        severityResult,
        aiReply,
        preventiveAdvice,
      });
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

    res.json({
      reply: finalReply,
      severity,
      emergency,
      sessionId: activeSessionId,
      title: chat.title,
      messages: chat.messages || [],
    });
  } catch (error) {
    console.error("SERVER ERROR:", error);
    res.status(500).json({
      error: "Server error",
      details: error.message,
    });
  }
};

export const getHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { sessionId } = req.query;

    if (!userId || !sessionId) {
      return res
        .status(400)
        .json({ error: "userId and sessionId are required" });
    }

    const chat = await Chat.findOne({
      userId,
      sessionId,
    });

    if (!chat) {
      return res.json({ messages: [], sessionId, title: "New Chat" });
    }

    res.json({
      messages: chat.messages || [],
      sessionId: chat.sessionId,
      title: chat.title || "New Chat",
    });
  } catch (error) {
    console.error("HISTORY ERROR:", error);
    res.status(500).json({
      error: "Server error",
      details: error.message,
    });
  }
};

export const listChats = async (req, res) => {
  try {
    const { userId } = req.params;

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
        preview: lastUserMessage?.content?.slice(0, 60) || "",
      };
    });

    res.json({ sessions });
  } catch (error) {
    console.error("LIST CHATS ERROR:", error);
    res.status(500).json({
      error: "Server error",
      details: error.message,
    });
  }
};

export const createChatSession = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const sessionId = createSessionId();

    const chat = new Chat({
      userId,
      sessionId,
      title: "New Chat",
      messages: [],
    });

    await chat.save();

    res.status(201).json({
      sessionId,
      title: chat.title,
      messages: [],
    });
  } catch (error) {
    console.error("CREATE CHAT ERROR:", error);
    res.status(500).json({
      error: "Server error",
      details: error.message,
    });
  }
};

export const renameChatSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { userId, title } = req.body;

    if (!userId || !sessionId || !title?.trim()) {
      return res
        .status(400)
        .json({ error: "userId, sessionId and title are required" });
    }

    const chat = await Chat.findOneAndUpdate(
      { userId, sessionId },
      { title: title.trim().slice(0, 60) },
      { new: true }
    );

    if (!chat) {
      return res.status(404).json({ error: "Chat session not found" });
    }

    res.json({
      sessionId: chat.sessionId,
      title: chat.title,
    });
  } catch (error) {
    console.error("RENAME CHAT ERROR:", error);
    res.status(500).json({
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
      return res
        .status(400)
        .json({ error: "userId and sessionId are required" });
    }

    const deleted = await Chat.findOneAndDelete({ userId, sessionId });

    if (!deleted) {
      return res.status(404).json({ error: "Chat session not found" });
    }

    res.json({ success: true, sessionId });
  } catch (error) {
    console.error("DELETE CHAT ERROR:", error);
    res.status(500).json({
      error: "Server error",
      details: error.message,
    });
  }
};

export const getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    let profile = await UserProfile.findOne({ userId });

    if (!profile) {
      profile = new UserProfile({ userId });
      await profile.save();
    }

    res.json(profile);
  } catch (error) {
    console.error("GET PROFILE ERROR:", error);
    res.status(500).json({
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
    } = req.body;

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

    res.json(profile);
  } catch (error) {
    console.error("UPDATE PROFILE ERROR:", error);
    res.status(500).json({
      error: "Server error",
      details: error.message,
    });
  }
};