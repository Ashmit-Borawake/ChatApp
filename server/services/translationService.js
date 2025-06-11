import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

console.log("Gemini API Key loaded:", GEMINI_API_KEY ? "Loaded" : "Not Loaded");

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent";

/**
 * Determines if translation should be forced, especially for Hinglish to Hindi cases
 * @param {string} fromLanguage - Source language code
 * @param {string} toLanguage - Target language code
 * @param {string} text - The text to analyze
 * @returns {boolean} - Whether translation should be forced
 */
export const shouldForceTranslate = (fromLanguage, toLanguage, text) => {
  // Check for Hinglish (Hindi written in Latin script)
  if (fromLanguage === "hi" && toLanguage === "hi") {
    const devanagariRegex = /[\u0900-\u097F]/; // Hindi/Marathi script
    const latinRegex = /[a-zA-Z]/;

    // Force translation if:
    // 1. No Devanagari characters AND has Latin characters (pure Hinglish)
    // 2. Or if the text is mixed script (contains both Devanagari and Latin)
    return (
      (!devanagariRegex.test(text) && latinRegex.test(text)) ||
      (devanagariRegex.test(text) && latinRegex.test(text))
    );
  }

  // Check if this is English but contains Hindi words in Latin script
  if (fromLanguage === "en" && toLanguage === "hi") {
    // Common Hindi words in Latin script
    const hinglishPattern =
      /\b(?:main|tum|kya|kese|nahi|hai|ho|ka|ke|ki|aap|yeh|woh|kuch|acha)\b/i;
    return hinglishPattern.test(text);
  }

  return false;
};

/**
 * Translates text from one language to another using the Gemini API
 * @param {string} text - The text to translate
 * @param {string} fromLanguage - The source language code (e.g., 'en', 'es')
 * @param {string} toLanguage - The target language code (e.g., 'en', 'es')
 * @returns {Promise<string>} - The translated text
 */
// Track API quota status to avoid excessive failed calls
let apiQuotaExceeded = false;
let quotaResetTimer = null;

export const translateText = async (
  text,
  fromLanguage,
  toLanguage,
  forceTranslate = false
) => {
  try {
    console.log(
      `Translation request received: { text: '${text}', fromLanguage: '${fromLanguage}', toLanguage: '${toLanguage}', forceTranslate: ${forceTranslate} }`
    );

    // Validate inputs
    if (!text || typeof text !== "string") {
      console.error("Invalid text for translation:", text);
      return text || "";
    }

    if (!fromLanguage || !toLanguage) {
      console.error("Missing language parameters:", {
        fromLanguage,
        toLanguage,
      });
      return text;
    }

    // Check if we need to force translation (like Hinglish to Hindi)
    if (!forceTranslate) {
      forceTranslate = shouldForceTranslate(fromLanguage, toLanguage, text);
    }

    // Skip translation only if not forced
    if (!forceTranslate && fromLanguage === toLanguage) {
      console.log(
        "Source and target languages are the same, skipping translation"
      );
      return text;
    }

    // Handle known API quota exceeded
    if (apiQuotaExceeded) {
      console.log("Using fallback translation (API quota exceeded)");
      return fallbackTranslate(text, fromLanguage, toLanguage);
    }

    const languageNames = {
      en: "English",
      hi: "Hindi",
      mr: "Marathi",
      es: "Spanish",
      fr: "French",
      de: "German",
      zh: "Chinese",
    };

    const fromLanguageName = languageNames[fromLanguage] || fromLanguage;
    const toLanguageName = languageNames[toLanguage] || toLanguage;

    let prompt;

    if (forceTranslate && fromLanguage === "hi" && toLanguage === "hi") {
      // Special case for Hinglish to Hindi (transliteration)
      prompt = `Transliterate the following Hinglish text (Hindi written in Latin script) to proper Hindi in Devanagari script.
Only return the transliterated text without any explanations or additional text.

Text to transliterate: "${text}"`;
    } else {
      // Regular translation
      prompt = `Translate the following text from ${fromLanguageName} to ${toLanguageName}.
Only return the translated text without any explanations or additional text.

Text to translate: "${text}"`;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log("Translation API request timed out");
        controller.abort();
      }, 10000);

      console.log("Making API request to Gemini for translation");

      if (!GEMINI_API_KEY) {
        console.error("Missing Gemini API key");
        clearTimeout(timeoutId);
        return fallbackTranslate(text, fromLanguage, toLanguage);
      }

      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(
          "API response not OK:",
          response.status,
          response.statusText
        );
        return fallbackTranslate(text, fromLanguage, toLanguage);
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error("Error parsing JSON response:", jsonError);
        return fallbackTranslate(text, fromLanguage, toLanguage);
      }

      // Additional check for quota error
      if (data.error?.code === 429) {
        console.log("API quota exceeded, activating fallback mode");
        apiQuotaExceeded = true;

        if (quotaResetTimer) clearTimeout(quotaResetTimer);
        quotaResetTimer = setTimeout(() => {
          apiQuotaExceeded = false;
          console.log("API quota reset timer expired, will try API again");
        }, 60 * 60 * 1000);

        return fallbackTranslate(text, fromLanguage, toLanguage);
      }

      const translatedText =
        data.candidates?.[0]?.content?.parts?.[0]?.text || "";

      if (!translatedText) {
        console.error("Empty translation result from API");
        return fallbackTranslate(text, fromLanguage, toLanguage);
      }

      console.log("Successfully received translation from API");

      const cleanedText = translatedText.replace(/^["']|["']$/g, "").trim();
      return cleanedText || text;
    } catch (apiError) {
      console.error("API call error:", apiError);
      return fallbackTranslate(text, fromLanguage, toLanguage);
    }
  } catch (error) {
    console.error("Translation error:", error);
    return `${text} [Translation error]`;
  }
};

