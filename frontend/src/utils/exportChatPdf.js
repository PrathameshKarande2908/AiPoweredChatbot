import { jsPDF } from "jspdf";

const languageLabels = {
  en: "English",
  hi: "Hindi",
  mr: "Marathi",
};

const removeUnsupportedSymbols = (text = "") => {
  return String(text)
    .replace(/🚨/g, "")
    .replace(/🩺/g, "")
    .replace(/⚠️/g, "Warning:")
    .replace(/⚠/g, "Warning:")
    .replace(/[^\x00-\x7F\u0900-\u097F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

const cleanMessageText = (text = "") => {
  return String(text)
    .replace(/🚨\s*EMERGENCY ALERT\s*🚨/gi, "EMERGENCY ALERT")
    .replace(/🚨\s*इमरजेंसी अलर्ट\s*🚨/gi, "इमरजेंसी अलर्ट")
    .replace(/🚨\s*आपत्कालीन इशारा\s*🚨/gi, "आपत्कालीन इशारा")
    .replace(/🩺\s*Triage Level:\s*(MILD|MODERATE|SEVERE)/gi, "Triage Level: $1")
    .replace(/🩺\s*ट्रायेज स्तर:\s*(MILD|MODERATE|SEVERE)/gi, "ट्रायेज स्तर: $1")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\r/g, "")
    .trim();
};

const getSeverityLabel = (text = "") => {
  const raw = String(text || "");
  const upper = raw.toUpperCase();

  if (
    upper.includes("EMERGENCY ALERT") ||
    raw.includes("इमरजेंसी अलर्ट") ||
    raw.includes("आपत्कालीन इशारा") ||
    upper.includes("TRIAGE LEVEL: SEVERE")
  ) {
    return "SEVERE";
  }

  if (
    upper.includes("TRIAGE LEVEL: MODERATE") ||
    raw.includes("ट्रायेज स्तर: MODERATE")
  ) {
    return "MODERATE";
  }

  if (
    upper.includes("TRIAGE LEVEL: MILD") ||
    raw.includes("ट्रायेज स्तर: MILD")
  ) {
    return "MILD";
  }

  return "";
};

const formatTimestamp = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
};

const getSafeFileName = (value = "chat-export") => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097f\s-]/gi, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60) || "chat-export";
};

const ensurePageSpace = (doc, y, neededHeight = 10) => {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + neededHeight > pageHeight - 14) {
    doc.addPage();
    return 18;
  }
  return y;
};

const drawWrappedText = ({
  doc,
  text,
  x,
  y,
  maxWidth,
  fontSize = 11,
  fontStyle = "normal",
  lineHeight = 5.5,
}) => {
  const safeText = removeUnsupportedSymbols(text);

  if (!safeText) return y;

  doc.setFont("helvetica", fontStyle);
  doc.setFontSize(fontSize);

  const lines = doc.splitTextToSize(safeText, maxWidth);

  for (const line of lines) {
    y = ensurePageSpace(doc, y, lineHeight + 2);
    doc.text(line, x, y);
    y += lineHeight;
  }

  return y;
};

const parseStructuredLines = (text = "") => {
  return cleanMessageText(text)
    .split("\n")
    .map((line) => line.trim())
    .filter((line, index, arr) => !(line === "" && arr[index - 1] === ""));
};

const drawMessageBody = ({ doc, text, x, y, maxWidth }) => {
  const lines = parseStructuredLines(text);

  for (const rawLine of lines) {
    const line = removeUnsupportedSymbols(rawLine);

    if (!line) {
      y += 2;
      continue;
    }

    if (line === "---") {
      y = ensurePageSpace(doc, y, 8);
      doc.setDrawColor(220);
      doc.line(x, y, x + maxWidth, y);
      y += 5;
      continue;
    }

    if (line.startsWith("### ")) {
      y = ensurePageSpace(doc, y, 10);
      y = drawWrappedText({
        doc,
        text: line.slice(4),
        x,
        y,
        maxWidth,
        fontSize: 12,
        fontStyle: "bold",
        lineHeight: 6,
      });
      y += 1;
      continue;
    }

    if (line.startsWith("## ")) {
      y = ensurePageSpace(doc, y, 11);
      y = drawWrappedText({
        doc,
        text: line.slice(3),
        x,
        y,
        maxWidth,
        fontSize: 13,
        fontStyle: "bold",
        lineHeight: 6.5,
      });
      y += 1;
      continue;
    }

    if (line.startsWith("# ")) {
      y = ensurePageSpace(doc, y, 12);
      y = drawWrappedText({
        doc,
        text: line.slice(2),
        x,
        y,
        maxWidth,
        fontSize: 14,
        fontStyle: "bold",
        lineHeight: 7,
      });
      y += 1;
      continue;
    }

    if (line.startsWith("- ") || line.startsWith("• ")) {
      y = ensurePageSpace(doc, y, 8);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text("-", x, y);

      y = drawWrappedText({
        doc,
        text: line.replace(/^(- |• )/, ""),
        x: x + 5,
        y,
        maxWidth: maxWidth - 5,
        fontSize: 11,
        fontStyle: "normal",
        lineHeight: 5.5,
      });

      y += 1;
      continue;
    }

    y = drawWrappedText({
      doc,
      text: line,
      x,
      y,
      maxWidth,
      fontSize: 11,
      fontStyle: "normal",
      lineHeight: 5.5,
    });

    y += 1;
  }

  return y;
};

