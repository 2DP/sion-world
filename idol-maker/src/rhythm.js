// Music and falling notes share this 120 BPM score, in milliseconds.
export const RHYTHM_BEAT_MS=500;
export const RHYTHM_DURATION_MS=30000;
export function rhythmChart(tier=0){
 const count=[8,12,16][Math.max(0,Math.min(2,tier))];
 return Array.from({length:count},(_,i)=>(4+Math.round(i*52/(count-1)))*RHYTHM_BEAT_MS);
}

// Falling arrows arrive every two beats, with a generous timing window.
export const DANCE_BEAT_MS=750;
export const DANCE_PREVIEW_MS=3000;
export const DANCE_TURN_MS=1500;
export const DANCE_DURATION_MS=66000;
export function danceChart(tier=0,random=Math.random){
 return [Array.from({length:40},(_,step)=>({step,direction:Math.floor(random()*4),at:DANCE_PREVIEW_MS+step*DANCE_TURN_MS}))];
}
export function createDanceRun(turns,easy=false){
 const notes=turns.flat().map(note=>({...note,status:'pending',score:0}));
 const window=easy?700:600;let hits=0,combo=0,bestCombo=0;
 function advance(time){for(const n of notes)if(n.status==='pending'&&time-n.at>window){n.status='miss';combo=0;}}
 function press(direction,time){
  advance(time);
  const note=notes.filter(n=>n.status==='pending'&&n.direction===direction&&Math.abs(time-n.at)<=window).sort((a,b)=>Math.abs(time-a.at)-Math.abs(time-b.at))[0];
  if(!note)return null;
  note.score=100;note.status='perfect';hits++;combo++;bestCombo=Math.max(bestCombo,combo);return note;
 }
 return {notes,advance,press,window,get current(){return notes.find(n=>n.status==='pending');},get score(){return hits/notes.length*100;},get hits(){return hits;},get combo(){return combo;},get bestCombo(){return bestCombo;}};
}
export function memorySequences(random=Math.random){return Array.from({length:3},()=>Array.from({length:4+Math.floor(random()*3)},()=>Math.floor(random()*4)));}
export const VOCAL_PITCHES=[261.63,293.66,329.63,349.23,392];
export function vocalChart(tier=0){return rhythmChart(tier).map((at,i)=>({at,pitch:[2,3,1,2,4,3,2,0][i%8]}));}
export function movePitch(pitch,direction,dt){return Math.max(0,Math.min(4,pitch+direction*Math.max(0,Math.min(dt,100))/700));}
export function vocalScore(timingScore,pitch,target){return Math.abs(pitch-target)<=.65?timingScore:0;}
