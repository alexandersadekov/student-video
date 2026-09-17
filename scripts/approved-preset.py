"""Restore a reviewed edit only when the source fingerprint is identical."""
import datetime
import hashlib
import json
from pathlib import Path
from registry import add_entry
import shutil
import subprocess
import uuid


def try_restore(root, source):
    digest = hashlib.file_digest(source.open('rb'), 'sha256').hexdigest()
    for manifest in (root / 'presets').glob('*/preset.json'):
        preset = json.loads(manifest.read_text(encoding='utf-8'))
        if digest != preset['sourceSha256']:
            continue
        ident = 'Video-' + datetime.datetime.now().strftime('%Y%m%d-%H%M%S') + '-' + uuid.uuid4().hex[:4]
        folder = root / 'public/projects' / ident
        generated = root / 'src/generated'
        folder.mkdir(parents=True)
        template = (manifest.parent / 'Composition.template').read_text(encoding='utf-8').replace('__ID__', ident)
        for filename in preset['media']:
            shutil.copy2(manifest.parent / filename, folder / filename)
            template = template.replace(f'staticFile("{filename}")', f'staticFile("projects/{ident}/{filename}")')
        (generated / f'{ident}.tsx').write_text(template, encoding='utf-8')
        shutil.copy2(manifest.parent / 'Captions.template', generated / f'{ident}.captions.tsx')
        research_template = (manifest.parent / 'RESEARCH_REQUEST.template').read_text(encoding='utf-8')
        (folder / 'RESEARCH_REQUEST.md').write_text(research_template.replace('__ID__', ident), encoding='utf-8')
        shutil.copy2(manifest.parent / 'SOURCES.template', folder / 'SOURCES.md')
        cfg = json.loads((root / 'editing-profile.json').read_text(encoding='utf-8-sig'))
        registry_file = add_entry(root, ident, preset['duration'], preset['fps'], cfg)
        (folder / 'review.json').write_text(json.dumps({'composition':ident,'mode':'reviewed-preset','source':str(source),'sourceSha256':digest,'sourceStartFrame':17,'splitFrame':119,'note':'Exact reviewed source. No retranscription or retiming applied.'},indent=2),encoding='utf-8')
        subprocess.run([shutil.which('node') or 'node', str(root/'node_modules/prettier/bin/prettier.cjs'), '--write',str(registry_file),str(generated/f'{ident}.tsx'),str(generated/f'{ident}.captions.tsx')],check=True,capture_output=True)
        print(f'READY (reviewed preset): {ident}\nhttp://localhost:3000/{ident}',flush=True)
        return True
    return False
