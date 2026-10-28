self.onmessage=({data:{samples,sampleRate}})=>{
  const hop=256,energy=[];for(let n=0;n<samples.length;n+=hop){let sum=0;for(let i=n;i<Math.min(n+hop,samples.length);i++)sum+=samples[i]*samples[i];energy.push(Math.sqrt(sum/hop));}
  const onset=energy.map((v,i)=>Math.max(0,v-(energy[i-1]||0)));let best=0,bpm=120;
  for(let candidate=70;candidate<=180;candidate+=.5){const lag=sampleRate/hop*60/candidate;let sum=0,denom=0;for(let i=Math.ceil(lag);i<onset.length;i++){const p=i-lag,j=Math.floor(p),f=p-j;sum+=onset[i]*((onset[j]||0)*(1-f)+(onset[j+1]||0)*f);denom+=onset[i]**2;}const score=sum/(denom+1e-9);if(score>best){best=score;bpm=candidate;}}
  let peak=0,index=0;for(let i=0;i<Math.min(onset.length,sampleRate/hop*2);i++)if(onset[i]>peak){peak=onset[i];index=i;}
  self.postMessage({bpm,firstBeat:index*hop/sampleRate,confidence:best});
};
