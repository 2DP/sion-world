// Three gentle level bands; comfortable mode always uses the first band.
export function minigameDifficulty(level=1,easy=false){
 const tier=easy?0:level>=16?2:level>=6?1:0;
 return {tier,label:easy?'더 편하게':['기초 · Lv.1–5','성장 · Lv.6–15','도전 · Lv.16+'][tier],
  vocalNotes:[8,10,12][tier],danceWindow:easy?700:[600,550,500][tier],
  memoryMin:[4,4,5][tier],memoryRange:[1,2,2][tier],memoryBeat:easy?1100:[1000,950,900][tier],
  actingFrames:[3,4,5][tier],quizDuration:easy?40000:[34000,31000,28000][tier],
  runSpeed:easy?29:[34,37,40][tier],foamCount:[8,10,12][tier],
  cloudGrowth:easy?16:[22,24,26][tier],pairs:[6,8,10][tier],
  fallDuration:easy?3400:[2900,2650,2400][tier],fruitPeriod:easy?850:[700,640,580][tier],
  beachObjects:[12,16,20][tier]};
}
