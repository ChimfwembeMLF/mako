import {
  accountDefaults,
  appendDefaultHashtags,
  normalizeHashtags,
} from './account-defaults';

describe('account defaults', () => {
  it('tidies hashtags however they were typed', () => {
    expect(normalizeHashtags('coffee, #Lusaka  ##roast coffee')).toEqual([
      '#coffee',
      '#Lusaka',
      '#roast',
    ]);
    expect(normalizeHashtags('')).toEqual([]);
  });

  it('adds only the hashtags the post does not already have', () => {
    expect(
      appendDefaultHashtags(
        'Fresh roast today #Coffee',
        '#coffee #lusaka',
        'facebook',
      ),
    ).toBe('Fresh roast today #Coffee\n\n#lusaka');
    expect(
      appendDefaultHashtags('Already tagged #lusaka', '#lusaka', 'facebook'),
    ).toBe('Already tagged #lusaka');
  });

  it('keeps X posts within 280 characters', () => {
    const long = 'x'.repeat(265);
    const out = appendDefaultHashtags(
      long,
      '#coffee #lusakaroasters',
      'twitter',
    );
    expect(out.length).toBeLessThanOrEqual(280);
    expect(out).toBe(`${long}\n\n#coffee`);
  });

  it('reads saved defaults defensively', () => {
    expect(
      accountDefaults({
        metadata: { defaults: { hashtags: '#a', firstComment: 'Hi' } },
      }),
    ).toEqual({ hashtags: '#a', firstComment: 'Hi' });
    expect(accountDefaults({ metadata: { defaults: 'nope' } })).toEqual({});
    expect(accountDefaults(null)).toEqual({});
  });
});
