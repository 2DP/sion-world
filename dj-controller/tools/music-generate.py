"""Render MIXROOM's original score with Python 3 and NumPy.

Run from any directory: python tools/music-generate.py
All compositions, instrument waveforms, and arrangements are synthesized here.
There are no sampled recordings or external music dependencies.
"""
from pathlib import Path
import json
import math
import wave
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
SR = 22050
TAU = 2 * np.pi
rng = np.random.default_rng(29816)


def hz(midi):
    return 440 * 2 ** ((midi - 69) / 12)


def timeline(seconds):
    return np.arange(max(1, round(seconds * SR)), dtype=np.float32) / SR


def edge(signal, attack=.006, release=.035):
    out = signal.astype(np.float32, copy=True)
    a = min(len(out), max(1, round(attack * SR)))
    r = min(len(out), max(1, round(release * SR)))
    out[:a] *= np.linspace(0, 1, a)
    out[-r:] *= np.linspace(1, 0, r)
    return out


def kick(hip=False):
    t = timeline(.65 if hip else .45)
    frequency = 47 if hip else 51
    phase = TAU * (frequency*t + 90*.022*(1-np.exp(-t/.022)))
    body = np.sin(phase) * np.exp(-t/(.21 if hip else .14))
    click = rng.normal(0, .13, len(t)) * np.exp(-t/.004)
    return edge(body + click, .001, .03)


def clap():
    t = timeline(.24)
    noise = rng.normal(0, 1, len(t)).astype(np.float32)
    noise = noise - np.roll(noise, 1) * .8
    env = np.exp(-t/.047)*.35
    for offset in [0, .012, .023]:
        env += np.where(t >= offset, np.exp(-np.maximum(0,t-offset)/.007), 0)*.55
    return edge(noise * env*.38, .0005, .02)


def hat(opened=False):
    t = timeline(.27 if opened else .075)
    noise = rng.normal(0, .25, len(t))
    noise -= np.roll(noise, 1)*.9
    metal = sum(np.sin(TAU*f*t) for f in [4131, 5933, 7019, 8391])*.025
    return edge((noise+metal)*np.exp(-t/(.075 if opened else .016)), .001, .01)


def snare():
    t = timeline(.29)
    noise = rng.normal(0, .18, len(t))
    bright = noise - np.roll(noise, 2)*.6
    return edge(bright*np.exp(-t/.065)+.28*np.sin(TAU*182*t)*np.exp(-t/.045), .001, .025)


def bass(note, duration, hip=False):
    t = timeline(duration)
    f = hz(note)
    wavelet = np.sin(TAU*f*t) + .25*np.sin(TAU*2*f*t) + .1*np.sin(TAU*3*f*t)
    shape = (1-np.exp(-t/.005))*np.exp(-t/(.40 if hip else .25))
    return edge(wavelet*shape*.6, .003, .04)


def keys(note, duration, bright=False):
    t = timeline(duration)
    f = hz(note)
    # Soft FM electric-piano attack with bell-like high harmonics.
    mod = (.8 if bright else .38)*np.sin(TAU*f*2*t)*np.exp(-t/.16)
    tone = np.sin(TAU*f*t+mod) + .18*np.sin(TAU*f*3*t)*np.exp(-t/.3)
    return edge(tone*np.exp(-t/(.5 if bright else .8))*.35, .004, .08)


def pad(notes, duration):
    t = timeline(duration)
    out = np.zeros_like(t)
    for note in notes:
        f = hz(note)
        out += np.sin(TAU*f*t)*.6 + np.sin(TAU*f*1.002*t)*.26
        out += np.sin(TAU*f*2*t)*.09
    return edge(out/len(notes)*.5, .12, .3)


def riser(seconds=3):
    t = timeline(seconds)
    p = t/seconds
    noise = rng.normal(0, .15, len(t))
    carrier = np.sin(TAU*(170*t+350*t*t/seconds))
    trem = .55+.45*np.sin(TAU*(3*t+5*t*t/seconds))
    return edge((noise+carrier*.09)*p**1.6*trem, .05, .06)


