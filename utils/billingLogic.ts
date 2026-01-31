import { BillingConfig, ItemType, BillingRow } from '../types';

/**
 * Simple BODMAS evaluator for math strings.
 * Supports basic operators: +, -, *, /
 */
/**
 * Safe BODMAS evaluator for math strings using recursive descent parser.
 * Supports basic operators: +, -, *, /, ( )
 * Replaces unsafe 'new Function' to comply with CSP.
 */
export function evaluateExpression(input: string): number {
  try {
    // Remove all whitespace
    const expr = input.replace(/\s+/g, '');
    if (!expr) return 0;

    // Tokenize: match numbers (including decimals) or operators
    const tokens = expr.match(/(\d+(\.\d+)?|[-+*/()])/g);
    if (!tokens) return 0;

    let pos = 0;

    // Grammar:
    // Expression = Term { (+|-) Term }
    // Term       = Factor { (*|/) Factor }
    // Factor     = Number | ( Expression )

    function parseExpression(): number {
      let lhs = parseTerm();
      while (pos < tokens!.length && (tokens![pos] === '+' || tokens![pos] === '-')) {
        const op = tokens![pos++];
        const rhs = parseTerm();
        if (op === '+') lhs += rhs;
        else lhs -= rhs;
      }
      return lhs;
    }

    function parseTerm(): number {
      let lhs = parseFactor();
      while (pos < tokens!.length && (tokens![pos] === '*' || tokens![pos] === '/')) {
        const op = tokens![pos++];
        const rhs = parseFactor();
        if (op === '*') lhs *= rhs;
        else if (rhs === 0) lhs = 0; // Prevent division by zero
        else lhs /= rhs;
      }
      return lhs;
    }

    function parseFactor(): number {
      if (pos >= tokens!.length) return 0;

      const token = tokens![pos];

      if (token === '(') {
        pos++; // consume '('
        const val = parseExpression();
        if (pos < tokens!.length && tokens![pos] === ')') {
          pos++; // consume ')'
        }
        return val;
      }

      // Handle negative numbers if they appear as -Number (simple unary support)
      // Note: This simple tokenizer treats '-' as an operator, so negative numbers 
      // at start of factor might need special handling if we wanted full unary support.
      // But for basic billing formulas, usually it's "10*5", not "-5*10".
      // If we need unary minus, we'd check it here. 
      // For now, assume positive numbers or parens.

      const val = parseFloat(token);
      pos++;
      return isNaN(val) ? 0 : val;
    }

    const result = parseExpression();
    return isFinite(result) ? result : 0;
  } catch (e) {
    console.warn("Math parse error", e);
    return 0;
  }
}


/**
 * Calculates the amount for a parcel based on tiered slabs.
 * New Tier Logic based on 177kg example:
 * S1: First 10kg
 * S2: Next 100kg (Total up to 110kg)
 * S3: Remainder (> 110kg)
 */
export function calculateParcelAmount(weight: number, config: BillingConfig): {
  total: number,
  breakdown: string,
  s1w: number,
  s2w: number,
  s3w: number
} {
  // Rule: any decimal, consider next rounding off number (e.g. 5.14 = 6)
  const roundedWeight = weight > 0 ? Math.ceil(weight) : 0;

  let remaining = roundedWeight;
  let total = 0;
  let s1w = 0, s2w = 0, s3w = 0;
  const components: string[] = [];

  // Slab 1: First 10kg
  s1w = Math.min(remaining, 10);
  if (s1w > 0) {
    total += s1w * config.parcelSlab1Rate;
    components.push(`${s1w}kg*${config.parcelSlab1Rate}`);
    remaining -= s1w;
  }

  if (remaining > 0) {
    // Slab 2: Next 100kg (User's new requirement based on 177kg example)
    s2w = Math.min(remaining, 100);
    total += s2w * config.parcelSlab2Rate;
    components.push(`${s2w}kg*${config.parcelSlab2Rate}`);
    remaining -= s2w;
  }

  if (remaining > 0) {
    // Slab 3: Remainder above 110kg
    s3w = remaining;
    total += s3w * config.parcelSlab3Rate;
    components.push(`${s3w}kg*${config.parcelSlab3Rate}`);
  }

  return {
    total,
    breakdown: components.join(' + ') || '₹0.00',
    s1w,
    s2w,
    s3w
  };
}

export function calculateRow(row: Omit<BillingRow, 'rate' | 'amount' | 'breakdown'> & { rate?: number, isManualRate?: boolean }, config: BillingConfig): BillingRow {
  let amount = 0;
  let rate = row.rate || 0;
  let isManualRate = row.isManualRate || false;
  let breakdown = '';

  const roundedWeight = row.weight > 0 ? Math.ceil(row.weight) : 0;

  if (row.type === ItemType.DOCUMENT) {
    if (!isManualRate) {
      rate = config.documentRate;
    }
    amount = rate;
    breakdown = `Flat: ₹${rate}`;
  } else {
    const calc = calculateParcelAmount(row.weight, config);
    if (!isManualRate) {
      rate = roundedWeight > 0 ? calc.total / roundedWeight : config.parcelSlab1Rate;
      amount = calc.total;
      breakdown = calc.breakdown;
    } else {
      amount = rate * roundedWeight;
      breakdown = `${roundedWeight}kg * ${rate} (Manual)`;
    }
  }

  return {
    ...row,
    rate,
    isManualRate,
    amount,
    breakdown
  };
}