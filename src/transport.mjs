import {zipSync,strToU8} from 'fflate';
export function encodeCfg(plan){
    if(plan.schema!==2||!plan.scenarios.length||plan.scenarios.length>64)throw new Error('No supported practice scenarios to export.');
    const keys=['id','round','player','enemy','player_angles','enemy_angles','training_budget_s','enemy_path'];
    const data={schema:2,map:plan.map,steam_id:plan.steam_id,scenarios:plan.scenarios.map(s=>Object.fromEntries(keys.filter(k=>k in s).map(k=>[k,s[k]])))};
    const text=JSON.stringify(data).replace(/[\u007f-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
    if(text.length>262144)throw new Error('The training file is too large. Choose a shorter demo.');
    let hash=2166136261;for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619)>>>0;
    const lines=['// Mattiak personal training. Experimental offline import runtime required.',`personal_import_begin 1 ${text.length} ${hash.toString(16).padStart(8,'0')}`];
    for(let i=0;i<text.length;i+=160){let hex='';for(const c of text.slice(i,i+160))hex+=c.charCodeAt(0).toString(16).padStart(2,'0');lines.push(`personal_import_chunk ${i/160} ${hex}`);}
    lines.push('personal_import_end');return lines.join('\r\n')+'\r\n';
}
export function trainingZip(plan){
    const readme=`MATTIAK PERSONAL TRAINING - EXPERIMENTAL\n\nMap: ${plan.map}\nDuels: ${plan.scenarios.length}\n\nREQUIRES the experimental mattiak_personal addon with personal_loader.vjs.\nThe current published Workshop map does not support this import yet.\n\n1. Copy mattiak_training.cfg into Counter-Strike Global Offensive/game/csgo/cfg/.\n2. In local Tools with addon mattiak_personal, load: map ${plan.map}\n3. After loading: exec mattiak_personal_loader\n4. Import: exec mattiak_training\n5. Join CT, then personal_rehearse (no timer) or personal_start.\n   personal_next changes duel; personal_stop stops.\n\nUse only in local offline practice. Re-import after restarting the map.\nThis file imports data, not executable JavaScript. It does not update your aim ratings.\nMovement is sampled, and the time budget is a practice target, not human reaction time.\nThe trainer uses a standard weapon/health baseline and checks current map geometry.\n`;
    return zipSync({'mattiak_training.cfg':strToU8(encodeCfg(plan)),'training.json':strToU8(JSON.stringify(plan,null,2)),'READ_ME.txt':strToU8(readme)});
}
