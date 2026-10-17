export const MAPS=['de_mirage','de_inferno','de_dust2','de_anubis','de_ancient','de_nuke','de_train'];
const steamId=id=>typeof id==='string'&&/^7656119\d{10}$/.test(id);
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const point=p=>p&&['x','y','z'].every(k=>finite(p[k])&&Math.abs(p[k])<32768);
const clonePoint=p=>({x:p.x,y:p.y,z:p.z});
const round6=n=>Math.round(n*1e6)/1e6;

export function validateMotion(rows,round){
    if(rows.some(r=>!r))return 'missing snapshot';
    for(const row of rows){
        if(!point(row.position)||![row.angles.pitch,row.angles.yaw,row.flash,row.duck,row.flags,row.round].every(finite))return 'missing or invalid state';
        if(row.warmup!==false||row.freeze!==false||!row.alive)return 'inactive player or round';
        if(row.round!==round)return 'round boundary';
        if(row.flash>0||row.duck>.05)return 'flash or crouch unsupported';
        if(!(row.flags&1))return 'airborne movement unsupported';
    }
    const heights=rows.map(r=>r.position.z);
    if(Math.max(...heights)-Math.min(...heights)>12)return 'vertical movement unsupported';
    return null;
}

export function buildDuel(death,hits,history,tickSeconds,lastRoundEnd=-Infinity){
    if(!steamId(death.victim)||!steamId(death.attacker)||death.victim===death.attacker||death.playerTeam===death.enemyTeam)return {reason:'world, self or team damage'};
    if(death.thrusmoke||death.penetrated||death.attackerblind||death.attackerinair||['hegrenade','inferno','world','knife','taser'].includes(death.weapon))return {reason:'smoke, penetration, utility or unsupported kill'};
    const relevant=hits.filter(h=>h.victim===death.victim&&h.attacker===death.attacker&&h.tick<=death.tick&&(death.tick-h.tick)*tickSeconds<=2).sort((a,b)=>a.tick-b.tick);
    if(!relevant.length)return {reason:'no damage timing'};
    let start=relevant.at(-1).tick;
    for(let i=relevant.length-2;i>=0;i--){if((start-relevant[i].tick)*tickSeconds>.75)break;start=relevant[i].tick;}
    const first=start-1-Math.round(.75/tickSeconds),last=death.tick-1;
    if(lastRoundEnd>=first&&lastRoundEnd<death.tick)return {reason:'round already ended'};
    const ticks=[];for(let t=first;t<=last;t+=2)ticks.push(t);if(ticks.at(-1)!==last)ticks.push(last);
    const players=ticks.map(t=>history.get(t)?.get(death.victim)),enemies=ticks.map(t=>history.get(t)?.get(death.attacker));
    const round=players[0]?.round;
    const reason=validateMotion(players,round)||validateMotion(enemies,round);
    if(reason)return {reason};
    const duration=round6((death.tick-start)*tickSeconds),lead=round6((start-1-first)*tickSeconds);
    const player=players[0],enemy=enemies[0];
    return {scenario:{id:0,round:round+1,start_tick:start,death_tick:death.tick,
        player:player.position,enemy:enemy.position,player_angles:player.angles,enemy_angles:enemy.angles,
        player_team:death.playerTeam,enemy_steam_id:death.attacker,enemy_weapon:death.weapon,
        player_weapon:player.weapon,observed_damage_to_death_s:duration,opponent_reaction_s:null,
        training_budget_s:round6(Math.max(.6,Math.min(2.5,duration+.6))+lead),replay_lead_s:lead,
        budget_basis:'Authored practice target: observed damage-to-death + 0.6s, clamped 0.6..2.5s, plus lead-in. NOT human reaction time.',
        enemy_path:ticks.map((tick,i)=>({t:round6((tick-first)*tickSeconds),position:enemies[i].position,angles:enemies[i].angles})),
        validation:'requires in-game collision and visibility checks'}};
}

function snapshot(player,rules){
    const props=player.pawn?.entity?.properties;
    if(!props||!rules?.entity||!player.position)return null;
    const angles=props['CCSPlayerPawn.m_angEyeAngles'];
    if(!Array.isArray(angles))return null;
    const rawRules=rules.entity.properties;
    return {position:clonePoint(player.position),angles:{pitch:angles[0],yaw:angles[1],roll:0},
        alive:props['CCSPlayerPawn.m_lifeState']===0,
        flash:props['CCSPlayerPawn.m_flFlashDuration'],
        duck:props['CCSPlayerPawn.CCSPlayer_MovementServices.m_flDuckAmount'],
        flags:props['CCSPlayerPawn.m_fFlags'],
        round:rawRules['CCSGameRulesProxy.CCSGameRules.m_totalRoundsPlayed'],
        warmup:rawRules['CCSGameRulesProxy.CCSGameRules.m_bWarmupPeriod'],
        freeze:rawRules['CCSGameRulesProxy.CCSGameRules.m_bFreezePeriod'],
        weapon:player.inventory?.activeItem?.name??null};
}

