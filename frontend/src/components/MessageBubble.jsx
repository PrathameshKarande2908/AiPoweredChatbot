import { formatTime } from "../utils/formatTime";

export default function MessageBubble({ msg, speakText }) {
  const formatInline = (text) => {
    if (!text) return null;

    const parts = text.split(/(\*\*.*?\*\*)/g);

    return parts.map((part, index) => {
      const isBold = part.startsWith("**") && part.endsWith("**");

      if (isBold) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }

      return <span key={index}>{part}</span>;
    });
  };

  const getSeverityMeta = (text) => {
    const rawContent = text || "";
    const content = rawContent.toUpperCase();

    if (
      content.includes("EMERGENCY ALERT") ||
      rawContent.includes("इमरजेंसी अलर्ट") ||
      rawContent.includes("आपत्कालीन इशारा") ||
      content.includes("TRIAGE LEVEL: SEVERE")
    ) {
      return {
        level: "SEVERE",
        badge: "🔴 Severe",
        bubbleClass: "border-red-300 bg-red-50",
        badgeClass: "bg-red-100 text-red-700 border border-red-200",
      };
    }

    if (
      content.includes("TRIAGE LEVEL: MODERATE") ||
      rawContent.includes("ट्रायेज स्तर: MODERATE")
    ) {
      return {
        level: "MODERATE",
        badge: "🟡 Moderate",
        bubbleClass: "border-yellow-300 bg-yellow-50",
        badgeClass: "bg-yellow-100 text-yellow-800 border border-yellow-200",
      };
    }

    if (
      content.includes("TRIAGE LEVEL: MILD") ||
      rawContent.includes("ट्रायेज स्तर: MILD")
    ) {
      return {
        level: "MILD",
        badge: "🟢 Mild",
        bubbleClass: "border-green-300 bg-green-50",
        badgeClass: "bg-green-100 text-green-700 border border-green-200",
      };
    }

    return {
      level: null,
      badge: null,
      bubbleClass: "border-gray-200 bg-white",
      badgeClass: "",
    };
  };

  const cleanDisplayText = (text) => {
    if (!text) return "";

    return text
      .replace(/🚨\s*EMERGENCY ALERT\s*🚨/gi, "")
      .replace(/🚨\s*इमरजेंसी अलर्ट\s*🚨/gi, "")
      .replace(/🚨\s*आपत्कालीन इशारा\s*🚨/gi, "")
      .replace(/🩺\s*Triage Level:\s*(MILD|MODERATE|SEVERE)/gi, "")
      .replace(/🩺\s*ट्रायेज स्तर:\s*(MILD|MODERATE|SEVERE)/gi, "")
      .replace(/Triage Level:\s*(MILD|MODERATE|SEVERE)/gi, "")
      .trim();
  };

  const renderContent = (text) => {
    if (!text) return null;

    const lines = text.split("\n");
    const elements = [];
    let bulletItems = [];
    let numberItems = [];

    const flushBullets = (keyPrefix) => {
      if (bulletItems.length > 0) {
        elements.push(
          <ul
            key={`${keyPrefix}-bullets`}
            className="list-disc ml-5 mb-3 space-y-1"
          >
            {bulletItems.map((item, idx) => (
              <li key={`${keyPrefix}-bullet-${idx}`}>{formatInline(item)}</li>
            ))}
          </ul>
        );
        bulletItems = [];
      }
    };

    const flushNumbers = (keyPrefix) => {
      if (numberItems.length > 0) {
        elements.push(
          <ol
            key={`${keyPrefix}-numbers`}
            className="list-decimal ml-5 mb-3 space-y-1"
          >
            {numberItems.map((item, idx) => (
              <li key={`${keyPrefix}-number-${idx}`}>{formatInline(item)}</li>
            ))}
          </ol>
        );
        numberItems = [];
      }
    };

    const flushAllLists = (keyPrefix) => {
      flushBullets(`${keyPrefix}-b`);
      flushNumbers(`${keyPrefix}-n`);
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      if (!trimmed) {
        flushAllLists(index);
        elements.push(<div key={`space-${index}`} className="h-2" />);
        return;
      }

      if (trimmed === "---") {
        flushAllLists(index);
        elements.push(
          <hr key={`hr-${index}`} className="my-3 border-gray-300" />
        );
        return;
      }

      if (trimmed.startsWith("### ")) {
        flushAllLists(index);
        elements.push(
          <h3 key={`h3-${index}`} className="font-semibold text-base mb-2 mt-1">
            {formatInline(trimmed.slice(4))}
          </h3>
        );
        return;
      }

      if (trimmed.startsWith("## ")) {
        flushAllLists(index);
        elements.push(
          <h2 key={`h2-${index}`} className="font-bold text-lg mb-2 mt-1">
            {formatInline(trimmed.slice(3))}
          </h2>
        );
        return;
      }

      if (trimmed.startsWith("# ")) {
        flushAllLists(index);
        elements.push(
          <h1 key={`h1-${index}`} className="font-bold text-xl mb-2 mt-1">
            {formatInline(trimmed.slice(2))}
          </h1>
        );
        return;
      }

      if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
        flushNumbers(index);
        bulletItems.push(trimmed.replace(/^(- |• )/, ""));
        return;
      }

      if (/^\d+\.\s/.test(trimmed)) {
        flushBullets(index);
        numberItems.push(trimmed.replace(/^\d+\.\s/, ""));
        return;
      }

      flushAllLists(index);
      elements.push(
        <p key={`p-${index}`} className="mb-2 last:mb-0">
          {formatInline(trimmed)}
        </p>
      );
    });

    flushAllLists("final");

    return elements;
  };

  const severityMeta =
    msg.role === "assistant" ? getSeverityMeta(msg.content) : null;

  const displayText =
    msg.role === "assistant" ? cleanDisplayText(msg.content) : msg.content;

  const timeText = formatTime(msg.timestamp);

  return (
    <div
      className={`max-w-2xl w-fit px-4 py-3 rounded-2xl shadow relative ${
        msg.role === "user"
          ? "bg-green-500 text-white self-end rounded-br-none"
          : `${severityMeta.bubbleClass} text-gray-800 self-start rounded-bl-none border`
      }`}
    >
      {msg.role === "assistant" && severityMeta.badge && (
        <div
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold mb-3 ${severityMeta.badgeClass}`}
        >
          {severityMeta.badge}
        </div>
      )}

      <div className="pr-8 text-sm leading-relaxed break-words">
        {renderContent(displayText)}
      </div>

      <div
        className={`mt-2 text-[11px] ${
          msg.role === "user"
            ? "text-green-100 text-right"
            : "text-gray-400 text-left"
        }`}
      >
        {timeText}
      </div>

      {msg.role === "assistant" && (
        <button
          onClick={() => speakText(msg.content)}
          className="absolute top-2 right-2 text-gray-500 hover:text-black"
          title="Play voice"
          type="button"
        >
          🔊
        </button>
      )}
    </div>
  );
}