/**
 * Utility to extract clean human names and polite conversational greetings from raw phonebook/CRM contact names.
 * Handles CRM suffixes (e.g. "sumit sir csl" -> "Sumit Sir" / "Sumit"), honorifics, company acronyms, brackets, and raw phone numbers.
 */

export interface CleanContactNameResult {
  rawName: string;
  cleanFullName: string;
  greetingName: string;
  honorific?: string;
}

const COMMON_CRM_NOISE_WORDS = new Set([
  'csl', 'pvt', 'ltd', 'limited', 'private', 'llp', 'inc', 'corp', 'co', 'group',
  'client', 'lead', 'leads', 'hot', 'cold', 'warm', 'new', 'old', 'deal', 'deal1', 'deal2',
  'customer', 'buyer', 'seller', 'vendor', 'partner', 'wa', 'whatsapp', 'fb', 'facebook',
  'ig', 'insta', 'google', 'ad', 'ads', 'campaign', 'delhi', 'mumbai', 'bangalore', 'pune',
  'noida', 'gurgaon', 'kolkata', 'chennai', 'hyderabad', 'ahmedabad', 'india', 'dubai', 'usa',
  'test', 'sample', 'demo', 'inquiry', 'enquiry', 'user', 'contact'
]);

const HONORIFICS = new Set([
  'sir', 'madam', 'maam', 'ji', 'dr', 'dr.', 'mr', 'mr.', 'mrs', 'mrs.', 'ms', 'ms.', 'prof', 'prof.'
]);

export function extractCleanContactName(rawInput?: string | null): CleanContactNameResult {
  if (!rawInput || typeof rawInput !== 'string') {
    return {
      rawName: '',
      cleanFullName: 'there',
      greetingName: 'there',
    };
  }

  const raw = rawInput.trim();

  // 1. If it's a phone number or whatsapp id (e.g. 919876543210 or 919876543210@c.us)
  const isPhoneNumber = /^(\+?\d{8,15}(@c\.us|@s\.whatsapp\.net)?)$/i.test(raw) || /^\+?\d[\d\s\-()]{7,}\d$/.test(raw);
  if (isPhoneNumber) {
    return {
      rawName: raw,
      cleanFullName: 'there',
      greetingName: 'there',
    };
  }

  // 2. Remove text within parentheses or brackets: "Rahul (Hot Lead)" -> "Rahul"
  let cleaned = raw.replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ').replace(/\{[^}]*\}/g, ' ');

  // 3. Remove text after common separators: "Rahul - CSL Pvt Ltd" -> "Rahul"
  const separatorMatch = cleaned.split(/[-|/\\:~_]/)[0];
  if (separatorMatch && separatorMatch.trim().length > 1) {
    cleaned = separatorMatch;
  }

  // 4. Strip numbers / phone suffixes attached to names: "Rahul 9876543210" -> "Rahul"
  cleaned = cleaned.replace(/\b\d{4,}\b/g, ' ');

  // 5. Tokenize words and filter out CRM tags / noise
  const tokens = cleaned
    .split(/\s+/)
    .map(t => t.replace(/[^a-zA-Z.]/g, '').trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return {
      rawName: raw,
      cleanFullName: 'there',
      greetingName: 'there',
    };
  }

  // Process tokens
  const nameTokens: string[] = [];
  let foundHonorific: string | undefined = undefined;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const lower = token.toLowerCase();

    // Check if it's a recognized honorific (sir, ji, dr, etc.)
    if (HONORIFICS.has(lower)) {
      foundHonorific = capitalize(token);
      continue;
    }

    // Check if it's a CRM noise word at the end of the name (e.g. "csl", "client")
    if (COMMON_CRM_NOISE_WORDS.has(lower)) {
      continue;
    }

    nameTokens.push(capitalize(token));
  }

  if (nameTokens.length === 0) {
    // If the only token was an honorific like "Sir"
    if (foundHonorific) {
      return {
        rawName: raw,
        cleanFullName: foundHonorific,
        greetingName: foundHonorific,
        honorific: foundHonorific,
      };
    }
    return {
      rawName: raw,
      cleanFullName: 'there',
      greetingName: 'there',
    };
  }

  const firstName = nameTokens[0];
  const cleanFullName = nameTokens.join(' ');

  // Greeting name: If honorific exists like "Sir" or "Ji", create "Sumit Sir" or "Vikas Ji"
  // For prefix honorifics like "Dr.", "Dr. Amit"
  let greetingName = firstName;

  if (foundHonorific) {
    const lowerHon = foundHonorific.toLowerCase();
    if (lowerHon === 'sir' || lowerHon === 'madam' || lowerHon === 'maam' || lowerHon === 'ji') {
      greetingName = `${firstName} ${foundHonorific}`;
    } else {
      // Prefix honorifics like Dr. or Mr.
      greetingName = `${foundHonorific} ${firstName}`;
    }
  }

  return {
    rawName: raw,
    cleanFullName: foundHonorific ? `${cleanFullName} (${foundHonorific})` : cleanFullName,
    greetingName,
    honorific: foundHonorific,
  };
}

function capitalize(str: string): string {
  if (!str) return '';
  if (str.length <= 2 && str.toUpperCase() === str) return str; // acronyms like MD or DR
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
