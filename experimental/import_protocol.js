// Bounded, transactional data import. Downloaded files contain data, never script code.
function installPlanImporter(instance, commit) {
    const limit = 262144;
    let pending = null;
    const fail = reason => { pending = null; instance.Msg('[PERSONAL IMPORT] rejected: ' + reason); };
    const number = (n, min, max) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
    const position = p => p && ['x','y','z'].every(k => number(p[k], -32768, 32768));
    const angles = a => a && number(a.pitch, -90, 90) && number(a.yaw, -720, 720) && a.roll === 0;
    function validate(plan) {
        const maps = ['de_mirage','de_inferno','de_dust2','de_anubis','de_ancient','de_nuke','de_train'];
        if (!plan || plan.schema !== 2 || !maps.includes(plan.map) || !/^7656119\d{10}$/.test(plan.steam_id)) return false;
        if (!Array.isArray(plan.scenarios) || !plan.scenarios.length || plan.scenarios.length > 64) return false;
        const ids = new Set();
        return plan.scenarios.every(s => {
            if (!s || !Number.isInteger(s.id) || s.id < 1 || ids.has(s.id) || !Number.isInteger(s.round) || s.round < 1) return false;
            ids.add(s.id);
            if (!position(s.player) || !position(s.enemy) || !angles(s.player_angles) || !angles(s.enemy_angles)) return false;
            if (!number(s.training_budget_s, .1, 10)) return false;
            if (s.enemy_path === undefined) return true;
            if (!Array.isArray(s.enemy_path) || s.enemy_path.length < 2 || s.enemy_path.length > 512) return false;
            let previous = -1;
            return s.enemy_path.every((p, i) => {
                if (!p || !number(p.t, 0, 10) || p.t <= previous || (i === 0 && p.t !== 0) || !position(p.position) || !angles(p.angles)) return false;
                previous = p.t;
                return true;
            });
        });
    }
    instance.RegisterCheatCommand('personal_import_begin', raw => {
        const match = String(raw).trim().match(/^1 ([1-9]\d{0,5}) ([0-9a-f]{8})$/);
        if (!match || Number(match[1]) > limit) return fail('invalid header');
        pending = {size:Number(match[1]), hash:match[2], chunks:[], length:0, next:0, deadline:instance.GetGameTime()+60};
    });
    instance.RegisterCheatCommand('personal_import_chunk', raw => {
        if (!pending) return;
        const match = String(raw).trim().match(/^(\d{1,4}) ([0-9a-f]{2,640})$/);
        if (!match || match[2].length % 2 || Number(match[1]) !== pending.next || instance.GetGameTime() > pending.deadline) return fail('missing or invalid chunk');
        let text = '';
        for (let i=0;i<match[2].length;i+=2) {
            const n=parseInt(match[2].slice(i,i+2),16);
            if (n < 32 || n > 126) return fail('non-ASCII payload');
            text+=String.fromCharCode(n);
        }
        if (pending.length + text.length > pending.size) return fail('size exceeded');
        pending.chunks.push(text); pending.length+=text.length; pending.next++;
    });
    instance.RegisterCheatCommand('personal_import_end', () => {
        if (!pending) return;
        if (pending.length !== pending.size || instance.GetGameTime() > pending.deadline) return fail('incomplete import');
        const text=pending.chunks.join('');
        let hash=2166136261;
        for(let i=0;i<text.length;i++) hash=Math.imul(hash ^ text.charCodeAt(i),16777619) >>> 0;
        if (hash.toString(16).padStart(8,'0') !== pending.hash) return fail('checksum mismatch');
        let plan;
        try { plan=JSON.parse(text); } catch { return fail('invalid JSON'); }
        if (!validate(plan)) return fail('unsupported training data');
        pending=null;
        commit(plan);
        instance.Msg('[PERSONAL IMPORT] ready: '+plan.map+' / '+plan.scenarios.length+' scenarios');
    });
}