def add(dest, sound, seconds, gain=1):
    start = round(seconds*SR)
    if start >= len(dest):
        return
    if start < 0:
        sound = sound[-start:]
        start = 0
    count = min(len(sound), len(dest)-start)
    if count > 0:
        dest[start:start+count] += sound[:count]*gain


def save(name, signal):
    signal = np.asarray(signal, dtype=np.float32)
    if not np.all(np.isfinite(signal)):
        raise ValueError(f"Non-finite audio: {name}")
    signal -= np.mean(signal)
    signal = np.tanh(signal*.9)
    peak = float(np.max(np.abs(signal)))
    signal *= .86/max(.01, peak)
    signal = edge(signal, .003, .045)
    pcm = (signal*32767).round().astype('<i2')
    destination = ASSETS / name
    with wave.open(str(destination), 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SR)
        wav.writeframes(pcm.tobytes())
    return {"file":name, "duration":len(signal)/SR, "sampleRate":SR,
            "channels":1,"peak":float(np.max(np.abs(signal))),
            "rms":float(np.sqrt(np.mean(signal**2))),"bytes":destination.stat().st_size}


TRACKS = [
    {"id":"house124","title":"Velvet Hours","bpm":124,"key":"Am","genre":"HOUSE","bars":64,
     "chords":[[57,60,64,67],[53,57,60,64],[60,64,67,71],[55,59,62,64]],
     "roots":[33,29,36,31],"motif":[72,76,79,76,71,72,67,69]},
    {"id":"house128","title":"Afterglow Avenue","bpm":128,"key":"Dm","genre":"HOUSE","bars":64,
     "chords":[[50,53,57,60],[58,62,65,69],[53,57,60,64],[48,52,55,59]],
     "roots":[38,34,29,36],"motif":[77,81,79,77,76,72,74,77]},
    {"id":"hiphop90","title":"Rooftop Letters","bpm":90,"key":"Cm","genre":"HIP HOP","bars":48,
     "chords":[[48,51,55,58,62],[53,56,60,63],[46,50,53,57],[51,55,58,62]],
     "roots":[36,29,34,39],"motif":[74,70,67,63,65,67,70,67]},
    {"id":"hiphop94","title":"Night Bus Home","bpm":94,"key":"Fm","genre":"HIP HOP","bars":48,
     "chords":[[53,56,60,63],[49,53,56,60],[56,60,63,67],[51,55,58,62]],
     "roots":[29,37,32,39],"motif":[72,75,72,68,67,68,70,72]},
    {"id":"dance128","title":"Prism Runner","bpm":128,"key":"F#m","genre":"DANCE","bars":64,
     "chords":[[54,57,61,66],[57,61,64,69],[52,56,59,64],[50,54,57,62]],
     "roots":[30,33,28,38],"motif":[78,81,85,81,76,73,74,78]},
    {"id":"dance132","title":"Electric Horizon","bpm":132,"key":"Bm","genre":"DANCE","bars":64,
     "chords":[[59,62,66,69],[55,59,62,66],[50,54,57,62],[57,61,64,69]],
     "roots":[35,31,38,33],"motif":[78,81,83,86,85,81,78,74]},
]


