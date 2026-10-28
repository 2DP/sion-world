import {DeckDSP} from './dsp.js';
class MixroomProcessor extends AudioWorkletProcessor {
  constructor(){super();this.deck=new DeckDSP(sampleRate);this.count=0;this.port.onmessage=e=>this.deck.message(e.data);}
  process(inputs,outputs){this.deck.render(outputs[0],currentTime);if(++this.count%12===0)this.port.postMessage({position:this.deck.pos/sampleRate,stateTime:currentTime+outputs[0][0].length/sampleRate,playing:this.deck.playing,rate:this.deck.rate,loop:this.deck.loop?{start:this.deck.loop.start/sampleRate,end:this.deck.loop.end/sampleRate}:null});return true;}
}
registerProcessor('mixroom-deck',MixroomProcessor);
class MixroomLimiter extends AudioWorkletProcessor {
  constructor(){super();this.gain=1;}
  process(inputs,outputs){const input=inputs[0],out=outputs[0];if(!input.length)return true;for(let i=0;i<out[0].length;i++){let peak=0;for(const ch of input)peak=Math.max(peak,Math.abs(ch[i]||0));const target=peak>.98?.98/peak:1;this.gain=target<this.gain?target:this.gain+(target-this.gain)*.0005;for(let c=0;c<out.length;c++)out[c][i]=(input[c]?.[i]||input[0][i]||0)*this.gain;}return true;}
}
registerProcessor('mixroom-limiter',MixroomLimiter);
