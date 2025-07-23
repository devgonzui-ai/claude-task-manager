import * as fs from 'fs-extra';
import * as path from 'path';

export type Language = 'en' | 'ja';

interface Messages {
  [key: string]: any;
}

export class I18n {
  private static instance: I18n;
  private messages: Messages = {};
  private currentLang: Language = 'en';
  private localesDir: string;
  private initialized: boolean = false;

  private constructor() {
    // In production, locales are in src/locales relative to package root
    // In development, they are in src/locales relative to src
    const isProd = __dirname.includes('dist');
    this.localesDir = isProd 
      ? path.join(__dirname, '../../src/locales')
      : path.join(__dirname, '../locales');
  }

  static getInstance(): I18n {
    if (!I18n.instance) {
      I18n.instance = new I18n();
    }
    return I18n.instance;
  }

  async init(lang?: Language): Promise<void> {
    if (lang) {
      this.currentLang = lang;
    }
    await this.loadMessages();
    this.initialized = true;
  }

  private async loadMessages(): Promise<void> {
    const filePath = path.join(this.localesDir, `${this.currentLang}.json`);
    try {
      this.messages = await fs.readJson(filePath);
    } catch (error) {
      // Fallback to English if language file not found
      if (this.currentLang !== 'en') {
        this.currentLang = 'en';
        await this.loadMessages();
      } else {
        throw new Error(`Failed to load language file: ${filePath}`);
      }
    }
  }

  setLanguage(lang: Language): void {
    this.currentLang = lang;
    this.loadMessages();
  }

  getLanguage(): Language {
    return this.currentLang;
  }

  t(key: string, params?: Record<string, any>): string {
    const keys = key.split('.');
    let value: any = this.messages;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key; // Return key if translation not found
      }
    }

    if (typeof value !== 'string') {
      return key;
    }

    // Replace parameters
    if (params) {
      Object.entries(params).forEach(([paramKey, paramValue]) => {
        value = value.replace(new RegExp(`{{${paramKey}}}`, 'g'), String(paramValue));
      });
    }

    return value;
  }

  // Get all messages for a specific namespace
  getNamespace(namespace: string): any {
    const keys = namespace.split('.');
    let value: any = this.messages;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return {};
      }
    }

    return value;
  }

  // Format priority labels based on language
  formatPriority(priority: string): string {
    if (this.currentLang === 'ja') {
      const priorityMap: Record<string, string> = {
        'high': '高',
        'medium': '中',
        'low': '低'
      };
      return priorityMap[priority] || priority;
    }
    return priority;
  }

  // Get available languages
  async getAvailableLanguages(): Promise<Language[]> {
    try {
      const files = await fs.readdir(this.localesDir);
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', '') as Language);
    } catch {
      return ['en'];
    }
  }

  // Check if i18n is initialized
  isInitialized(): boolean {
    return this.initialized;
  }
}