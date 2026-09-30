import test from "node:test";
import assert from "node:assert/strict";
import { composerKey,readComposer,saveComposer,readDemo,saveDemo,DEMO_STORAGE_KEY,type Composer } from "../src/lib/ai/persistence";
import { createDemoTransport,DEMO_SEED } from "../src/lib/ai/demo";
import { transition,initialState } from "../src/lib/ai/flow";
import { messagesForTransition } from "../src/lib/ai/messages";
const fixture:Composer={seed:DEMO_SEED,mode:"explore",format:"basic",useResearch:false,sessionId:null,revision:null,choices:["option1","other"],custom:"나중에 다시 생각할 내용",feedback:"문장 요청",focusDirection:"관심 기능"};
function storage(){const values=new Map<string,string>();return {getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}};}
test("typed memo and unsubmitted multiselect answers survive reload and remain scoped to a user",()=>{
  const store=storage();assert.equal(saveComposer(store,composerKey("alice"),fixture),true);
  assert.deepEqual(readComposer(store,composerKey("alice")),fixture);
  assert.equal(readComposer(store,composerKey("bob")),null);
  store.setItem(composerKey("alice"),"broken");assert.equal(readComposer(store,composerKey("alice")),null);
  assert.equal(saveComposer({getItem:()=>null,setItem:()=>{throw new Error("quota");}},"key",fixture),false);
});
test("preview restores a stored conversation and can continue it without losing the original exploration",async()=>{
  const store=storage();let persisted;
  const first=createDemoTransport([], (sessions,lastId)=>{saveDemo(store,sessions,lastId);});
  const session=await first({action:"start",seed:DEMO_SEED,mode:"explore",format:"basic",useResearch:false});
  const answered=await first({action:"answer",id:session.id,revision:session.revision,choices:["option1","option2"],custom:""});
  persisted=readDemo(store);assert.equal(persisted.lastId,answered.id);assert.equal(persisted.sessions[0].state.answers.length,1);
  const restored=createDemoTransport(persisted.sessions);
  const continued=await restored({action:"answer",id:answered.id,revision:answered.revision,choices:["option1","other"],custom:"추가 아이디어"});
  assert.equal(continued.state.answers.length,2);assert.equal(continued.revision,answered.revision+1);
  store.setItem(DEMO_STORAGE_KEY,'{"sessions":[{}],"lastId":null}');assert.equal(readDemo(store).sessions.length,0);
});
test("a failed first AI response leaves a resumable memo, and transcript includes all offered choices",async()=>{
  const request={action:"start" as const,seed:DEMO_SEED,mode:"explore" as const,format:"basic" as const,useResearch:false};
  const saved=initialState(request);
  const deps={askQuestion:async()=>{throw new Error("provider offline");},makeDraft:async()=>{throw new Error("not reached");},researchIdea:async()=>({text:"",citations:[],resources:[]})};
  await assert.rejects(transition(saved,{action:"resume",id:"10000000-0000-4000-8000-000000000001",revision:0},deps),/provider offline/);
  assert.equal(saved.seed,DEMO_SEED);assert.equal(saved.question,null);
  const q={topic:"goal" as const,prompt:"어떤 가능성을 더 펼쳐볼까요?",reason:"생각을 확인하려고 물어봐요.",multiple:true,options:[{id:"option1",label:"가능성 A",detail:"자세한 설명"},{id:"option2",label:"가능성 B",detail:"다른 설명"},{id:"option3",label:"미정",detail:""}]};
  const next=await transition(saved,{action:"resume",id:"10000000-0000-4000-8000-000000000001",revision:0},{...deps,askQuestion:async()=>q});
  assert.deepEqual(messagesForTransition(saved,next,request),[{role:"user",text:DEMO_SEED},{role:"assistant",text:q.prompt,payload:{question:q}}]);
});
