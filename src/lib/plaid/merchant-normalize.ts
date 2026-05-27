// Aggregator merchant normalizer.
//
// Many bank transactions flow through a delivery/aggregator channel before
// reaching the actual store. This module extracts the *destination* merchant
// from the raw Plaid transaction name so charts and reconciliation can
// pivot between "spending via Instacart" (channel) and "spending at Costco"
// (destination).
//
// Returns null when the name doesn't match any known aggregator — callers
// should fall back to merchant_name or the raw name.
//
// All patterns are matched case-insensitively against the upper-cased name.

export type MerchantNormResult = {
  /** The delivery channel (e.g. "Instacart", "DoorDash"). */
  channel: string;
  /** The effective destination store (e.g. "Costco", "Chipotle"). */
  destination: string;
};

// ---------------------------------------------------------------------------
// Store name corrections — maps normalized tokens → display name.
// Add entries here for stores whose title-cased spelling is wrong.
// ---------------------------------------------------------------------------
const STORE_CORRECTIONS: Record<string, string> = {
  "trader joes": "Trader Joe's",
  "trader joe": "Trader Joe's",
  "wholefds": "Whole Foods",
  "whole foods": "Whole Foods",
  "wholefoods": "Whole Foods",
  "bjs": "BJ's",
  "bjs wholesale": "BJ's Wholesale",
  "costco": "Costco",
  "costco whse": "Costco",
  "aldi": "Aldi",
  "target": "Target",
  "walmart": "Walmart",
  "wmt": "Walmart",
  "walgreens": "Walgreens",
  "cvs": "CVS",
  "cvs pharmacy": "CVS",
  "kroger": "Kroger",
  "safeway": "Safeway",
  "sprouts": "Sprouts",
  "hmart": "H Mart",
  "stop shop": "Stop & Shop",
  "stop and shop": "Stop & Shop",
  "starbucks": "Starbucks",
  "sbux": "Starbucks",
  "mcdonalds": "McDonald's",
  "mcdonald": "McDonald's",
  "chipotle": "Chipotle",
  "chipotle mxcn grll": "Chipotle",
  "dunkin": "Dunkin'",
  "dunkin donuts": "Dunkin'",
  "shake shack": "Shake Shack",
  "panera": "Panera Bread",
  "panera bread": "Panera Bread",
  "sweetgreen": "Sweetgreen",
  "dominos": "Domino's",
  "pizza hut": "Pizza Hut",
};

/** Normalize a raw extracted name to a display-friendly store name. */
function normalizeStoreName(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  const lower = trimmed.toLowerCase();

  // Check corrections map (exact and prefix match).
  if (STORE_CORRECTIONS[lower]) return STORE_CORRECTIONS[lower];

  // Prefix match for stores with trailing location noise (e.g. "COSTCO #412").
  for (const [key, val] of Object.entries(STORE_CORRECTIONS)) {
    if (lower.startsWith(key)) return val;
  }

  // Fall back to title case.
  return trimmed
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Strip numeric noise appended to store names (order IDs, store #s). */
function stripNoise(s: string): string {
  return s
    .replace(/#\s*\d+/g, "") // #412, # 2341
    .replace(/\d{5,}/g, "") // long order numbers
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Aggregator patterns
// ---------------------------------------------------------------------------

type AggregatorPattern = {
  channel: string;
  /** Regex tested against the upper-cased transaction name. */
  regex: RegExp;
  /**
   * If true, attempt to extract a sub-merchant name from the capture group.
   * If false (or no capture group matches), destination = channel.
   */
  extractDestination: boolean;
};

const AGGREGATORS: AggregatorPattern[] = [
  // Instacart — several naming variants
  {
    channel: "Instacart",
    regex: /^IC\*\s*(.+)/,
    extractDestination: true,
  },
  {
    channel: "Instacart",
    regex: /^INSTACART[* ]+(.+)/,
    extractDestination: true,
  },
  // DoorDash
  {
    channel: "DoorDash",
    regex: /^DOORDASH[* ]+(?:DD\s*[*]?\s*)?(.+)/,
    extractDestination: true,
  },
  {
    channel: "DoorDash",
    regex: /^DD\s+DOORDASH[* ]+(.+)/,
    extractDestination: true,
  },
  {
    channel: "DoorDash",
    regex: /^DD\s*\*(.+)/,
    extractDestination: true,
  },
  // Uber Eats — Plaid usually gives "UBER* EATS" with no sub-merchant
  {
    channel: "Uber Eats",
    regex: /^UBER[* ]+EATS(?:[* ]+(.+))?/,
    extractDestination: true,
  },
  {
    channel: "Uber Eats",
    regex: /^UBEREATS[* ]+(.+)/,
    extractDestination: true,
  },
  // GrubHub
  {
    channel: "GrubHub",
    regex: /^GRUBHUB[* ]+(.+)/,
    extractDestination: true,
  },
  // Gopuff — no sub-merchant extraction possible
  {
    channel: "Gopuff",
    regex: /^GOPUFF[* ]/,
    extractDestination: false,
  },
  // Postmates
  {
    channel: "Postmates",
    regex: /^POSTMATES[* ]+(.+)/,
    extractDestination: true,
  },
  // Amazon — order ID after * is not the store name
  {
    channel: "Amazon",
    regex: /^AMAZON\.COM\*/,
    extractDestination: false,
  },
  {
    channel: "Amazon",
    regex: /^AMZN MKTP/,
    extractDestination: false,
  },
  {
    channel: "Amazon",
    regex: /^AMAZON PRIME\*/,
    extractDestination: false,
  },
  // Caviar (acquired by DoorDash but still shows up)
  {
    channel: "Caviar",
    regex: /^CAVIAR[* ]+(.+)/,
    extractDestination: true,
  },
  // Seamless
  {
    channel: "Seamless",
    regex: /^SEAMLESS[* ]+(.+)/,
    extractDestination: true,
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Given a raw Plaid transaction name, returns the channel + effective
 * destination merchant if the name matches a known aggregator pattern.
 *
 * Returns null for non-aggregator transactions (callers fall back to
 * merchant_name or the raw name).
 */
export function normalizeEffectiveMerchant(
  name: string,
): MerchantNormResult | null {
  const upper = name.toUpperCase().trim();

  for (const agg of AGGREGATORS) {
    const match = upper.match(agg.regex);
    if (!match) continue;

    if (agg.extractDestination && match[1]) {
      const raw = stripNoise(match[1]);
      if (raw.length >= 2) {
        return {
          channel: agg.channel,
          destination: normalizeStoreName(raw),
        };
      }
    }

    // No sub-merchant extractable — destination = channel.
    return { channel: agg.channel, destination: agg.channel };
  }

  return null;
}