// Fallback translation function that doesn't rely on external APIs
const fallbackTranslate = (text, fromLanguage, toLanguage) => {
  try {
    console.log("Using fallback translation mechanism");
    // For the fallback, we'll just return the original text
    // This ensures the chat continues to function even when translation fails
    return text;
  } catch (error) {
    console.error("Error in fallback translation:", error);
    return text; // Return original text as last resort
  }
};

/**
 * Detects the language of a text (simplified implementation)
 * In a production environment, you would use a proper language detection API
 * @param {string} text - The text to detect language for
 * @returns {string} - The detected language code
 */
// Simple language detection patterns for fallback
const languagePatterns = {
  en: /\b(the|is|are|and|in|on|at|to|for|with|by|of|from)\b/i,
  es: /\b(el|la|los|las|es|son|y|en|a|para|con|por|de|desde)\b/i,
  fr: /\b(le|la|les|est|sont|et|en|à|pour|avec|par|de|depuis)\b/i,
  de: /\b(der|die|das|ist|sind|und|in|auf|zu|für|mit|von|aus)\b/i,
  hi: /[\u0900-\u097F]/, // Hindi Unicode range
  mr: /[\u0900-\u097F]/, // Marathi uses the same Unicode range as Hindi
  zh: /[\u4E00-\u9FFF]/, // Chinese Unicode range
};

