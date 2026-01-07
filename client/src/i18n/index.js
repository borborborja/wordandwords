import en from './en.json';
import ca from './ca.json';
import es from './es.json';

const translations = { en, ca, es };

export function useTranslation(language = 'en') {
    const t = (key, params = {}) => {
        const keys = key.split('.');
        let value = translations[language];

        for (const k of keys) {
            value = value?.[k];
        }

        if (typeof value !== 'string') {
            // Fallback to English
            value = translations.en;
            for (const k of keys) {
                value = value?.[k];
            }
        }

        if (typeof value !== 'string') {
            return key;
        }

        // Replace {{param}} placeholders
        return value.replace(/\{\{(\w+)\}\}/g, (_, param) => params[param] ?? `{{${param}}}`);
    };

    return { t };
}

export const LANGUAGES = [
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'ca', name: 'Català', flag: 'custom:cat' },
    { code: 'en', name: 'English', flag: '🇬🇧' }
];
