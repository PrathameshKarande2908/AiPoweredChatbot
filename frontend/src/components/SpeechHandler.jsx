const languageMap = {
  en: "en-IN",
  hi: "hi-IN",
  mr: "mr-IN",
};

const titleMap = {
  en: "Voice Input",
  hi: "आवाज़ इनपुट",
  mr: "आवाज इनपुट",
};

const SpeechHandler = ({ setInput, onFinalText, language = "en" }) => {
  const start = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition not supported in this browser");
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = languageMap[language] || "en-IN";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (e) => {
      const text = e.results[0][0].transcript;

      setInput(text);

      if (onFinalText) {
        onFinalText(text);
      }
    };

    recognition.onerror = (err) => {
      console.log("Speech recognition error:", err);
    };

    recognition.start();
  };

  return (
    <button
      onClick={start}
      className="bg-blue-500 text-white px-3 py-2 rounded-full hover:bg-blue-600 transition"
      title={titleMap[language] || "Voice Input"}
      type="button"
    >
      🎤
    </button>
  );
};

export default SpeechHandler;