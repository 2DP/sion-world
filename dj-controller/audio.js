import {clamp,dbGain,crossGains,quantizedDelay,alignPosition} from './core.js';
const smooth=(param,value,ctx)=>param.setTargetAtTime(value,ctx.currentTime,.012);
export class FX {
  constructor(ctx){
    this.ctx=ctx;this.input=ctx.createGain();this.output=ctx.createGain();this.dry=ctx.createGain();this.wet=ctx.createGain();this.send=ctx.createGain();
    this.send.gain.value=0;this.wet.gain.value=0;this.input.connect(this.dry).connect(this.output);this.input.connect(this.send);this.wet.connect(this.output);this.amount=.35;this.on=false;this.bpm=128;this.beats=.5;this.kind='echo';this.setKind('echo');
  }
  setKind(kind){
    clearTimeout(this.tail);this.send.disconnect();if(this.effect)this.effect.disconnect();if(this.feedback)this.feedback.disconnect();if(this.osc){this.osc.stop();this.osc.disconnect();}
    this.kind=kind;this.feedback=null;this.osc=null;
    const c=this.ctx;
    if(kind==='reverb'){
      this.effect=c.createConvolver();const b=c.createBuffer(2,c.sampleRate*1.8,c.sampleRate);
      for(let ch=0;ch<2;ch++){const a=b.getChannelData(ch);let seed=123+ch;for(let i=0;i<a.length;i++){seed=(seed*1664525+1013904223)>>>0;a[i]=(seed/2147483648-1)*Math.pow(1-i/a.length,3)*.55;}}
      this.effect.buffer=b;
    }else{
      this.effect=c.createDelay(4);this.feedback=c.createGain();this.feedback.gain.value=kind==='echo'?.44:kind==='delay'?.2:.35;
      this.effect.connect(this.feedback).connect(this.effect);
      if(kind==='flanger'){this.effect.delayTime.value=.006;this.osc=c.createOscillator();const g=c.createGain();g.gain.value=.003;this.osc.frequency.value=.25;this.osc.connect(g).connect(this.effect.delayTime);this.osc.start();}
      else this.effect.delayTime.value=60/this.bpm*this.beats;
    }
    this.send.connect(this.effect).connect(this.wet);this.update();
  }
  update(){const c=this.ctx;clearTimeout(this.tail);smooth(this.send.gain,this.on?1:0,c);smooth(this.dry.gain,this.on?1-this.amount*.45:1,c);if(this.on)smooth(this.wet.gain,this.amount,c);else this.tail=setTimeout(()=>smooth(this.wet.gain,0,c),2500);if(this.effect.delayTime&&this.kind!=='flanger')smooth(this.effect.delayTime,clamp(60/this.bpm*this.beats,.01,3.9),c);}
}
function analyser(ctx){const a=ctx.createAnalyser();a.fftSize=256;a.data=new Float32Array(256);return a;}
function meter(a){a.getFloatTimeDomainData(a.data);let peak=0,sum=0;for(const v of a.data){peak=Math.max(peak,Math.abs(v));sum+=v*v;}return {peak,rms:Math.sqrt(sum/a.data.length)};}
export class AudioEngine {
  constructor(){this.ctx=null;this.decks=[];this.cross=.5;this.curve='mix';this.reverse=false;this.monitor='master';this.cueMix=0;this.cueLevel=.7;this.samples=[];this.voices=new Set();this.cache=new Map();this.onState=()=>{};this.onError=()=>{};}
  async init(){
    if(this.ctx){await this.ctx.resume();return;}
    const ctx=this.ctx=new AudioContext({latencyHint:'interactive'});
    try{await ctx.audioWorklet.addModule(new URL('./processor.js',import.meta.url));}catch(e){await ctx.close();this.ctx=null;throw new Error('오디오 엔진을 시작하지 못했습니다. 최신 PC 브라우저와 HTTPS 또는 localhost를 사용해 주세요.');}
    this.mix=ctx.createGain();this.mainFX=new FX(ctx);this.mix.connect(this.mainFX.input);
    this.master=ctx.createGain();this.master.gain.value=.72;this.mainFX.output.connect(this.master);
    this.masterMeter=analyser(ctx);this.master.connect(this.masterMeter);
    this.ceiling=new AudioWorkletNode(ctx,'mixroom-limiter');this.masterMeter.connect(this.ceiling);
    this.recordDest=ctx.createMediaStreamDestination();this.ceiling.connect(this.recordDest);
    this.speaker=ctx.createGain();this.ceiling.connect(this.speaker).connect(ctx.destination);
    this.cueBus=ctx.createGain();this.cuePart=ctx.createGain();this.masterPart=ctx.createGain();this.phones=ctx.createGain();this.phoneGate=ctx.createGain();
    this.cueBus.connect(this.cuePart).connect(this.phones);this.ceiling.connect(this.masterPart).connect(this.phones);this.phones.connect(this.phoneGate).connect(ctx.destination);
    this.splitGate=ctx.createGain();this.split=ctx.createChannelMerger(2);
    this.cueMono=ctx.createGain();this.cueMono.channelCount=1;this.cueMono.channelCountMode='explicit';this.cueBus.connect(this.cueMono).connect(this.split,0,0);
    const mono=ctx.createGain();mono.channelCount=1;mono.channelCountMode='explicit';this.ceiling.connect(mono).connect(this.split,0,1);this.split.connect(this.splitGate).connect(ctx.destination);
    this.decks=[this.makeDeck(0),this.makeDeck(1)];this.updateCross();this.updateMonitor();
    await ctx.resume();
  }
  makeDeck(index){
    const c=this.ctx, d={index,track:null,buffer:null,position:0,playing:false,rate:1,bpm:128,firstBeat:0,cue:0,hot:Array(8).fill(null),loop:null,loopSize:4,savedLoop:null,volume:.82,trim:0,eq:{high:0,mid:0,low:0},filter:0,monitor:false,keylock:false,quantize:false,vinyl:true,loadToken:0};
    d.node=new AudioWorkletNode(c,'mixroom-deck',{numberOfOutputs:1,outputChannelCount:[2]});d.node.port.onmessage=e=>{Object.assign(d,e.data);this.onState(index);};
    d.trimNode=c.createGain();d.low=c.createBiquadFilter();d.low.type='lowshelf';d.low.frequency.value=250;
    d.mid=c.createBiquadFilter();d.mid.type='peaking';d.mid.frequency.value=1000;d.mid.Q.value=.7;
    d.high=c.createBiquadFilter();d.high.type='highshelf';d.high.frequency.value=4000;
    d.filterNode=c.createBiquadFilter();d.filterNode.type='allpass';d.filterNode.Q.value=.7;
    d.fader=c.createGain();d.fader.gain.value=d.volume**2;d.crossNode=c.createGain();d.fx=new FX(c);d.meter=analyser(c);d.cueNode=c.createGain();d.cueNode.gain.value=0;
    d.node.connect(d.trimNode).connect(d.low).connect(d.mid).connect(d.high).connect(d.filterNode);
    d.filterNode.connect(d.fader).connect(d.crossNode).connect(d.fx.input);d.fx.output.connect(d.meter).connect(this.mix);
    d.filterNode.connect(d.cueNode).connect(this.cueBus);return d;
  }
  async decode(url){if(this.cache.has(url))return this.cache.get(url);const response=await fetch(url);if(!response.ok)throw new Error('음원을 불러오지 못했습니다.');const buffer=await this.ctx.decodeAudioData(await response.arrayBuffer());this.cache.set(url,buffer);if(this.cache.size>4)this.cache.delete(this.cache.keys().next().value);return buffer;}
  async load(index,track,buffer){
    const d=this.decks[index];if(d.playing)throw new Error('먼저 덱을 일시 정지해 주세요.');const token=++d.loadToken;
    const b=buffer||await this.decode(track.url);if(token!==d.loadToken)return false;
    d.track=track;d.buffer=b;d.bpm=track.bpm;d.firstBeat=track.firstBeat||0;d.cue=0;d.hot=Array(8).fill(null);d.loop=null;d.savedLoop=null;d.manualIn=undefined;d.position=0;d.rate=1;d.synced=false;d.fx.bpm=d.bpm;d.fx.update();
    const channels=Array.from({length:Math.min(2,b.numberOfChannels)},(_,i)=>new Float32Array(b.getChannelData(i)));
    d.node.port.postMessage({type:'load',channels},channels.map(a=>a.buffer));this.send(index,{type:'rate',value:1});return true;
  }
  send(i,msg,quantized=false){const d=this.decks[i];if(quantized&&d.quantize&&d.playing)msg.at=this.ctx.currentTime+quantizedDelay(d.position,d.bpm,d.rate,1,d.firstBeat);d.node.port.postMessage(msg);}
  position(i,at=this.ctx.currentTime){const d=this.decks[i];let p=d.position+(d.playing?Math.max(0,at-(d.stateTime||at))*d.rate:0);if(d.loop&&p>=d.loop.end)p=d.loop.start+(p-d.loop.start)%(d.loop.end-d.loop.start);return p;}
  play(i,value){const d=this.decks[i];if(!d.buffer)return;const playing=value??!d.playing;if(playing&&d.synced){const at=this.ctx.currentTime+.035,m=this.decks[1-i];this.send(i,{type:'seek',position:alignPosition(this.position(1-i,at),m.bpm,d.position,d.bpm,m.firstBeat,d.firstBeat),at});this.send(i,{type:'play',value:true,at});}else this.send(i,{type:'play',value:playing});d.playing=playing;}
  seek(i,seconds,quantize=false){const d=this.decks[i];this.send(i,{type:'seek',position:clamp(seconds,0,d.buffer?.duration||0)},quantize);}
  rate(i,value,linked=false){const d=this.decks[i];if(!linked)d.synced=false;d.rate=clamp(value,.5,1.5);this.send(i,{type:'rate',value:d.rate});d.fx.bpm=d.bpm*d.rate;d.fx.update();if(!linked&&this.decks[1-i]?.synced)this.rate(1-i,d.bpm*d.rate/this.decks[1-i].bpm,true);}
  sync(i,phase=true){const d=this.decks[i],m=this.decks[1-i];if(!d.buffer||!m.buffer)return;if(phase&&d.synced){d.synced=false;return;}m.synced=false;this.rate(i,m.bpm*m.rate/d.bpm,true);d.synced=phase;if(phase&&d.playing){const at=this.ctx.currentTime+.035;this.send(i,{type:'seek',position:alignPosition(this.position(1-i,at),m.bpm,this.position(i,at),d.bpm,m.firstBeat,d.firstBeat),at});}}
  loop(i,length){const d=this.decks[i];if(!d.buffer)return;if(d.loop){d.savedLoop=d.loop;d.loop=null;}else{const step=60/d.bpm;const start=d.quantize?Math.floor((d.position-d.firstBeat)/step)*step+d.firstBeat:d.position;d.loop={start:Math.max(0,start),end:Math.min(d.buffer.duration,start+(length||d.loopSize)*step)};d.savedLoop=d.loop;}this.send(i,{type:'loop',value:d.loop});}
  setLoop(i,start,end){const d=this.decks[i];if(!d.buffer||end<=start+.02)return;d.loop={start,end};d.savedLoop=d.loop;this.send(i,{type:'loop',value:d.loop});}
  control(i,type,value){const d=this.decks[i],c=this.ctx;if(type==='volume'){d.volume=value;smooth(d.fader.gain,value**2,c);}if(type==='trim'){d.trim=value;smooth(d.trimNode.gain,dbGain(value),c);}if(['high','mid','low'].includes(type)){d.eq[type]=value;smooth(d[type].gain,value,c);}if(type==='filter'){d.filter=value;const f=d.filterNode;f.type=Math.abs(value)<.02?'allpass':value<0?'lowpass':'highpass';smooth(f.frequency,value<0?20000*Math.pow(80/20000,-value):30*Math.pow(12000/30,value),c);}}
  updateCross(){if(!this.ctx)return;const gains=crossGains(this.cross,this.curve,this.reverse);this.decks.forEach((d,i)=>smooth(d.crossNode.gain,gains[i],this.ctx));}
  updateMonitor(){if(!this.ctx)return;const c=this.ctx;smooth(this.speaker.gain,this.monitor==='master'?1:0,c);smooth(this.phoneGate.gain,this.monitor==='cue'?1:0,c);smooth(this.splitGate.gain,this.monitor==='split'?1:0,c);smooth(this.phones.gain,this.cueLevel,c);smooth(this.cueMono.gain,this.cueLevel,c);smooth(this.cuePart.gain,1-this.cueMix,c);smooth(this.masterPart.gain,this.cueMix,c);this.decks.forEach(d=>smooth(d.cueNode.gain,d.monitor?1:0,c));}
  levels(){return {master:meter(this.masterMeter),decks:this.decks.map(d=>meter(d.meter))};}
  async loadSamples(samples){this.samples=await Promise.all(samples.map(async s=>({ ...s,volume:.55,buffer:await this.decode(s.url)})));}
  sample(index,loop=false,at=this.ctx.currentTime){const s=this.samples[index];if(!s)return;const source=this.ctx.createBufferSource();source.buffer=s.buffer;source.loop=loop;const gain=this.ctx.createGain();gain.gain.value=s.volume;source.sampleIndex=index;source.sampleGain=gain;source.connect(gain).connect(this.mix);source.onended=()=>{this.voices.delete(source);source.disconnect();gain.disconnect();};source.start(at);this.voices.add(source);return source;}
  stopSamples(){for(const s of this.voices)s.stop();this.voices.clear();}
  startRecording(){if(!globalThis.MediaRecorder)throw new Error('이 브라우저는 녹음을 지원하지 않습니다.');const mime=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'].find(t=>MediaRecorder.isTypeSupported(t));this.chunks=[];this.recorder=new MediaRecorder(this.recordDest.stream,mime?{mimeType:mime}:{});this.recorder.ondataavailable=e=>{if(e.data.size)this.chunks.push(e.data);};this.recorder.start(1000);this.recordStart=this.ctx.currentTime;}
  stopRecording(){return new Promise(resolve=>{this.recorder.onstop=()=>resolve(new Blob(this.chunks,{type:this.recorder.mimeType}));this.recorder.stop();});}
}
