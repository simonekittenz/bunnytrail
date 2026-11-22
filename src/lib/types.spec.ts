import { describe, expect, it } from 'vitest';
import { folderLabels, naiveSingular } from './types';

describe('naiveSingular', () => {
	it.each([
		['Star Systems', 'Star System'],
		['Cities', 'City'],
		['Planets', 'Planet'],
		['Places', 'Place'],
		['Boundaries', 'Boundary'],
		['Class', 'Class']
	])('%s → %s', (plural, singular) => {
		expect(naiveSingular(plural)).toBe(singular);
	});

	it('singularizes the head noun before a preposition', () => {
		expect(naiveSingular('Realms of Mundus')).toBe('Realm of Mundus');
		expect(naiveSingular('Characters of Aurethia')).toBe('Character of Aurethia');
		expect(naiveSingular('Books in the Library')).toBe('Book in the Library');
	});

	it('leaves -us and -is endings alone', () => {
		expect(naiveSingular('Mundus')).toBe('Mundus');
		expect(naiveSingular('Axis')).toBe('Axis');
		expect(naiveSingular('Campus')).toBe('Campus');
	});
});

describe('folderLabels', () => {
	it('derives the singular from a title with a trailing proper noun', () => {
		expect(folderLabels('realms', 'Realms of Mundus')).toEqual({
			plural: 'Realms of Mundus',
			singular: 'Realm of Mundus'
		});
	});
});
