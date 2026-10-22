/**
 * Smart UPI/Payment Transaction Text Parser
 * Handles: Google Pay, PhonePe, Paytm, BHIM, Bank SMS & Screenshot OCR outputs
 */

const AMOUNT_PATTERNS = [
  // Explicit currency prefixes with optional spaces/symbols (handles OCR misreading ₹ as 7, ?, :, etc.)
  /(?:₹|rs\.?|inr|total\s*(?:amount)?|amount\s*(?:paid)?|paid|sent|debited|transferred)[\s:=-]*(?:₹|rs\.?|inr)?\s*([\d,]+\.?\d{0,2})/i,
  // Amount followed by currency or payment keywords
  /([\d,]+\.?\d{0,2})\s*(?:₹|rs\.?|inr|debited|paid|transferred|successful)/i,
  // Lone floating numbers with two decimal places (typical payment summary amount: 450.00 or 1,250.50)
  /(?:^|\s)(?:₹|rs\.?|inr)?\s*([1-9]\d{0,2}(?:,\d{3})*\.\d{2})(?:\s|$)/m,
  // Lone integers on their own line with preceding/following payment context
  /(?:paid|total|amount)\s*\n\s*(?:₹|rs\.?|inr)?\s*([\d,]+)/i,
];

const MERCHANT_PATTERNS = [
  // Paid to / Sent to / Transfer to <Merchant>
  /(?:paid to|payment to|sent to|transfer to|transferred to|paying)\s+([A-Za-z0-9\s&'.,\-/]{2,45}?)(?:\s*\n|\s*on\s|\s*via|\s*using|\s*upi|\s*ref|\s*transaction|\s*id|\s*banking|[.!]|$)/i,
  // To <Merchant> (standard GPay & PhonePe header)
  /\bto\s+([A-Za-z0-9][A-Za-z0-9\s&'.,\-/]{2,35}?)(?:\s*\n|\s*on\s|\s*via|\s*using|\s*upi|\s*ref|\s*transaction|\s*id|[.!]|$)/i,
  // At <Merchant> (e.g. Paid at Starbucks)
  /\bat\s+([A-Za-z0-9][A-Za-z0-9\s&'.,\-/]{2,35}?)(?:\s*\n|\s*on\s|\s*[.!]|$)/i,
  // For <Merchant>
  /(?:merchant|biller|receiver|payee)(?:\s*name)?\s*[:\-]\s*([A-Za-z0-9\s&'.,\-/]{2,40})/i,
];

const MONTH_MAP = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

function parseDate(text) {
  // 19 Oct 2026 or 19 October 2026 or 19-Oct-2026 or 18 Oct '26
  const longMonthMatch = text.match(/(\d{1,2})[\s\-\/]+([A-Za-z]{3,9})[\s\-\/,']+(\d{2,4})/);
  if (longMonthMatch) {
    const day = parseInt(longMonthMatch[1], 10);
    const mon = MONTH_MAP[longMonthMatch[2].toLowerCase().slice(0, 3)];
    let year = parseInt(longMonthMatch[3], 10);
    if (year < 100) year += 2000;
    if (mon !== undefined && day >= 1 && day <= 31) {
      const d = new Date(year, mon, day);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // Oct 19, 2026 or October 19 2026
  const reversedMonthMatch = text.match(/([A-Za-z]{3,9})[\s\-\/]+(\d{1,2})[,\s\-\/]+(\d{2,4})/);
  if (reversedMonthMatch) {
    const mon = MONTH_MAP[reversedMonthMatch[1].toLowerCase().slice(0, 3)];
    const day = parseInt(reversedMonthMatch[2], 10);
    let year = parseInt(reversedMonthMatch[3], 10);
    if (year < 100) year += 2000;
    if (mon !== undefined && day >= 1 && day <= 31) {
      const d = new Date(year, mon, day);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // 19/10/2026 or 19-10-2026 or 19.10.2026
  const numericDMY = text.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (numericDMY) {
    let day = parseInt(numericDMY[1], 10);
    let month = parseInt(numericDMY[2], 10) - 1;
    let year = parseInt(numericDMY[3], 10);
    if (year < 100) year += 2000;
    if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // ISO: 2026-10-19
  const isoMatch = text.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (isoMatch) {
    const d = new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10));
    if (!isNaN(d.getTime())) return d;
  }

  // Time-only like "10:30 AM" or "14:20" on receipts (defaults to today)
  if (/\b\d{1,2}:\d{2}\s*(?:am|pm)?\b/i.test(text)) {
    return new Date();
  }

  return null;
}

const CATEGORY_KEYWORDS = {
  Food: ['swiggy', 'zomato', 'domino', 'pizza', 'burger', 'kfc', 'mcdonald', 'restaurant', 'cafe', 'food', 'biryani', 'hotel', 'dine', 'eat', 'starbucks', 'dunkin', 'subway', 'blinkit', 'zepto', 'instamart', 'grocery', 'bakery', 'canteen', 'chai', 'tea', 'coffee', 'juice', 'sweets'],
  Transport: ['uber', 'ola', 'rapido', 'metro', 'irctc', 'railway', 'train', 'bus', 'auto', 'cab', 'petrol', 'fuel', 'diesel', 'fastag', 'toll', 'redbus', 'makemytrip', 'airport', 'flight', 'indigo', 'spicejet', 'hpcl', 'iocl', 'bpcl'],
  Shopping: ['amazon', 'flipkart', 'myntra', 'meesho', 'ajio', 'nykaa', 'snapdeal', 'store', 'shop', 'mart', 'mall', 'retail', 'dmart', 'big bazaar', 'zara', 'h&m', 'reliance', 'trends'],
  Bills: ['electricity', 'water bill', 'gas bill', 'wifi', 'broadband', 'recharge', 'postpaid', 'prepaid', 'airtel', 'jio recharge', 'vi recharge', 'vodafone', 'bsnl', 'insurance', 'emi', 'loan', 'rent', 'house rent', 'maintenance', 'society maintenance', 'municipal', 'property tax', 'bescom', 'tneb', 'wbseedcl', 'credit card'],
  Entertainment: ['netflix', 'hotstar', 'prime video', 'spotify', 'youtube', 'movie', 'cinema', 'pvr', 'inox', 'bookmyshow', 'concert', 'game', 'gaming', 'disney', 'zee5', 'sonyliv', 'steam', 'playstation'],
};

function detectCategory(text) {
  const lower = text.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return category;
  }
  return 'Other';
}

function cleanExtractedTitle(candidate) {
  if (!candidate) return '';
  return candidate
    .replace(/^(?:paid to|sent to|payment to|to:|to|at)\s*/i, '')
    .replace(/[,\-–|:]+$/, '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000, lakh: 100000, crore: 10000000
};

function parseRupeesInWords(text) {
  const match = text.match(/rupees?\s+([A-Za-z\s]+?)\s+(?:only|$)/i);
  if (!match || !match[1]) return 0;
  const words = match[1].toLowerCase().replace(/\band\b/g, '').split(/\s+/).filter(Boolean);
  let total = 0;
  let current = 0;
  for (const w of words) {
    if (NUMBER_WORDS[w] !== undefined) {
      const val = NUMBER_WORDS[w];
      if (val === 100) {
        current = (current || 1) * 100;
      } else if (val === 1000 || val === 100000 || val === 10000000) {
        current = (current || 1) * val;
        total += current;
        current = 0;
      } else {
        current += val;
      }
    }
  }
  total += current;
  return total > 0 ? total : 0;
}

export function parseTransactionText(text) {
  if (!text || typeof text !== 'string') {
    return { amount: 0, title: 'Shared Expense', date: new Date(), category: 'Other' };
  }

  // 1. Normalize OCR text
  let normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[ \t]+/g, ' ')
    .trim();

  // Normalize common OCR misreadings of the Rupee symbol (₹) before digits:
  // e.g. "?3,500", ":3,500", "=130", "F130"
  normalized = normalized.replace(/(?:^|\n)\s*[\?:=Ff]\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/g, '\n₹$1');

  // OCR engines (especially ML Kit) often recognize the Indian Rupee symbol '₹' as a '7':
  // Case A: Isolated '7' on its own line followed immediately by an amount line (e.g. "7\n80" -> "₹80", "7\n500" -> "₹500")
  normalized = normalized.replace(/(?:^|\n)\s*7\s*\n\s*([1-9][0-9]{0,2}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[1-9][0-9]*(?:\.[0-9]{1,2})?)(?=\s*(?:\n|$))/g, '\n₹$1');

  // Case B: In a payment context (like "PAYMENT SUCCESSFUL\n7 80" or "PAID\n780"), convert isolated 7 before amount:
  normalized = normalized.replace(/(?:success|successful|paid|amount|total)\s*\n\s*7\s+([1-9][0-9]{0,2}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[1-9][0-9]*(?:\.[0-9]{1,2})?)/gi, '₹$1');

  // Case C: Leading 7 attached to number when between payment success/paid and "To <Merchant>" or "Paid to"
  // e.g., "PAYMENT SUCCESSFUL\n780\nTo Advait..." or "Paid successfully\n7500\nPaid to..." -> ₹80 / ₹500
  normalized = normalized.replace(/(?:payment successful|paid successfully|slice|successful|paid|debited)\s*\n\s*7([1-9][0-9]{1,5}(?:\.[0-9]{1,2})?)\s*\n\s*(?:(?:paid\s+)?to\b|for\b|from\b)/gi, (match, num) => {
    return match.replace(`7${num}`, `₹${num}`);
  });

  // Case D: If an isolated '7' is sitting right before "Paid to" or "To <Merchant>" or "Paid from", remove that stray 7 (it was ₹)
  normalized = normalized.replace(/(?:^|\n)\s*7\s*\n\s*(?:paid\s+to|to\s+|paid\s+from|from\s+)/gi, '\n');

  // 2. Extract Amount
  let amount = 0;

  // Check 2A: Words like "Rupees Five Hundred Only" (very common in Paytm & GPay receipts)
  const wordsAmount = parseRupeesInWords(normalized);
  if (wordsAmount > 0) {
    amount = wordsAmount;
  }

  // Check 2B: Explicit ₹/rs/inr prefix/suffix
  if (amount === 0) {
    for (const pattern of AMOUNT_PATTERNS) {
      const match = normalized.match(pattern);
      if (match && match[1]) {
        const rawNumber = match[1].replace(/,/g, '');
        const parsed = parseFloat(rawNumber);
        if (!isNaN(parsed) && parsed > 0 && parsed < 10000000 && parsed !== 2024 && parsed !== 2025 && parsed !== 2026 && parsed !== 2027) {
          amount = parsed;
          break;
        }
      }
    }
  }

  // Check 2C: Line-by-line inspection (find lines with isolated numbers)
  if (amount === 0) {
    const lines = normalized.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check adjacent lines for context
      const prevLine = i > 0 ? lines[i - 1].trim() : '';
      const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';

      // If this line itself is just '7', do not treat 7 as the amount
      // (in Indian payment receipts, ₹ is often misread as a standalone 7)
      if (trimmed === '7') {
        continue;
      }

      const lineMatch = trimmed.match(/^(?:[₹\?:=Ff]|rs\.?|inr)?\s*([1-9][0-9]{0,2}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?|[1-9][0-9]{0,5}(?:\.[0-9]{1,2})?)$/i);
      if (lineMatch && lineMatch[1]) {
        let raw = lineMatch[1].replace(/,/g, '');

        if (raw === '7') {
          continue;
        }

        // If ML Kit mistakenly prepended '7' for '₹' (e.g. ₹80 -> 780, ₹500 -> 7500):
        const hasPaymentContext = (
          prevLine.toLowerCase().includes('slice') ||
          prevLine.toLowerCase().includes('payment') ||
          prevLine.toLowerCase().includes('successful') ||
          prevLine.toLowerCase().includes('paid') ||
          nextLine.toLowerCase().startsWith('to ') ||
          nextLine.toLowerCase().startsWith('paid to')
        );

        if (raw.length >= 2 && raw.startsWith('7') && hasPaymentContext) {
          const stripped = parseFloat(raw.slice(1));
          if (stripped > 0) {
            raw = stripped.toString();
          }
        } else if (raw.length >= 4 && raw.startsWith('7') && (raw.endsWith('00') || raw.endsWith('50'))) {
          const stripped = parseFloat(raw.slice(1));
          if (stripped > 0) {
            raw = stripped.toString();
          }
        }

        const val = parseFloat(raw);
        // Exclude calendar years (2024-2027)
        if (val > 0 && val !== 2024 && val !== 2025 && val !== 2026 && val !== 2027) {
          amount = val;
          break;
        }
      }
    }
  }

  // Check 2D: Comma format (e.g. "3,500")
  if (amount === 0) {
    const commaMatch = normalized.match(/\b([1-9]\d{0,2},\d{3}(?:\.\d{1,2})?)\b/);
    if (commaMatch && commaMatch[1]) {
      const val = parseFloat(commaMatch[1].replace(/,/g, ''));
      if (!isNaN(val) && val > 0 && val !== 2026) {
        amount = val;
      }
    }
  }

  // Sanity check: If amount starts with 7 and is a round payment like 7500, 7250, 7100, 750, 780
  // in receipts that don't have large transactions:
  if (amount > 7000 && (amount % 50 === 0 || amount % 10 === 0)) {
    const potentialAmount = amount - 7000;
    if (potentialAmount > 0 && (wordsAmount === potentialAmount || /paid\s+successfully|payment\s+successful/i.test(normalized))) {
      amount = potentialAmount;
    }
  }

  // 3. Extract Merchant / Title
  let title = '';
  const skipWords = [
    'you', 'your', 'the', 'a', 'an', 'is', 'was', 'has', 'completed', 'successful',
    'success', 'paid', 'sent', 'payment', 'money sent', 'money sent successfully',
    'transaction successful', 'paid successfully'
  ];

  for (const pattern of MERCHANT_PATTERNS) {
    const match = normalized.match(pattern);
    if (match && match[1]) {
      let candidate = match[1].trim();
      const lowerCandidate = candidate.toLowerCase();
      // If the matched name is just a 2-letter avatar abbreviation like "SP", "AB", "JD"
      // check if the line immediately following has the actual full name
      if (/^[A-Z]{2}$/.test(candidate)) {
        const fullIdx = normalized.indexOf(match[0]);
        if (fullIdx !== -1) {
          const afterMatch = normalized.slice(fullIdx + match[0].length);
          const nextLines = afterMatch.split('\n').map(l => l.trim()).filter(Boolean);
          if (nextLines.length > 0 && /^[A-Za-z\s&'.,\-/]{3,40}$/.test(nextLines[0]) && !/@|upi|rrn|ref/i.test(nextLines[0])) {
            candidate = nextLines[0];
          }
        }
      }

      if (
        candidate.length > 1 &&
        !skipWords.some((sw) => lowerCandidate === sw || lowerCandidate.startsWith(sw))
      ) {
        title = cleanExtractedTitle(candidate);
        break;
      }
    }
  }

  // If title was not found via regex, look through lines for prominent non-system labels
  if (!title) {
    const lines = normalized.split('\n').map((l) => l.trim()).filter(Boolean);
    const blacklistedLines = [
      'google pay', 'phonepe', 'paytm', 'bhim', 'upi', 'payment successful',
      'paid successfully', 'transaction successful', 'completed', 'paid',
      'share receipt', 'check balance', 'split bill', 'view details', 'done',
      'money sent', 'money sent successfully', 'transfer details', 'banking name',
      'debited from', 'powered by', 'rupees five hundred only', 'rupees',
      'slice', 'slice savings', 'paid securely on'
    ];
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (
        line.length >= 3 &&
        line.length <= 40 &&
        !blacklistedLines.some((b) => lower.includes(b)) &&
        !/^[\d\s.,₹$:+\-/]+$/.test(line) &&
        !/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(line) &&
        !lower.startsWith('+91') &&
        !lower.startsWith('upi id') &&
        !lower.startsWith('rrn')
      ) {
        title = cleanExtractedTitle(line);
        break;
      }
    }
  }

  if (!title) title = 'Shared Expense';

  // 4. Extract Date (fallback to today if no specific date is detected in receipt)
  const parsedDate = parseDate(normalized);
  const date = parsedDate || new Date();

  // 5. Detect Category
  const category = detectCategory(normalized + ' ' + title);

  return { amount, title, date, category };
}
