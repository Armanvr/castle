import chapter1 from '../../stormwreck-json/chapters/chapter-01.json' with { type: 'json' }
import chapter2 from '../../stormwreck-json/chapters/chapter-02.json' with { type: 'json' }
import chapter3 from '../../stormwreck-json/chapters/chapter-03.json' with { type: 'json' }
import chapter4 from '../../stormwreck-json/chapters/chapter-04.json' with { type: 'json' }
import npcs from '../../stormwreck-json/characters.json' with { type: 'json' }
import encounters from '../../stormwreck-json/encounters.json' with { type: 'json' }
import introduction from '../../stormwreck-json/introduction.json' with { type: 'json' }
import items from '../../stormwreck-json/items.json' with { type: 'json' }
import locations from '../../stormwreck-json/locations.json' with { type: 'json' }
import manifest from '../../stormwreck-json/manifest.json' with { type: 'json' }
import monsters from '../../stormwreck-json/monster-catalog.json' with { type: 'json' }
import report from '../../stormwreck-json/validation-report.json' with { type: 'json' }
export const stormwreckData = {
	manifest,
	chapters: [chapter1, chapter2, chapter3, chapter4],
	npcs,
	locations,
	encounters,
	monsters,
	items,
	introduction,
	report,
}
