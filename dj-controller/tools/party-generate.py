"""Ten original energetic club compositions. Run with Python + NumPy.
Existing songs and samples are preserved. No external recordings are used.
"""
import importlib.util
import json
import numpy as np
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('synth', Path(__file__).with_name('music-generate.py'))
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)

# Each score specifies its own key, harmonic progression, lead contour and rhythm.
SCORES = [
 ('sunburst','Sunburst Parade',128,'C','FESTIVAL HOUSE',48,[0,7,9,5],[0,4,7,12,11,7,4,2],0),
 ('mirrorball','Mirrorball Express',126,'D','DISCO HOUSE',50,[0,9,5,7],[4,7,9,7,4,2,0,2],1),
 ('neonrush','Neon Rush',132,'Am','ELECTRO',45,[0,5,3,7],[0,3,7,10,12,10,7,3],2),
 ('skyline','Skyline Lift',138,'Em','TRANCE',52,[0,8,3,10],[7,12,14,15,14,12,10,7],3),
 ('laserhearts','Laser Hearts',130,'F','FUTURE HOUSE',53,[0,7,9,5],[0,7,12,9,7,4,2,4],4),
 ('tropical','Tropical Voltage',124,'G','TROPICAL HOUSE',55,[0,7,9,5],[7,4,2,0,4,7,9,12],5),
 ('midnight','Midnight Turbo',140,'Dm','TECHNO',50,[0,0,8,10],[0,12,7,3,0,7,10,12],6),
 ('bounce','Bounce District',134,'Bm','UK GARAGE',47,[0,8,3,10],[0,3,7,5,3,10,7,12],7),
 ('starlight','Starlight Sprint',172,'F#m','DRUM & BASS',54,[0,8,3,10],[12,7,3,0,7,10,14,12],8),
 ('confetti','Confetti Sunrise',136,'A','DANCE POP',57,[0,7,9,5],[4,4,7,9,12,11,9,7],9),
]

def lead(note, duration, style):
    t=s.timeline(duration); f=s.hz(note)
    # Band-limited harmonic stack with detuning; no discontinuous naive sawtooth.
    tone=np.zeros_like(t)
    for h in range(1, min(10, int(9000/f))+1):
        amp=1/h**(1.3 if style in (2,3,6,8) else 2)
        tone += amp*np.sin(s.TAU*f*h*t + .18*np.sin(s.TAU*5*t))
        if style in (0,3,4,9): tone += amp*.3*np.sin(s.TAU*f*h*1.004*t)
    decay=.17 if style in (1,5,7) else .42
    return s.edge(tone*np.exp(-t/decay)*.25,.008,.06)

