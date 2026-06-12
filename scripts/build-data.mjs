import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildSkillFinderIndex } from '../src/task/skillFinderIndex.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const SRC = path.join(rootDir, 'src');
const PUBLIC = path.join(rootDir, 'public');

function hashContent(content) {
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 8);
}

function pngIconsToWebp(value) {
    if (Array.isArray(value)) {
        value.forEach(pngIconsToWebp);
    } else if (value && typeof value === 'object') {
        for (const [key, val] of Object.entries(value)) {
            if (key === 'icon' && typeof val === 'string' && val.endsWith('.png')) {
                value[key] = val.replace(/\.png$/, '.webp');
            } else {
                pngIconsToWebp(val);
            }
        }
    }
}

async function main() {
    const [skills, characters, accessories, release_dates] = await Promise.all([
        fs.readFile(path.join(SRC, 'data', 'skills.json'), 'utf8').then(JSON.parse),
        fs.readFile(path.join(SRC, 'data', 'characters.json'), 'utf8').then(JSON.parse),
        fs.readFile(path.join(SRC, 'data', 'accessory.json'), 'utf8').then(JSON.parse),
        fs.readFile(path.join(SRC, 'data', 'release_dates.json'), 'utf8').then(JSON.parse),
    ]);

    const releaseDateItems = Array.isArray(release_dates)
        ? release_dates
        : release_dates.items || [];
    const releaseDateMap = new Map(releaseDateItems.map(item => [item.unit_id, item]));

    characters.forEach(character => {
        const releaseDate = releaseDateMap.get(character.unit_id);
        if (!releaseDate) return;
        character.release_date = releaseDate.release_date;
        character.release_date_raw = releaseDate.release_date_raw;
        character.release_order = releaseDate.release_order;
        character.obtain = releaseDate.obtain;
    });

    const skillFinderIndex = buildSkillFinderIndex({ skills, characters, accessories });

    pngIconsToWebp(characters);
    pngIconsToWebp(accessories);

    const indexContent = JSON.stringify(skillFinderIndex);
    const skillsContent = JSON.stringify(skills);
    const charactersContent = JSON.stringify(characters);
    const accessoryContent = JSON.stringify(accessories);

    const dataHash = {
        index: hashContent(indexContent),
        skills: hashContent(skillsContent),
        characters: hashContent(charactersContent),
        accessory: hashContent(accessoryContent),
    };

    await fs.mkdir(path.join(PUBLIC, 'data'), { recursive: true });

    await Promise.all([
        fs.writeFile(path.join(PUBLIC, 'data', 'index.json'), indexContent),
        fs.writeFile(path.join(PUBLIC, 'data', 'skills.json'), skillsContent),
        fs.writeFile(path.join(PUBLIC, 'data', 'characters.json'), charactersContent),
        fs.writeFile(path.join(PUBLIC, 'data', 'accessory.json'), accessoryContent),
        fs.writeFile(path.join(SRC, 'data', 'dataHash.generated.json'), JSON.stringify(dataHash)),
    ]);

    console.log('✓ public/data/ を更新しました');
}

main().catch(err => { console.error(err); process.exit(1); });
