const normalizeText = (text = "") =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const matchesAny = (text, patterns = []) =>
  patterns.some((pattern) => pattern.test(text));

const collectMatchedLabels = (text, groups = []) => {
  const matches = [];

  for (const group of groups) {
    if (matchesAny(text, group.patterns)) {
      matches.push(group.label);
    }
  }

  return matches;
};

const emergencyGroups = [
  {
    label: "chest pain",
    patterns: [
      /\bchest pain\b/,
      /\bsevere chest pain\b/,
      /सीने में दर्द/,
      /छाती में दर्द/,
      /छातीत दुख/,
    ],
  },
  {
    label: "trouble breathing",
    patterns: [
      /\b(can t breathe|cannot breathe|difficulty breathing|shortness of breath|breathing problem|breathless)\b/,
      /सांस लेने में दिक्कत/,
      /सांस नहीं ले पा/,
      /श्वास घेण्यास त्रास/,
      /श्वास घ्यायला त्रास/,
      /दम लाग/,
    ],
  },
  {
    label: "coughing blood",
    patterns: [
      /\bcoughing blood\b/,
      /\bcough blood\b/,
      /\bblood cough\b/,
      /\bcough with blood\b/,
      /\bblood in cough\b/,
      /\bcoughing up blood\b/,
      /\bhemoptysis\b/,
      /खून वाली खांसी/,
      /खांसी में खून/,
      /खून की खांसी/,
      /रक्तासह खोकला/,
      /खोकल्यात रक्त/,
      /रक्त येत आहे/,
    ],
  },
  {
    label: "unconsciousness or fainting",
    patterns: [
      /\b(unconscious|passed out|fainted|fainting|not waking up)\b/,
      /बेहोश/,
      /होश नहीं/,
      /बेशुद्ध/,
      /शुद्ध हरप/,
    ],
  },
  {
    label: "seizure",
    patterns: [
      /\b(seizure|convulsion|fits)\b/,
      /दौरा/,
      /झटके/,
      /फिट्स/,
      /आकडी/,
    ],
  },
  {
    label: "stroke warning signs",
    patterns: [
      /\b(slurred speech|face drooping|one side weakness|sudden weakness|stroke)\b/,
      /बोलने में दिक्कत/,
      /चेहरा टेढ़ा/,
      /शरीर के एक तरफ कमजोरी/,
      /स्ट्रोक/,
      /चेहरा वाकडा/,
      /एका बाजूला अशक्तपणा/,
    ],
  },
  {
    label: "heavy bleeding",
    patterns: [
      /\b(heavy bleeding|bleeding a lot|won t stop bleeding|cannot stop bleeding)\b/,
      /बहुत खून/,
      /खून बंद नहीं/,
      /जास्त रक्तस्राव/,
      /रक्त थांबत नाही/,
    ],
  },
  {
    label: "severe allergic reaction",
    patterns: [
      /\b(anaphylaxis|allergic reaction with swelling|tongue swelling|throat swelling)\b/,
      /एलर्जी से सूजन/,
      /गला सूज/,
      /जीभ सूज/,
      /अॅलर्जीमुळे सूज/,
      /घसा सुज/,
    ],
  },
];

const moderateGroups = [
  {
    label: "high fever",
    patterns: [
      /\bhigh fever\b/,
      /\bfever for \d+ days\b/,
      /तेज बुखार/,
      /जोर का बुखार/,
      /उच्च ताप/,
      /खूप ताप/,
      /अनेक दिवसांपासून ताप/,
    ],
  },
  {
    label: "persistent vomiting or diarrhea",
    patterns: [
      /\b(persistent vomiting|vomiting again and again|severe vomiting|diarrhea many times)\b/,
      /बार बार उल्टी/,
      /लगातार उल्टी/,
      /बार बार दस्त/,
      /सतत उलट्या/,
      /वारंवार उलटी/,
      /जुलाब खूप वेळा/,
    ],
  },
  {
    label: "moderate dehydration",
    patterns: [
      /\bdehydration\b/,
      /\bvery weak\b/,
      /कमजोरी बहुत/,
      /पानी की कमी/,
      /खूप अशक्त/,
      /निर्जलीकरण/,
    ],
  },
  {
    label: "abdominal pain",
    patterns: [/\bstomach pain\b/, /\babdominal pain\b/, /पेट में दर्द/, /पोटात दुख/],
  },
  {
    label: "infection-like symptoms",
    patterns: [
      /\bcough and fever\b/,
      /\bsore throat and fever\b/,
      /खांसी और बुखार/,
      /गले में दर्द और बुखार/,
      /खोकला आणि ताप/,
      /घसा दुखणे आणि ताप/,
    ],
  },
];

const mildGroups = [
  {
    label: "mild fever",
    patterns: [/\bfever\b/, /बुखार/, /ताप/],
  },
  {
    label: "cough or cold",
    patterns: [/\bcough\b/, /\bcold\b/, /खांसी/, /सर्दी/, /खोकला/],
  },
  {
    label: "headache",
    patterns: [/\bheadache\b/, /सिर दर्द/, /डोकेदुखी/, /डोके दुख/],
  },
  {
    label: "sore throat",
    patterns: [/\bsore throat\b/, /गले में दर्द/, /घसा दुख/],
  },
  {
    label: "body ache",
    patterns: [/\bbody ache\b/, /शरीर दर्द/, /अंगदुखी/],
  },
];

const inferPrimaryConcern = (text, matchedTriggers = []) => {
  const combined = `${text} ${matchedTriggers.join(" ")}`;

  if (/cough|cold|throat|breath|breathing|fever|viral|infection|खांसी|खोकला|घसा|सांस|श्वास|ताप|बुखार/.test(combined)) {
    return "respiratory";
  }

  if (/stomach|abdomen|vomit|vomiting|diarrhea|dehydration|पेट|पोट|उल्टी|उलट्या|जुलाब|दस्त/.test(combined)) {
    return "digestive";
  }

  if (/headache|migraine|dizziness|stroke|seizure|सिर दर्द|डोकेदुखी|चक्कर|फिट्स|स्ट्रोक/.test(combined)) {
    return "neurological";
  }

  if (/allergy|rash|itch|skin|एलर्जी|अॅलर्जी|पुरळ|त्वचा|खुजली/.test(combined)) {
    return "skin";
  }

  return "general";
};

export const analyzeSeverity = (inputText = "") => {
  const text = normalizeText(inputText);

  const emergencyMatches = collectMatchedLabels(text, emergencyGroups);
  const moderateMatches = collectMatchedLabels(text, moderateGroups);
  const mildMatches = collectMatchedLabels(text, mildGroups);

  let level = "MILD";
  let isEmergency = false;
  let matchedTriggers = [];

  if (emergencyMatches.length > 0) {
    level = "SEVERE";
    isEmergency = true;
    matchedTriggers = emergencyMatches;
  } else if (moderateMatches.length > 0) {
    level = "MODERATE";
    matchedTriggers = moderateMatches;
  } else if (mildMatches.length > 0) {
    level = "MILD";
    matchedTriggers = mildMatches;
  }

  return {
    level,
    isEmergency,
    matchedTriggers,
    primaryConcern: inferPrimaryConcern(text, matchedTriggers),
  };
};
