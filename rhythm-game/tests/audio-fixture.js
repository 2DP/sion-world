(function(){
  window.qaTime=0; window.qaClock=0;
  Starbeat.Audio=class {
    constructor(){this.ctx={state:'running',get currentTime(){return window.qaClock;}};}
    async unlock(){} volume(){} async prepare(){} stop(){} tick(){} hit(){}
    play(position){window.qaTime=position;} pause(){return window.qaTime;} time(){return window.qaTime;}
  };
})();
