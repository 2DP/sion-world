export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const dbGain = db => Math.pow(10, db / 20);
export const wrap = (v, length) => ((v % length) + length) % length;
export const clock = seconds => {
  const s = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  return `${Math.floor(s / 60).toString().padStart(2,'0')}:${Math.floor(s % 60).toString().padStart(2,'0')}`;
};
export function crossGains(value, curve = 'mix', reverse = false) {
  const x = clamp(reverse ? 1 - value : value, 0, 1);
  return curve === 'cut' ? [x < .97 ? 1 : (1-x)/.03, x > .03 ? 1 : x/.03] : [Math.cos(x*Math.PI/2), Math.sin(x*Math.PI/2)];
}
export function phaseError(a, b, bpmA, bpmB, firstA=0, firstB=0) {
  const delta = wrap((a-firstA)*bpmA/60 - (b-firstB)*bpmB/60 + .5, 1) - .5;
  return Math.abs(delta);
}
export function beatScore(error) { return clamp((.125-error)/(.125-.03125),0,1); }
export function quantizedDelay(position, bpm, rate=1, step=1, firstBeat=0) {
  const beat = 60/bpm*step;
  const phase = wrap(position-firstBeat,beat);
  return (phase < .012 ? 0 : beat-phase)/rate;
}
export function alignPosition(masterPos, masterBpm, followerPos, followerBpm, firstA=0, firstB=0) {
  const phase = wrap((masterPos-firstA)*masterBpm/60,1);
  const beat = (followerPos-firstB)*followerBpm/60;
  return (Math.max(0,Math.round(beat-phase))+phase)*60/followerBpm+firstB;
}
export function scoreMix(stats) {
  const n = stats.windows || 1;
  const beatN=stats.beatWindows??n;
  return Math.round(clamp(30*(stats.beat/(beatN||1)) + 25*(stats.phrase || 0) + 15*(1-stats.clips/n) + 10*(1-stats.gaps/n) + 20*(stats.goals || 0),0,100));
}
export const LESSONS = [
  {name:'첫 번째 플레이',tag:'PLAY / CUE',body:'왼쪽 A 덱의 재생 버튼을 눌러 보세요. CUE는 기준점으로 돌아갑니다.',event:'play'},
  {name:'두 곡 사이',tag:'CROSSFADER',body:'중앙 아래 크로스페이더를 움직여 보세요. 왼쪽 끝은 A, 오른쪽 끝은 B입니다.',event:'cross'},
  {name:'다음 곡 미리 듣기',tag:'HEADPHONE CUE',body:'B 채널의 헤드폰 CUE를 켜세요. 출력에서 CUE를 선택하면 다음 곡만 미리 들을 수 있어요.',event:'monitor'},
  {name:'박자 맞추기',tag:'TEMPO / JOG',body:'템포 슬라이더로 BPM을 바꾸거나 조그 가장자리를 움직여 박자를 보정해 보세요.',event:'tempo'},
  {name:'저음 교대',tag:'LOW EQ',body:'중앙 믹서의 LOW 노브를 아래로 드래그하세요. 저음이 줄어드는 것을 들어보세요.',event:'low'},
  {name:'다시 듣고 싶은 순간',tag:'LOOP / HOT CUE',body:'덱의 LOOP를 켜거나 HOT CUE 패드를 눌러 현재 지점을 저장해 보세요.',event:'loop'},
  {name:'공간을 더하기',tag:'BEAT FX',body:'오른쪽 FX의 ON을 눌러 효과를 켜고 DEPTH를 움직여 보세요.',event:'fx'},
  {name:'손끝으로 스크래치',tag:'VINYL',body:'재생 중인 조그휠의 안쪽을 잡고 앞뒤로 돌려 보세요. 지금 흐르는 곡을 직접 긁습니다.',event:'scratch'}
];
export const MISSIONS = [
  {name:'첫 클럽 오프닝',subtitle:'두 하우스 트랙을 자연스럽게 연결하세요.',tracks:['house124','house128'],goal:'transition',seconds:180},
  {name:'베이스 릴레이',subtitle:'두 곡의 저음을 교대하고 B로 전환하세요.',tracks:['house128','dance128'],goal:'low',seconds:180},
  {name:'루프 빌더',subtitle:'4박 루프를 사용한 뒤 B로 전환하세요.',tracks:['dance128','dance132'],goal:'loop',seconds:180},
  {name:'에코 애프터글로우',subtitle:'Echo 효과를 사용해 A에서 B로 전환하세요.',tracks:['hiphop90','hiphop94'],goal:'fx',seconds:180}
];
