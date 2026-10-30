/**
 * Date parsing and formatting for temporal relation fields.
 *
 * Dates are ISO-8601 strings of decreasing precision: `YYYY-MM-DD`,
 * `YYYY-MM` or `YYYY`. A bare YAML integer (`date: 1735`) is read as a
 * year. Partial dates are for records where only the year (or month) is
 * known — they are never padded out to an invented day.
 *
 * Format tokens (matched in a single pass, so substituted text is never
 * re-scanned):
 *   `mmmm` — long month name   ("september" / "September")
 *   `mmm`  — short month name  ("sep" / "Sep")
 *   `YYYY` — 4-digit year      ("1950")
 *   `YY`   — 2-digit year      ("50")
 *   `dd`   — zero-padded day   ("09")
 *   `d`    — bare day          ("9")
 *   `mm`   — zero-padded month ("09")
 */

export type DatePrecision = 'year' | 'month' | 'day';

export interface ParsedDate {
	year: number;
	/** 1-based; present for `month` and `day` precision. */
	month?: number;
	/** Present for `day` precision. */
	day?: number;
	precision: DatePrecision;
}

const DATE_RE = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

/**
 * Parse a relation date value. Accepts `YYYY-MM-DD`, `YYYY-MM`, `YYYY`
 * or an integer year. Returns null for anything else, including
 * impossible months and days.
 */
export function parseDate(value: unknown): ParsedDate | null {
	if (typeof value === 'number') {
		if (!Number.isInteger(value) || value < 1000 || value > 9999) return null;
		return { year: value, precision: 'year' };
	}
	if (typeof value !== 'string') return null;
	const m = DATE_RE.exec(value);
	if (!m) return null;
	const year = parseInt(m[1]!, 10);
	if (m[2] === undefined) return { year, precision: 'year' };
	const month = parseInt(m[2], 10);
	if (month < 1 || month > 12) return null;
	if (m[3] === undefined) return { year, month, precision: 'month' };
	const day = parseInt(m[3], 10);
	const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
	if (day < 1 || day > daysInMonth) return null;
	return { year, month, day, precision: 'day' };
}

/** True when `value` is a date `parseDate` accepts. */
export function isValidDate(value: unknown): boolean {
	return parseDate(value) !== null;
}

/**
 * Sortable number for a date: `year * 10000 + month * 100 + day`, with
 * missing parts as 0, so a bare year sorts before any date within it.
 * Null for unparseable input.
 */
export function dateSortKey(value: unknown): number | null {
	const d = parseDate(value);
	if (!d) return null;
	return d.year * 10000 + (d.month ?? 0) * 100 + (d.day ?? 0);
}

/** The year of a date, or null when it can't be parsed. */
export function dateYear(value: unknown): number | null {
	return parseDate(value)?.year ?? null;
}

/**
 * Convert a relation date to a display string using a world-authored
 * format token pattern and the world's UI language locale.
 *
 * Partial dates drop the parts they don't have: a year-only date is the
 * bare year, a year-month date is "<month name> <year>" (long month name
 * when the format asks for `mmmm`, short otherwise).
 *
 * Falls back to the raw value (as a string) when `dateFormat` is null or
 * empty, or the value isn't a valid date.
 */
export function formatDate(
	value: string | number,
	dateFormat: string | null | undefined,
	language: string
): string {
	const raw = String(value);
	if (!dateFormat) return raw;
	const d = parseDate(value);
	if (!d) return raw;

	const yyyy = String(d.year).padStart(4, '0');
	if (d.precision === 'year') return yyyy;

	const month = d.month!;
	const monthName = (style: 'long' | 'short'): string =>
		new Intl.DateTimeFormat(language, { month: style, timeZone: 'UTC' }).format(
			new Date(Date.UTC(d.year, month - 1, 1))
		);

	if (d.precision === 'month') {
		return `${monthName(dateFormat.includes('mmmm') ? 'long' : 'short')} ${yyyy}`;
	}

	const day = d.day!;
	return dateFormat.replace(/mmmm|mmm|mm|YYYY|YY|dd|d/g, (token) => {
		switch (token) {
			case 'mmmm':
				return monthName('long');
			case 'mmm':
				return monthName('short');
			case 'mm':
				return String(month).padStart(2, '0');
			case 'YYYY':
				return yyyy;
			case 'YY':
				return yyyy.slice(2);
			case 'dd':
				return String(day).padStart(2, '0');
			default:
				return String(day);
		}
	});
}