const estimateMessageHeight = (doc, text, maxWidth) => {
  const lines = parseStructuredLines(text);
  let total = 0;

  for (const rawLine of lines) {
    const line = removeUnsupportedSymbols(rawLine);

    if (!line) {
      total += 2;
      continue;
    }

    if (line === "---") {
      total += 5;
      continue;
    }

    const content =
      line.startsWith("### ")
        ? line.slice(4)
        : line.startsWith("## ")
        ? line.slice(3)
        : line.startsWith("# ")
        ? line.slice(2)
        : line.startsWith("- ") || line.startsWith("• ")
        ? line.replace(/^(- |• )/, "")
        : line;

    const wrapWidth =
      line.startsWith("- ") || line.startsWith("• ") ? maxWidth - 5 : maxWidth;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);

    const wrapped = doc.splitTextToSize(content || " ", wrapWidth);
    total += Math.max(wrapped.length, 1) * 5.5 + 1;
  }

  return total + 6;
};

export const exportChatPdf = ({
  messages = [],
  sessionTitle = "New Chat",
  language = "en",
  userId = "",
}) => {
  const doc = new jsPDF({
    orientation: "p",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const cardPadding = 5;
  const cardWidth = contentWidth;
  let y = 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("AI Health Assistant Chat Export", margin, y);
  y += 9;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Session: ${removeUnsupportedSymbols(sessionTitle || "New Chat")}`, margin, y);
  y += 6;
  doc.text(`Language: ${languageLabels[language] || "English"}`, margin, y);
  y += 6;
  doc.text(`Exported: ${new Date().toLocaleString()}`, margin, y);
  y += 6;

  if (userId) {
    doc.text(`User ID: ${removeUnsupportedSymbols(userId)}`, margin, y);
    y += 6;
  }

  y += 1;
  y = drawWrappedText({
    doc,
    text: "Disclaimer: This export contains preliminary AI-generated health guidance and does not replace professional medical advice.",
    x: margin,
    y,
    maxWidth: contentWidth,
    fontSize: 10,
    fontStyle: "normal",
    lineHeight: 5,
  });

  y += 4;
  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  if (!messages.length) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    doc.text("No messages available in this chat.", margin, y);
  } else {
    messages.forEach((msg, index) => {
      const roleLabel = msg.role === "user" ? "User" : "Assistant";
      const severity = msg.role === "assistant" ? getSeverityLabel(msg.content) : "";
      const timeText = formatTimestamp(msg.timestamp);
      const headerText = `${index + 1}. ${roleLabel}${severity ? ` [${severity}]` : ""}${timeText ? ` - ${timeText}` : ""}`;
      const bodyText = cleanMessageText(msg.content || "");
      const estimatedHeight =
        10 + estimateMessageHeight(doc, bodyText, cardWidth - cardPadding * 2);

      y = ensurePageSpace(doc, y, estimatedHeight + 6);

      doc.setDrawColor(225);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin, y, cardWidth, estimatedHeight, 3, 3, "FD");

      let innerY = y + 7;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      const headerLines = doc.splitTextToSize(
        removeUnsupportedSymbols(headerText),
        cardWidth - cardPadding * 2
      );

      headerLines.forEach((line) => {
        doc.text(line, margin + cardPadding, innerY);
        innerY += 5.5;
      });

      innerY += 1;
      doc.setDrawColor(235);
      doc.line(
        margin + cardPadding,
        innerY,
        margin + cardWidth - cardPadding,
        innerY
      );
      innerY += 5;

      innerY = drawMessageBody({
        doc,
        text: bodyText,
        x: margin + cardPadding,
        y: innerY,
        maxWidth: cardWidth - cardPadding * 2,
      });

      y += estimatedHeight + 6;
    });
  }

  const fileName = `${getSafeFileName(sessionTitle || "chat-export")}.pdf`;
  doc.save(fileName);
};