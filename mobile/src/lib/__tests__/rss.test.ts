import { describe, expect, it } from '@jest/globals';

import { categoryOf, excerptOf, parseFeed, scoreItem } from '../../../supabase/functions/_shared/rss';

const xml = `<rss><channel>
<item><title><![CDATA[Ferrari revela novo supercarro híbrido]]></title><link>https://ex.com/a</link>
<description><![CDATA[<p>O modelo tem <b>bateria</b> nova.</p><img src="https://ex.com/a.jpg">]]></description>
<pubDate>Sat, 10 Oct 2026 10:00:00 GMT</pubDate><category>Lançamentos</category></item>
<item><title>Preço da gasolina sobe</title><link>https://ex.com/b</link><description>Posto</description></item>
<item><title>Sem link</title></item>
</channel></rss>`;

describe('parseFeed', () => {
  it('reads title, link, summary, image and categories, skipping items without a link', () => {
    const items = parseFeed(xml);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ title: 'Ferrari revela novo supercarro híbrido', link: 'https://ex.com/a',
      summary: 'O modelo tem bateria nova.', image: 'https://ex.com/a.jpg', cats: ['Lançamentos'] });
  });
});

describe('scoreItem / categoryOf', () => {
  it('ranks premium launches above everyday news and tags tech', () => {
    const [premium, everyday] = parseFeed(xml);
    expect(scoreItem(premium!)).toBeGreaterThanOrEqual(3);
    expect(scoreItem(everyday!)).toBe(0);
    expect(categoryOf(premium!, 'Automotivo')).toBe('Tecnologia');
  });

  it('cuts long summaries', () => {
    expect(excerptOf('a'.repeat(300))).toHaveLength(281);
  });
});
