import importlib.util, pathlib, unittest
spec=importlib.util.spec_from_file_location('importer',pathlib.Path(__file__).with_name('import-video.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Cuts(unittest.TestCase):
 def setUp(self): self.cfg={'openingPaddingSeconds':.08,'paddingSeconds':.2,'minimumKeepSeconds':.3}
 def test_quiet_word_is_protected(self):
  words=[{'start':1,'end':2},{'start':3,'end':3.1},{'start':5,'end':6}]
  result=m.plan_cuts(8,words,[[2,5]],self.cfg)
  for w in words:self.assertTrue(any(a<=w['start'] and b>=w['end'] for a,b in result))
 def test_real_gap_is_cut(self):
  result=m.plan_cuts(8,[{'start':1,'end':2},{'start':5,'end':6}],[[2,5]],self.cfg)
  self.assertEqual(len(result),2);self.assertAlmostEqual(result[0][1],2.2);self.assertAlmostEqual(result[1][0],4.8)
 def test_short_silence_not_cut_by_padding(self):
  result=m.plan_cuts(5,[{'start':1,'end':2},{'start':2.3,'end':4}],[[2,2.3]],self.cfg)
  self.assertEqual(len(result),1)
if __name__=='__main__':unittest.main()
