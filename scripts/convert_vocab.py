#!/usr/bin/env python3
"""Rebuild editable CSVs from preserved Anki exports; Python standard library only."""
import csv
import hashlib
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data'

def read(pattern):
    paths = sorted((ROOT / 'data-source').glob(pattern))
    if len(paths) != 1:
        raise ValueError(f'Expected exactly one source for {pattern}: {paths}')
    path = paths[0]
    with path.open(encoding='utf-8-sig', newline='') as f:
        # Metadata precedes records; retain multiline quoted records for csv.reader.
        lines = iter(f)
        for line in lines:
            if not line.startswith('#'):
                import itertools
                rows = list(csv.reader(itertools.chain([line], lines), delimiter='\t'))
                break
        else:
            rows = []
    for number, row in enumerate(rows, 1):
        if len(row) != 4:
            raise ValueError(f'{path.name}: record {number}: expected 4 columns')
    return path.name, rows

def identifier(kind, *parts):
    return kind + '_' + hashlib.sha256('\x1f'.join(parts).encode()).hexdigest()[:16]

def write(name, rows, fields):
    with (OUT / name).open('w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)

def main():
    OUT.mkdir(exist_ok=True)
    raw, words = [], {}
    with (ROOT / 'data-source' / 'general-examples.csv').open(encoding='utf-8-sig', newline='') as f:
        examples = {(r['german'], r['english']): r['example_de'] for r in csv.DictReader(f)}
    with (ROOT / 'data-source' / 'example-translations.csv').open(encoding='utf-8-sig', newline='') as f:
        translations = {r['example_de']: r['example_en'] for r in csv.DictReader(f)}
    source_counts = {}
    for level in ('A1', 'A2'):
        name, rows = read(f'Schritte*{level}*')
        source_counts[name] = len(rows)
        for index, (deck, german, english, tags) in enumerate(rows, 1):
            raw.append(dict(source_file=name, record=index, deck=deck, front=german, back=english, tags=tags))
            # Unify only the explicit separable-prefix marks between letters.
            normalized = re.sub(r'(?<=[^\W\d_])[.🞌](?=[^\W\d_])', '', german)
            key = (normalized, english)
            if key not in words:
                noun = bool(re.match(r'^(der|die|das)\s+[A-ZÄÖÜ]', normalized))
                verb = english.startswith('to ') and not noun
                words[key] = dict(id=identifier('word', *key), german=normalized, english=english,
                    word_type='noun' if noun else 'verb' if verb else 'other',
                    classification='inferred; review if needed', levels=[], source_refs=[], example_de=examples.get(key, ''))
            entry = words[key]
            if level not in entry['levels']: entry['levels'].append(level)
            entry['source_refs'].append(f'{name}:{index}')
    for entry in words.values():
        entry['example_en'] = translations.get(entry['example_de'], '')
        entry['levels'] = '; '.join(entry['levels'])
        entry['source_refs'] = '; '.join(entry['source_refs'])
    write('vocabulary.csv', words.values(), ['id','german','english','word_type','classification','levels','source_refs','example_de','example_en'])

    name, rows = read('Verbs-*')
    source_counts[name] = len(rows)
    verbs = {}
    for index, (deck, front, back, tags) in enumerate(rows, 1):
        raw.append(dict(source_file=name, record=index, deck=deck, front=front, back=back, tags=tags))
        if deck.endswith('English to Infinitiv'):
            match = re.fullmatch(r'(.+?)  Beispiel: (.*?)  Gebrauch: (.*)', back)
            if not match: raise ValueError(f'Unknown verb format: {back}')
            infinitive, example, usage = match.groups()
            english = front.removesuffix('  Wie heißt das Verb auf Deutsch?')
            fields = dict(english=english, example_de=example, usage=usage)
        else:
            infinitive = front
            match = re.fullmatch(r'(Perfekt|Präteritum|Präsens): (.*?)  English: (.*?) Gebrauch: (.*)', back)
            if not match: raise ValueError(f'Unknown conjugation format: {back}')
            tense, form, english, usage = match.groups()
            fields = {dict(Perfekt='perfekt', Präteritum='praeteritum', Präsens='praesens')[tense]:form, 'english':english, 'usage':usage}
        entry = verbs.setdefault((infinitive, english), dict(id=identifier('verb', infinitive, english), infinitive=infinitive,
            english='', praesens='', praeteritum='', perfekt='', example_de='', usage='', source_refs=[]))
        for field, value in fields.items():
            if entry[field] and entry[field] != value:
                if field not in ('english', 'usage'): raise ValueError(f'Conflicting {field}: {infinitive}')
                if value not in entry[field].split(' | '): entry[field] += ' | ' + value
            else:
                entry[field] = value
        entry['source_refs'].append(f'{name}:{index}')
    for entry in verbs.values():
        entry['source_refs'] = '; '.join(entry['source_refs'])
        entry['example_en'] = translations.get(entry['example_de'], '')
    write('irregular_verbs.csv', verbs.values(), ['id','infinitive','english','praesens','praeteritum','perfekt','example_de','example_en','usage','source_refs'])

    name, rows = read('Preposition-*')
    source_counts[name] = len(rows)
    preps = []
    reviewed_preps = json.loads((ROOT / 'scripts/mappings/preposition-meanings.json').read_text(encoding='utf-8'))
    for index, (deck, front, back, tags) in enumerate(rows, 1):
        raw.append(dict(source_file=name, record=index, deck=deck, front=front, back=back, tags=tags))
        match = re.fullmatch(r'(.+) (\S+) \(\+([ADG])\) — (.+)', back)
        if not match: raise ValueError(f'Unknown preposition format: {back}')
        verb, prep, case, meaning_example = match.groups()
        # No structural separator exists between meaning and answer sentence.
        # Preserve the combined field verbatim rather than guessing its boundary.
        example = reviewed_preps.get(identifier('prep', front, back).removeprefix('prep_'), {}).get('example', '')
        preps.append(dict(id=identifier('prep',front,back), verb=verb, preposition=prep,
            case={'A':'Akkusativ','D':'Dativ','G':'Genitiv'}[case], prompt=front,
            meaning_and_example=meaning_example, example_de=example, example_en=translations.get(example, ''), source_ref=f'{name}:{index}'))
    write('prepositions.csv', preps, ['id','verb','preposition','case','prompt','meaning_and_example','example_de','example_en','source_ref'])
    write('source_records.csv', raw, ['source_file','record','deck','front','back','tags'])
    report = dict(source_records=source_counts, vocabulary_entries=len(words),
        vocabulary_rows_merged=sum(v for k,v in source_counts.items() if k.startswith('Schritte'))-len(words),
        vocabulary_types=dict(Counter(e['word_type'] for e in words.values())),
        irregular_verbs=len(verbs), prepositions=len(preps), preserved_source_records=len(raw))
    (OUT / 'import_summary.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__ == '__main__': main()
