import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('research',Path(__file__).with_name('apply-research.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class ResearchValidation(unittest.TestCase):
 def test_project_cannot_escape_root(self):
  for ident in ['../outside','C:/outside','a/b','a\\b']:
   with self.assertRaises(ValueError):m.folder_for(ident)
 def test_invalid_assets_never_download(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);folder=root/'Video-test';folder.mkdir()
   base=dict(name='asset',url='https://example.com/a.png',source='https://example.com',license='test',checked='2026-09-18')
   assets=[dict(base,name='../escape'),dict(base,checked='not-a-date')]
   missing=dict(base);del missing['checked'];assets.append(missing)
   (folder/'research.json').write_text(json.dumps({'assets':assets}),encoding='utf-8')
   with patch.object(m,'PROJECTS',root),patch.object(m.urllib.request,'urlopen') as download:
    m.fetch('Video-test');download.assert_not_called()
   self.assertEqual(json.loads((folder/'assets.json').read_text()),[])
if __name__=='__main__':unittest.main()
