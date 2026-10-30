import { describe, it, expect } from 'vitest';
import { parseDate, isValidDate, dateSortKey, dateYear, formatDate } from './dates.js';

describe('parseDate', () => {
	it('parses full, month and year precision', () => {
		expect(parseDate('1735-08-14')).toEqual({ year: 1735, month: 8, day: 14, precision: 'day' });
		expect(parseDate('1735-08')).toEqual({ year: 1735, month: 8, precision: 'month' });
		expect(parseDate('1735')).toEqual({ year: 1735, precision: 'year' });
	});

	it('reads an integer as a year', () => {
		expect(parseDate(1735)).toEqual({ year: 1735, precision: 'year' });
	});

	it('rejects malformed and impossible dates', () => {
		for (const bad of [
			'',
			'abc',
			'1735-13',
			'1735-00-01',
			'1735-02-30',
			'1735-8-1',
			173,
			17.5,
			null,
			undefined
		]) {
			expect(parseDate(bad), String(bad)).toBeNull();
		}
		expect(isValidDate('2024-02-29')).toBe(true);
		expect(isValidDate('2023-02-29')).toBe(false);
	});
});

describe('dateSortKey / dateYear', () => {
	it('orders by precision-aware key', () => {
		const keys = ['1735-08-14', '1735', '1735-08', '1734-12-31'].map((d) => dateSortKey(d)!);
		const sorted = [...keys].sort((a, b) => a - b);
		expect(sorted).toEqual([17341231, 17350000, 17350800, 17350814]);
	});

	it('extracts the year', () => {
		expect(dateYear('1735-08')).toBe(1735);
		expect(dateYear(1735)).toBe(1735);
		expect(dateYear('nope')).toBeNull();
	});
});

describe('formatDate', () => {
	it('formats a full date with the world pattern', () => {
		expect(formatDate('1735-08-14', 'd mmm YYYY', 'nl')).toMatch(/^14 aug\.? 1735$/);
		expect(formatDate('1735-08-04', 'dd-mm-YYYY', 'nl')).toBe('04-08-1735');
	});

	it('does not re-scan substituted month names for tokens', () => {
		// "dec" contains a `d` that must not be treated as the day token.
		expect(formatDate('1735-12-05', 'd mmm YYYY', 'en')).toBe('5 Dec 1735');
		expect(formatDate('1735-12-05', 'd mmmm YYYY', 'en')).toBe('5 December 1735');
	});

	it('renders partial dates without inventing parts', () => {
		expect(formatDate('1735', 'd mmm YYYY', 'nl')).toBe('1735');
		expect(formatDate(1735, 'd mmm YYYY', 'nl')).toBe('1735');
		expect(formatDate('1735-12', 'd mmmm YYYY', 'en')).toBe('December 1735');
		expect(formatDate('1735-12', 'd mmm YYYY', 'en')).toBe('Dec 1735');
	});

	it('falls back to the raw value', () => {
		expect(formatDate('1735-08-14', null, 'en')).toBe('1735-08-14');
		expect(formatDate('garbage', 'd mmm YYYY', 'en')).toBe('garbage');
	});
});
