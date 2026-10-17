// Loaded only in a local practice server, via the generated experimental cfg.
import { Instance } from 'cs_script/point_script';
// __PLAN__
let index=0, phase='idle', player, bot, at=0, score=0, attempts=0, message='personal_start to begin', rehearsal=false;
let replayAt=0, lastBotPosition, seen=false;
const now=()=>Instance.GetGameTime();
// __IMPORTER__

const raised=p=>({...p,z:p.z+2});
function pathSample(path,t){
    const last=path[path.length-1];
    if(t>=last.t)return last;
    for(let i=1;i<path.length;i++){
        if(t<=path[i].t){
            const a=path[i-1],b=path[i],f=Math.max(0,(t-a.t)/(b.t-a.t));
            const position={};for(const k of ['x','y','z'])position[k]=a.position[k]+(b.position[k]-a.position[k])*f;
            const yawDelta=((b.angles.yaw-a.angles.yaw+540)%360)-180;
            return {position,angles:{pitch:a.angles.pitch+(b.angles.pitch-a.angles.pitch)*f,yaw:a.angles.yaw+yawDelta*f,roll:0}};
        }
    }
    return path[0];
}
function moveOpponent(path,t){
    const sample=pathSample(path,t),next=raised(sample.position);
    const trace=Instance.TracePlayer({start:lastBotPosition,end:next,player:bot,isDucked:false});
    if(trace.startedInSolid||trace.didHit){phase='idle';message='Replay obstructed: skipped without score';return;}
    bot.Teleport({position:next,angles:sample.angles,velocity:{x:0,y:0,z:0}});
    lastBotPosition=next;
}

function findPlayers(){
    const controllers=Instance.GetAllPlayerControllers().filter(c=>c.IsConnected());
    player=controllers.find(c=>!c.IsBot())?.GetPlayerPawn();
    bot=controllers.find(c=>c.IsBot())?.GetPlayerPawn();
    return player?.IsAlive() && bot?.IsAlive();
}
function start(){
    phase='idle';
    if(!PLAN){message='Import a training file first: exec mattiak_training';return;}
    if(Instance.GetMapName()!==PLAN.map){ message='Wrong map: load '+PLAN.map;return; }
    if(!findPlayers()){message='Join CT and wait for the practice bot, then personal_start';return;}
    const s=PLAN.scenarios[index];
    if(!s){message='No scenarios';return;}
    for(const [pawn,pos] of [[player,s.player],[bot,s.enemy]]){
        if(Instance.TracePlayer({start:{...pos,z:pos.z+2},player:pawn}).startedInSolid){
            phase='idle';message='Position blocked: personal_next to skip';return;
        }
    }
    if(s.enemy_path){
        for(let i=1;i<s.enemy_path.length;i++){
            const trace=Instance.TracePlayer({start:raised(s.enemy_path[i-1].position),end:raised(s.enemy_path[i].position),player:bot,isDucked:false});
            if(trace.startedInSolid||trace.didHit){message='Recorded path blocked: personal_next to skip';return;}
        }
    }
    lastBotPosition=raised(s.enemy);seen=false;
    player.Teleport({position:{...s.player,z:s.player.z+2},angles:s.player_angles,velocity:{x:0,y:0,z:0}});
    bot.Teleport({position:{...s.enemy,z:s.enemy.z+2},angles:s.enemy_angles,velocity:{x:0,y:0,z:0}});
    player.SetHealth(100);bot.SetHealth(100);
    if(!player.FindWeapon('weapon_ak47'))player.GiveNamedItem('weapon_ak47',true);
    const weapon=player.FindWeapon('weapon_ak47');
    if(weapon){player.SwitchToWeapon(weapon);weapon.SetClipAmmo(30);weapon.SetReserveAmmo(90);}
    // Equal weapon/health baseline is deliberate; no claim of a complete replay.
    phase='ready';at=now()+2;message='GET READY';
    Instance.Msg('[PERSONAL] positioned scenario '+s.id+' round '+s.round);
}
function finish(success){
    if(!rehearsal){attempts++;if(success)score++;}
    phase='idle';message=(success?'SUCCESS':'TIME LIMIT')+' --- personal_start retry / personal_next next';
    Instance.Msg('[PERSONAL] result '+JSON.stringify({id:PLAN.scenarios[index].id,success,rehearsal,score,attempts}));
}
Instance.RegisterCheatCommand('personal_start',()=>{rehearsal=false;start();});
Instance.RegisterCheatCommand('personal_rehearse',()=>{rehearsal=true;start();});
Instance.RegisterCheatCommand('personal_next',()=>{if(PLAN)index=(index+1)%PLAN.scenarios.length;start();});
Instance.RegisterCheatCommand('personal_stop',()=>{phase='idle';message='Stopped';});
Instance.OnModifyPlayerDamage(e=>{
    if(e.player===bot && (phase!=='live'||e.attacker!==player))return {abort:true};
    if(e.player===player)return {abort:true}; // Timed drill, not an AI opponent simulation.
});
Instance.OnPlayerKill(e=>{if(e.player===bot&&phase==='live')finish(true);});
Instance.SetThink(()=>{
    const t=now(), s=PLAN?.scenarios[index];
    if(phase==='ready'&&t>=at){
        const hit=Instance.TraceLine({start:player.GetEyePosition(),end:bot.GetEyePosition(),ignoreEntity:[player,bot]});
        if(hit.didHit&&!s.enemy_path){phase='idle';message='Occluded duel: personal_next to skip';}
        else {phase='live';replayAt=t;at=t+s.training_budget_s;message='GO';}
    }
    if(phase==='live'){
        if(!player?.IsAlive()||!bot?.IsAlive()){phase='idle';message='Player unavailable: retry';}
        else {
            if(s.enemy_path)moveOpponent(s.enemy_path,t-replayAt);
            if(!Instance.TraceLine({start:player.GetEyePosition(),end:bot.GetEyePosition(),ignoreEntity:[player,bot]}).didHit)seen=true;
            if(phase==='live'&&!rehearsal&&t>=at){
                if(seen)finish(false);else{phase='idle';message='No visible target: skipped without score';}
            }
        }
    }
    Instance.DebugScreenText({text:PLAN?'PERSONAL TRAINING | '+PLAN.map+' | '+(index+1)+'/'+PLAN.scenarios.length+' | '+score+'/'+attempts:'PERSONAL TRAINING | IMPORT A TRAINING FILE',
        x:380,y:160,duration:.12,color:{r:255,g:255,b:255}});
    Instance.DebugScreenText({text:message+(phase==='live'?(rehearsal?' - REHEARSAL / NO SCORE':' '+Math.max(0,at-t).toFixed(2)+'s'):''),
        x:380,y:190,duration:.12,color:{r:255,g:210,b:90}});
    Instance.SetNextThink(t+.05);
});
Instance.SetNextThink(now()+.1);
Instance.Msg(PLAN?'[PERSONAL] runtime loaded: '+PLAN.map+' / '+PLAN.scenarios.length+' scenarios':'[PERSONAL] generic import runtime loaded');
