// Music and falling notes share this 120 BPM score, in milliseconds.
export const RHYTHM_BEAT_MS=500;
export const RHYTHM_DURATION_MS=30000;
export function rhythmChart(tier=0){
 const count=[8,12,16][Math.max(0,Math.min(2,tier))];
 return Array.from({length:count},(_,i)=>(4+Math.round(i*52/(count-1)))*RHYTHM_BEAT_MS);
}