export const detectLanguage = async (text, defaultLanguage = "en") => {
  try {
    // Validate inputs
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      console.log(
        "Empty or invalid text for language detection, using default language"
      );
      return defaultLanguage;
    }

    // If text is very short (less than 5 characters), it's hard to detect language reliably
    if (text.trim().length < 5) {
      console.log(
        "Text too short for reliable language detection, using default language"
      );
      return defaultLanguage;
    }

    // Check for Hinglish pattern before API call
    // This improves detection for Hindi text written in Latin script
    const devanagariRegex = /[\u0900-\u097F]/;
    const hinglishPattern =
      /\b(?:main|tum|kya|kese|nahi|hai|ho|ka|ke|ki|aap|yeh|woh|kuch|acha)\b/i;

    // If text contains common Hindi words in Latin script and the default language is Hindi
    if (
      hinglishPattern.test(text) &&
      !devanagariRegex.test(text) &&
      defaultLanguage === "hi"
    ) {
      console.log(
        "Detected Hinglish (Hindi in Latin script), setting language to Hindi"
      );
      return "hi";
    }

    // If we know the API quota is exceeded, use fallback immediately
    if (apiQuotaExceeded) {
      console.log("Using fallback language detection (API quota exceeded)");
      return fallbackDetectLanguage(text, defaultLanguage);
    }

    try {
      // Set a timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      // In a real implementation, you would call a language detection API
      // For now, we'll use Gemini to detect the language
      const prompt = `Detect the language of the following text and respond with only the ISO 639-1 language code (e.g., 'en' for English, 'es' for Spanish, etc.).
      
      Text: "${text}"
      
      Supported language codes: en (English), hi (Hindi), mr (Marathi), es (Spanish), fr (French), de (German), zh (Chinese).
      If the language is not in the supported list, return the closest match from the supported languages.
      
      If the text appears to be Hindi written in Latin script (Hinglish), respond with 'hi'.`;

      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 32,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        // Check if the error is due to quota exceeded
        if (data.error?.code === 429) {
          console.log("API quota exceeded, activating fallback mode");
          apiQuotaExceeded = true;

          // Set a timer to reset the quota flag after 1 hour
          if (quotaResetTimer) clearTimeout(quotaResetTimer);
          quotaResetTimer = setTimeout(() => {
            apiQuotaExceeded = false;
            console.log("API quota reset timer expired, will try API again");
          }, 60 * 60 * 1000); // 1 hour

          // Use fallback language detection
          return fallbackDetectLanguage(text, defaultLanguage);
        }

        console.error("Language detection API error:", data);
        return fallbackDetectLanguage(text, defaultLanguage);
      }

      // Extract the language code from Gemini's response
      const detectedLanguage =
        data.candidates?.[0]?.content?.parts?.[0]?.text || "";

      if (!detectedLanguage) {
        console.error("Empty language detection result");
        return fallbackDetectLanguage(text, defaultLanguage);
      }

      // Clean up and validate the response
      const languageCode = detectedLanguage.trim().toLowerCase().slice(0, 2);

      // Check if the detected language is in our supported list
      const supportedLanguages = ["en", "hi", "mr", "es", "fr", "de", "zh"];
      return supportedLanguages.includes(languageCode)
        ? languageCode
        : defaultLanguage;
    } catch (apiError) {
      console.error("API call error:", apiError);
      return fallbackDetectLanguage(text, defaultLanguage);
    }
  } catch (error) {
    console.error("Language detection error:", error);
    return defaultLanguage;
  }
};

// Fallback language detection function that doesn't rely on external APIs
const fallbackDetectLanguage = (text, defaultLanguage) => {
  try {
    if (!text || typeof text !== "string") {
      return defaultLanguage;
    }

    // Check for Hinglish pattern
    const hinglishPattern =
      /\b(?:main|tum|kya|kese|nahi|hai|ho|ka|ke|ki|aap|yeh|woh|kuch|acha)\b/i;
    const latinRegex = /[a-zA-Z]/;

    // If default is Hindi and text contains common Hindi words in Latin script
    if (
      defaultLanguage === "hi" &&
      hinglishPattern.test(text) &&
      latinRegex.test(text)
    ) {
      return "hi";
    }

    // Simple pattern matching for basic language detection
    for (const [lang, pattern] of Object.entries(languagePatterns)) {
      if (pattern.test(text)) {
        console.log(`Fallback detected language: ${lang}`);
        return lang;
      }
    }

    // If no patterns match, return the default language
    return defaultLanguage;
  } catch (error) {
    console.error("Error in fallback language detection:", error);
    return defaultLanguage;
  }
};
