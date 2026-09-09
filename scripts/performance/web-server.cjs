const path=require('node:path');
const fs=require('node:fs');
const root=path.resolve(__dirname,'../..');
const req=require('node:module').createRequire(`${root}/apps/web/package.json`);
(async()=>{
 const {createServer}=req('vite');
 const react=req('@vitejs/plugin-react').default;
 const tailwind=req('@tailwindcss/vite').default;
 const poster=fs.readFileSync(`${root}/apps/mobile/assets/images/icon.png`);
 const server=await createServer({configFile:false,envDir:false,root:`${__dirname}/web`,plugins:[react(),tailwind(),{name:'fixture-poster',configureServer(server){server.middlewares.use((req,res,next)=>{if(!req.url.startsWith('/poster.png'))return next();res.setHeader('Content-Type','image/png');res.setHeader('Cache-Control','public, max-age=3600');res.end(poster);});}}],resolve:{alias:[{find:'#/integrations/posthog/provider',replacement:`${__dirname}/web/posthog.ts`},{find:'#',replacement:`${root}/apps/web/src`},{find:'react',replacement:path.dirname(req.resolve('react/package.json'))},{find:'react-dom',replacement:path.dirname(req.resolve('react-dom/package.json'))},{find:'@tanstack/react-router',replacement:path.dirname(req.resolve('@tanstack/react-router/package.json'))}]},server:{host:'127.0.0.1',port:4400,fs:{allow:[root]}}});
 await server.listen(); console.log('Performance fixture: http://127.0.0.1:4400');
})();
