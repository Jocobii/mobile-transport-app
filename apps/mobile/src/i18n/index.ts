import { getLocales } from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import es from "./locales/es.json";

const FALLBACK_LANGUAGE = "es";

i18n.use(initReactI18next).init({
  resources: { es: { translation: es } },
  lng: getLocales()[0]?.languageCode ?? FALLBACK_LANGUAGE,
  fallbackLng: FALLBACK_LANGUAGE,
  interpolation: { escapeValue: false },
  initAsync: false,
});

export { i18n };
