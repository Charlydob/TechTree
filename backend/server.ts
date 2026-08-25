import {createApp} from './app';
import {PgRunbookStore} from './db';

function requireEnv(name:string){
 const value=process.env[name];
 if(!value)throw new Error(`${name} is required`);
 return value;
}

const port=Number(process.env.PORT??3003);
const store=new PgRunbookStore();
await store.migrate();

const app=createApp({
 store,
 appPassword:requireEnv('APP_PASSWORD'),
 sessionSecret:requireEnv('SESSION_SECRET'),
});

const server=app.listen(port,'0.0.0.0',()=>{
 console.log(`TechTree API listening on ${port}`);
});

const shutdown=async()=>{
 server.close();
 await store.close();
 process.exit(0);
};

process.on('SIGINT',()=>void shutdown());
process.on('SIGTERM',()=>void shutdown());
