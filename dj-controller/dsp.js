// PCM transport shared by the AudioWorklet and deterministic offline tests.
import {clamp, wrap} from './core.js';
export class DeckDSP {
  constructor(sampleRate=48000) {
    this.sr=sampleRate; this.channels=[]; this.length=0; this.pos=0; this.rate=1;
    this.playing=false; this.keylock=false; this.loop=null; this.scratch=false;
    this.target=0; this.nudge=0; this.queue=[]; this.grains=[]; this.tick=0; this.last=[0,0]; this.fade=0;
  }
  message(m) {
    if(m.at !== undefined) {this.queue.push(m); this.queue.sort((a,b)=>a.at-b.at);return;}
    this.apply(m);
  }
  apply(m) {
    if(m.type==='load') {this.channels=m.channels;this.length=this.channels[0]?.length||0;this.pos=0;this.playing=false;this.loop=null;this.queue=[];this.reset();}
    if(m.type==='play') {this.playing=m.value;if(!m.value)this.queue=this.queue.filter(q=>q.type!=='play'&&q.type!=='seek');}
    if(m.type==='seek') {this.pos=clamp(m.position*this.sr,0,Math.max(0,this.length-1));this.reset();}
    if(m.type==='rate') this.rate=clamp(m.value,.5,1.5);
    if(m.type==='keylock') {this.keylock=m.value;this.reset();}
    if(m.type==='loop') this.loop=m.value ? {start:clamp(m.value.start*this.sr,0,this.length-2),end:clamp(m.value.end*this.sr,1,this.length)} : null;
    if(this.loop && this.loop.end<=this.loop.start) this.loop=null;
    if(m.type==='grab') {this.scratch=m.value;this.target=this.pos;this.reset();}
    if(m.type==='scratch') this.target=clamp(m.position*this.sr,0,Math.max(0,this.length-1));
    if(m.type==='nudge') this.nudge=clamp(m.value,-.12,.12);
  }
  reset() {this.grains=[];this.tick=0;this.fade=64;}
  read(channel,p) {
    if(this.loop && !this.scratch) p=this.loop.start+wrap(p-this.loop.start,this.loop.end-this.loop.start);
    if(p<0 || p>=this.length-1)return 0;
    const data=this.channels[channel]||this.channels[0], i=Math.floor(p), f=p-i;
    return data ? data[i]*(1-f)+data[i+1]*f : 0;
  }
  // Overlap-add grains retain the original pitch while the transport changes speed.
  // Correlation alignment reduces flanging around attacks; scratching bypasses stretching.
  grain() {
    const hop=1024, size=2048;
    let start=this.pos;
    const prev=this.grains[this.grains.length-1];
    if(prev && this.channels.length) {
      let best=-Infinity, offset=0;
      for(let d=-96;d<=96;d+=4) {
        let dot=0,a2=0,b2=0;
        for(let k=0;k<192;k+=8) {const a=this.read(0,prev.start+hop+k),b=this.read(0,start+d+k);dot+=a*b;a2+=a*a;b2+=b*b;}
        const score=dot/Math.sqrt(a2*b2+1e-12)-Math.abs(d)*.00001;
        if(score>best){best=score;offset=d;}
      }
      start+=offset;
    }
    this.grains.push({start,age:0});this.grains=this.grains.filter(g=>g.age<size);
  }
  render(output,time=0) {
    const n=output[0].length;
    for(let i=0;i<n;i++) {
      while(this.queue.length && this.queue[0].at<=time+i/this.sr) {const m=this.queue.shift();delete m.at;this.apply(m);}
      const active=this.length && (this.playing||this.scratch);
      let speed=this.scratch ? clamp((this.target-this.pos)/64,-8,8) : this.rate+this.nudge;
      const stretch=active && this.keylock && !this.scratch && Math.abs(speed-1)>.0001;
      if(stretch && this.tick%1024===0)this.grain();
      for(let c=0;c<output.length;c++) {
        let v=0;
        if(active) {
          if(stretch) {
            let sum=0;
            for(const g of this.grains){const w=Math.sin(Math.PI*g.age/2048)**2;v+=this.read(c,g.start+g.age)*w;sum+=w;}
            v=sum>.001?v/sum:0;
          } else v=this.read(c,this.pos);
        }
        if(this.fade>0) v=v*(1-this.fade/64)+this.last[c]*(this.fade/64);
        output[c][i]=Number.isFinite(v)?v:0;this.last[c]=output[c][i];
      }
      if(this.fade>0)this.fade--;
      if(active) {
        this.pos+=speed;
        if(this.loop&&!this.scratch&&this.pos>=this.loop.end)this.pos=this.loop.start+wrap(this.pos-this.loop.start,this.loop.end-this.loop.start);
        if(this.pos>=this.length){this.pos=this.length-1;this.playing=false;}
        if(this.pos<0)this.pos=0;
      }
      if(stretch){for(const g of this.grains)g.age++;this.tick++;}
    }
  }
}
