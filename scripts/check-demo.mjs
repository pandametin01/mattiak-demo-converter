import fs from 'node:fs';
import {DemoReader,EntityMode} from 'cs2parser';
import {analyzeDemo,planForPlayer} from '../src/analyzer.mjs';
import {encodeCfg,trainingZip} from '../src/transport.mjs';
const started=Date.now();
const match=await analyzeDemo(DemoReader,EntityMode,process.argv[2]);
const plan=planForPlayer(match,process.argv[3]);
fs.mkdirSync('output',{recursive:true});fs.writeFileSync('output/training.json',JSON.stringify(plan,null,2));
console.log(JSON.stringify({seconds:(Date.now()-started)/1000,map:match.map,players:match.players.length,deaths:plan.total_player_deaths,duels:plan.scenarios.length,excluded:plan.rejected_scenarios},null,2));
if(plan.scenarios.length){fs.writeFileSync('output/mattiak_training.cfg',encodeCfg(plan));fs.writeFileSync('output/mattiak_training.zip',trainingZip(plan));}