export async function analyzeDemo(DemoReader,EntityMode,input,{onProgress=()=>{},name='match.dem'}={}){
    const parser=new DemoReader(),history=new Map(),players=new Map(),results=new Map();
    let header,tickSeconds,lastRoundEnd=-Infinity,hits=[];
    parser.on('header',h=>{header=h;if(!MAPS.includes(h.map_name))throw new Error('This map is not supported yet.');});
    parser.on('serverinfo',info=>{if(finite(info.tick_interval)&&info.tick_interval>0&&info.tick_interval<.1)tickSeconds=info.tick_interval;});
    parser.on('progress',onProgress);
    parser.on('tickend',tick=>{
        if(!tickSeconds)return;
        const frame=new Map();
        for(const player of parser.playerControllers){
            if(!steamId(player.steamId)||player.isBot||player.isHLTV)continue;
            players.set(player.steamId,{steam_id:player.steamId,name:player.name,team:player.teamNumber});
            const sample=snapshot(player,parser.gameRules);if(sample)frame.set(player.steamId,sample);
        }
        history.set(tick,frame);
        for(const oldTick of history.keys()){if((tick-oldTick)*tickSeconds>4)history.delete(oldTick);else break;}
        hits=hits.filter(hit=>(tick-hit.tick)*tickSeconds<=3);
    });
    parser.gameEvents.on('round_end',()=>{lastRoundEnd=parser.currentTick;});
    parser.gameEvents.on('player_hurt',event=>hits.push({tick:parser.currentTick,attacker:event.attackerPlayer?.steamId,victim:event.player?.steamId}));
    parser.gameEvents.on('player_death',event=>{
        const victim=event.player,enemy=event.attackerPlayer;
        if(!victim||!steamId(victim.steamId))return;
        if(!tickSeconds)throw new Error('Cannot verify the demo tick rate.');
        if(!results.has(victim.steamId))results.set(victim.steamId,{total:0,scenarios:[],rejected:[]});
        const result=results.get(victim.steamId);result.total++;
        const death={tick:parser.currentTick,victim:victim.steamId,attacker:enemy?.steamId,playerTeam:victim.teamNumber,enemyTeam:enemy?.teamNumber,
            weapon:event.weapon,thrusmoke:event.thrusmoke,penetrated:event.penetrated,attackerblind:event.attackerblind,attackerinair:event.attackerinair};
        const duel=buildDuel(death,hits,history,tickSeconds,lastRoundEnd);
        if(duel.scenario&&result.scenarios.length<64){duel.scenario.id=result.total;result.scenarios.push(duel.scenario);}
        else result.rejected.push({id:result.total,round:(parser.gameRules?.roundsPlayed??0)+1,reason:duel.reason??'64-duel export limit'});
    });
    const outcome=await parser.parseDemo(input,{entities:EntityMode.ALL});
    if(outcome.status!=='complete')throw new Error('The demo is incomplete. Download the full file and try again.');
    if(!header||!tickSeconds||!players.size)throw new Error('No supported match data was found in this demo.');
    return {map:header.map_name,tick_seconds:tickSeconds,demo:name,players:[...players.values()],results:Object.fromEntries(results)};
}

export function planForPlayer(match,id){
    const player=match.players.find(p=>p.steam_id===id);if(!player)throw new Error('Choose a player from this match.');
    const result=match.results[id]??{total:0,scenarios:[],rejected:[]};
    return {schema:2,steam_id:id,player_name:player.name,map:match.map,demo:match.demo,sha256:match.sha256??null,
        parser:'cs2parser 2.7.2',tick_seconds:match.tick_seconds,total_player_deaths:result.total,
        scenarios:result.scenarios,rejected_scenarios:result.rejected,
        limitations:['Recorded positions and sampled opponent movement; standard weapon/health baseline.',
        'Practice time target is not measured opponent reaction time.','Smoke, wallbangs, flash, crouch and airborne scenarios are excluded.',
        'Collision and visibility checks run in-game; map geometry may have changed.',
        'Experimental personal-training addon required; published Workshop integration is not complete.']};
}
