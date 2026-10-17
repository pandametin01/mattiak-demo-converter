import {planForPlayer} from './analyzer.mjs';
import {trainingZip} from './transport.mjs';
const el=id=>document.getElementById(id);
let worker=null,match=null,selected=null,urls=[],deadline;
const stateText={downloading:'Downloading demo',unpacking:'Unpacking the demo',analyzing:'Reading positions and duels'};
function error(message){el('error').textContent=message;el('error').hidden=false;}
function step(n){['link','player','ready'].forEach((id,i)=>{el('step-'+id).classList.toggle('active',i===n);el('step-'+id).classList.toggle('done',i<n);});}
function savedPlayer(){try{return localStorage.getItem('mattiak-player');}catch{return null;}}
function remember(id){try{localStorage.setItem('mattiak-player',id);}catch{}}
function busy(value){el('analyze-button').disabled=value;el('demo-url').disabled=value;el('demo-file').disabled=value;el('cancel').hidden=!value;}
function stop(){worker?.terminate();worker=null;clearTimeout(deadline);busy(false);el('progress').hidden=true;}
function choose(id){selected=id;document.querySelectorAll('.player').forEach(b=>b.setAttribute('aria-checked',String(b.dataset.steamId===id)));el('convert-button').disabled=!id;}
function players(){
    el('players').replaceChildren();el('players-section').hidden=false;step(1);el('map-chip').textContent=match.map.replace('de_','');
    el('players').setAttribute('role','radiogroup');el('players').setAttribute('aria-label','Select your player');
    for(const player of match.players){
        const button=document.createElement('button');button.className='player';button.type='button';button.dataset.steamId=player.steam_id;button.setAttribute('role','radio');button.setAttribute('aria-checked','false');
        const radio=document.createElement('span');radio.className='radio';radio.setAttribute('aria-hidden','true');
        const text=document.createElement('span'),name=document.createElement('strong'),id=document.createElement('small');name.textContent=player.name;id.textContent=player.steam_id;text.append(name,id);button.append(radio,text);button.addEventListener('click',()=>choose(player.steam_id));
        button.addEventListener('keydown',event=>{if(!['ArrowDown','ArrowRight','ArrowUp','ArrowLeft'].includes(event.key))return;event.preventDefault();const buttons=[...el('players').children],index=buttons.indexOf(button),d=['ArrowDown','ArrowRight'].includes(event.key)?1:-1,next=buttons[(index+d+buttons.length)%buttons.length];choose(next.dataset.steamId);next.focus();});
        el('players').append(button);
    }
    choose(match.players.some(p=>p.steam_id===savedPlayer())?savedPlayer():null);
    el('converter-title').textContent='Match found. Choose your player.';document.querySelector('.converter').classList.add('finished');
}
function begin(payload){
    stop();match=null;selected=null;for(const url of urls)URL.revokeObjectURL(url);urls=[];
    busy(true);step(0);document.querySelector('.converter').classList.remove('finished');el('error').hidden=true;el('players-section').hidden=true;el('result').hidden=true;el('empty-state').hidden=true;
    el('progress').hidden=false;el('progress-title').textContent=payload.file?'Reading your demo':'Connecting to the replay server';el('progress-detail').textContent='';el('progress-bar').removeAttribute('value');
    worker=new Worker('/worker.js',{type:'module'});
    deadline=setTimeout(()=>{stop();error('Processing exceeded 10 minutes. Try a smaller demo on a desktop browser.');},600000);
    worker.onmessage=event=>{const data=event.data;
        if(data.type==='progress'){el('progress-title').textContent=stateText[data.stage];el('progress-detail').textContent=data.received?`${(data.received/1048576).toFixed(1)} MB`:'';if(data.total){el('progress-bar').max=data.total;el('progress-bar').value=data.received;}else el('progress-bar').removeAttribute('value');}
        if(data.type==='complete'){match=data.match;stop();players();}
        if(data.type==='error'){stop();error(data.message);}
    };
    worker.onerror=()=>{stop();error('The browser could not process this demo. Try a desktop browser or a smaller file.');};
    worker.postMessage(payload);
}
function linkBlob(id,blob){const url=URL.createObjectURL(blob);urls.push(url);el(id).href=url;}
el('demo-form').addEventListener('submit',e=>{e.preventDefault();begin({url:el('demo-url').value.trim()});});
el('demo-file').addEventListener('change',()=>{const file=el('demo-file').files[0];if(!file)return;if(file.size>512*1024*1024){error('Choose a file smaller than 512 MB.');return;}begin({file});});
el('cancel').addEventListener('click',()=>{stop();el('empty-state').hidden=false;});
el('convert-button').addEventListener('click',()=>{
    if(!match||!selected)return;
    try{
        const plan=planForPlayer(match,selected);remember(selected);const count=plan.scenarios.length;
        if(count)linkBlob('download',new Blob([trainingZip(plan)],{type:'application/zip'}));
        linkBlob('report',new Blob([JSON.stringify(plan,null,2)],{type:'application/json'}));
        el('download').download='mattiak_training.zip';el('report').download='training.json';
        step(2);el('error').hidden=true;el('players-section').hidden=true;el('result').hidden=false;el('download').hidden=!count;
        el('converter-title').textContent='Your match, converted.';el('result-title').textContent=count?'Your practice file is ready':'No supported duels in this demo';
        el('result-player').textContent=plan.player_name;el('duel-count').textContent=count;el('death-count').textContent=plan.total_player_deaths;el('result-map').textContent=plan.map.replace('de_','');
        el('result-detail').textContent=`${count} eligible situations from ${plan.total_player_deaths} recorded deaths. Unsupported situations are omitted.`;
        el('rounds').replaceChildren();for(const s of plan.scenarios){const chip=document.createElement('span');chip.textContent='Round '+s.round;el('rounds').append(chip);}
        el('excluded').replaceChildren();for(const reason of new Set(plan.rejected_scenarios.map(s=>s.reason))){const li=document.createElement('li');li.textContent='Excluded: '+reason;el('excluded').append(li);}
    }catch(e){error(e.message);}
});
el('another-player').addEventListener('click',()=>{el('result').hidden=true;el('players-section').hidden=false;step(1);});
