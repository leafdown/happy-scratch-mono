const {dedupeAssets} = require('../src/api/scratch-api.js');

describe('dedupeAssets', () => {
    it('keeps the first entry for a repeated asset id', () => {
        const first = {id: 'a', name: 'first'};
        const duplicate = {id: 'a', name: 'again'};
        const second = {id: 'b', name: 'second'};

        expect(dedupeAssets([first, duplicate, second])).toEqual([first, second]);
    });

    it('uses assetId when present', () => {
        const first = {assetId: 'abc', name: 'costume'};
        const duplicate = {assetId: 'abc', name: 'costume copy'};
        expect(dedupeAssets([first, duplicate])).toEqual([first]);
    });

    it('falls back to name + md5ext for assets without ids', () => {
        const first = {name: 'cat', md5ext: 'abc.svg'};
        const duplicate = {name: 'cat', md5ext: 'abc.svg'};
        const different = {name: 'cat', md5ext: 'def.svg'};

        expect(dedupeAssets([first, duplicate, different])).toEqual([first, different]);
    });

    it('preserves order and keeps entries without identity keys', () => {
        const items = [{name: 'a', md5ext: '1.png'}, {}, {name: 'b', md5ext: '2.png'}, {}];
        const result = dedupeAssets(items);
        expect(result).toHaveLength(3);
        expect(result[0]).toBe(items[0]);
        expect(result[1]).toBe(items[1]);
        expect(result[2]).toBe(items[2]);
    });

    it('handles an empty list', () => {
        expect(dedupeAssets([])).toEqual([]);
    });
});
