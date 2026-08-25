import {createHmac,timingSafeEqual} from 'node:crypto';
import type {NextFunction,Request,Response} from 'express';

const COOKIE_NAME='techtree_session';
const ONE_WEEK_SECONDS=60*60*24*7;

function sign(value:string,secret:string){
 return createHmac('sha256',secret).update(value).digest('base64url');
}

function equal(a:string,b:string){
 const left=Buffer.from(a);
 const right=Buffer.from(b);
 return left.length===right.length&&timingSafeEqual(left,right);
}

export function createSessionToken(secret:string,now=Date.now()){
 const expires=Math.floor(now/1000)+ONE_WEEK_SECONDS;
 const payload=`v1.${expires}`;
 return `${payload}.${sign(payload,secret)}`;
}

export function verifySessionToken(token:string|undefined,secret:string,now=Date.now()){
 if(!token)return false;
 const parts=token.split('.');
 if(parts.length!==3||parts[0]!=='v1')return false;
 const payload=`${parts[0]}.${parts[1]}`;
 const expires=Number(parts[1]);
 if(!Number.isFinite(expires)||expires<Math.floor(now/1000))return false;
 return equal(parts[2],sign(payload,secret));
}

export function passwordMatches(input:string,expected:string){
 return equal(createHmac('sha256','password').update(input).digest('hex'),createHmac('sha256','password').update(expected).digest('hex'));
}

export function setSessionCookie(response:Response,secret:string,secure:boolean){
 response.cookie(COOKIE_NAME,createSessionToken(secret),{
  httpOnly:true,
  secure,
  sameSite:'lax',
  maxAge:ONE_WEEK_SECONDS*1000,
  path:'/',
 });
}

export function clearSessionCookie(response:Response,secure:boolean){
 response.clearCookie(COOKIE_NAME,{httpOnly:true,secure,sameSite:'lax',path:'/'});
}

export function requireAuth(secret:string){
 return (request:Request,response:Response,next:NextFunction)=>{
  if(verifySessionToken(request.cookies?.[COOKIE_NAME],secret))return next();
  response.status(401).json({error:'unauthorized',message:'Authentication required.'});
 };
}

export function isAuthenticated(request:Request,secret:string){
 return verifySessionToken(request.cookies?.[COOKIE_NAME],secret);
}