def render(score):
    ident,title,bpm,key,genre,tonic,progression,motif,style=score
    s.rng=np.random.default_rng(40700+style)
    beat=60/bpm; bars=80 if style==8 else 64
    n=round(bars*4*beat*s.SR)
    drums=np.zeros(n,np.float32); music=drums.copy(); low=drums.copy()
    kick,clap,hat,openhat,snare=s.kick(),s.clap(),s.hat(),s.hat(True),s.snare()
    kicks=[]; minor=key.endswith('m')
    drop=40; outro=bars-8
    for bar in range(bars):
        start=bar*4*beat; root=tonic+progression[(bar//4)%4]
        chord=[root,root+(3 if minor else 4),root+7]
        intro=bar<8; breaking=24<=bar<32; building=32<=bar<40
        active=not breaking; full=(8<=bar<24 or drop<=bar<outro)
        if active:
            positions=([0,1.5,2.75] if style==8 else [0,1.75,2.5] if style==7 else [0,1,2,3])
            for p in positions:
                s.add(drums,kick,start+p*beat,.8); kicks.append(start+p*beat)
            for p in [1,3]: s.add(drums,snare if style in (7,8) else clap,start+p*beat,.6)
            for k in range(16 if full else 8):
                p=k*(.25 if full else .5)
                if style in (1,7) and k%2: p+=.07
                s.add(drums,hat,start+p*beat,.14 if k%2 else .23)
            if full:
                for p in [.5,1.5,2.5,3.5]: s.add(drums,openhat,start+p*beat,.3)
            if bar%8==7:
                for k in range(8): s.add(drums,snare,start+(2+k*.25)*beat,.1+k*.025)
        if bar%2==0: s.add(music,s.pad(chord,beat*7.9),start,.7 if breaking else .28)
        if bar>=4 and not breaking:
            bass_pattern=[(.5,0),(1.5,0),(2.5,12),(3.5,7)]
            if style in (7,8): bass_pattern=[(0,0),(.75,0),(1.75,7),(2.5,12),(3.25,0)]
            if style==6: bass_pattern=[(.5,0),(1.5,0),(2.5,0),(3.5,0)]
            for p,interval in bass_pattern:
                s.add(low,s.bass(root-24+interval,beat*.48),start+p*beat,.9)
        if full:
            for p in [.5,1.5,2.5,3.5]:
                for note in chord: s.add(music,lead(note,beat*.6,style),start+p*beat,.26)
            positions=([0,.75,1.5,2,2.75,3.5] if style%3==0 else [.5,1,1.75,2.5,3,3.75] if style%3==1 else [0,.5,1.5,2,3,3.5])
            for j,p in enumerate(positions):
                note=tonic+12+motif[(bar%4*3+j)%8]
                sound=lead(note,beat*.8,style)
                s.add(music,sound,start+p*beat,.68 if bar>=drop else .52)
                s.add(music,sound,start+(p+.75)*beat,.14)
            if style in (3,8):
                for j in range(16): s.add(music,lead(chord[j%3]+12,beat*.22,style),start+j*.25*beat,.18)
        if breaking and bar%2==0:
            s.add(music,lead(tonic+12+motif[(bar//2)%8],beat*3,style),start,.6)
        if building:
            div=1 if bar<36 else 2 if bar<38 else 4
            for j in range(4*div): s.add(drums,snare,start+j/div*beat,.08+(bar-32)*.025)
        if bar in (7,39): s.add(music,s.riser(4*beat),start,.8)
        if bar in (8,40): s.add(drums,openhat,start,.8)
    duck=np.ones(n,np.float32); dip=1-.65*np.exp(-s.timeline(.35)/.11)
    for at in kicks:
        ix=round(at*s.SR); count=min(len(dip),n-ix)
        duck[ix:ix+count]=np.minimum(duck[ix:ix+count],dip[:count])
    audio=drums+(music+low)*duck
    stats=s.save(ident+'.wav',s.edge(audio,.004,.1))
    entry=dict(id=ident,title=title,bpm=bpm,key=key,genre=genre,bars=bars,artist='MIXROOM ORIGINALS',duration=stats['duration'],firstBeat=0,url='assets/'+ident+'.wav',phrases=[{'bar':b,'label':label} for b,label in [(0,'INTRO'),(8,'GROOVE'),(24,'BREAK'),(32,'BUILD'),(40,'DROP'),(outro,'OUTRO')]])
    return entry,stats

def main():
    manifest=json.loads((ROOT/'music-manifest.json').read_text(encoding='utf-8'))
    validation=json.loads((ROOT/'tools/music-validation.json').read_text(encoding='utf-8'))
    ids={score[0] for score in SCORES}
    manifest['tracks']=[t for t in manifest['tracks'] if t['id'] not in ids]
    validation=[v for v in validation if v['file'].removesuffix('.wav') not in ids]
    for score in SCORES:
        entry,stats=render(score); manifest['tracks'].append(entry); validation.append(stats)
        print(f"{entry['title']}: {entry['bpm']} BPM / {entry['duration']:.1f}s / RMS {stats['rms']:.3f}",flush=True)
    manifest['version']=2
    (ROOT/'music-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (ROOT/'tools/music-validation.json').write_text(json.dumps(validation,indent=2)+'\n',encoding='utf-8')
    print(f"Library: {len(manifest['tracks'])} songs; {sum(v['bytes'] for v in validation)/1024/1024:.1f} MiB")

if __name__=='__main__': main()
