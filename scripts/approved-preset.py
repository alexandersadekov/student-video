"""Restore a reviewed edit only when the source fingerprint is identical."""
import datetime
import hashlib
import json
from pathlib import Path
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
        root_file = root / 'src/Root.tsx'
        root_source = root_file.read_text(encoding='utf-8-sig')
        marker = '{/* IMPORTED_COMPOSITIONS */}'
        if marker not in root_source:
            raise RuntimeError('Root import marker missing')
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
        alias = 'Imported' + ident.replace('-', '')
        composition = f'<Composition id="{ident}" component={{{alias}}} durationInFrames={{{preset["duration"]}}} fps={{{preset["fps"]}}} width={{1080}} height={{1920}} defaultProps={{{{showGuides:true,fullScreenExplanation:false,lightTheme:false,colorGrade:true}}}}/>'
        cfg = json.loads((root / 'editing-profile.json').read_text(encoding='utf-8-sig'))
        for key in ('fullScreenExplanation', 'lightTheme', 'colorGrade'):
            default = 'true' if key == 'colorGrade' else 'false'
            composition = composition.replace(key + ':' + default, key + ':' + str(cfg.get(key, key == 'colorGrade')).lower())
        root_source = f'import {{ImportedVideo as {alias}}} from "./generated/{ident}";\n' + root_source.replace(marker, composition + '\n' + marker)
        root_file.write_text(root_source, encoding='utf-8')
        registry = generated / 'registry.json'
        entries = json.loads(registry.read_text()) if registry.exists() else []
        entries.append({'id':ident,'duration':preset['duration'],'fps':preset['fps']})
        registry.write_text(json.dumps(entries, indent=2), encoding='utf-8')
        (folder / 'review.json').write_text(json.dumps({'composition':ident,'mode':'reviewed-preset','source':str(source),'sourceSha256':digest,'sourceStartFrame':17,'splitFrame':119,'note':'Exact reviewed source. No retranscription or retiming applied.'},indent=2),encoding='utf-8')
        subprocess.run([shutil.which('node') or 'node', str(root/'node_modules/prettier/bin/prettier.cjs'), '--write',str(root_file),str(generated/f'{ident}.tsx'),str(generated/f'{ident}.captions.tsx')],check=True,capture_output=True)
        print(f'READY (reviewed preset): {ident}\nhttp://localhost:3000/{ident}',flush=True)
        return True
    return False
