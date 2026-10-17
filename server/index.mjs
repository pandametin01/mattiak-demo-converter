import {handleDemoRequest} from '../functions/api/demo.js';

export default {
    async fetch(request, env) {
        const {pathname} = new URL(request.url);
        if (pathname === '/api/demo') return handleDemoRequest(request);
        if (pathname === '/api' || pathname.startsWith('/api/')) {
            return Response.json({error:'Not found.'}, {
                status:404,
                headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},
            });
        }
        return env.ASSETS.fetch(request);
    },
};
