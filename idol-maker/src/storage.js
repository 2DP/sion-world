const PREFIX='idol-maker:slot:';
export const SLOT_COUNT=10;
const clone=x=>JSON.parse(JSON.stringify(x));
export function createStore(storage,validate=()=>true,{writerId=`tab-${Math.random().toString(36).slice(2)}`,locks=globalThis.navigator?.locks}={}) {
  function checkSlot(slot){if(!Number.isInteger(slot)||slot<1||slot>SLOT_COUNT)throw new Error('저장 칸을 다시 골라 주세요.');}
  function read(slot) {
    checkSlot(slot);
    try {
      const raw=storage.getItem(PREFIX+slot);
      if(!raw)return {slot,empty:true,revision:0};
      const data=JSON.parse(raw);
      if(data.version!==1||!Number.isInteger(data.revision)||data.revision<1)throw Error('저장 형식을 읽을 수 없어요.');
      const snapshot=data.snapshot&&validate(data.snapshot)?data.snapshot:null;
      const recovery=data.recovery&&validate(data.recovery)?data.recovery:null;
      if(!snapshot&&!recovery)throw Error('저장 내용이 손상되었어요.');
      return {...data,slot,snapshot,recovery,state:recovery||snapshot,damaged:!!((data.snapshot&&!snapshot)||(data.recovery&&!recovery))};
    }catch(error){return {slot,error:error.message,revision:null};}
  }
  async function write(slot,state,{kind='recovery',expectedRevision=0,overwrite=false}={}) {
    checkSlot(slot);
    const action=()=>{
      if(!validate(state))return {ok:false,error:'현재 기록을 확인하지 못해 저장하지 않았어요.'};
      const previous=read(slot);
      if(previous.error&&!overwrite)return {ok:false,error:'읽을 수 없는 기록을 보존했어요. 다른 칸을 골라 주세요.'};
      if(!previous.error&&previous.revision!==expectedRevision)return {ok:false,conflict:true,error:'다른 창에서 이 기록이 바뀌었어요. 최신 기록을 불러오거나 다른 칸에 저장해 주세요.'};
      if(previous.state&&previous.state.id!==state.id&&!overwrite)return {ok:false,error:'다른 아이돌의 기록이에요. 덮어쓰기를 먼저 확인해 주세요.'};
      const now=new Date().toISOString();
      const record={version:1,revision:(previous.revision||0)+1,writerId,updatedAt:now,savedAt:previous.savedAt||null,snapshot:previous.snapshot||null,recovery:null};
      if(overwrite&&previous.state?.id!==state.id){record.snapshot=null;record.savedAt=null;}
      if(kind==='recovery')record.recovery=clone(state);
      else {record.snapshot=clone(state);record.savedAt=now;}
      try {storage.setItem(PREFIX+slot,JSON.stringify(record));return {ok:true,revision:record.revision,savedAt:now};}
      catch {return {ok:false,error:'이 기기에 저장하지 못했어요. 저장 공간이나 브라우저 설정을 확인하고 다시 시도해 주세요.'};}
    };
    if(locks?.request)return locks.request(PREFIX+slot,{mode:'exclusive'},action);
    return action();
  }
  return {read,list:()=>Array.from({length:SLOT_COUNT},(_,i)=>read(i+1)),write,key:slot=>PREFIX+slot};
}