def render_track(info):
    bpm = info['bpm']
    beat = 60/bpm
    bars = info['bars']
    length = round(bars*4*beat*SR)
    drums = np.zeros(length, np.float32)
    harmony = np.zeros(length, np.float32)
    melody = np.zeros(length, np.float32)
    low = np.zeros(length, np.float32)
    hip = info['genre']=='HIP HOP'
    dance = info['genre']=='DANCE'
    kick_s, clap_s, snare_s = kick(hip), clap(), snare()
    closed, opened = hat(), hat(True)
    kicks = []
    # 8-bar intro, harmonic groove, 8-bar break, build, full return, 8-bar outro.
    phrases = ([{"bar":0,"label":"INTRO"},{"bar":8,"label":"GROOVE"},
                {"bar":24,"label":"BREAK"},{"bar":32,"label":"RETURN"},
                {"bar":40,"label":"OUTRO"}] if hip else
               [{"bar":0,"label":"INTRO"},{"bar":8,"label":"GROOVE"},
                {"bar":24,"label":"BREAK"},{"bar":32,"label":"BUILD"},
                {"bar":40,"label":"DROP"},{"bar":56,"label":"OUTRO"}])
    for bar in range(bars):
        start = bar*4*beat
        chord = info['chords'][(bar//2)%4]
        root = info['roots'][(bar//2)%4]
        breaking = 24<=bar<32
        intro = bar<8
        outro = bar>=bars-8
        build = not hip and 32<=bar<40
        active = not breaking
        # Drums remain sparse in introductions and outros, leaving room to mix.
        if active:
            positions = ([0,1.75,2.5] if bar%2==0 else [0,.75,2,3.5]) if hip else [0,1,2,3]
            for pos in positions:
                at = start+pos*beat
                add(drums,kick_s,at,.66 if hip else .70)
                kicks.append(at)
            for pos in [1,3]:
                add(drums,snare_s if hip else clap_s,start+pos*beat,.50 if hip else .47)
            for eighth in range(8):
                # Sixteenth swing on hip-hop hats leaves the downbeat grid intact.
                swing = (.10 if eighth%2 else 0)*beat if hip else 0
                add(drums,closed,start+eighth*.5*beat+swing,.20 if eighth%2==0 else .13)
            if not intro and not outro:
                for pos in [.5,1.5,2.5,3.5]:
                    add(drums,opened,start+pos*beat,.16 if hip else .22)
            if (bar+1)%8==0 and not outro:
                for i in range(4):
                    add(drums,snare_s,start+(3+i*.25)*beat,.11+i*.035)
        else:
            for pos in [1,3]:
                add(drums,closed,start+pos*beat,.09)
        # Layered chords: smooth sustain plus syncopated Rhodes stabs.
        if bar%2==0:
            gain = .23 if intro or outro else (.46 if breaking else .32)
            add(harmony,pad(chord,beat*7.9),start,gain)
        if bar>=4 and not outro:
            for pos in ([0,1.5,3] if hip else [.5,2.5,3.5]):
                for note in chord:
                    add(harmony,keys(note,beat*1.4),start+pos*beat,.13 if hip else .12)
        # Bass pattern changes after the break, with short rests for the groove.
        if bar>=4 and not breaking:
            pattern = [(0,0,1),(.75,0,.5),(2,0,.75),(3.25,7,.5)] if hip else [(.5,0,.4),(1.5,0,.4),(2.5,12,.4),(3.5,7,.4)]
            for pos,interval,dur in pattern:
                if outro and pos not in [0,.5,2,2.5]:
                    continue
                add(low,bass(root+interval,beat*dur,hip),start+pos*beat,.56)
        # Original 4-bar melodic motif, developed into a brighter final chorus.
        if (8<=bar<24 or 40<=bar<bars-8 or hip and 32<=bar<40):
            notes = info['motif']
            for j,pos in enumerate([.5,1.25,2.5,3.25] if hip else [0,.75,2,2.75]):
                if (bar+j)%4==3:
                    continue
                n = notes[((bar%4)*2+j)%len(notes)]
                if bar%8>=4 and j==3:
                    n -= 12
                sound = keys(n,beat*(1.35 if hip else .95),dance)
                amp = .31 if dance else .27
                add(melody,sound,start+pos*beat,amp)
                add(melody,sound,start+(pos+.75)*beat,amp*.18)
                add(melody,sound,start+(pos+1.5)*beat,amp*.07)
        if breaking and bar%2==0:
            sound = keys(info['motif'][(bar//2)%8],beat*4)
            add(melody,sound,start,.26)
            add(melody,sound,start+beat*1.5,.12)
        if build and bar>=36:
            divisions = 2 if bar<38 else 4
            for k in range(4*divisions):
                add(drums,snare_s,start+k/divisions*beat,.06+.10*(bar-36)/4)
        if bar in ([31] if hip else [7,39]):
            add(melody,riser(4*beat),start,.55)
    # Sidechain envelope, triggered by actual kick events, to keep bass readable.
    duck = np.ones(length,np.float32)
    t = timeline(.32)
    dip = 1-.42*np.exp(-t/.085)
    for at in kicks:
        ix = round(at*SR)
        n = min(len(dip),length-ix)
        duck[ix:ix+n] = np.minimum(duck[ix:ix+n],dip[:n])
    harmony *= duck
    melody *= .8+.2*duck
    # A restrained room tail, kept out of the bass and kick.
    room = np.zeros(length,np.float32)
    for delay,gain in [(.047,.09),(.079,.06),(.127,.04)]:
        samples = round(delay*SR)
        room[samples:] += harmony[:-samples]*gain
    mixed = drums + low + harmony + melody + room
    # Short fades preserve the exact bar length while avoiding end discontinuities.
    mixed = edge(mixed,.003,.12)
    stats = save(info['id']+'.wav',mixed)
    output = {k:info[k] for k in ['id','title','bpm','key','genre','bars']}
    output.update(artist='MIXROOM ORIGINALS',duration=stats['duration'],firstBeat=0,
                  url='assets/'+info['id']+'.wav',phrases=phrases)
    return output,stats


def render_samples():
    t = timeline(.7)
    laser = edge(np.sin(TAU*(180*t+900*.055*(1-np.exp(-t/.055))))*np.exp(-t/.18)*.55,.001,.03)
    t2 = timeline(.8)
    # Formant-shaped synthetic voice-like tone; no human recording is used.
    vocal = edge((np.sin(TAU*220*t2)+.32*np.sin(TAU*660*t2)+.2*np.sin(TAU*1100*t2))*np.exp(-t2/.23)*.35,.018,.08)
    impact = np.zeros(round(SR*1.5),np.float32)
    add(impact,kick(),0,.8)
    add(impact,clap(),0,.3)
    t3 = timeline(1.5)
    impact += rng.normal(0,.11,len(t3))*np.exp(-t3/.35)
    chord = sum(keys(n,1.2) for n in [60,64,67,71])*.5
    samples = [('kick','DEEP KICK',kick()),('clap','CLUB CLAP',clap()),
               ('hat','OPEN HAT',hat(True)),('riser','WHITE RISE',riser(2)),
               ('impact','LOW IMPACT',impact),('voice','SYNTH YEAH',vocal),
               ('chord','MAJ7 STAB',chord),('laser','SPACE LASER',laser)]
    entries,checks = [],[]
    for ident,title,audio in samples:
        stats = save('sample-'+ident+'.wav',audio)
        entries.append({'id':ident,'title':title,'url':'assets/sample-'+ident+'.wav','duration':stats['duration']})
        checks.append(stats)
    return entries,checks


def main():
    ASSETS.mkdir(exist_ok=True,parents=True)
    manifest = {'version':1,'sampleRate':SR,'license':'Original synthesis created for MIXROOM. No third-party samples.','tracks':[],'samples':[]}
    validation = []
    for config in TRACKS:
        entry,stats = render_track(config)
        manifest['tracks'].append(entry)
        validation.append(stats)
        print(f"{entry['title']}: {entry['duration']:.2f}s; RMS {stats['rms']:.3f}; peak {stats['peak']:.3f}",flush=True)
    manifest['samples'],sample_stats = render_samples()
    validation.extend(sample_stats)
    (ROOT/'music-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (ROOT/'tools'/'music-validation.json').write_text(json.dumps(validation,indent=2)+'\n',encoding='utf-8')
    print(f"Generated {len(validation)} files; {sum(x['bytes'] for x in validation)/1024/1024:.1f} MiB",flush=True)


if __name__=='__main__':
    main()
